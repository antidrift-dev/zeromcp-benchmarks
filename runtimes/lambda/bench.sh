#!/bin/bash
# Benchmark ZeroMCP on Lambda RIE
# Run the Lambda container, then invoke via curl from host

PORT=9000
ITERATIONS=100

echo "Starting Lambda container..."
docker run -d --name zeromcp-lambda -p $PORT:8080 zeromcp-bench-lambda >/dev/null 2>&1

# Wait for ready
sleep 3

# Cold start — first invocation
echo "Cold start..."
COLD=$(curl -s -w "%{time_total}" -o /dev/null -X POST \
  "http://localhost:$PORT/2015-03-31/functions/function/invocations" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"bench","version":"1"}}}')
echo "  Cold start: ${COLD}s"

# Warm invocations
echo "Running $ITERATIONS warm invocations..."
TOTAL=0
for i in $(seq 1 $ITERATIONS); do
  T=$(curl -s -w "%{time_total}" -o /dev/null -X POST \
    "http://localhost:$PORT/2015-03-31/functions/function/invocations" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$i,\"method\":\"tools/call\",\"params\":{\"name\":\"hello\",\"arguments\":{\"name\":\"bench\"}}}")
  TOTAL=$(echo "$TOTAL + $T" | bc)
done

AVG=$(echo "scale=4; $TOTAL / $ITERATIONS" | bc)
RPS=$(echo "scale=0; $ITERATIONS / $TOTAL" | bc)

echo "  Avg latency: ${AVG}s"
echo "  Throughput: ${RPS} req/s"

docker stop zeromcp-lambda >/dev/null 2>&1
docker rm zeromcp-lambda >/dev/null 2>&1

echo ""
echo "{\"runtime\":\"lambda\",\"cold_start_s\":$COLD,\"avg_latency_s\":$AVG,\"rps\":$RPS}"
