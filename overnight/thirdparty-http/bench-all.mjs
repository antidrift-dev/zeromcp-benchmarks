#!/usr/bin/env node

/**
 * Third-party MCP Framework HTTP Benchmark
 * Speaks proper Streamable HTTP protocol (sessions, Accept headers, etc.)
 * Also handles simple JSON-RPC POST for frameworks that support it.
 *
 * Usage: node bench-all.mjs
 *   ENV DURATION (default 300)
 *   ENV INTERVAL (default 10)
 *   ENV FRAMEWORKS (comma-separated, default all)
 */

import { execSync } from 'node:child_process';

const DURATION = parseInt(process.env.DURATION || '300');
const INTERVAL = parseInt(process.env.INTERVAL || '10');
const WARMUP = 50;

const FRAMEWORKS = [
  { name: 'fastmcp-node',       image: 'bench-tp-fastmcp-node',       port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'fastmcp-python',     image: 'bench-tp-fastmcp-python',     port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'mcp-framework-node', image: 'bench-tp-mcp-framework-node', port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'fast-mcp-ruby',      image: 'bench-tp-fast-mcp-ruby',      port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'zeromcp-mrexodia',   image: 'bench-tp-zeromcp-mrexodia',   port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'mcp-go-mark3labs',   image: 'bench-tp-mcp-go-mark3labs',   port: 3000, endpoint: '/mcp', protocol: 'streamable' },
  { name: 'spring-ai-mcp',      image: 'bench-tp-spring-ai-mcp',      port: 3000, endpoint: '/sse', protocol: 'sse' },
  { name: 'quarkus-mcp',        image: 'bench-tp-quarkus-mcp',        port: 3000, endpoint: '/mcp', protocol: 'streamable' },
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * p / 100) - 1];
}
function round(v, d = 2) { return Math.round(v * 10 ** d) / 10 ** d; }

function getDockerStats(name) {
  try {
    const raw = execSync(`docker stats --no-stream --format '{{.MemUsage}}|||{{.CPUPerc}}' ${name}`, { encoding: 'utf8', timeout: 5000 }).trim();
    const [m, c] = raw.split('|||');
    let mem = null;
    const mm = m.match(/([\d.]+)\s*(MiB|GiB)/);
    if (mm) { mem = parseFloat(mm[1]); if (mm[2] === 'GiB') mem *= 1024; mem = round(mem); }
    let cpu = null;
    const cm = c.match(/([\d.]+)%/);
    if (cm) cpu = round(parseFloat(cm[1]));
    return { mem, cpu };
  } catch { return { mem: null, cpu: null }; }
}

/**
 * Streamable HTTP: POST with Accept header, parse JSON or SSE response.
 * Handles session IDs via Mcp-Session-Id header.
 */
class McpHttpClient {
  constructor(baseUrl, endpoint, protocol) {
    this.baseUrl = baseUrl;
    this.endpoint = endpoint;
    this.protocol = protocol;
    this.sessionId = null;
    this.nextId = 1;
  }

