#!/bin/bash

# ZeroMCP Overnight Benchmark Suite
# Runs all benchmarks, re-validates our own tests, saves results.
# Expected runtime: ~4-6 hours

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS="$BENCH_ROOT/results/overnight"
PARENT="$(dirname "$BENCH_ROOT")"
ZEROMCP="$PARENT/zeromcp"

mkdir -p "$RESULTS"

echo "================================================"
echo "ZeroMCP Overnight Benchmark Suite"
echo "Started: $(date)"
echo "Results: $RESULTS"
echo "================================================"
echo ""

# --- Phase 0: Re-validate our own stuff ---
echo "=== Phase 0: Re-validate ZeroMCP ==="

echo "Building ZeroMCP Docker image..."
docker build -t zeromcp "$ZEROMCP" 2>&1 | tail -3

echo "Running conformance tests..."
docker run --rm zeromcp 2>&1 | tee "$RESULTS/conformance.txt"
echo ""

echo "Running chaos monkey (all 10 languages)..."
docker run --rm zeromcp node tests/chaos/run-chaos.js 2>&1 | tee "$RESULTS/chaos-zeromcp.txt"
echo ""

# Check for failures
if grep -q "crashed\|corrupted" "$RESULTS/chaos-zeromcp.txt"; then
  echo "!!! CHAOS FAILURES DETECTED — check $RESULTS/chaos-zeromcp.txt"
fi
if grep -q "failed" "$RESULTS/conformance.txt"; then
  echo "!!! CONFORMANCE FAILURES DETECTED — check $RESULTS/conformance.txt"
fi

echo ""

# --- Phase 1: Chaos test official SDKs ---
echo "=== Phase 1: Chaos Monkey — Official SDKs ==="

for lang in node python go java ruby php rust kotlin swift csharp; do
  DF="$BENCH_ROOT/overnight/chaos-official/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then
    echo "  $lang: skipped (no Dockerfile)"
    continue
  fi
  echo "  Building official $lang chaos server..."
  docker build -t "zeromcp-chaos-official-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  Running chaos against official $lang SDK..."
  docker run --rm "zeromcp-chaos-official-$lang" 2>/dev/null > "$RESULTS/chaos-official-$lang.json" || true
  echo "  Done."
done

echo ""

# --- Phase 2: HTTP Framework benchmarks (5 min each) ---
echo "=== Phase 2: HTTP Framework Benchmarks ==="

echo "Building HTTP frameworks image..."
docker build -t zeromcp-bench-http \
  -f "$BENCH_ROOT/runtimes/http-frameworks/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running HTTP frameworks (bare, Express, Fastify, Hono × 5 min each = ~20 min)..."
docker run --rm -e DURATION=300 -e INTERVAL=10 zeromcp-bench-http \
  2>/dev/null > "$RESULTS/http-frameworks-node.json"
echo "  Done."

echo ""

# --- Phase 3: Load ramp to breaking point ---
echo "=== Phase 3: Load Ramp ==="

echo "Building load ramp image..."
docker build -t zeromcp-loadramp \
  -f "$BENCH_ROOT/overnight/loadramp/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running load ramp (concurrency 1→100, ~3 min)..."
docker run --rm zeromcp-loadramp 2>/dev/null > "$RESULTS/loadramp-node.json" || true
echo "  Done."

echo ""

# --- Phase 4: Overhead measurement ---
echo "=== Phase 4: Overhead Measurement ==="

echo "Building overhead image..."
docker build -t zeromcp-overhead \
  -f "$BENCH_ROOT/overnight/overhead/Dockerfile" "$PARENT" 2>&1 | tail -3

echo "Running overhead measurement (bare echo vs ZeroMCP handler, ~2 min)..."
docker run --rm zeromcp-overhead 2>/dev/null > "$RESULTS/overhead-node.json" || true
echo "  Done."

echo ""

# --- Phase 5: Head-to-head benchmarks (all languages) ---
echo "=== Phase 5: Head-to-Head vs Official SDKs ==="

for lang in node python go rust csharp java ruby php; do
  DF="$BENCH_ROOT/$lang/Dockerfile"
  if [ ! -f "$DF" ]; then continue; fi
  echo "  Building $lang benchmark..."
  docker build -t "zeromcp-bench-$lang" -f "$DF" "$PARENT" 2>&1 | tail -2
  echo "  Running $lang benchmark..."
  docker run --rm "zeromcp-bench-$lang" 2>/dev/null > "$RESULTS/bench-$lang.json" || true
  echo "  Done."
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
for f in "$RESULTS"/*.json; do
  echo "  $(basename $f): $(wc -c < "$f") bytes"
done
