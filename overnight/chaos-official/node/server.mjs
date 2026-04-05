/**
 * Official MCP SDK server with chaos tools for resilience testing.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "official-chaos", version: "1.0.0" });

const leaks = [];

server.tool("hello", { name: z.string() }, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }],
}));

server.tool("throw_error", {}, async () => {
  throw new Error("Intentional chaos: unhandled exception");
});

server.tool("hang", {}, async () => {
  await new Promise(() => {}); // never resolves
});

server.tool("slow", {}, async () => {
  await new Promise(r => setTimeout(r, 3000));
  return { content: [{ type: "text", text: JSON.stringify({ status: "ok", delay_ms: 3000 }) }] };
});

server.tool("leak_memory", {}, async () => {
  leaks.push(Buffer.alloc(1024 * 1024));
  return { content: [{ type: "text", text: JSON.stringify({ leaked_buffers: leaks.length, total_mb: leaks.length }) }] };
});

server.tool("stdout_corrupt", {}, async () => {
  process.stdout.write("CORRUPTED OUTPUT\n");
  return { content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
