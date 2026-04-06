#!/usr/bin/env node

/**
 * ZeroMCP HTTP Time-Series Benchmark — Best framework per language
 * Same methodology as official SDK bench: server in Docker, client on host, Docker stats.
 *
 * Usage: node bench-zeromcp-timeseries.mjs
 *   ENV DURATION (default 300)
 *   ENV INTERVAL (default 10)
 */

import { execSync } from 'node:child_process';

const DURATION = parseInt(process.env.DURATION || '300');
const INTERVAL = parseInt(process.env.INTERVAL || '10');
const PORT = 3000;
const WARMUP = 100;

// Best framework per language — image + server command override
const FRAMEWORKS = [
  { lang: 'node',   image: 'zeromcp-bench-http-node',   label: 'bare http', cmd: ['node', '/bench/server-bare.mjs'] },
  { lang: 'rust',   image: 'zeromcp-bench-http-rust',   label: 'Actix',     cmd: ['/bench/server-actix'] },
  { lang: 'go',     image: 'zeromcp-bench-http-go',     label: 'Chi',       cmd: ['/bench/server-chi'] },
  { lang: 'ruby',   image: 'zeromcp-bench-http-ruby',   label: 'Rack+Puma', cmd: ['bundle', 'exec', 'ruby', '/bench/server-rack.rb'] },
  { lang: 'python', image: 'zeromcp-bench-http-python',  label: 'Starlette', cmd: ['python', '/bench/server-starlette.py'] },
  { lang: 'java',   image: 'zeromcp-bench-http-java',   label: 'Javalin',   cmd: ['java', '-cp', '/bench/jars/*', 'ServerJavalin'] },
  { lang: 'kotlin', image: 'zeromcp-bench-http-kotlin',  label: 'Ktor',      cmd: ['java', '-jar', '/bench/ktor/server-ktor.jar'] },
  { lang: 'csharp', image: 'zeromcp-bench-http-csharp',  label: 'ASP.NET',   cmd: ['dotnet', '/bench/aspnet/bench-aspnet.dll'] },
  { lang: 'swift',  image: 'zeromcp-bench-http-swift',   label: 'Vapor',     cmd: ['/bench/server-vapor'] },
  { lang: 'php',    image: 'zeromcp-bench-http-php',     label: 'Slim',      cmd: ['php', '/bench/server-slim.php'] },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v, d = 2) {
  return Math.round(v * 10 ** d) / 10 ** d;
}

