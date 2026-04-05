#!/usr/bin/env node

/**
 * Load Ramp Benchmark — All 10 ZeroMCP Languages
 * Fires requests with increasing concurrency (1, 5, 10, 25, 50, 100) over stdio,
 * 30 seconds per level, finds where each language breaks.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

const RAMP_LEVELS = [1, 5, 10, 25, 50, 100]; // concurrent connections
const DURATION_PER_LEVEL = 30; // seconds per concurrency level
const INTERVAL = 5; // snapshot every 5 seconds

const SERVERS = [
  {
    name: 'nodejs',
    command: 'node',
    args: ['/zeromcp/nodejs/bin/mcp.js', 'serve', '/zeromcp/nodejs/examples/tools'],
  },
  {
    name: 'python',
    command: 'python3',
    args: ['-m', 'zeromcp', 'serve', '/zeromcp/python/examples/tools'],
    env: { PYTHONPATH: '/zeromcp/python' },
  },
  {
    name: 'go',
    command: 'zeromcp-go',
    args: [],
  },
  {
    name: 'ruby',
    command: 'ruby',
    args: ['-I', '/zeromcp/ruby/lib', '/zeromcp/ruby/bin/zeromcp', 'serve', '/zeromcp/ruby/tools'],
  },
  {
    name: 'rust',
    command: '/zeromcp/rust/target/release/examples/hello',
    args: [],
  },
  {
    name: 'php',
    command: 'php',
    args: ['/zeromcp/php/zeromcp.php', 'serve', '/zeromcp/php/tools'],
  },
  {
    name: 'swift',
    command: 'zeromcp-swift',
    args: [],
  },
  {
    name: 'kotlin',
    command: '/zeromcp/kotlin/example/build/install/example/bin/example',
    args: [],
  },
  {
    name: 'java',
    command: 'java',
    args: ['-Dfile.encoding=UTF-8', '-cp', '/zeromcp/java/target/zeromcp-0.1.0.jar:/zeromcp/java/target/deps/*:/tmp/java-out', 'Main'],
  },
  {
    name: 'csharp',
    command: '/tmp/csharp-out/Example',
    args: [],
  },
];

function createHandler(proc) {
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
    const s = readFileSync(`/proc/${pid}/status`, 'utf8');
    const m = s.match(/VmRSS:\s+(\d+)\s+kB/);
    return m ? Math.round(parseInt(m[1]) / 1024 * 10) / 10 : null;
  } catch { return null; }
}

function getCpuMs(pid) {
  try {
    const s = readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ');
    return ((parseInt(s[13]) + parseInt(s[14])) / 100) * 1000;
  } catch { return null; }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}

function round(v) { return Math.round(v * 100) / 100; }

async function rampTest(server) {
  const label = server.name;
  console.error(`\n  [${label}] starting...`);

  const env = { ...process.env, ...(server.env || {}) };
  const proc = spawn(server.command, server.args, { stdio: ['pipe', 'pipe', 'pipe'], env });
  proc.on('error', (err) => {
    console.error(`  [${label}] spawn error: ${err.message}`);
  });
  proc.stderr.on('data', () => {});

  const send = createHandler(proc);

  // Initialize
  try {
    await send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'loadramp', version: '1.0' } } });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    proc.kill();
    console.error(`  [${label}] failed to initialize: ${err.message}`);
    return { label, error: 'Failed to initialize' };
  }

  // Warmup
  for (let i = 0; i < 50; i++) {
    try {
      await send({ jsonrpc: '2.0', id: 100 + i, method: 'tools/call', params: { name: 'hello', arguments: { name: 'warmup' } } });
    } catch {
      break;
    }
  }

  const levels = [];
  let requestId = 1000;
  let broken = false;

  for (const concurrency of RAMP_LEVELS) {
    if (broken) break;
    console.error(`    concurrency=${concurrency}...`);

    const snapshots = [];
    let latencies = [];
    let errors = 0;
    let cpuBefore = getCpuMs(proc.pid);
    const levelStart = performance.now();
    let nextSnapshot = INTERVAL * 1000;

    // Fire requests with concurrency
    const inFlight = new Set();

    const fireRequest = () => {
      const id = requestId++;
      const t0 = performance.now();
      const p = send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'hello', arguments: { name: 'load' } } })
        .then(() => { latencies.push(performance.now() - t0); })
        .catch(() => { errors++; latencies.push(performance.now() - t0); })
        .finally(() => { inFlight.delete(p); });
      inFlight.add(p);
      return p;
    };

    while (performance.now() - levelStart < DURATION_PER_LEVEL * 1000) {
      // Maintain concurrency level
      while (inFlight.size < concurrency) {
        fireRequest();
      }
      await new Promise(r => setTimeout(r, 0)); // yield

      const elapsed = performance.now() - levelStart;
      if (elapsed >= nextSnapshot) {
        const cpuNow = getCpuMs(proc.pid);
        const sorted = [...latencies].sort((a, b) => a - b);
        snapshots.push({
          t: Math.round(elapsed / 1000),
          concurrency,
          requests: latencies.length,
          errors,
          rps: Math.round(latencies.length / INTERVAL),
          error_rate: latencies.length > 0 ? round(errors / latencies.length * 100) : 0,
          p50_ms: round(percentile(sorted, 50)),
          p95_ms: round(percentile(sorted, 95)),
          p99_ms: round(percentile(sorted, 99)),
          cpu_ms: cpuBefore != null && cpuNow != null ? round(cpuNow - cpuBefore) : null,
          memory_mb: getMemoryMB(proc.pid),
        });

        const s = snapshots[snapshots.length - 1];
        console.error(`      t=${s.t}s rps=${s.rps} p50=${s.p50_ms}ms errors=${errors} mem=${s.memory_mb}MB`);

        // Check if broken
        if (s.error_rate > 5) {
          console.error(`      BROKEN at concurrency=${concurrency} (${s.error_rate}% error rate)`);
          broken = true;
          break;
        }

        latencies = [];
        errors = 0;
        cpuBefore = cpuNow;
        nextSnapshot += INTERVAL * 1000;
      }
    }

    // Wait for in-flight to finish
    await Promise.all([...inFlight]).catch(() => {});

    levels.push({ concurrency, snapshots, broken });
  }

  proc.kill();
  return { label, levels };
}

async function main() {
  console.error('Load Ramp Benchmark — All Languages\n');

  // Allow filtering via env var, e.g. LANGUAGES=nodejs,go
  const filter = process.env.LANGUAGES
    ? process.env.LANGUAGES.split(',').map(s => s.trim().toLowerCase())
    : null;

  const servers = filter
    ? SERVERS.filter(s => filter.includes(s.name))
    : SERVERS;

  const results = {};
  for (const server of servers) {
    results[server.name] = await rampTest(server);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
