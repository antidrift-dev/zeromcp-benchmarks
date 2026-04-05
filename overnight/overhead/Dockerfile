# Build context: antidrift/
# Uses the main zeromcp image (all 10 runtimes pre-built) as base.
# Build: docker build -f zeromcp-benchmarks/overnight/overhead/Dockerfile -t overhead .
# Run:   docker run --rm overhead > results.json

FROM zeromcp:latest AS base

# Install Node.js benchmark harness deps
WORKDIR /bench
COPY zeromcp-benchmarks/overnight/overhead/bench.mjs .
COPY zeromcp-benchmarks/package.json .

# Build Node.js ZeroMCP (if not already built in base)
RUN cd /zeromcp/nodejs && npm install --ignore-scripts 2>/dev/null; npm run build 2>/dev/null || true

CMD ["node", "bench.mjs"]
