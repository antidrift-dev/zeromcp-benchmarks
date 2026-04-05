#!/usr/bin/env node

/**
 * Generic chaos runner for official MCP SDKs.
 * Usage: node chaos-runner.mjs <language> <command> [args...]
 * Example: node chaos-runner.mjs python python3 official/server.py
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const TIMEOUT = 5000;
const LANG = process.argv[2];
const CMD = process.argv[3];
const ARGS = process.argv.slice(4);
const STARTUP_WAIT = parseInt(process.env.STARTUP_WAIT || '3000');

if (!LANG || !CMD) {
  console.error('Usage: node chaos-runner.mjs <language> <command> [args...]');
  process.exit(1);
}

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
  { name: 'malformed_json', run: async (s, p) => { sendRaw(p, '{{{{garbage\n'); await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9001); } },
  { name: 'truncated_json', run: async (s, p) => { sendRaw(p, '{"jsonrpc":"2.0","id":1,"meth\n'); await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9002); } },
  { name: 'empty_line', run: async (s, p) => { sendRaw(p, '\n\n\n\n\n'); await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9003); } },
  { name: 'missing_id', run: async (s, p) => { sendRaw(p, JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'hello', arguments: { name: 'noid' } } }) + '\n'); await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9004); } },
  { name: 'missing_method', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9005 }); } catch {} await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9006); } },
  { name: 'null_id', run: async (s, p) => { sendRaw(p, JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping' }) + '\n'); await new Promise(r => setTimeout(r, 300)); return healthCheck(s, 9007); } },
  { name: 'negative_id', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: -999, method: 'ping' }); } catch {} return healthCheck(s, 9008); } },
  { name: 'duplicate_id', run: async (s, p) => { const p1 = s({ jsonrpc: '2.0', id: 7777, method: 'ping' }); const p2 = s({ jsonrpc: '2.0', id: 7777, method: 'ping' }); try { await p1; } catch {} try { await p2; } catch {} return healthCheck(s, 9009); } },
  { name: 'double_initialize', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9011, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chaos', version: '1.0' } } }); } catch {} return healthCheck(s, 9012); } },
  { name: 'unknown_method', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9013, method: 'chaos/destroy', params: {} }); } catch {} return healthCheck(s, 9014); } },
  { name: 'giant_string', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9020, method: 'tools/call', params: { name: 'hello', arguments: { name: 'A'.repeat(1024 * 1024) } } }, 15000); } catch {} return healthCheck(s, 9021); } },
  { name: 'deeply_nested', run: async (s, p) => { let obj = { v: 'deep' }; for (let i = 0; i < 100; i++) obj = { n: obj }; try { await s({ jsonrpc: '2.0', id: 9022, method: 'tools/call', params: { name: 'hello', arguments: { name: JSON.stringify(obj) } } }, 10000); } catch {} return healthCheck(s, 9023); } },
  { name: 'empty_tool_name', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9024, method: 'tools/call', params: { name: '', arguments: {} } }); } catch {} return healthCheck(s, 9025); } },
  { name: 'null_arguments', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9026, method: 'tools/call', params: { name: 'hello', arguments: null } }); } catch {} return healthCheck(s, 9027); } },
  { name: 'binary_garbage', run: async (s, p) => { const buf = Buffer.alloc(256); for (let i = 0; i < 256; i++) buf[i] = Math.floor(Math.random() * 256); sendRaw(p, buf); sendRaw(p, '\n'); await new Promise(r => setTimeout(r, 500)); return healthCheck(s, 9028); } },
  { name: 'tool_throws', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9030, method: 'tools/call', params: { name: 'throw_error', arguments: {} } }); } catch {} return healthCheck(s, 9031); } },
  { name: 'tool_hangs', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9032, method: 'tools/call', params: { name: 'hang', arguments: {} } }, 5000); return 'survived'; } catch (err) { if (err.message === 'Timeout') return 'degraded'; return 'crashed'; } } },
  { name: 'tool_slow', run: async (s, p) => { try { const res = await s({ jsonrpc: '2.0', id: 9034, method: 'tools/call', params: { name: 'slow', arguments: {} } }, 10000); if (res?.result?.content?.[0]?.text?.includes('ok')) return 'survived'; return 'corrupted'; } catch { return 'crashed'; } } },
  { name: 'tool_leak_memory', run: async (s, p) => { for (let i = 0; i < 50; i++) { try { await s({ jsonrpc: '2.0', id: 9040 + i, method: 'tools/call', params: { name: 'leak_memory', arguments: {} } }); } catch { return 'crashed'; } } return healthCheck(s, 9099); } },
  { name: 'tool_stdout_corrupt', run: async (s, p) => { try { await s({ jsonrpc: '2.0', id: 9100, method: 'tools/call', params: { name: 'stdout_corrupt', arguments: {} } }); } catch {} return healthCheck(s, 9101); } },
  { name: 'rapid_fire_100', run: async (s, p) => { const ps = []; for (let i = 0; i < 100; i++) ps.push(s({ jsonrpc: '2.0', id: 9200 + i, method: 'tools/call', params: { name: 'hello', arguments: { name: `f${i}` } } }).catch(() => null)); const r = await Promise.all(ps); const ok = r.filter(x => x?.result?.content?.[0]?.text?.includes('Hello')).length; if (ok === 100) return 'survived'; if (ok > 0) return 'degraded'; return 'crashed'; } },
];

async function spawnAndInit() {
  const proc = spawn(CMD, ARGS, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
  proc.stdin.on('error', () => {});
  proc.on('error', () => {});
  const started = await new Promise(r => { proc.on('error', () => r(false)); setTimeout(() => r(true), STARTUP_WAIT); });
  if (!started) return null;
  const send = createHandler(proc);
  try {
    await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'chaos', version: '1.0' } } });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    await new Promise(r => setTimeout(r, 300));
  } catch { proc.kill(); return null; }
  return { proc, send };
}

async function main() {
  console.error(`Chaos monkey: official ${LANG} SDK (${CMD} ${ARGS.join(' ')})`);
  const results = [];
  for (const attack of attacks) {
    console.error(`  ${attack.name}...`);
    const instance = await spawnAndInit();
    if (!instance) { results.push({ attack: attack.name, score: 'crashed' }); console.error('    spawn failed'); continue; }
    let score;
    try { score = await attack.run(instance.send, instance.proc); } catch { score = 'crashed'; }
    results.push({ attack: attack.name, score });
    console.error(`    ${score}`);
    instance.proc.kill();
  }
  const applicable = results.filter(r => r.score !== 'skipped');
  console.log(JSON.stringify({
    sdk: 'official', language: LANG,
    total: applicable.length,
    survived: applicable.filter(r => r.score === 'survived').length,
    degraded: applicable.filter(r => r.score === 'degraded').length,
    crashed: applicable.filter(r => r.score === 'crashed').length,
    corrupted: applicable.filter(r => r.score === 'corrupted').length,
    score: `${applicable.filter(r => r.score === 'survived').length}/${applicable.length}`,
    results,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
