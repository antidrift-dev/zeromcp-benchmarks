# Official MCP Ruby SDK server — hello + add tools over stdio.
require "mcp"

class HelloTool < MCP::Tool
  tool_name "hello"
  description "Say hello"
  input_schema(
    properties: { name: { type: "string" } },
    required: ["name"]
  )

  def call(name:)
    "Hello, #{name}!"
  end
end

class AddTool < MCP::Tool
  tool_name "add"
  description "Add two numbers"
  input_schema(
    properties: {
      a: { type: "number" },
      b: { type: "number" }
    },
    required: ["a", "b"]
  )

  def call(a:, b:)
    (a + b).to_s
  end
end

server = MCP::Server.new(name: "official-ruby", version: "1.0.0")
server.register_tool(HelloTool)
server.register_tool(AddTool)
server.start
