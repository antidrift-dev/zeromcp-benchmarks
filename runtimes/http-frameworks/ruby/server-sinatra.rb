require 'sinatra'
require 'json'
require 'zeromcp'

#
# ZeroMCP over Sinatra -- HTTP benchmark server.
#

# Build server and register tools inline (no scanner/tool files)
server = ZeroMcp::Server.new

# Manually register tools since we're not using file-based scanning
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

# Inject tools via instance variable (server uses @tools internally)
server.instance_variable_set(:@tools, { 'hello' => hello_tool, 'add' => add_tool })

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
