#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

LANGUAGES="${@:-node python go rust java kotlin swift csharp ruby php}"

for lang in $LANGUAGES; do
  echo ""
  echo "=== $lang ==="
  dockerfile="$SCRIPT_DIR/$lang/Dockerfile"
  if [ ! -f "$dockerfile" ]; then
    echo "  skipped (no Dockerfile)"
    continue
  fi

  docker build -t "zeromcp-bench-$lang" -f "$dockerfile" "$ROOT" 2>&1 | tail -3
  docker run --rm "zeromcp-bench-$lang" > "$RESULTS_DIR/$lang.json" 2>/dev/null
  cat "$RESULTS_DIR/$lang.json"
done

echo ""
echo "=== Results saved to $RESULTS_DIR ==="
echo ""

# Generate report if node is available
if command -v node &> /dev/null; then
  node "$SCRIPT_DIR/report.js"
fi
