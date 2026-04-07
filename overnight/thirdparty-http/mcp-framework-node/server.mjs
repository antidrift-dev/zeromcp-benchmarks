/**
 * mcp-framework benchmark server — hello + add tools over HTTP stream.
 */
import { MCPServer, MCPTool } from "mcp-framework";
import { z } from "zod";

class HelloTool extends MCPTool {
  name = "hello";
  description = "Greets someone by name";
  schema = z.object({
    name: z.string().describe("Name to greet"),
  });

  async execute(input) {
    return `Hello, ${input.name}!`;
  }
}

class AddTool extends MCPTool {
  name = "add";
  description = "Adds two numbers";
  schema = z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  });

  async execute(input) {
    return String(input.a + input.b);
  }
}

const port = parseInt(process.env.PORT || "3000");

const server = new MCPServer({
  name: "mcp-framework-node",
  version: "1.0.0",
  transport: {
    type: "http-stream",
    options: {
      port,
      host: "0.0.0.0",
      endpoint: "/mcp",
    },
  },
});

server.addTool(HelloTool);
server.addTool(AddTool);

await server.start();
