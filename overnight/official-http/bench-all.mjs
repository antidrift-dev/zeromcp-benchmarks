#!/usr/bin/env node

/**
 * Official MCP SDK HTTP Benchmark — All 10 Languages
 * Builds and runs each official SDK's HTTP server, benchmarks 30s each.
 * Outputs JSON with results for all languages.
 *
 * Usage: node bench-all.mjs
 *   ENV DURATION (default 30)
 *   ENV INTERVAL (default 10)
 */

import { execSync } from 'node:child_process';

const DURATION = parseInt(process.env.DURATION || '30');
const INTERVAL = parseInt(process.env.INTERVAL || '10');
const PORT = 3000;
const WARMUP = 50;

const LANGUAGES = [
  'node', 'python', 'go', 'rust', 'java', 'kotlin',
  'csharp', 'ruby', 'php', 'swift',
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

async function waitForPort(port, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
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

async function benchmarkLanguage(lang) {
  const imageName = `zeromcp-bench-official-http-${lang}`;
  const containerName = `bench-official-http-${lang}`;

  console.error(`\n=== ${lang} ===`);

  // Build
  console.error(`  Building ${imageName}...`);
  try {
    execSync(
      `docker build -t ${imageName} -f zeromcp-benchmarks/overnight/official-http/${lang}/Dockerfile .`,
      { cwd: '/Users/chriswelker/Projects/antidrift', stdio: ['pipe', 'pipe', 'pipe'], timeout: 600000 }
    );
  } catch (err) {
    console.error(`  BUILD FAILED: ${err.stderr?.toString().slice(-200)}`);
    return { label: lang, error: 'Build failed' };
  }

  // Run container
  console.error(`  Starting container...`);
  try {
    execSync(`docker rm -f ${containerName} 2>/dev/null`, { stdio: 'pipe' });
  } catch {}

  try {
    execSync(
      `docker run -d --name ${containerName} -p ${PORT}:3000 -e PORT=3000 ${imageName}`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error(`  RUN FAILED: ${err.stderr?.toString().slice(-200)}`);
    return { label: lang, error: 'Container start failed' };
  }

  // Wait for health
  const ready = await waitForPort(PORT, 60000);
  if (!ready) {
    console.error(`  Server failed to start within 60s`);
    execSync(`docker logs ${containerName} 2>&1 | tail -10`, { stdio: 'inherit' });
    execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    return { label: lang, error: 'Server failed to start' };
  }

  // Warmup
  console.error(`  Warming up...`);
  for (let i = 0; i < WARMUP; i++) {
    try {
      await mcpRequest(100 + i, 'tools/call', { name: 'hello', arguments: { name: 'warmup' } });
    } catch {}
  }

  // Benchmark
  const snapshots = [];
  let latencies = [];
  const tierStart = performance.now();
  let nextSnapshotMs = INTERVAL * 1000;
  let requestId = 1000;

  console.error(`  Running for ${DURATION}s...`);

  while (performance.now() - tierStart < DURATION * 1000) {
    const t0 = performance.now();
    try {
      await mcpRequest(requestId++, 'tools/call', { name: 'hello', arguments: { name: 'bench' } });
      latencies.push(performance.now() - t0);
    } catch {
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - tierStart;
    if (elapsed >= nextSnapshotMs) {
      const sorted = [...latencies].sort((a, b) => a - b);

      const snap = {
        t: Math.round(elapsed / 1000),
        requests: latencies.length,
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
      };
      snapshots.push(snap);

      console.error(`    t=${snap.t}s  rps=${snap.rps}  p50=${snap.p50_ms}ms  p99=${snap.p99_ms}ms`);

      latencies = [];
      nextSnapshotMs += INTERVAL * 1000;
    }
  }

  // Get container memory
  let memoryMb = null;
  try {
    const stats = execSync(`docker stats --no-stream --format '{{.MemUsage}}' ${containerName}`, { encoding: 'utf8' }).trim();
    const match = stats.match(/([\d.]+)([MG])iB/);
    if (match) {
      memoryMb = parseFloat(match[1]);
      if (match[2] === 'G') memoryMb *= 1024;
      memoryMb = round(memoryMb);
    }
  } catch {}

  // Cleanup
  execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });

  const avgRps = snapshots.length > 0
    ? Math.round(snapshots.reduce((s, x) => s + x.rps, 0) / snapshots.length)
    : 0;

  return { label: lang, snapshots, avg_rps: avgRps, memory_mb: memoryMb };
}

async function main() {
  console.error(`Official MCP SDK HTTP Benchmark — All 10 Languages`);
  console.error(`  Duration: ${DURATION}s per language, Interval: ${INTERVAL}s\n`);

  const results = { type: 'official-sdk-http', duration_s: DURATION };

  for (const lang of LANGUAGES) {
    results[lang] = await benchmarkLanguage(lang);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
