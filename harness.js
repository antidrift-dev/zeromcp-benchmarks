#!/usr/bin/env node

/**
 * ZeroMCP Benchmark Harness
 * Spawns a server, measures startup time, latency, throughput, and memory.
 *
 * Usage: node harness.js <label> <command> [args...]
 * Example: node harness.js "official" node official/server.mjs
 *
 * Or run both via config:
 * node harness.js --config config.json
 */

import { spawn, execSync } from 'child_process';
import { createInterface } from 'readline';
import { readFileSync, existsSync } from 'fs';

const WARMUP = 50;
const ITERATIONS = 1000;

function createRequestHandler(proc) {
  const rl = createInterface({ input: proc.stdout });
  const pending = [];

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try { parsed = JSON.parse(trimmed); }
    catch { return; }
    // Skip notifications (no id) — some SDKs emit log messages
    if (parsed.id === undefined || parsed.id === null) return;
    if (pending.length === 0) return;
    const { resolve, timer } = pending.shift();
    clearTimeout(timer);
    resolve(parsed);
  });

  return (request) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = pending.findIndex(p => p.timer === timer);
        if (idx !== -1) pending.splice(idx, 1);
        reject(new Error('Timeout'));
      }, 30000);
      pending.push({ resolve, reject, timer });
      proc.stdin.write(JSON.stringify(request) + '\n');
    });
  };
}

function getMemoryMB(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
    if (match) return parseInt(match[1]) / 1024;
  } catch {}
  return null;
}

function getCpuMs(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.split(' ');
    // fields[13] = utime (user), fields[14] = stime (system), in clock ticks
    const utime = parseInt(fields[13]);
    const stime = parseInt(fields[14]);
    const ticksPerSec = 100; // sysconf(_SC_CLK_TCK) is typically 100 on Linux
    return ((utime + stime) / ticksPerSec) * 1000; // convert to ms
  } catch {}
  return null;
}

function getDepsSize(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const out = execSync(`du -sm ${path} 2>/dev/null`).toString().trim();
    return parseFloat(out.split('\t')[0]);
  } catch {}
  return null;
}

function percentile(sorted, p) {
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

async function benchmark(label, command, args, env, depsPath) {
  const fullEnv = { ...process.env, ...(env || {}) };
  const proc = spawn(command, args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: fullEnv,
  });

  proc.on('error', (err) => console.error(`[harness] spawn error: ${err.message}`));
  proc.stderr.on('data', (d) => console.error(`[harness:stderr] ${d.toString().trim().slice(0, 200)}`));

  // Measure startup
  const startTime = performance.now();
  const send = createRequestHandler(proc);

  let startupMs;
  try {
    await send({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'benchmark', version: '1.0' },
      },
    });
    startupMs = performance.now() - startTime;
  } catch (err) {
    proc.kill();
    return { label, error: `Startup failed: ${err.message}` };
  }

  // Send initialized notification
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0', method: 'notifications/initialized',
  }) + '\n');
  await new Promise(r => setTimeout(r, 100));

  // Memory at idle
  const memoryIdle = getMemoryMB(proc.pid);

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await send({
      jsonrpc: '2.0', id: 100 + i, method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'bench' } },
    });
  }

  // CPU before benchmark
  const cpuBefore = getCpuMs(proc.pid);

  // Benchmark
  const latencies = [];
  const batchStart = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await send({
      jsonrpc: '2.0', id: 1000 + i, method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'bench' } },
    });
    latencies.push(performance.now() - t0);
  }

  const totalMs = performance.now() - batchStart;

  // CPU and memory at peak
  const cpuAfter = getCpuMs(proc.pid);
  const memoryPeak = getMemoryMB(proc.pid);
  const cpuMs = (cpuBefore != null && cpuAfter != null) ? Math.round((cpuAfter - cpuBefore) * 100) / 100 : null;

  proc.kill();

  // Calculate stats
  latencies.sort((a, b) => a - b);

  const result = {
    label,
    startup_ms: Math.round(startupMs * 100) / 100,
    p50_ms: Math.round(percentile(latencies, 50) * 100) / 100,
    p95_ms: Math.round(percentile(latencies, 95) * 100) / 100,
    p99_ms: Math.round(percentile(latencies, 99) * 100) / 100,
    rps: Math.round(ITERATIONS / (totalMs / 1000)),
    cpu_ms: cpuMs,
    cpu_per_req_us: cpuMs != null ? Math.round((cpuMs / ITERATIONS) * 1000 * 100) / 100 : null,
    memory_idle_mb: memoryIdle ? Math.round(memoryIdle * 10) / 10 : null,
    memory_peak_mb: memoryPeak ? Math.round(memoryPeak * 10) / 10 : null,
  };

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--config') {
    const config = JSON.parse(readFileSync(args[1] || 'config.json', 'utf8'));
    const results = { language: config.language };

    for (const server of config.servers) {
      const result = await benchmark(
        server.label,
        server.command,
        server.args,
        server.env,
        server.deps_path,
      );
      results[server.label] = result;
    }

    console.log(JSON.stringify(results, null, 2));
  } else {
    // Direct mode: node harness.js <label> <command> [args...]
    const label = args[0];
    const command = args[1];
    const cmdArgs = args.slice(2);
    const result = await benchmark(label, command, cmdArgs);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
