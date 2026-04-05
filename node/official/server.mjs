import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "bench-official", version: "1.0.0" });

server.tool("hello", { name: z.string() }, async ({ name }) => ({
  content: [{ type: "text", text: `Hello, ${name}!` }],
}));

server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: JSON.stringify({ sum: a + b }) }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
