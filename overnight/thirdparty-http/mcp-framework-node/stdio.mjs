import { MCPServer, MCPTool } from "mcp-framework";
import { z } from "zod";
class HelloTool extends MCPTool {
  name = "hello";
  description = "Say hello";
  schema = z.object({ name: z.string().describe("Name") });
  async execute(input) { return `Hello, ${input.name}!`; }
}
class AddTool extends MCPTool {
  name = "add";
  description = "Add";
  schema = z.object({ a: z.number().describe("A"), b: z.number().describe("B") });
  async execute(input) { return String(input.a + input.b); }
}
const server = new MCPServer({ name: "mcpfw", version: "1.0.0" });
server.addTool(HelloTool);
server.addTool(AddTool);
await server.start();