  async request(method, params) {
    const id = this.nextId++;
    const body = { jsonrpc: '2.0', id, method };
    if (params) body.params = params;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const res = await fetch(`${this.baseUrl}${this.endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    // Capture session ID
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    const contentType = res.headers.get('content-type') || '';

    // JSON response
    if (contentType.includes('application/json')) {
      return res.json();
    }

    // SSE response — parse first data event
    if (contentType.includes('text/event-stream')) {
      const text = await res.text();
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            return JSON.parse(line.slice(6));
          } catch {}
        }
      }
      return null;
    }

    // Fallback — try JSON
    try {
      return res.json();
    } catch {
      return { status: res.status, body: await res.text() };
    }
  }

  async initialize() {
    const resp = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'bench', version: '1.0' },
    });

    // Send initialized notification
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    await fetch(`${this.baseUrl}${this.endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    return resp;
  }

  async callTool(name, args) {
    return this.request('tools/call', { name, arguments: args });
  }
}

async function waitForServer(baseUrl, endpoint, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      // Try a simple POST to see if server is up
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {
          protocolVersion: '2024-11-05', capabilities: {},
          clientInfo: { name: 'probe', version: '1.0' },
        }}),
      });
      if (res.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function benchmarkFramework(fw) {
  const containerName = `bench-tp-${fw.name}`;
  const baseUrl = `http://127.0.0.1:${fw.port}`;

  console.error(`\n=== ${fw.name} ===`);

  try { execSync(`docker rm -f ${containerName} 2>/dev/null`, { stdio: 'pipe' }); } catch {}

  console.error(`  Starting container...`);
  try {
    execSync(
      `docker run --rm -d --name ${containerName} -p ${fw.port}:${fw.port} -e PORT=${fw.port} ${fw.image}`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error(`  Container start failed`);
    return { name: fw.name, error: 'Container start failed' };
  }

  // Wait for server
  const ready = await waitForServer(baseUrl, fw.endpoint, 60000);
  if (!ready) {
    console.error(`  Server failed to respond within 60s`);
    try { execSync(`docker logs ${containerName} 2>&1 | tail -10`, { stdio: 'inherit' }); } catch {}
    execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    return { name: fw.name, error: 'Server failed to start' };
  }

  // Initialize MCP session
  const client = new McpHttpClient(baseUrl, fw.endpoint, fw.protocol);
  try {
    await client.initialize();
    console.error(`  Initialized (session: ${client.sessionId || 'none'})`);
  } catch (err) {
    console.error(`  Initialize failed: ${err.message}`);
    execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    return { name: fw.name, error: `Initialize failed: ${err.message}` };
  }

  // Warmup
  console.error(`  Warming up...`);
  for (let i = 0; i < WARMUP; i++) {
    try { await client.callTool('hello', { name: 'warmup' }); } catch {}
  }

  // Benchmark
  const snapshots = [];
  let latencies = [];
  const t0 = performance.now();
  let nextSnap = INTERVAL * 1000;

  console.error(`  Running for ${DURATION}s...`);

  while (performance.now() - t0 < DURATION * 1000) {
    const start = performance.now();
    try {
      await client.callTool('hello', { name: 'bench' });
      latencies.push(performance.now() - start);
    } catch {
      latencies.push(performance.now() - start);
    }

    if (performance.now() - t0 >= nextSnap) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const stats = getDockerStats(containerName);
      const snap = {
        t: Math.round((performance.now() - t0) / 1000),
        rps: Math.round(latencies.length / INTERVAL),
        p50_ms: round(percentile(sorted, 50)),
        p99_ms: round(percentile(sorted, 99)),
        memory_mb: stats.mem,
        cpu_pct: stats.cpu,
      };
      snapshots.push(snap);
      console.error(`    t=${snap.t}s  rps=${snap.rps}  p50=${snap.p50_ms}ms  p99=${snap.p99_ms}ms  mem=${snap.memory_mb}MB  cpu=${snap.cpu_pct}%`);
      latencies = [];
      nextSnap += INTERVAL * 1000;
    }
  }

  execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });

  const avgRps = snapshots.length > 0 ? Math.round(snapshots.reduce((s, x) => s + x.rps, 0) / snapshots.length) : 0;
  const avgP50 = snapshots.length > 0 ? round(snapshots.reduce((s, x) => s + x.p50_ms, 0) / snapshots.length) : 0;
  const avgP99 = snapshots.length > 0 ? round(snapshots.reduce((s, x) => s + x.p99_ms, 0) / snapshots.length) : 0;
  const mems = snapshots.map(s => s.memory_mb).filter(Boolean);
  const avgCpu = snapshots.length > 0 ? round(snapshots.filter(s => s.cpu_pct != null).reduce((s, x) => s + x.cpu_pct, 0) / snapshots.filter(s => s.cpu_pct != null).length) : 0;

  console.error(`  DONE: avg=${avgRps} rps, p50=${avgP50}ms, p99=${avgP99}ms, mem=${Math.min(...mems)}-${Math.max(...mems)}MB, cpu=${avgCpu}%`);

  return { name: fw.name, avg_rps: avgRps, avg_p50_ms: avgP50, avg_p99_ms: avgP99, memory_mb: { min: Math.min(...mems), max: Math.max(...mems) }, avg_cpu_pct: avgCpu, snapshots };
}

async function main() {
  const filter = process.env.FRAMEWORKS?.split(',').map(s => s.trim());
  const fws = filter ? FRAMEWORKS.filter(f => filter.includes(f.name)) : FRAMEWORKS;

  console.error(`Third-party MCP Framework HTTP Benchmark`);
  console.error(`  Duration: ${DURATION}s, Interval: ${INTERVAL}s`);
  console.error(`  Frameworks: ${fws.map(f => f.name).join(', ')}\n`);

  const results = {};
  for (const fw of fws) {
    results[fw.name] = await benchmarkFramework(fw);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
