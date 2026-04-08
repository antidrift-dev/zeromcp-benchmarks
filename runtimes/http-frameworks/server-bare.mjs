/**
 * ZeroMCP over bare Node.js http.createServer
 */
import { createServer } from 'node:http';
import { createHandler } from './zeromcp/handler.js';

const handler = await createHandler({
  tools: ['./tools'],
  resources: ['./resources'],
  prompts: ['./prompts'],
});

const PORT = parseInt(process.env.PORT || '3000');
createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  if (req.method === 'POST' && req.url === '/mcp') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const result = await handler(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result || {}));
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.error(`bare http on :${PORT}`));
