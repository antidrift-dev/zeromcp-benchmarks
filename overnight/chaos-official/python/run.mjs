#!/usr/bin/env node
// Chaos runner for official Python SDK — same attacks, different spawn command

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const TIMEOUT = 5000;
const SPAWN_CMD = 'python3';
const SPAWN_ARGS = ['official/server.py'];
const LANG = 'python';

function createHandler(proc) {
  const rl = createInterface({ input: proc.stdout });
  const pending = [];
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { return; }
    if (parsed.id === undefined || parsed.id === null) return;
    if (pending.length === 0) return;
    const { resolve, timer } = pending.shift();
    clearTimeout(timer);
    resolve(parsed);
  });
  return (request, timeoutMs = TIMEOUT) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = pending.findIndex(p => p.timer === timer);
      if (idx !== -1) pending.splice(idx, 1);
      reject(new Error('Timeout'));
    }, timeoutMs);
    pending.push({ resolve, reject, timer });
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

function sendRaw(proc, data) { proc.stdin.write(data); }

async function healthCheck(send, id) {
  try {
    const res = await send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'hello', arguments: { name: 'healthcheck' } } });
    const text = res?.result?.content?.[0]?.text || '';
    if (text.includes('Hello, healthcheck!')) return 'survived';
    return 'corrupted';
  } catch { return 'crashed'; }
}

const attacks = [
  { name: 'malformed_json', run: async (send, proc) => { sendRaw(proc, '{{{{garbage\n'); await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9001); } },
  { name: 'truncated_json', run: async (send, proc) => { sendRaw(proc, '{"jsonrpc":"2.0","id":1,"meth\n'); await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9002); } },
  { name: 'empty_line', run: async (send, proc) => { sendRaw(proc, '\n\n\n\n\n'); await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9003); } },
  { name: 'missing_id', run: async (send, proc) => { sendRaw(proc, JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'hello', arguments: { name: 'noid' } } }) + '\n'); await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9004); } },
  { name: 'missing_method', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9005 }); } catch {} await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9006); } },
  { name: 'null_id', run: async (send, proc) => { sendRaw(proc, JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping' }) + '\n'); await new Promise(r => setTimeout(r, 200)); return healthCheck(send, 9007); } },
  { name: 'negative_id', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: -999, method: 'ping' }); } catch {} return healthCheck(send, 9008); } },
  { name: 'duplicate_id', run: async (send, proc) => { const p1 = send({ jsonrpc: '2.0', id: 7777, method: 'ping' }); const p2 = send({ jsonrpc: '2.0', id: 7777, method: 'ping' }); try { await p1; } catch {} try { await p2; } catch {} return healthCheck(send, 9009); } },
  { name: 'double_initialize', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9011, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chaos', version: '1.0' } } }); } catch {} return healthCheck(send, 9012); } },
  { name: 'unknown_method', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9013, method: 'chaos/destroy', params: {} }); } catch {} return healthCheck(send, 9014); } },
  { name: 'giant_string', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9020, method: 'tools/call', params: { name: 'hello', arguments: { name: 'A'.repeat(1024 * 1024) } } }, 15000); } catch {} return healthCheck(send, 9021); } },
  { name: 'deeply_nested', run: async (send, proc) => { let obj = { v: 'deep' }; for (let i = 0; i < 100; i++) obj = { n: obj }; try { await send({ jsonrpc: '2.0', id: 9022, method: 'tools/call', params: { name: 'hello', arguments: { name: JSON.stringify(obj) } } }, 10000); } catch {} return healthCheck(send, 9023); } },
  { name: 'empty_tool_name', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9024, method: 'tools/call', params: { name: '', arguments: {} } }); } catch {} return healthCheck(send, 9025); } },
  { name: 'null_arguments', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9026, method: 'tools/call', params: { name: 'hello', arguments: null } }); } catch {} return healthCheck(send, 9027); } },
  { name: 'binary_garbage', run: async (send, proc) => { const buf = Buffer.alloc(256); for (let i = 0; i < 256; i++) buf[i] = Math.floor(Math.random() * 256); sendRaw(proc, buf); sendRaw(proc, '\n'); await new Promise(r => setTimeout(r, 500)); return healthCheck(send, 9028); } },
  { name: 'tool_throws', run: async (send, proc) => { try { const res = await send({ jsonrpc: '2.0', id: 9030, method: 'tools/call', params: { name: 'throw_error', arguments: {} } }); } catch {} return healthCheck(send, 9031); } },
  { name: 'tool_hangs', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9032, method: 'tools/call', params: { name: 'hang', arguments: {} } }, 5000); return 'survived'; } catch (err) { if (err.message === 'Timeout') return 'degraded'; return 'crashed'; } } },
  { name: 'tool_slow', run: async (send, proc) => { try { const res = await send({ jsonrpc: '2.0', id: 9034, method: 'tools/call', params: { name: 'slow', arguments: {} } }, 10000); if (res?.result?.content?.[0]?.text?.includes('ok')) return 'survived'; return 'corrupted'; } catch { return 'crashed'; } } },
  { name: 'tool_leak_memory', run: async (send, proc) => { for (let i = 0; i < 50; i++) { try { await send({ jsonrpc: '2.0', id: 9040 + i, method: 'tools/call', params: { name: 'leak_memory', arguments: {} } }); } catch { return 'crashed'; } } return healthCheck(send, 9099); } },
  { name: 'tool_stdout_corrupt', run: async (send, proc) => { try { await send({ jsonrpc: '2.0', id: 9100, method: 'tools/call', params: { name: 'stdout_corrupt', arguments: {} } }); } catch {} return healthCheck(send, 9101); } },
  { name: 'rapid_fire_100', run: async (send, proc) => { const ps = []; for (let i = 0; i < 100; i++) ps.push(send({ jsonrpc: '2.0', id: 9200 + i, method: 'tools/call', params: { name: 'hello', arguments: { name: `f${i}` } } }).catch(() => null)); const r = await Promise.all(ps); const ok = r.filter(x => x?.result?.content?.[0]?.text?.includes('Hello')).length; if (ok === 100) return 'survived'; if (ok > 0) return 'degraded'; return 'crashed'; } },
];

async function spawnAndInit() {
  const proc = spawn(SPAWN_CMD, SPAWN_ARGS, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } });
  proc.stdin.on('error', () => {});
  proc.on('error', () => {});
  const started = await new Promise(r => { proc.on('error', () => r(false)); setTimeout(() => r(true), 3000); });
  if (!started) return null;
  const send = createHandler(proc);
  try {
    await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chaos', version: '1.0' } } });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    await new Promise(r => setTimeout(r, 200));
  } catch { proc.kill(); return null; }
  return { proc, send };
}

async function main() {
  const results = [];
  for (const attack of attacks) {
    const instance = await spawnAndInit();
    if (!instance) { results.push({ attack: attack.name, score: 'crashed' }); continue; }
    let score;
    try { score = await attack.run(instance.send, instance.proc); } catch { score = 'crashed'; }
    results.push({ attack: attack.name, score });
    instance.proc.kill();
  }
  const applicable = results.filter(r => r.score !== 'skipped');
  const output = {
    sdk: 'official', language: LANG,
    total: applicable.length,
    survived: applicable.filter(r => r.score === 'survived').length,
    degraded: applicable.filter(r => r.score === 'degraded').length,
    crashed: applicable.filter(r => r.score === 'crashed').length,
    corrupted: applicable.filter(r => r.score === 'corrupted').length,
    score: `${applicable.filter(r => r.score === 'survived').length}/${applicable.length}`,
    results,
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
