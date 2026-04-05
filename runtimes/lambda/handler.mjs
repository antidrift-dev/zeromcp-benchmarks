/**
 * AWS Lambda handler wrapper for ZeroMCP.
 * Simulates MCP over Lambda invocations instead of stdio.
 * Each Lambda invocation is one JSON-RPC request/response cycle.
 */

import { ToolScanner } from '/zeromcp/nodejs/dist/scanner.js';
import { toJsonSchema, validate } from '/zeromcp/nodejs/dist/schema.js';

let tools = null;

async function initTools() {
  if (tools) return tools;
  const scanner = new ToolScanner({ tools: ['/zeromcp/nodejs/examples/tools'] });
  await scanner.scan();
  tools = scanner.tools;
  return tools;
}

export async function handler(event) {
  const allTools = await initTools();

  const request = typeof event === 'string' ? JSON.parse(event) : event;
  const { id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'zeromcp-lambda', version: '0.1.0' },
      },
    };
  }

  if (method === 'tools/list') {
    const list = [];
    for (const [name, tool] of allTools) {
      list.push({ name, description: tool.description, inputSchema: toJsonSchema(tool.input) });
    }
    return { jsonrpc: '2.0', id, result: { tools: list } };
  }

  if (method === 'tools/call') {
    const name = params?.name ?? '';
    const args = params?.arguments ?? {};
    const tool = allTools.get(name);
    if (!tool) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true } };
    }
    const schema = toJsonSchema(tool.input);
    const errors = validate(args, schema);
    if (errors.length > 0) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Validation errors:\n${errors.join('\n')}` }], isError: true } };
    }
    try {
      const result = await tool.execute(args);
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
    } catch (err) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } };
    }
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}
