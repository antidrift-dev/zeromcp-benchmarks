require "fast_mcp"
require "puma"
require "rack"
require "json"

class HelloTool < FastMcp::Tool
  tool_name "hello"
  description "Say hello to someone"

  arguments do
    required(:name).filled(:string).description("Name to greet")
  end

  def call(name:)
    "Hello, #{name}!"
  end
end

class AddTool < FastMcp::Tool
  tool_name "add"
  description "Add two numbers"

  arguments do
    required(:a).filled(:float).description("First number")
    required(:b).filled(:float).description("Second number")
  end

  def call(a:, b:)
    (a + b).to_s
  end
end

# Plain Rack app with /health endpoint
base_app = Proc.new do |env|
  if env["REQUEST_METHOD"] == "GET" && env["PATH_INFO"] == "/health"
    ["200", { "Content-Type" => "application/json" }, ['{"status":"ok"}']]
  else
    ["404", { "Content-Type" => "text/plain" }, ["Not Found"]]
  end
end

# Create MCP server and register tools
mcp_server = FastMcp::Server.new(name: "fast-mcp-ruby-bench", version: "1.0.0")
mcp_server.register_tool(HelloTool)
mcp_server.register_tool(AddTool)

# Wrap base app with MCP Rack transport
mcp_app = mcp_server.start_rack(base_app, localhost_only: false)

port = (ENV["PORT"] || 3000).to_i
$stderr.puts "fast-mcp-ruby on :#{port}"

launcher = Puma::Launcher.new(
  Puma::Configuration.new do |config|
    config.app mcp_app
    config.bind "tcp://0.0.0.0:#{port}"
    config.threads 0, 5
    config.workers 0
    config.log_requests false
    config.quiet
  end
)
launcher.run
