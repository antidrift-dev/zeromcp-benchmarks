require 'mcp'

class HelloTool < MCP::Tool
  description "Say hello to someone"
  input_schema(
    properties: { name: { type: "string" } },
    required: [:name]
  )

  def self.call(name:)
    MCP::Tool::Response.new([{ type: "text", text: "Hello, #{name}!" }])
  end
end

class AddTool < MCP::Tool
  description "Add two numbers together"
  input_schema(
    properties: {
      a: { type: "number" },
      b: { type: "number" }
    },
    required: [:a, :b]
  )

  def self.call(a:, b:)
    require 'json'
    MCP::Tool::Response.new([{ type: "text", text: JSON.generate({ sum: a + b }) }])
  end
end

server = MCP::Server.new(
  name: "bench-official",
  version: "1.0.0",
  tools: [HelloTool, AddTool]
)

transport = MCP::Server::Transports::StdioTransport.new(server)
server.transport = transport
transport.open
