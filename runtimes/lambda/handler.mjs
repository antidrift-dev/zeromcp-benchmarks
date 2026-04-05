/**
 * AWS Lambda handler wrapper for ZeroMCP.
 * Each Lambda invocation is one JSON-RPC request/response cycle.
 * Tools are loaded once on cold start, cached for warm invocations.
 */

import { ToolScanner } from './zeromcp/dist/scanner.js';
import { toJsonSchema, validate } from './zeromcp/dist/schema.js';

let tools = null;

async function initTools() {
  if (tools) return tools;
  const scanner = new ToolScanner({ tools: ['./tools'] });
  await scanner.scan();
  tools = scanner.tools;
  return tools;
}

export async function handler(event) {
  const allTools = await initTools();

  const request = typeof event === 'string' ? JSON.parse(event) : (event.body ? JSON.parse(event.body) : event);
  const { id, method, params } = request;

  let result;

  if (method === 'initialize') {
    result = {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'zeromcp-lambda', version: '0.1.0' },
      },
    };
  } else if (method === 'tools/list') {
    const list = [];
    for (const [name, tool] of allTools) {
      list.push({ name, description: tool.description, inputSchema: toJsonSchema(tool.input) });
    }
    result = { jsonrpc: '2.0', id, result: { tools: list } };
  } else if (method === 'tools/call') {
    const name = params?.name ?? '';
    const args = params?.arguments ?? {};
    const tool = allTools.get(name);
    if (!tool) {
      result = { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    } else {
      const schema = toJsonSchema(tool.input);
      const errors = validate(args, schema);
      if (errors.length > 0) {
        result = { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Validation errors:\n${errors.join('\n')}` }], isError: true } };
      } else {
        try {
          const r = await tool.execute(args);
          const text = typeof r === 'string' ? r : JSON.stringify(r);
          result = { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
        } catch (err) {
          result = { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
        }
      }
    }
  } else if (method === 'ping') {
    result = { jsonrpc: '2.0', id, result: {} };
  } else {
    result = { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }

  return result;
}
