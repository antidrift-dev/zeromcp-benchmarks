/**
 * ZeroMCP over bare Node.js http.createServer
 */
import { createServer } from 'node:http';
import { ToolScanner } from './zeromcp/scanner.js';
import { toJsonSchema, validate } from './zeromcp/schema.js';

const scanner = new ToolScanner({ tools: ['./tools'] });
await scanner.scan();
const tools = scanner.tools;

async function handleMcp(body) {
  const { id, method, params } = body;
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'zeromcp-bare', version: '0.1.0' } } };
  }
  if (method === 'tools/list') {
    const list = [];
    for (const [name, tool] of tools) list.push({ name, description: tool.description, inputSchema: toJsonSchema(tool.input) });
    return { jsonrpc: '2.0', id, result: { tools: list } };
  }
  if (method === 'tools/call') {
    const name = params?.name ?? '';
    const args = params?.arguments ?? {};
    const tool = tools.get(name);
    if (!tool) return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    try {
      const result = await tool.execute(args);
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
    }
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

const PORT = parseInt(process.env.PORT || '3000');
createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', tools: tools.size }));
    return;
  }
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const result = await handleMcp(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.error(`bare http on :${PORT}`));
