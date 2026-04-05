/**
 * HTTP→stdio proxy for official MCP SDK servers.
 *
 * Spawns the official SDK server as a child process communicating over stdio,
 * then exposes HTTP endpoints:
 *   GET  /health → {"status":"ok"}
 *   POST /mcp    → forwards JSON-RPC to stdin, reads response from stdout
 *
 * Usage: node proxy.mjs <command> [args...]
 *   ENV PORT (default 3000)
 *
 * The child process must speak newline-delimited JSON-RPC over stdio.
 * Some SDKs (Swift) use content-length framing — the proxy handles both.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";

const PORT = parseInt(process.env.PORT || "3000", 10);
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node proxy.mjs <command> [args...]");
  process.exit(1);
}

const [cmd, ...cmdArgs] = args;

// Spawn the official SDK stdio server
const child = spawn(cmd, cmdArgs, {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONUNBUFFERED: "1" },
});

child.stderr.on("data", (d) => process.stderr.write(d));
child.on("exit", (code) => {
  console.error(`Child exited with code ${code}`);
  process.exit(code ?? 1);
});

// ── Buffered stdout reader ──────────────────────────────────────────────
// Handles both newline-delimited JSON and content-length framed protocols.

let stdoutBuf = "";
const pendingResolvers = []; // queue of {id, resolve}

child.stdout.on("data", (chunk) => {
  stdoutBuf += chunk.toString();
  drainBuffer();
});

function drainBuffer() {
  // Try content-length framing first
  while (true) {
    const clMatch = stdoutBuf.match(
      /^Content-Length:\s*(\d+)\r?\n(?:[^\r\n]+\r?\n)*\r?\n/
    );
    if (clMatch) {
      const headerLen = clMatch[0].length;
      const bodyLen = parseInt(clMatch[1], 10);
      if (stdoutBuf.length >= headerLen + bodyLen) {
        const body = stdoutBuf.slice(headerLen, headerLen + bodyLen);
        stdoutBuf = stdoutBuf.slice(headerLen + bodyLen);
        handleMessage(body);
        continue;
      }
      break; // wait for more data
    }

    // Try newline-delimited JSON
    const nlIdx = stdoutBuf.indexOf("\n");
    if (nlIdx === -1) break;
    const line = stdoutBuf.slice(0, nlIdx).trim();
    stdoutBuf = stdoutBuf.slice(nlIdx + 1);
    if (line.length > 0) {
      handleMessage(line);
    }
  }
}

function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    // Not valid JSON — skip (e.g. log noise)
    return;
  }

  // Only resolve pending requests for messages with an "id" field
  // (skip notifications like notifications/message)
  if (msg.id !== undefined && pendingResolvers.length > 0) {
    const entry = pendingResolvers.find((e) => e.id === msg.id);
    if (entry) {
      pendingResolvers.splice(pendingResolvers.indexOf(entry), 1);
      entry.resolve(msg);
      return;
    }
  }

  // If there's a pending resolver expecting any response (for initialize etc.)
  // and the message has an id, resolve the first one
  if (msg.id !== undefined && pendingResolvers.length > 0) {
    const entry = pendingResolvers.shift();
    entry.resolve(msg);
  }
}

function sendRequest(jsonRpc, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const entry = { id: jsonRpc.id, resolve };
    pendingResolvers.push(entry);

    const timer = setTimeout(() => {
      const idx = pendingResolvers.indexOf(entry);
      if (idx !== -1) pendingResolvers.splice(idx, 1);
      reject(new Error(`Timeout waiting for response to id=${jsonRpc.id}`));
    }, timeoutMs);

    entry.resolve = (msg) => {
      clearTimeout(timer);
      resolve(msg);
    };

    // Write as newline-delimited JSON (most SDKs)
    // Some SDKs expect content-length framing — detect from env
    const payload = JSON.stringify(jsonRpc);
    if (process.env.USE_CONTENT_LENGTH === "1") {
      const buf = Buffer.from(payload, "utf-8");
      child.stdin.write(
        `Content-Length: ${buf.length}\r\n\r\n${payload}`,
        "utf-8"
      );
    } else {
      child.stdin.write(payload + "\n", "utf-8");
    }
  });
}

// ── Initialize the MCP session ──────────────────────────────────────────
// We must send initialize + initialized before the server accepts tool calls.

let initialized = false;
let initPromise = null;

async function ensureInitialized() {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = doInitialize();
  return initPromise;
}

async function doInitialize() {
  const initResp = await sendRequest({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "http-proxy", version: "1.0.0" },
    },
  });

  // Send initialized notification (no id, no response expected)
  const notif = JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  if (process.env.USE_CONTENT_LENGTH === "1") {
    const buf = Buffer.from(notif, "utf-8");
    child.stdin.write(
      `Content-Length: ${buf.length}\r\n\r\n${notif}`,
      "utf-8"
    );
  } else {
    child.stdin.write(notif + "\n", "utf-8");
  }

  initialized = true;
}

// ── HTTP Server ─────────────────────────────────────────────────────────

let nextId = 1;

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"status":"ok"}');
    return;
  }

  if (req.method === "POST" && req.url === "/mcp") {
    let body = "";
    for await (const chunk of req) body += chunk;

    let jsonRpc;
    try {
      jsonRpc = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"Invalid JSON"}');
      return;
    }

    try {
      await ensureInitialized();

      // Assign a unique id if none provided, or use the client's id
      const requestId = jsonRpc.id ?? nextId++;
      const outgoing = { ...jsonRpc, id: requestId };

      const response = await sendRequest(outgoing);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Wait a bit for child process to start, then initialize
const startupWait = parseInt(process.env.STARTUP_WAIT || "500", 10);
setTimeout(async () => {
  try {
    await ensureInitialized();
    console.error(`Proxy: MCP session initialized, listening on port ${PORT}`);
  } catch (err) {
    console.error(`Proxy: Failed to initialize MCP session: ${err.message}`);
    process.exit(1);
  }
}, startupWait);

httpServer.listen(PORT, () => {
  console.error(`Proxy: HTTP server listening on port ${PORT}`);
});
