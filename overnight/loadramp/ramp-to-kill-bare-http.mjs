#!/usr/bin/env node

/**
 * Ramp-to-Kill — Bare HTTP echo (no ZeroMCP)
 * Same test as ramp-to-kill-http.mjs but without ZeroMCP.
 * Isolates whether the breaking point is Node.js HTTP or ZeroMCP.
 */

import { createServer } from 'node:http';

const DURATION_PER_LEVEL = 30;
const INTERVAL = 5;
const ERROR_THRESHOLD = 0.5;
const PORT = 14999;

const LEVELS = [
  { concurrency: 1000 },
  { concurrency: 2000 },
  { concurrency: 3000 },
  { concurrency: 5000 },
  { concurrency: 10000 },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

async function main() {
  console.error('Ramp-to-Kill — Bare HTTP echo (no ZeroMCP)\n');

  // Bare echo server — no ZeroMCP, just parse + respond
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: parsed.id,
          result: { content: [{ type: 'text', text: 'Hello, bench!' }] }
        }));
      });
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(PORT);
  await new Promise(r => setTimeout(r, 500));

  const results = [];
  let requestId = 0;
  let broke = false;

  for (const level of LEVELS) {
    if (broke) break;
    const { concurrency } = level;
    console.error(`  concurrency=${concurrency}`);

    const snapshots = [];
    let latencies = [];
    let errors = 0;
    const levelStart = performance.now();
    let nextSnapshot = INTERVAL * 1000;
    const inFlight = new Set();

    const fireRequest = () => {
      const id = requestId++;
      const t0 = performance.now();
      const body = JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'hello', arguments: { name: 'bench' } } });
      const p = fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
        .then(r => r.json())
        .then(() => { latencies.push(performance.now() - t0); })
        .catch(() => { errors++; latencies.push(performance.now() - t0); })
        .finally(() => { inFlight.delete(p); });
      inFlight.add(p);
    };

    while (performance.now() - levelStart < DURATION_PER_LEVEL * 1000) {
      while (inFlight.size < concurrency) fireRequest();
      await new Promise(r => setTimeout(r, 0));

      const elapsed = performance.now() - levelStart;
      if (elapsed >= nextSnapshot) {
        const allMs = [...latencies].sort((a, b) => a - b);
        const errorRate = latencies.length > 0 ? round(errors / latencies.length * 100) : 0;
        const mem = process.memoryUsage();

        const snap = {
          t: Math.round(elapsed / 1000),
          concurrency,
          requests: latencies.length,
          errors,
          error_rate_pct: errorRate,
          rps: Math.round(latencies.length / INTERVAL),
          p50_us: Math.round(percentile(allMs, 50) * 1000),
          p99_us: Math.round(percentile(allMs, 99) * 1000),
          rss_mb: round(mem.rss / 1024 / 1024),
          heap_mb: round(mem.heapUsed / 1024 / 1024),
        };
        snapshots.push(snap);

        console.error(`    t=${snap.t}s rps=${snap.rps} p50=${snap.p50_us}μs p99=${snap.p99_us}μs errors=${errors} (${errorRate}%) rss=${snap.rss_mb}MB`);

        if (errorRate > ERROR_THRESHOLD) {
          console.error(`    *** BROKE at concurrency=${concurrency} — ${errorRate}% ***`);
          broke = true;
          break;
        }

        latencies = [];
        errors = 0;
        nextSnapshot += INTERVAL * 1000;
      }
    }

    await Promise.all([...inFlight]).catch(() => {});
    results.push({ concurrency, snapshots, broke });
  }

  server.close();

  console.log(JSON.stringify({
    type: 'bare-http-echo',
    error_threshold_pct: ERROR_THRESHOLD,
    broke_at_concurrency: results.find(r => r.broke)?.concurrency || 'never',
    levels: results,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
