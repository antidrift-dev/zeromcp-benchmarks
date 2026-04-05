#!/bin/bash

# ZeroMCP Overnight Benchmark Suite
# Runs ALL benchmarks across ALL 10 languages. No exceptions.
# Expected runtime: ~4-6 hours

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS="$BENCH_ROOT/results/overnight"
PARENT="$(dirname "$BENCH_ROOT")"
ZEROMCP="$PARENT/zeromcp"
ALL_LANGS="node python go rust java kotlin swift csharp ruby php"

mkdir -p "$RESULTS"

echo "================================================"
echo "ZeroMCP Overnight Benchmark Suite"
echo "Started: $(date)"
echo "Results: $RESULTS"
echo "Languages: $ALL_LANGS"
echo "================================================"
echo ""

# --- Phase 0: Re-validate ZeroMCP (~15 min) ---
echo "=== Phase 0: Re-validate ZeroMCP ==="

echo "Building ZeroMCP Docker image (all 10 languages)..."
docker build -t zeromcp "$ZEROMCP" 2>&1 | tail -3

echo "Running conformance tests (10 suites, 39 implementations)..."
docker run --rm zeromcp 2>&1 | tee "$RESULTS/conformance.txt"
echo ""

echo "Running chaos monkey (22 attacks × 10 languages)..."
docker run --rm zeromcp node tests/chaos/run-chaos.js 2>&1 | tee "$RESULTS/chaos-zeromcp.txt"
echo ""

if grep -q "crashed\|corrupted" "$RESULTS/chaos-zeromcp.txt"; then
  echo "!!! CHAOS FAILURES DETECTED — check $RESULTS/chaos-zeromcp.txt"
fi
if grep -q "failed" "$RESULTS/conformance.txt"; then
  echo "!!! CONFORMANCE FAILURES DETECTED — check $RESULTS/conformance.txt"
fi

echo ""

# --- Phase 1: Chaos test ALL 10 official SDKs (~40 min) ---
echo "=== Phase 1: Chaos Monkey — All 10 Official SDKs ==="

for lang in $ALL_LANGS; do
  DF="$BENCH_ROOT/overnight/chaos-official/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then
    echo "  $lang: MISSING Dockerfile"
    continue
  fi
  echo "  [$lang] Building official SDK chaos server..."
  docker build -t "zeromcp-chaos-official-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running 21 chaos attacks..."
  docker run --rm "zeromcp-chaos-official-$lang" 2>/dev/null > "$RESULTS/chaos-official-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 2a: ZeroMCP HTTP Framework benchmarks (~100 min) ---
echo "=== Phase 2a: ZeroMCP HTTP Frameworks (all 10 languages × 5 min each) ==="

# Node.js: bare http, Express, Fastify, Hono
echo "  [node] Building (bare, Express, Fastify, Hono)..."
docker build -t zeromcp-bench-http-node \
  -f "$BENCH_ROOT/runtimes/http-frameworks/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [node] Running 4 frameworks × 5 min..."
docker run --rm -e DURATION=300 -e INTERVAL=10 zeromcp-bench-http-node \
  2>/dev/null > "$RESULTS/http-frameworks-node.json"
echo "  [node] Done."

# All other languages
for lang in python go rust java kotlin swift csharp ruby php; do
  DF="$BENCH_ROOT/runtimes/http-frameworks/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then
    echo "  [$lang] MISSING Dockerfile"
    continue
  fi
  echo "  [$lang] Building HTTP frameworks..."
  docker build -t "zeromcp-bench-http-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running frameworks × 5 min each..."
  docker run --rm -e DURATION=300 -e INTERVAL=10 "zeromcp-bench-http-$lang" \
    2>/dev/null > "$RESULTS/http-frameworks-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 2b: Official SDK HTTP benchmarks (~50 min) ---
echo "=== Phase 2b: Official SDK HTTP (all 10 languages × 5 min each) ==="

for lang in $ALL_LANGS; do
  DF="$BENCH_ROOT/overnight/official-http/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then
    echo "  [$lang] MISSING Dockerfile"
    continue
  fi
  echo "  [$lang] Building official SDK HTTP server..."
  docker build -t "zeromcp-official-http-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running 5 min benchmark..."
  docker run --rm -e DURATION=300 -e INTERVAL=10 "zeromcp-official-http-$lang" \
    2>/dev/null > "$RESULTS/official-http-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 3: Load ramp ALL 10 languages (~30 min) ---
echo "=== Phase 3: Load Ramp (all 10 languages, concurrency 1→100) ==="

echo "Building load ramp image (uses zeromcp base with all runtimes)..."
docker build -t zeromcp-loadramp \
  -f "$BENCH_ROOT/overnight/loadramp/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running load ramp for all 10 languages..."