function getDockerStats(containerName) {
  try {
    const raw = execSync(
      `docker stats --no-stream --format '{{.MemUsage}}|||{{.CPUPerc}}' ${containerName}`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    const [memPart, cpuPart] = raw.split('|||');

    let memoryMb = null;
    const memMatch = memPart.match(/([\d.]+)\s*(MiB|GiB|KiB)/);
    if (memMatch) {
      memoryMb = parseFloat(memMatch[1]);
      if (memMatch[2] === 'GiB') memoryMb *= 1024;
      if (memMatch[2] === 'KiB') memoryMb /= 1024;
      memoryMb = round(memoryMb);
    }

    let cpuPct = null;
    const cpuMatch = cpuPart.match(/([\d.]+)%/);
    if (cpuMatch) cpuPct = round(parseFloat(cpuMatch[1]));

    return { memory_mb: memoryMb, cpu_pct: cpuPct };
  } catch {
    return { memory_mb: null, cpu_pct: null };
  }
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

async function mcpRequest(id) {
  const res = await fetch(`http://127.0.0.1:${PORT}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id,
      method: 'tools/call',
      params: { name: 'hello', arguments: { name: 'bench' } },
    }),
  });
  return res.json();
}

async function benchmarkFramework(fw) {
  const containerName = `bench-zeromcp-ts-${fw.lang}`;

  console.error(`\n=== ${fw.lang} (${fw.label}) ===`);

  try { execSync(`docker rm -f ${containerName} 2>/dev/null`, { stdio: 'pipe' }); } catch {}

  console.error(`  Starting container...`);
  const cmdStr = fw.cmd.map(c => `"${c}"`).join(' ');
  try {
    execSync(
      `docker run --rm -d --name ${containerName} -p ${PORT}:3000 -e PORT=3000 -e ASPNETCORE_URLS=http://0.0.0.0:3000 ${fw.image} ${fw.cmd.join(' ')}`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error(`  Container start failed`);
    return { label: fw.lang, framework: fw.label, error: 'Container start failed' };
  }

  const ready = await waitForPort(PORT, 60000);
  if (!ready) {
    console.error(`  Server failed to start within 60s`);
    try { execSync(`docker logs ${containerName} 2>&1 | tail -5`, { stdio: 'inherit' }); } catch {}
    execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    return { label: fw.lang, framework: fw.label, error: 'Server failed to start' };
  }

  // Warmup
  console.error(`  Warming up...`);
  for (let i = 0; i < WARMUP; i++) {
    try { await mcpRequest(100 + i); } catch {}
  }

  const initStats = getDockerStats(containerName);
  console.error(`  Initial: mem=${initStats.memory_mb}MB cpu=${initStats.cpu_pct}%`);

  // Time-series
  const snapshots = [];
  let latencies = [];
  const tierStart = performance.now();
  let nextSnapshotMs = INTERVAL * 1000;
  let requestId = 1000;

  console.error(`  Running for ${DURATION}s...`);

  while (performance.now() - tierStart < DURATION * 1000) {
    const t0 = performance.now();
    try {
      await mcpRequest(requestId++);
      latencies.push(performance.now() - t0);
    } catch {
      latencies.push(performance.now() - t0);
    }

    const elapsed = performance.now() - tierStart;
    if (elapsed >= nextSnapshotMs) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const stats = getDockerStats(containerName);

      const snap = {
        t: Math.round(elapsed / 1000),
        requests: latencies.length,
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p95_ms: round(percentile(sorted, 95)),
        p99_ms: round(percentile(sorted, 99)),
        memory_mb: stats.memory_mb,
        cpu_pct: stats.cpu_pct,
      };
      snapshots.push(snap);

      console.error(`    t=${snap.t}s  rps=${snap.rps}  p50=${snap.p50_ms}ms  p99=${snap.p99_ms}ms  mem=${snap.memory_mb}MB  cpu=${snap.cpu_pct}%`);

      latencies = [];
      nextSnapshotMs += INTERVAL * 1000;
    }
  }

  const finalStats = getDockerStats(containerName);
  execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });

  const avgRps = snapshots.length > 0
    ? Math.round(snapshots.reduce((s, x) => s + x.rps, 0) / snapshots.length)
    : 0;
  const avgP50 = snapshots.length > 0
    ? round(snapshots.reduce((s, x) => s + x.p50_ms, 0) / snapshots.length)
    : 0;
  const avgP99 = snapshots.length > 0
    ? round(snapshots.reduce((s, x) => s + x.p99_ms, 0) / snapshots.length)
    : 0;
  const memRange = snapshots.length > 0
    ? { min: Math.min(...snapshots.map(s => s.memory_mb).filter(Boolean)),
        max: Math.max(...snapshots.map(s => s.memory_mb).filter(Boolean)) }
    : null;
  const avgCpu = snapshots.length > 0
    ? round(snapshots.filter(s => s.cpu_pct != null).reduce((s, x) => s + x.cpu_pct, 0) / snapshots.filter(s => s.cpu_pct != null).length)
    : 0;

  console.error(`  DONE: avg=${avgRps} rps, p50=${avgP50}ms, p99=${avgP99}ms, mem=${memRange?.min}-${memRange?.max}MB, cpu=${avgCpu}%`);

  return {
    label: fw.lang,
    framework: fw.label,
    duration_s: DURATION,
    avg_rps: avgRps,
    avg_p50_ms: avgP50,
    avg_p99_ms: avgP99,
    memory_mb: memRange,
    avg_cpu_pct: avgCpu,
    initial_memory_mb: initStats.memory_mb,
    final_memory_mb: finalStats.memory_mb,
    snapshots,
  };
}

async function main() {
  console.error(`ZeroMCP HTTP Time-Series Benchmark — Best framework per language`);
  console.error(`  Duration: ${DURATION}s per language, Interval: ${INTERVAL}s\n`);

  const results = {
    type: 'zeromcp-http-timeseries',
    duration_s: DURATION,
    interval_s: INTERVAL,
    languages: {},
  };

  for (const fw of FRAMEWORKS) {
    results.languages[fw.lang] = await benchmarkFramework(fw);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
