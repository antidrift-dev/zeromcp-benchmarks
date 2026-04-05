/**
 * ZeroMCP over Express
 */
import express from 'express';
import { ToolScanner } from './zeromcp/scanner.js';
import { toJsonSchema, validate } from './zeromcp/schema.js';

const scanner = new ToolScanner({ tools: ['./tools'] });
await scanner.scan();
const tools = scanner.tools;

async function handleMcp(body) {
  const { id, method, params } = body;
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'zeromcp-express', version: '0.1.0' } } };
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

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', tools: tools.size }));
app.post('/mcp', async (req, res) => res.json(await handleMcp(req.body)));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.error(`express on :${PORT}`));
