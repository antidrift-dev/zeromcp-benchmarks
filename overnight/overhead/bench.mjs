#!/usr/bin/env node

/**
 * Overhead Measurement — All 10 ZeroMCP Languages
 *
 * For each language, compares:
 *   1. Bare stdio echo  — a tiny Node.js child that echoes JSON-RPC responses
 *   2. ZeroMCP stdio    — the real server processing a tools/call request
 *
 * The delta between them is pure ZeroMCP overhead (parsing, routing, tool dispatch).
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const DURATION = 60; // seconds per test
const INTERVAL = 10; // snapshot interval
const WARMUP = 100;

const SERVERS = [
  {
    name: 'nodejs',
    command: 'node',
    args: ['/zeromcp/nodejs/bin/mcp.js', 'serve', '/zeromcp/nodejs/examples/tools'],
  },
  {
    name: 'python',
    command: 'python3',
    args: ['-m', 'zeromcp', 'serve', '/zeromcp/python/examples/tools'],
    env: { PYTHONPATH: '/zeromcp/python' },
  },
  {
    name: 'go',
    command: 'zeromcp-go',
    args: [],
  },
  {
    name: 'ruby',
    command: 'ruby',
    args: ['-I', '/zeromcp/ruby/lib', '/zeromcp/ruby/bin/zeromcp', 'serve', '/zeromcp/ruby/tools'],
  },
  {
    name: 'rust',
    command: '/zeromcp/rust/target/release/examples/hello',
    args: [],
  },
  {
    name: 'php',
    command: 'php',
    args: ['/zeromcp/php/zeromcp.php', 'serve', '/zeromcp/php/tools'],
  },
  {
    name: 'swift',
    command: 'zeromcp-swift',
    args: [],
  },
  {
    name: 'kotlin',
    command: '/zeromcp/kotlin/example/build/install/example/bin/example',
    args: [],
  },
  {
    name: 'java',
    command: 'java',
    args: ['-Dfile.encoding=UTF-8', '-cp', '/zeromcp/java/target/zeromcp-0.1.0.jar:/zeromcp/java/target/deps/*:/tmp/java-out', 'Main'],
  },
  {
    name: 'csharp',
    command: '/tmp/csharp-out/Example',
    args: [],
  },
];

// A minimal Node.js script that reads JSON-RPC from stdin and echoes a canned response.
// Used as the "bare echo" baseline for all languages.
const ECHO_SCRIPT = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  try {
    const req = JSON.parse(line.trim());
    if (req.id !== undefined && req.id !== null) {
      const resp = { jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: 'Hello, bench!' }] } };
      process.stdout.write(JSON.stringify(resp) + '\\n');
    }
  } catch {}
});
`;

const ECHO_SCRIPT_PATH = '/tmp/_overhead_echo.js';

function createHandler(proc) {
  const rl = createInterface({ input: proc.stdout });
  const pending = [];
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { return; }
    if (parsed.id === undefined || parsed.id === null) return;
    if (pending.length === 0) return;
    const { resolve, timer } = pending.shift();
    clearTimeout(timer);
    resolve(parsed);
  });
  return (request) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = pending.findIndex(p => p.timer === timer);
      if (idx !== -1) pending.splice(idx, 1);
      reject(new Error('Timeout'));
    }, 15000);
    pending.push({ resolve, reject, timer });
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

function getMemoryMB(pid) {
  try {
    const s = readFileSync(`/proc/${pid}/status`, 'utf8');
    const m = s.match(/VmRSS:\s+(\d+)\s+kB/);
    return m ? Math.round(parseInt(m[1]) / 1024 * 10) / 10 : null;
  } catch { return null; }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

/**
 * Run a stdio benchmark against a spawned process.
 * If `initialize` is true, sends MCP initialize handshake first.
 */
