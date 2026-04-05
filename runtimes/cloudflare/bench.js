#!/usr/bin/env node

/**
 * Benchmark ZeroMCP running on Cloudflare Workers (via wrangler dev).
 * Fires HTTP requests to the local worker and measures latency/throughput.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = 8787;
const WARMUP = 50;
const ITERATIONS = 1000;

function percentile(sorted, p) {
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, idx)];
}

function round(v, d = 2) {
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

async function waitForPort(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function httpRequest(method, path, body) {
  const url = `http://localhost:${PORT}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function main() {
  console.error('Starting wrangler dev...');
  const proc = spawn('wrangler', ['dev', '--port', String(PORT), '--local'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  proc.stderr.on('data', () => {}); // suppress wrangler output

  const ready = await waitForPort(PORT);
  if (!ready) {
    console.error('Worker failed to start');
    proc.kill();
    console.log(JSON.stringify({ error: 'Worker failed to start' }));
    process.exit(1);
  }

  const startupMs = performance.now();

  // Initialize
  await httpRequest('POST', '/mcp', {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bench', version: '1.0' } },
  });

  const initMs = round(performance.now() - startupMs);

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await httpRequest('POST', '/mcp', {
      jsonrpc: '2.0', id: 100 + i, method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'bench' } },
    });
  }

  // Benchmark
  const latencies = [];
  const batchStart = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    await httpRequest('POST', '/mcp', {
      jsonrpc: '2.0', id: 1000 + i, method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'bench' } },
    });
    latencies.push(performance.now() - t0);
  }

  const totalMs = performance.now() - batchStart;
  latencies.sort((a, b) => a - b);

  proc.kill();

  const result = {
    runtime: 'cloudflare-workers',
    init_ms: initMs,
    p50_ms: round(percentile(latencies, 50)),
    p95_ms: round(percentile(latencies, 95)),
    p99_ms: round(percentile(latencies, 99)),
    rps: Math.round(ITERATIONS / (totalMs / 1000)),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
