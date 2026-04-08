require 'json'
require 'zeromcp'

#
# ZeroMCP over pure Rack -- HTTP benchmark server (no framework).
#

config = ZeroMcp::Config.new(
  tools_dir: './tools',
  resources_dir: './resources',
  prompts_dir: './prompts'
)
server = ZeroMcp::Server.new(config)
server.load_tools

hello_tool = ZeroMcp::Tool.new(
  name: 'hello',
  description: 'Say hello',
  input: { 'name' => { 'type' => 'string', 'description' => 'Name to greet' } }
) { |args, _ctx| "Hello, #{args['name']}!" }

add_tool = ZeroMcp::Tool.new(
  name: 'add',
  description: 'Add two numbers',
  input: {
    'a' => { 'type' => 'number', 'description' => 'First number' },
    'b' => { 'type' => 'number', 'description' => 'Second number' }
  }
) { |args, _ctx| args['a'].to_f + args['b'].to_f }

# Merge inline tools with any file-scanned tools
server.instance_variable_get(:@tools).merge!('hello' => hello_tool, 'add' => add_tool)

app = Proc.new do |env|
  if env['REQUEST_METHOD'] == 'GET' && env['PATH_INFO'] == '/health'
    ['200', { 'Content-Type' => 'application/json' }, ['{"status":"ok"}']]
  elsif env['REQUEST_METHOD'] == 'POST' && env['PATH_INFO'] == '/mcp'
    body = JSON.parse(env['rack.input'].read)
    response = server.handle_request(body)
    if response
      ['200', { 'Content-Type' => 'application/json' }, [response.to_json]]
    else
      ['204', {}, ['']]
    end
  else
    ['404', { 'Content-Type' => 'text/plain' }, ['Not Found']]
  end
end

port = (ENV['PORT'] || 3000).to_i
$stderr.puts "rack on :#{port}"

require 'puma'

launcher = Puma::Launcher.new(
  Puma::Configuration.new do |config|
    config.app app
    config.bind "tcp://0.0.0.0:#{port}"
    config.threads 0, 5
    config.workers 0
    config.log_requests false
    config.quiet
  end
)
launcher.run
