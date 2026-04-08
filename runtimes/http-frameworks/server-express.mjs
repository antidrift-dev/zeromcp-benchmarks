/**
 * ZeroMCP over Express
 */
import express from 'express';
import { createHandler } from './zeromcp/handler.js';

const handler = await createHandler({
  tools: ['./tools'],
  resources: ['./resources'],
  prompts: ['./prompts'],
});

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.post('/mcp', async (req, res) => res.json((await handler(req.body)) || {}));

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => console.error(`express on :${PORT}`));
