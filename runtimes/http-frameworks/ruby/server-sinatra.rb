require 'sinatra'
require 'json'
require 'zeromcp'

#
# ZeroMCP over Sinatra -- HTTP benchmark server.
#

# Build server with resource and prompt directories configured
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

set :port, (ENV['PORT'] || 3000).to_i
set :bind, '0.0.0.0'
set :logging, false

get '/health' do
  content_type :json
  { status: 'ok' }.to_json
end

post '/mcp' do
  content_type :json
  body = JSON.parse(request.body.read)
  response = server.handle_request(body)
  if response
    response.to_json
  else
    status 204
    ''
  end
end

$stderr.puts "sinatra on :#{settings.port}"
