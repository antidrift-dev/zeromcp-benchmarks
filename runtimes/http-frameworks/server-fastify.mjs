/**
 * ZeroMCP over Fastify
 */
import Fastify from 'fastify';
import { createHandler } from './zeromcp/handler.js';

const handler = await createHandler({
  tools: ['./tools'],
  resources: ['./resources'],
  prompts: ['./prompts'],
});

const fastify = Fastify({ logger: false });
fastify.get('/health', async () => ({ status: 'ok' }));
fastify.post('/mcp', async (req) => (await handler(req.body)) || {});

const PORT = parseInt(process.env.PORT || '3000');
await fastify.listen({ port: PORT, host: '0.0.0.0' });
console.error(`fastify on :${PORT}`);
