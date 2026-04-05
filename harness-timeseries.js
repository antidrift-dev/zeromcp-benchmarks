#!/usr/bin/env node

/**
 * ZeroMCP Time-Series Benchmark Harness
 * Runs 4 tool complexity tiers for 5 minutes each, capturing snapshots every 10 seconds.
 * Output: JSON time-series data for interactive charts.
 *
 * Usage: node harness-timeseries.js --config config-timeseries.json
 */

import { spawn, execSync } from 'child_process';
import { createInterface } from 'readline';
import { createServer } from 'http';
import { readFileSync } from 'fs';

// Defaults — override via config
const DEFAULT_DURATION = 300;    // 5 minutes per tier
const DEFAULT_INTERVAL = 10;     // snapshot every 10 seconds
const WARMUP = 50;

// --- Reusable utilities ---

function createRequestHandler(proc) {
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
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
    if (match) return Math.round(parseInt(match[1]) / 1024 * 10) / 10;
  } catch {}
  return null;
}

function getCpuMs(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.split(' ');
    const utime = parseInt(fields[13]);
    const stime = parseInt(fields[14]);
    return ((utime + stime) / 100) * 1000;
  } catch {}
  return null;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function round(v, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

// --- Test data generators ---

const TIER_ARGS = {
  hello: { name: 'bench' },
  create_invoice: {
    customer_id: 'cust_12345',
    amount: 250.00,
    currency: 'USD',
    items: [
      { description: 'Widget A', quantity: 2, unit_price: 75.00 },
      { description: 'Widget B', quantity: 1, unit_price: 100.00 },
    ],
  },
  process_data: {
    records: Array.from({ length: 50 }, (_, i) => ({
      id: `rec_${i}`,
      value: Math.round(Math.random() * 1000) / 10,
      category: ['electronics', 'clothing', 'food', 'services'][i % 4],
    })),
  },
  pipeline: {
    url: 'http://localhost:18923/data',
    transform: 'summarize',
  },
};

// --- Mock server for pipeline tier ---

let mockServer;

function startMockServer() {
  return new Promise((resolve) => {
    const mockData = {
      users: Array.from({ length: 20 }, (_, i) => ({
        id: i, name: `User ${i}`, email: `user${i}@test.com`, score: Math.random() * 100,
      })),
      meta: { generated: new Date().toISOString(), version: '1.0' },
    };
    mockServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData));
    });
    mockServer.listen(18923, resolve);
  });
}

function stopMockServer() {
  return new Promise((resolve) => {
    if (mockServer) mockServer.close(resolve);
    else resolve();
  });
}

// --- Main benchmark ---

async function benchmarkTier(send, pid, tierName, durationSec, intervalSec) {
  const durationMs = durationSec * 1000;
  const intervalMs = intervalSec * 1000;
  const args = TIER_ARGS[tierName];
  if (!args) throw new Error(`Unknown tier: ${tierName}`);

  const snapshots = [];
  let latencies = [];
  let requestId = 0;
  let nextSnapshotMs = intervalMs;
  let cpuBefore = getCpuMs(pid);
  const tierStart = performance.now();

  console.error(`    [${tierName}] running for ${durationSec}s...`);

  while (performance.now() - tierStart < durationMs) {
    const t0 = performance.now();
    try {
      await send({
        jsonrpc: '2.0',
        id: 10000 + requestId++,
        method: 'tools/call',
        params: { name: tierName, arguments: args },
      });
      latencies.push(performance.now() - t0);
    } catch (err) {
      // Skip failed requests but keep going
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - tierStart;
    if (elapsed >= nextSnapshotMs) {
      const cpuNow = getCpuMs(pid);
      const cpuDelta = (cpuBefore != null && cpuNow != null) ? round(cpuNow - cpuBefore) : null;

      const sorted = [...latencies].sort((a, b) => a - b);
      snapshots.push({
        t: Math.round(elapsed / 1000),
        requests: latencies.length,
        rps: Math.round(latencies.length / intervalSec),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
        cpu_ms: cpuDelta,
        memory_mb: getMemoryMB(pid),
      });

      console.error(`      t=${Math.round(elapsed / 1000)}s  rps=${snapshots[snapshots.length - 1].rps}  p50=${snapshots[snapshots.length - 1].p50_ms}ms  mem=${snapshots[snapshots.length - 1].memory_mb}MB`);

      // Reset for next window
      latencies = [];
      cpuBefore = cpuNow;
      nextSnapshotMs += intervalMs;
    }
  }

  return { snapshots };
}

async function benchmarkServer(serverConfig, tiers, durationSec, intervalSec) {
  const fullEnv = { ...process.env, ...(serverConfig.env || {}) };
  const proc = spawn(serverConfig.command, serverConfig.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: fullEnv,
  });

  proc.on('error', (err) => console.error(`[harness] spawn error: ${err.message}`));
  proc.stderr.on('data', () => {}); // suppress

  const send = createRequestHandler(proc);

  // Initialize
  console.error(`  [${serverConfig.label}] initializing...`);
  try {
    await send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bench', version: '1.0' } },
    });
  } catch (err) {
    proc.kill();
    return { label: serverConfig.label, error: `Startup failed: ${err.message}` };
  }

  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await new Promise(r => setTimeout(r, 200));

  // Warmup all tiers
  for (const tier of tiers) {
    const args = TIER_ARGS[tier];
    if (!args) continue;
    for (let i = 0; i < WARMUP; i++) {
      try {
        await send({ jsonrpc: '2.0', id: 5000 + i, method: 'tools/call', params: { name: tier, arguments: args } });
      } catch {}
    }
  }

  // Run each tier
  const tierResults = {};
  for (const tier of tiers) {
    tierResults[tier] = await benchmarkTier(send, proc.pid, tier, durationSec, intervalSec);
  }

  proc.kill();
  return { label: serverConfig.label, tiers: tierResults };
}

// --- Entry point ---

async function main() {
  const configPath = process.argv.find((a, i) => process.argv[i - 1] === '--config') || 'config-timeseries.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  const durationSec = config.duration_seconds || DEFAULT_DURATION;
  const intervalSec = config.snapshot_interval_seconds || DEFAULT_INTERVAL;
  const tiers = config.tiers || ['hello', 'create_invoice', 'process_data', 'pipeline'];

  console.error(`ZeroMCP Time-Series Benchmark`);
  console.error(`  Duration: ${durationSec}s per tier, ${intervalSec}s intervals`);
  console.error(`  Tiers: ${tiers.join(', ')}`);
  console.error();

  // Start mock server for pipeline tier
  if (tiers.includes('pipeline')) {
    await startMockServer();
    console.error('  Mock server started on port 18923');
  }

  const results = { language: config.language };

  for (const server of config.servers) {
    console.error(`\n  === ${server.label} ===`);
    results[server.label] = await benchmarkServer(server, tiers, durationSec, intervalSec);
  }

  if (tiers.includes('pipeline')) {
    await stopMockServer();
  }

  // Output JSON to stdout
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
