#!/usr/bin/env node

/**
 * Ramp-to-Kill over Streamable HTTP — Node.js
 * POST /mcp with JSON-RPC body, mixed traffic, increasing concurrency.
 * Stops when error rate exceeds 0.5%.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const DURATION_PER_LEVEL = 30;
const INTERVAL = 5;
const ERROR_THRESHOLD = 0.5;
const PORT = 14999;

const LEVELS = [
  { concurrency: 1,   mix: { hello: 100 } },
  { concurrency: 5,   mix: { hello: 70, create_invoice: 20, process_data: 10 } },
  { concurrency: 10,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 25,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 50,  mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 100, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 200, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 500, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
  { concurrency: 1000, mix: { hello: 50, create_invoice: 30, process_data: 15, pipeline: 5 } },
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

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

function getMemory() {
  const mem = process.memoryUsage();
  return {
    rss_mb: round(mem.rss / 1024 / 1024),
    heap_used_mb: round(mem.heapUsed / 1024 / 1024),
    heap_total_mb: round(mem.heapTotal / 1024 / 1024),
    external_mb: round(mem.external / 1024 / 1024),
    array_buffers_mb: round(mem.arrayBuffers / 1024 / 1024),
  };
}

function getCpuUsage(prev) {
  const cpu = process.cpuUsage(prev);
  return {
    user_ms: round(cpu.user / 1000),
    system_ms: round(cpu.system / 1000),
    total_ms: round((cpu.user + cpu.system) / 1000),
    raw: cpu,
  };
}

function measureEventLoopLag() {
  return new Promise(resolve => {
    const start = performance.now();
    setImmediate(() => resolve(round((performance.now() - start) * 1000))); // microseconds
  });
}

async function mcpRequest(id, tool, args) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id, method: 'tools/call',
    params: { name: tool, arguments: args },
  });

  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.error('Ramp-to-Kill over Streamable HTTP — Node.js ZeroMCP\n');

  // Start mock server for pipeline tool
  const mockData = { users: Array.from({ length: 20 }, (_, i) => ({ id: i, name: `User ${i}`, score: Math.random() * 100 })) };
  const mockServer = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData));
  });
  mockServer.listen(18923);

  // Start ZeroMCP HTTP server using createHandler
  const { createHandler } = await import('/zeromcp/nodejs/dist/handler.js');
  const handler = await createHandler('/bench/tools');

  const mcpServer = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200).end('{"status":"ok"}');
      return;
    }
    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const result = await handler(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(404).end();
  });
  mcpServer.listen(PORT);

  // Wait for server
  await new Promise(r => setTimeout(r, 500));

  // Initialize MCP session
  await mcpRequest(0, 'hello', { name: 'init' });

  // Warmup
  for (let i = 0; i < 50; i++) {
    await mcpRequest(100 + i, 'hello', { name: 'warmup' });
  }

  const results = [];
  let requestId = 1000;
  let broke = false;

  for (const level of LEVELS) {
    if (broke) break;
    const { concurrency, mix } = level;
    console.error(`  concurrency=${concurrency}`);

    const snapshots = [];
    let latencies = [];
    let errors = 0;
    let cpuPrev = process.cpuUsage();
    const levelStart = performance.now();
    let nextSnapshot = INTERVAL * 1000;

    const inFlight = new Set();

    const fireRequest = () => {
      const tool = pickTool(mix);
      const args = TOOL_ARGS[tool] || {};
      const id = requestId++;
      const t0 = performance.now();
      const p = mcpRequest(id, tool, args)
        .then((res) => {
          latencies.push(performance.now() - t0);
          if (res?.result?.isError) errors++;
        })
        .catch(() => { errors++; latencies.push(performance.now() - t0); })
        .finally(() => { inFlight.delete(p); });
      inFlight.add(p);
    };

    while (performance.now() - levelStart < DURATION_PER_LEVEL * 1000) {
      while (inFlight.size < concurrency) fireRequest();
      await new Promise(r => setTimeout(r, 0));

      const elapsed = performance.now() - levelStart;
      if (elapsed >= nextSnapshot) {
        const allMs = latencies.map(l => l).sort((a, b) => a - b);
        const errorRate = latencies.length > 0 ? round(errors / latencies.length * 100) : 0;
        const mem = getMemory();
        const cpu = getCpuUsage(cpuPrev);
        const eventLoopLag = await measureEventLoopLag();

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
          memory: mem,
          cpu: {
            user_ms: cpu.user_ms,
            system_ms: cpu.system_ms,
            total_ms: cpu.total_ms,
          },
          event_loop_lag_us: eventLoopLag,
          in_flight: inFlight.size,
        };
        snapshots.push(snap);
        cpuPrev = cpu.raw;

        console.error(`    t=${snap.t}s rps=${snap.rps} p50=${snap.p50_us}μs p99=${snap.p99_us}μs errors=${errors} (${errorRate}%) rss=${mem.rss_mb}MB heap=${mem.heap_used_mb}/${mem.heap_total_mb}MB cpu=${cpu.total_ms}ms lag=${eventLoopLag}μs`);

        if (errorRate > ERROR_THRESHOLD) {
          console.error(`    *** BROKE at concurrency=${concurrency} — ${errorRate}% error rate ***`);
          broke = true;
          break;
        }

        latencies = [];
        errors = 0;
        nextSnapshot += INTERVAL * 1000;
      }
    }

    await Promise.all([...inFlight]).catch(() => {});
    results.push({ concurrency, mix, snapshots, broke });
  }

  mcpServer.close();
  mockServer.close();

  const maxSustained = results.filter(r => !r.broke).pop();
  const brokeAt = results.find(r => r.broke);

  console.log(JSON.stringify({
    language: 'node',
    transport: 'streamable-http',
    error_threshold_pct: ERROR_THRESHOLD,
    max_sustained_concurrency: maxSustained?.concurrency || 0,
    broke_at_concurrency: brokeAt?.concurrency || 'never',
    levels: results,
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
