/**
 * ZeroMCP over Hono (with @hono/node-server)
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createHandler } from './zeromcp/handler.js';

const handler = await createHandler({
  tools: ['./tools'],
  resources: ['./resources'],
  prompts: ['./prompts'],
});

const app = new Hono();
app.get('/health', (c) => c.json({ status: 'ok' }));
app.post('/mcp', async (c) => c.json((await handler(await c.req.json())) || {}));

const PORT = parseInt(process.env.PORT || '3000');
serve({ fetch: app.fetch, port: PORT }, () => console.error(`hono on :${PORT}`));
