#!/usr/bin/env node

/**
 * Reads benchmark results from results/ directory and outputs a markdown table.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(__dirname, 'results');

const files = readdirSync(resultsDir).filter(f => f.endsWith('.json')).sort();
if (files.length === 0) {
  console.error('No results found in results/');
  process.exit(1);
}

const results = files.map(f => JSON.parse(readFileSync(join(resultsDir, f), 'utf8')));

console.log('# ZeroMCP vs Official MCP SDKs — Benchmark Results\n');
console.log('| Language | SDK | Startup (ms) | p50 (ms) | p95 (ms) | p99 (ms) | req/s | Memory idle (MB) | Memory peak (MB) |');
console.log('|----------|-----|-------------|----------|----------|----------|-------|-----------------|-----------------|');

for (const r of results) {
  const lang = r.language.charAt(0).toUpperCase() + r.language.slice(1);

  for (const key of ['official', 'zeromcp']) {
    const d = r[key];
    if (!d || d.error) {
      console.log(`| ${lang} | ${key} | ERROR | - | - | - | - | - | - |`);
      continue;
    }
    const mem_idle = d.memory_idle_mb != null ? d.memory_idle_mb : '-';
    const mem_peak = d.memory_peak_mb != null ? d.memory_peak_mb : '-';
    console.log(`| ${lang} | ${key} | ${d.startup_ms} | ${d.p50_ms} | ${d.p95_ms} | ${d.p99_ms} | ${d.rps} | ${mem_idle} | ${mem_peak} |`);
  }
}

console.log('\n_1000 sequential `tools/call` requests over stdio after 50-request warmup. Run in Docker._');
