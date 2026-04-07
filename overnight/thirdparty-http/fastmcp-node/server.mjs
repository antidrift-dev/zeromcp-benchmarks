/**
 * fastmcp benchmark server — hello + add tools over native HTTP stream.
 */
import { FastMCP } from "fastmcp";
import { z } from "zod";

const server = new FastMCP({ name: "fastmcp-node", version: "1.0.0" });

server.addTool({
  name: "hello",
  description: "Say hello",
  parameters: z.object({ name: z.string() }),
  execute: async ({ name }) => `Hello, ${name}!`,
});

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({ a: z.number(), b: z.number() }),
  execute: async ({ a, b }) => String(a + b),
});

server.start({
  transportType: "httpStream",
  httpStream: { port: parseInt(process.env.PORT || "3000"), host: "0.0.0.0" },
});
