#!/usr/bin/env node

/**
 * Overhead Measurement
 * Compare: bare HTTP echo vs bare HTTP + ZeroMCP handler
 * Shows exactly how much overhead ZeroMCP adds to an HTTP framework.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const DURATION = 60; // seconds per test
const INTERVAL = 10;
const WARMUP = 100;
const PORT = 14567;

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

async function waitForPort(port, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const r = await fetch(`http://localhost:${port}/health`); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function benchmark(label, port) {
  console.error(`  [${label}] benchmarking for ${DURATION}s...`);

  // Warmup
  for (let i = 0; i < WARMUP; i++) {
    await fetch(`http://localhost:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: 'hello', arguments: { name: 'bench' } } }),
    }).catch(() => {});
  }

  const snapshots = [];
  let latencies = [];
  const start = performance.now();
  let nextSnapshot = INTERVAL * 1000;

  while (performance.now() - start < DURATION * 1000) {
    const t0 = performance.now();
    try {
      await fetch(`http://localhost:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'hello', arguments: { name: 'bench' } } }),
      });
      latencies.push(performance.now() - t0);
    } catch {
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - start;
    if (elapsed >= nextSnapshot) {
      const sorted = [...latencies].sort((a, b) => a - b);
      snapshots.push({
        t: Math.round(elapsed / 1000),
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
      });
      const s = snapshots[snapshots.length - 1];
      console.error(`    t=${s.t}s rps=${s.rps} p50=${s.p50_ms}ms`);
      latencies = [];
      nextSnapshot += INTERVAL * 1000;
    }
  }

  return { label, snapshots };
}

async function main() {
  console.error('Overhead Measurement: bare echo vs ZeroMCP handler\n');

  // --- Server 1: Bare echo (no ZeroMCP) ---
  const echoServer = createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200).end('{"status":"ok"}'); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { id } = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: 'Hello, bench!' }] }
      }));
    });
  });

  echoServer.listen(PORT);
  await waitForPort(PORT);
  const echoResult = await benchmark('bare-echo', PORT);
  echoServer.close();
  await new Promise(r => setTimeout(r, 500));

  // --- Server 2: ZeroMCP handler ---
  const { createHandler } = await import('/zeromcp/nodejs/dist/handler.js');
  const handler = await createHandler('/zeromcp/nodejs/examples/tools');

  const mcpServer = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200).end('{"status":"ok"}'); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      const result = await handler(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
  });

  mcpServer.listen(PORT);
  await waitForPort(PORT);
  const mcpResult = await benchmark('zeromcp-handler', PORT);
  mcpServer.close();

  // --- Calculate overhead ---
  const echoAvgRps = echoResult.snapshots.reduce((s, x) => s + x.rps, 0) / echoResult.snapshots.length;
  const mcpAvgRps = mcpResult.snapshots.reduce((s, x) => s + x.rps, 0) / mcpResult.snapshots.length;
  const echoP50 = echoResult.snapshots.reduce((s, x) => s + x.p50_ms, 0) / echoResult.snapshots.length;
  const mcpP50 = mcpResult.snapshots.reduce((s, x) => s + x.p50_ms, 0) / mcpResult.snapshots.length;

  const overhead = {
    rps_reduction_pct: round((1 - mcpAvgRps / echoAvgRps) * 100),
    latency_increase_ms: round(mcpP50 - echoP50),
    latency_increase_pct: round((mcpP50 / echoP50 - 1) * 100),
  };

  console.log(JSON.stringify({
    bare_echo: echoResult,
    zeromcp_handler: mcpResult,
    overhead,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
