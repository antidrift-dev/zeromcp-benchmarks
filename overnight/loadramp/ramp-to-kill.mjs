#!/usr/bin/env node

/**
 * Ramp-to-Kill Benchmark — Node.js
 * Mixed traffic (low/medium/high/extreme) with increasing concurrency.
 * Stops when error rate exceeds 0.5%.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

const DURATION_PER_LEVEL = 30; // seconds
const INTERVAL = 5;
const ERROR_THRESHOLD = 0.5; // percent

const LEVELS = [
  { concurrency: 1,   mix: { hello: 100 } },
  { concurrency: 5,   mix: { hello: 70, create_invoice: 20, process_data: 10 } },
  { concurrency: 10,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 25,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 50,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 100, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 200, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 500, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
];

const TOOL_ARGS = {
  hello: { name: 'bench' },
  create_invoice: {
    customer_id: 'cust_12345', amount: 250.00, currency: 'USD',
    items: [{ description: 'Widget A', quantity: 2, unit_price: 75.00 }, { description: 'Widget B', quantity: 1, unit_price: 100.00 }],
  },
  process_data: {
    records: Array.from({ length: 50 }, (_, i) => ({
      id: `rec_${i}`, value: Math.round(Math.random() * 1000) / 10,
      category: ['electronics', 'clothing', 'food', 'services'][i % 4],
    })),
  },
  pipeline: { url: 'http://localhost:18923/data', transform: 'summarize' },
};

function pickTool(mix) {
  const r = Math.random() * 100;
  let cumulative = 0;
  for (const [tool, pct] of Object.entries(mix)) {
    cumulative += pct;
    if (r < cumulative) return tool;
  }
  return Object.keys(mix)[0];
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
  return (request) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = pending.findIndex(p => p.timer === timer);
      if (idx !== -1) pending.splice(idx, 1);
      reject(new Error('Timeout'));
    }, 30000);
    pending.push({ resolve, reject, timer });
    proc.stdin.write(JSON.stringify(request) + '\n');
  });
}

function getMemoryMB(pid) {
  try {
    const s = readFileSync(`/proc/${pid}/status`, 'utf8');
    const m = s.match(/VmRSS:\s+(\d+)\s+kB/);
    return m ? Math.round(parseInt(m[1]) / 1024 * 10) / 10 : null;
  } catch { return null; }
}

function getCpuMs(pid) {
  try {
    const s = readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ');
    return ((parseInt(s[13]) + parseInt(s[14])) / 100) * 1000;
  } catch { return null; }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

// Mock server for pipeline tool
import { createServer } from 'node:http';
let mockServer;
function startMock() {
  return new Promise(r => {
    const data = { users: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `User ${i}`, score: Math.random() * 100 })) };
    mockServer = createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); });
    mockServer.listen(18923, r);
  });
}

async function main() {
  console.error('Ramp-to-Kill — Node.js ZeroMCP\n');
  await startMock();

  const proc = spawn('node', ['/zeromcp/nodejs/bin/mcp.js', 'serve', '/bench/tools'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.on('error', () => {});
  proc.stderr.on('data', () => {});

  const send = createHandler(proc);

  // Initialize
  await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ramp', version: '1.0' } } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await new Promise(r => setTimeout(r, 200));

  // Warmup
  for (let i = 0; i < 50; i++) {
    await send({ jsonrpc: '2.0', id: 100 + i, method: 'tools/call', params: { name: 'hello', arguments: { name: 'warmup' } } });
  }

  const results = [];
  let requestId = 1000;
  let broke = false;

  for (const level of LEVELS) {
    if (broke) break;
    const { concurrency, mix } = level;
    console.error(`  concurrency=${concurrency} mix=${JSON.stringify(mix)}`);

    const snapshots = [];
    let latencies = [];
    let errors = 0;
    let toolCounts = {};
    let cpuBefore = getCpuMs(proc.pid);
    const levelStart = performance.now();
    let nextSnapshot = INTERVAL * 1000;

    const inFlight = new Set();

    const fireRequest = () => {
      const tool = pickTool(mix);
      const args = TOOL_ARGS[tool] || {};
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      const id = requestId++;
      const t0 = performance.now();
      const p = send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: tool, arguments: args } })
        .then((res) => {
          latencies.push({ ms: performance.now() - t0, tool });
          if (res?.result?.isError) errors++;
        })
        .catch(() => { errors++; latencies.push({ ms: performance.now() - t0, tool }); })
        .finally(() => { inFlight.delete(p); });
      inFlight.add(p);
    };

    while (performance.now() - levelStart < DURATION_PER_LEVEL * 1000) {
      while (inFlight.size < concurrency) fireRequest();
      await new Promise(r => setTimeout(r, 0));

      const elapsed = performance.now() - levelStart;
      if (elapsed >= nextSnapshot) {
        const cpuNow = getCpuMs(proc.pid);
        const allMs = latencies.map(l => l.ms).sort((a, b) => a - b);
        const errorRate = latencies.length > 0 ? round(errors / latencies.length * 100) : 0;

        const snap = {
          t: Math.round(elapsed / 1000),
          concurrency,
          requests: latencies.length,
          errors,
          error_rate_pct: errorRate,
          rps: Math.round(latencies.length / INTERVAL),
          p50_us: Math.round(percentile(allMs, 50) * 1000),
          p95_us: Math.round(percentile(allMs, 95) * 1000),
          p99_us: Math.round(percentile(allMs, 99) * 1000),
          cpu_ms: cpuBefore != null && cpuNow != null ? round(cpuNow - cpuBefore) : null,
          memory_mb: getMemoryMB(proc.pid),
          tool_mix: { ...toolCounts },
        };
        snapshots.push(snap);

        console.error(`    t=${snap.t}s rps=${snap.rps} p50=${snap.p50_us}μs p99=${snap.p99_us}μs errors=${errors} (${errorRate}%) mem=${snap.memory_mb}MB`);

        if (errorRate > ERROR_THRESHOLD) {
          console.error(`    *** BROKE at concurrency=${concurrency} — ${errorRate}% error rate ***`);
          broke = true;
          break;
        }

        latencies = [];
        errors = 0;
        toolCounts = {};
        cpuBefore = cpuNow;
        nextSnapshot += INTERVAL * 1000;
      }
    }

    await Promise.all([...inFlight]).catch(() => {});
    results.push({ concurrency, mix, snapshots, broke });
  }

  proc.kill();
  mockServer.close();

  const maxSustained = results.filter(r => !r.broke).pop();
  const brokeAt = results.find(r => r.broke);

  console.log(JSON.stringify({
    language: 'node',
    error_threshold_pct: ERROR_THRESHOLD,
    max_sustained_concurrency: maxSustained?.concurrency || 0,
    broke_at_concurrency: brokeAt?.concurrency || 'never',
    levels: results,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
