/**
 * ZeroMCP Cloudflare Workers adapter.
 * Standalone — no external imports. Tools registered inline.
 */

const tools = new Map();

tools.set('hello', {
  description: 'Say hello to someone',
  input: { name: { type: 'string' } },
  execute: async ({ name }) => `Hello, ${name}!`,
});

tools.set('add', {
  description: 'Add two numbers together',
  input: { a: { type: 'number' }, b: { type: 'number' } },
  execute: async ({ a, b }) => ({ sum: a + b }),
});

tools.set('create_invoice', {
  description: 'Create an invoice',
  input: { customer_id: { type: 'string' }, amount: { type: 'number' } },
  execute: async ({ customer_id, amount }) => ({
    id: `inv_${Date.now()}`, customer_id, amount, status: 'draft', created: new Date().toISOString(),
  }),
});

async function handleMcp(body) {
  const { id, method, params } = body;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'zeromcp-cloudflare', version: '0.1.0' },
      },
    };
  }

  if (method === 'tools/list') {
    const list = [];
    for (const [name, tool] of tools) {
      const properties = {};
      for (const [k, v] of Object.entries(tool.input)) properties[k] = v;
      list.push({
        name,
        description: tool.description,
        inputSchema: { type: 'object', properties, required: Object.keys(tool.input) },
      });
    }
    return { jsonrpc: '2.0', id, result: { tools: list } };
  }

  if (method === 'tools/call') {
    const name = params?.name ?? '';
    const args = params?.arguments ?? {};
    const tool = tools.get(name);
    if (!tool) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    }
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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }});
    }
    if (url.pathname === '/health') return Response.json({ status: 'ok', tools: tools.size });
    if (url.pathname === '/mcp' && request.method === 'POST') {
      const body = await request.json();
      return Response.json(await handleMcp(body));
    }
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
