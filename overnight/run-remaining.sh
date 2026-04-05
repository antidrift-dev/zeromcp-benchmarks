#!/bin/bash

# ZeroMCP Overnight — Remaining phases only
# Skips Phase 0, starts Phase 1 from C#

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS="$BENCH_ROOT/results/overnight"
PARENT="$(dirname "$BENCH_ROOT")"
ZEROMCP="$PARENT/zeromcp"
ALL_LANGS="node python go rust java kotlin swift csharp ruby php"

mkdir -p "$RESULTS"

echo "================================================"
echo "ZeroMCP Overnight — Remaining Phases"
echo "Started: $(date)"
echo "================================================"
echo ""

# --- Phase 1: remaining chaos official (csharp, ruby, php) ---
echo "=== Phase 1: Chaos Official SDKs (remaining: csharp, ruby, php) ==="

for lang in csharp ruby php; do
  DF="$BENCH_ROOT/overnight/chaos-official/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then echo "  [$lang] MISSING"; continue; fi
  echo "  [$lang] Building..."
  docker build -t "zeromcp-chaos-official-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running chaos (10 min timeout)..."
  gtimeout 600 docker run --rm "zeromcp-chaos-official-$lang" 2>/dev/null > "$RESULTS/chaos-official-$lang.json" || true
  docker ps -q --filter "ancestor=zeromcp-chaos-official-$lang" | xargs -r docker kill 2>/dev/null || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 2a: ZeroMCP HTTP Frameworks ---
echo "=== Phase 2a: ZeroMCP HTTP Frameworks ==="

echo "  [node] Building..."
docker build -t zeromcp-bench-http-node \
  -f "$BENCH_ROOT/runtimes/http-frameworks/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [node] Running (4 × 5 min)..."
gtimeout 2400 docker run --rm -e DURATION=300 -e INTERVAL=10 zeromcp-bench-http-node \
  2>/dev/null > "$RESULTS/http-frameworks-node.json"
echo "  [node] Done."

for lang in python go rust java kotlin swift csharp ruby php; do
  DF="$BENCH_ROOT/runtimes/http-frameworks/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then echo "  [$lang] MISSING"; continue; fi
  echo "  [$lang] Building..."
  docker build -t "zeromcp-bench-http-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running (5 min)..."
  gtimeout 2400 docker run --rm -e DURATION=300 -e INTERVAL=10 "zeromcp-bench-http-$lang" \
    2>/dev/null > "$RESULTS/http-frameworks-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 2b: Official SDK HTTP ---
echo "=== Phase 2b: Official SDK HTTP ==="

for lang in $ALL_LANGS; do
  DF="$BENCH_ROOT/overnight/official-http/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then echo "  [$lang] MISSING"; continue; fi
  echo "  [$lang] Building..."
  docker build -t "zeromcp-official-http-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running (5 min)..."
  gtimeout 600 docker run --rm -e DURATION=300 -e INTERVAL=10 "zeromcp-official-http-$lang" \
    2>/dev/null > "$RESULTS/official-http-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 3: Load ramp ---
echo "=== Phase 3: Load Ramp (all 10 languages) ==="

echo "Building zeromcp base image..."
docker build -t zeromcp "$ZEROMCP" 2>&1 | tail -2

echo "Building load ramp image..."
docker build -t zeromcp-loadramp \
  -f "$BENCH_ROOT/overnight/loadramp/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running load ramp..."
gtimeout 1200 docker run --rm zeromcp-loadramp 2>/dev/null > "$RESULTS/loadramp-all.json" || true
echo "Done."

echo ""

# --- Phase 4: Overhead ---
echo "=== Phase 4: Overhead (all 10 languages) ==="

echo "Building overhead image..."
docker build -t zeromcp-overhead \
  -f "$BENCH_ROOT/overnight/overhead/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running overhead measurement..."
gtimeout 900 docker run --rm zeromcp-overhead 2>/dev/null > "$RESULTS/overhead-all.json" || true
echo "Done."

echo ""

# --- Phase 5: Head-to-head ---
echo "=== Phase 5: Head-to-Head stdio ==="

for lang in $ALL_LANGS; do
  DF="$BENCH_ROOT/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then echo "  [$lang] MISSING"; continue; fi
  echo "  [$lang] Building..."
  docker build -t "zeromcp-bench-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  [$lang] Running..."
  gtimeout 300 docker run --rm "zeromcp-bench-$lang" 2>/dev/null > "$RESULTS/bench-$lang.json" || true
  echo "  [$lang] Done."
done

echo ""

# --- Phase 6: JS runtimes ---
echo "=== Phase 6: JS Runtimes ==="

echo "  [bun] Building..."
docker build -t zeromcp-bench-bun \
  -f "$BENCH_ROOT/runtimes/bun/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [bun] Running..."
gtimeout 120 docker run --rm zeromcp-bench-bun 2>/dev/null > "$RESULTS/runtime-bun.json" || true
echo "  [bun] Done."

echo "  [deno] Building..."
docker build -t zeromcp-bench-deno \
  -f "$BENCH_ROOT/runtimes/deno/Dockerfile" "$PARENT" 2>&1 | tail -2
echo "  [deno] Running..."
gtimeout 120 docker run --rm zeromcp-bench-deno 2>/dev/null > "$RESULTS/runtime-deno.json" || true
echo "  [deno] Done."

for v in 14 16 18 20 22 23; do
  echo "  [node-$v] Testing..."
  gtimeout 60 docker run --rm -v "$ZEROMCP/nodejs:/app" -w /app "node:$v" bash -c \
    'npm install --silent 2>/dev/null && npm run build 2>/dev/null && \
    echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"t\",\"version\":\"1\"}}}" | \
    timeout 5 node bin/mcp.js serve examples/tools 2>/dev/null | head -1' \
    > "$RESULTS/runtime-node-$v.txt" 2>/dev/null || echo "FAIL" > "$RESULTS/runtime-node-$v.txt"
  if grep -q "jsonrpc" "$RESULTS/runtime-node-$v.txt" 2>/dev/null; then echo "  [node-$v] OK"; else echo "  [node-$v] FAIL"; fi
done

echo ""
echo "================================================"
echo "Complete: $(date)"
echo "================================================"
echo ""
echo "Results:"
for f in "$RESULTS"/*.json "$RESULTS"/*.txt; do
  [ -f "$f" ] && size=$(wc -c < "$f" | tr -d ' ') && echo "  $(basename $f): $size bytes"
done