docker run --rm zeromcp-loadramp 2>/dev/null > "$RESULTS/loadramp-all.json" || true
echo "Done."

echo ""

# --- Phase 4: Overhead measurement ALL 10 languages (~20 min) ---
echo "=== Phase 4: Overhead (all 10 languages, bare echo vs ZeroMCP) ==="

echo "Building overhead image..."
docker build -t zeromcp-overhead \
  -f "$BENCH_ROOT/overnight/overhead/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running overhead measurement for all 10 languages..."
docker run --rm zeromcp-overhead 2>/dev/null > "$RESULTS/overhead-all.json" || true
echo "Done."

echo ""

# --- Phase 5: Head-to-head stdio ALL 10 languages (~30 min) ---
echo "=== Phase 5: Head-to-Head stdio (ZeroMCP vs Official SDK, all languages) ==="

for lang in $ALL_LANGS; do
  DF="$BENCH_ROOT/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then
    echo "  [$lang] MISSING Dockerfile"
    continue
  fi
  echo "  [$lang] Building head-to-head benchmark..."
  docker build -t "zeromcp-bench-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running 1000 requests..."
  docker run --rm "zeromcp-bench-$lang" 2>/dev/null > "$RESULTS/bench-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 6: JS Runtime compatibility (~15 min) ---
echo "=== Phase 6: JS Runtimes (Node versions + Bun + Deno) ==="

# Bun — ZeroMCP vs Node on Bun
echo "  [bun] Building..."
docker build -t zeromcp-bench-bun \
  -f "$BENCH_ROOT/runtimes/bun/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [bun] Running ZeroMCP on Bun vs Node..."
docker run --rm zeromcp-bench-bun 2>/dev/null > "$RESULTS/runtime-bun.json" || true
echo "  [bun] Done."

# Deno — ZeroMCP vs Node on Deno
echo "  [deno] Building..."
docker build -t zeromcp-bench-deno \
  -f "$BENCH_ROOT/runtimes/deno/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [deno] Running ZeroMCP on Deno vs Node..."
docker run --rm zeromcp-bench-deno 2>/dev/null > "$RESULTS/runtime-deno.json" || true
echo "  [deno] Done."

# Test official SDK on Bun and Deno too
echo "  [official-bun] Testing if official SDK runs on Bun..."
docker run --rm zeromcp-bench-bun bash -c \
  'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}" | timeout 5 bun run official/server.mjs 2>/dev/null | head -1' \
  > "$RESULTS/runtime-official-bun.txt" 2>/dev/null || echo "FAIL" > "$RESULTS/runtime-official-bun.txt"
result=$(cat "$RESULTS/runtime-official-bun.txt" | head -c 20)
if echo "$result" | grep -q "jsonrpc"; then echo "  [official-bun] OK"; else echo "  [official-bun] FAIL"; fi

echo "  [official-deno] Testing if official SDK runs on Deno..."
docker run --rm zeromcp-bench-deno bash -c \
  'echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}" | timeout 5 deno run --allow-all /zeromcp/nodejs/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js 2>/dev/null | head -1' \
  > "$RESULTS/runtime-official-deno.txt" 2>/dev/null || echo "FAIL" > "$RESULTS/runtime-official-deno.txt"
result=$(cat "$RESULTS/runtime-official-deno.txt" | head -c 20)
if echo "$result" | grep -q "jsonrpc"; then echo "  [official-deno] OK"; else echo "  [official-deno] FAIL"; fi

# Node versions
for v in 14 16 18 20 22 23; do
  echo "  [node-$v] Testing compatibility..."
  docker run --rm -v "$ZEROMCP/nodejs:/app" -w /app "node:$v" bash -c \
    'npm install --silent 2>/dev/null && npm run build 2>/dev/null && \
    echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"1\"}}}" | \
    timeout 5 node bin/mcp.js serve examples/tools 2>/dev/null | head -1' \
    > "$RESULTS/runtime-node-$v.txt" 2>/dev/null || echo "FAIL" > "$RESULTS/runtime-node-$v.txt"
  result=$(cat "$RESULTS/runtime-node-$v.txt" | head -c 20)
  if echo "$result" | grep -q "jsonrpc"; then echo "  [node-$v] OK"; else echo "  [node-$v] FAIL"; fi
done

echo ""
echo "================================================"
echo "Overnight suite complete: $(date)"
echo "Results in: $RESULTS"
echo "================================================"
echo ""
echo "Files:"
ls -lh "$RESULTS"
echo ""
echo "Summary:"
for f in "$RESULTS"/*.json "$RESULTS"/*.txt; do
  [ -f "$f" ] && echo "  $(basename $f): $(wc -c < "$f" | tr -d ' ') bytes"
done
echo ""
echo "Total result files: $(ls "$RESULTS" | wc -l | tr -d ' ')"
