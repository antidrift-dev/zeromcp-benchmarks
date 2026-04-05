require "mcp"
require "json"

$leaks = []

server = MCP::Server.new(name: "official-chaos", version: "1.0.0")

server.define_tool(name: "hello", description: "Say hello",
  input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }) do |args|
  MCP::Tool::Response.new([{ type: "text", text: "Hello, #{args[:name] || args['name'] || 'world'}!" }])
end

server.define_tool(name: "throw_error", description: "Tool that throws",
  input_schema: { type: "object", properties: {} }) do |_|
  raise "Intentional chaos: unhandled exception"
end

server.define_tool(name: "hang", description: "Tool that hangs forever",
  input_schema: { type: "object", properties: {} }) do |_|
  sleep(86400)
  MCP::Tool::Response.new([{ type: "text", text: "unreachable" }])
end

server.define_tool(name: "slow", description: "Tool that takes 3 seconds",
  input_schema: { type: "object", properties: {} }) do |_|
  sleep(3)
  MCP::Tool::Response.new([{ type: "text", text: '{"status":"ok","delay_ms":3000}' }])
end

server.define_tool(name: "leak_memory", description: "Tool that leaks memory",
  input_schema: { type: "object", properties: {} }) do |_|
  $leaks << ("\x00" * 1024 * 1024)
  MCP::Tool::Response.new([{ type: "text", text: JSON.generate({ leaked_buffers: $leaks.length, total_mb: $leaks.length }) }])
end

server.define_tool(name: "stdout_corrupt", description: "Tool that writes to stdout",
  input_schema: { type: "object", properties: {} }) do |_|
  $stdout.write("CORRUPTED OUTPUT\n")
  $stdout.flush
  MCP::Tool::Response.new([{ type: "text", text: '{"status":"ok"}' }])
end

transport = MCP::Server::Transports::StdioTransport.new(server)
server.transport = transport
transport.open
