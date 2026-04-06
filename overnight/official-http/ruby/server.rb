# Official MCP Ruby SDK server — hello + add tools over stdio.
require "mcp"
require "mcp/server/transports/stdio_transport"

server = MCP::Server.new(name: "official-ruby", version: "1.0.0")

server.define_tool(
  name: "hello",
  description: "Say hello",
  input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }
) do |name:|
  MCP::Tool::Response.new([{ type: "text", text: "Hello, #{name}!" }])
end

server.define_tool(
  name: "add",
  description: "Add two numbers",
  input_schema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] }
) do |a:, b:|
  MCP::Tool::Response.new([{ type: "text", text: (a + b).to_s }])
end

server.transport = MCP::Server::Transports::StdioTransport.new(server)
server.transport.open