async function stdioBenchmark(label, command, args, opts = {}) {
  const { initialize = false, env: extraEnv } = opts;
  console.error(`  [${label}] benchmarking for ${DURATION}s...`);

  const env = { ...process.env, ...(extraEnv || {}) };
  const proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env });
  proc.on('error', (err) => {
    console.error(`  [${label}] spawn error: ${err.message}`);
  });
  proc.stderr.on('data', () => {});

  const send = createHandler(proc);

  if (initialize) {
    try {
      await send({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'overhead', version: '1.0' } } });
      proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      proc.kill();
      console.error(`  [${label}] failed to initialize: ${err.message}`);
      return { label, error: 'Failed to initialize' };
    }
  }

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    try {
      await send({ jsonrpc: '2.0', id: 1000 + i, method: 'tools/call', params: { name: 'hello', arguments: { name: 'bench' } } });
    } catch { break; }
  }

  const snapshots = [];
  let latencies = [];
  const start = performance.now();
  let nextSnapshot = INTERVAL * 1000;

  while (performance.now() - start < DURATION * 1000) {
    const t0 = performance.now();
    try {
      await send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'hello', arguments: { name: 'bench' } } });
      latencies.push(performance.now() - t0);
    } catch {
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - start;
    if (elapsed >= nextSnapshot) {
      const sorted = [...latencies].sort((a, b) => a - b);
      snapshots.push({
        t: Math.round(elapsed / 1000),
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
        memory_mb: getMemoryMB(proc.pid),
      });
      const s = snapshots[snapshots.length - 1];
      console.error(`    t=${s.t}s rps=${s.rps} p50=${s.p50_ms}ms mem=${s.memory_mb}MB`);
      latencies = [];
      nextSnapshot += INTERVAL * 1000;
    }
  }

  proc.kill();
  return { label, snapshots };
}

function computeOverhead(echoResult, mcpResult) {
  if (echoResult.error || mcpResult.error) {
    return { error: echoResult.error || mcpResult.error };
  }

  const avg = (arr, key) => arr.reduce((s, x) => s + x[key], 0) / arr.length;

  const echoAvgRps = avg(echoResult.snapshots, 'rps');
  const mcpAvgRps = avg(mcpResult.snapshots, 'rps');
  const echoP50 = avg(echoResult.snapshots, 'p50_ms');
  const mcpP50 = avg(mcpResult.snapshots, 'p50_ms');

  return {
    echo_avg_rps: round(echoAvgRps),
    mcp_avg_rps: round(mcpAvgRps),
    rps_reduction_pct: round((1 - mcpAvgRps / echoAvgRps) * 100),
    echo_avg_p50_ms: round(echoP50),
    mcp_avg_p50_ms: round(mcpP50),
    latency_increase_ms: round(mcpP50 - echoP50),
    latency_increase_pct: echoP50 > 0 ? round((mcpP50 / echoP50 - 1) * 100) : null,
  };
}

async function main() {
  console.error('Overhead Measurement — All Languages (stdio)\n');

  // Write the echo script to disk
  writeFileSync(ECHO_SCRIPT_PATH, ECHO_SCRIPT);

  // Allow filtering via env var, e.g. LANGUAGES=nodejs,go
  const filter = process.env.LANGUAGES
    ? process.env.LANGUAGES.split(',').map(s => s.trim().toLowerCase())
    : null;

  const servers = filter
    ? SERVERS.filter(s => filter.includes(s.name))
    : SERVERS;

  const results = {};

  for (const server of servers) {
    console.error(`\n=== ${server.name} ===`);

    // 1. Bare stdio echo baseline (Node.js echo script — same for all)
    const echoResult = await stdioBenchmark(
      `${server.name}-echo`,
      'node',
      [ECHO_SCRIPT_PATH],
      { initialize: false }
    );

    // 2. Real ZeroMCP server
    const mcpResult = await stdioBenchmark(
      `${server.name}-zeromcp`,
      server.command,
      server.args,
      { initialize: true, env: server.env }
    );

    // 3. Calculate overhead
    const overhead = computeOverhead(echoResult, mcpResult);

    results[server.name] = {
      bare_echo: echoResult,
      zeromcp: mcpResult,
      overhead,
    };

    console.error(`  overhead: latency +${overhead.latency_increase_ms}ms (${overhead.latency_increase_pct}%), rps -${overhead.rps_reduction_pct}%`);
  }

  // Cleanup
  try { unlinkSync(ECHO_SCRIPT_PATH); } catch {}

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
