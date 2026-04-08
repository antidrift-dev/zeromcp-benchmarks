#!/usr/bin/env node

/**
 * Vapor HTTP Framework Time-Series Benchmark — Mixed Workload
 * Exercises tools/call, resources/read, resources/list, prompts/get,
 * prompts/list, tools/list, initialize, and ping.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DURATION = parseInt(process.env.DURATION || '300');
const INTERVAL = parseInt(process.env.INTERVAL || '10');
const WARMUP = 50;
const PORT = 3000;

// Weighted method mix (approximate percentages from mixed-workload-node results)
const METHOD_MIX = [
  { weight: 65, method: 'tools/call',      params: { name: 'hello', arguments: { name: 'bench' } } },
  { weight: 10, method: 'resources/read',   params: { uri: 'resource:///data.json' } },
  { weight: 5,  method: 'resources/list',   params: {} },
  { weight: 10, method: 'tools/list',       params: {} },
  { weight: 5,  method: 'prompts/get',      params: { name: 'greet', arguments: { name: 'Alice', tone: 'formal' } } },
  { weight: 2,  method: 'initialize',       params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bench', version: '1.0' } } },
  { weight: 3,  method: 'ping',             params: undefined },
];

const TOTAL_WEIGHT = METHOD_MIX.reduce((s, m) => s + m.weight, 0);

function pickMethod() {
  const r = Math.random() * TOTAL_WEIGHT;
  let cumulative = 0;
  for (const m of METHOD_MIX) {
    cumulative += m.weight;
    if (r < cumulative) return m;
  }
  return METHOD_MIX[0];
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function round(v, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
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
    return ((parseInt(fields[13]) + parseInt(fields[14])) / 100) * 1000;
  } catch {}
  return null;
}

async function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function mcpRequest(id, method, params) {
  const body = { jsonrpc: '2.0', id, method };
  if (params) body.params = params;
  const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function isError(resp) {
  if (!resp) return true;
  if (resp.error) return true;
  if (resp.result?.isError) return true;
  return false;
}

async function benchmarkFramework(label, command, args) {
  console.error(`  [${label}] starting...`);

  const proc = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });
  proc.on('error', (e) => console.error(`  [${label}] spawn error: ${e.message}`));
  proc.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.error(`  [${label}] ${msg}`);
  });

  const ready = await waitForPort(PORT, 30000);
  if (!ready) {
    proc.kill();
    return { label, error: 'Server failed to start' };
  }

  await mcpRequest(1, 'initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'bench', version: '1.0' },
  });

  // Warmup with mixed methods
  for (let i = 0; i < WARMUP; i++) {
    const m = pickMethod();
    await mcpRequest(100 + i, m.method, m.params);
  }

  const snapshots = [];
  let latencies = [];
  let errors = 0;
  let methodCounts = {};
  let cpuBefore = getCpuMs(proc.pid);
  const tierStart = performance.now();
  let nextSnapshotMs = INTERVAL * 1000;
  let requestId = 0;

  console.error(`  [${label}] running mixed workload for ${DURATION}s...`);

  while (performance.now() - tierStart < DURATION * 1000) {
    const m = pickMethod();
    const t0 = performance.now();
    try {
      const resp = await mcpRequest(1000 + requestId++, m.method, m.params);
      latencies.push(performance.now() - t0);
      methodCounts[m.method] = (methodCounts[m.method] || 0) + 1;
      if (isError(resp)) errors++;
    } catch {
      latencies.push(performance.now() - t0);
      errors++;
    }

    const elapsed = performance.now() - tierStart;
    if (elapsed >= nextSnapshotMs) {
      const cpuNow = getCpuMs(proc.pid);
      const cpuDelta = (cpuBefore != null && cpuNow != null) ? round(cpuNow - cpuBefore) : null;
      const sorted = [...latencies].sort((a, b) => a - b);

      snapshots.push({
        t: Math.round(elapsed / 1000),
        requests: latencies.length,
        errors,
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
        cpu_ms: cpuDelta,
        memory_mb: getMemoryMB(proc.pid),
      });

      const s = snapshots[snapshots.length - 1];
      console.error(`    t=${s.t}s  rps=${s.rps}  p50=${s.p50_ms}ms  errors=${s.errors}  mem=${s.memory_mb}MB`);

      latencies = [];
      errors = 0;
      cpuBefore = cpuNow;
      nextSnapshotMs += INTERVAL * 1000;
    }
  }

  proc.kill();
  await new Promise(r => setTimeout(r, 500));

  const totalErrors = snapshots.reduce((s, x) => s + x.errors, 0);
  return { label, snapshots, method_counts: methodCounts, total_errors: totalErrors };
}

async function main() {
  const frameworks = [
    {
      label: 'vapor',
      command: '/bench/server-vapor',
      args: [],
    },
  ];

  console.error(`HTTP Framework Mixed Workload Benchmark (Swift)`);
  console.error(`  Duration: ${DURATION}s, Interval: ${INTERVAL}s\n`);

  const results = { type: 'http-frameworks-swift-mixed' };

  for (const fw of frameworks) {
    results[fw.label] = await benchmarkFramework(fw.label, fw.command, fw.args);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
