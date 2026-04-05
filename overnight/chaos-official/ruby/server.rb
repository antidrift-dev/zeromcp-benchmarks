# Official MCP Ruby SDK server with chaos tools for resilience testing.
require "mcp"

$leaks = []

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

class ThrowErrorTool < MCP::Tool
  tool_name "throw_error"
  description "Tool that throws"
  input_schema(properties: {})

  def call(**_args)
    raise "Intentional chaos: unhandled exception"
  end
end

class HangTool < MCP::Tool
  tool_name "hang"
  description "Tool that hangs forever"
  input_schema(properties: {})

  def call(**_args)
    sleep(86400)
    "unreachable"
  end
end

class SlowTool < MCP::Tool
  tool_name "slow"
  description "Tool that takes 3 seconds"
  input_schema(properties: {})

  def call(**_args)
    sleep(3)
    '{"status":"ok","delay_ms":3000}'
  end
end

class LeakMemoryTool < MCP::Tool
  tool_name "leak_memory"
  description "Tool that leaks memory"
  input_schema(properties: {})

  def call(**_args)
    $leaks << "\x00" * (1024 * 1024)
    "{\"leaked_buffers\":#{$leaks.length},\"total_mb\":#{$leaks.length}}"
  end
end

class StdoutCorruptTool < MCP::Tool
  tool_name "stdout_corrupt"
  description "Tool that writes to stdout"
  input_schema(properties: {})

  def call(**_args)
    $stdout.write("CORRUPTED OUTPUT\n")
    $stdout.flush
    '{"status":"ok"}'
  end
end

server = MCP::Server.new(name: "official-chaos", version: "1.0.0")
server.register_tool(HelloTool)
server.register_tool(ThrowErrorTool)
server.register_tool(HangTool)
server.register_tool(SlowTool)
server.register_tool(LeakMemoryTool)
server.register_tool(StdoutCorruptTool)
server.start
