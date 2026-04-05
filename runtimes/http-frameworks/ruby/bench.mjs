#!/usr/bin/env node

/**
 * Ruby HTTP Framework Time-Series Benchmark (Sinatra + Rack)
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DURATION = parseInt(process.env.DURATION || '300');
const INTERVAL = parseInt(process.env.INTERVAL || '10');
const WARMUP = 50;
const PORT = 3000;

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
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function mcpRequest(id, method, params) {
  const body = { jsonrpc: '2.0', id, method };
  if (params) body.params = params;
  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function benchmarkFramework(label, command, args) {
  console.error(`  [${label}] starting...`);

  const proc = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });
  proc.on('error', () => {});
  proc.stderr.on('data', () => {});

  const ready = await waitForPort(PORT, 30000);
  if (!ready) {
    proc.kill();
    return { label, error: 'Server failed to start' };
  }

  await mcpRequest(1, 'initialize', {
    protocolVersion: '2024-11-05', capabilities: {},
    clientInfo: { name: 'bench', version: '1.0' },
  });

  for (let i = 0; i < WARMUP; i++) {
    await mcpRequest(100 + i, 'tools/call', { name: 'hello', arguments: { name: 'warmup' } });
  }

  const snapshots = [];
  let latencies = [];
  let cpuBefore = getCpuMs(proc.pid);
  const tierStart = performance.now();
  let nextSnapshotMs = INTERVAL * 1000;
  let requestId = 0;

  console.error(`  [${label}] running for ${DURATION}s...`);

  while (performance.now() - tierStart < DURATION * 1000) {
    const t0 = performance.now();
    try {
      await mcpRequest(1000 + requestId++, 'tools/call', { name: 'hello', arguments: { name: 'bench' } });
      latencies.push(performance.now() - t0);
    } catch {
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - tierStart;
    if (elapsed >= nextSnapshotMs) {
      const cpuNow = getCpuMs(proc.pid);
      const cpuDelta = (cpuBefore != null && cpuNow != null) ? round(cpuNow - cpuBefore) : null;
      const sorted = [...latencies].sort((a, b) => a - b);

      snapshots.push({
        t: Math.round(elapsed / 1000),
        requests: latencies.length,
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
        cpu_ms: cpuDelta,
        memory_mb: getMemoryMB(proc.pid),
      });

      const s = snapshots[snapshots.length - 1];
      console.error(`    t=${s.t}s  rps=${s.rps}  p50=${s.p50_ms}ms  mem=${s.memory_mb}MB`);

      latencies = [];
      cpuBefore = cpuNow;
      nextSnapshotMs += INTERVAL * 1000;
    }
  }

  proc.kill();
  await new Promise(r => setTimeout(r, 500));

  return { label, snapshots };
}

async function main() {
  const frameworks = [
    {
      label: 'sinatra',
      command: 'ruby',
      args: ['server-sinatra.rb'],
    },
    {
      label: 'rack',
      command: 'ruby',
      args: ['server-rack.rb'],
    },
  ];

  console.error(`HTTP Framework Time-Series Benchmark (Ruby)`);
  console.error(`  Duration: ${DURATION}s, Interval: ${INTERVAL}s\n`);

  const results = { type: 'http-frameworks-ruby' };

  for (const fw of frameworks) {
    results[fw.label] = await benchmarkFramework(fw.label, fw.command, fw.args);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
