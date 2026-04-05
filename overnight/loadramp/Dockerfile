# Build context: antidrift/
# Uses the main zeromcp image (all 10 runtimes pre-built) as base.
# Build: docker build -f zeromcp-benchmarks/overnight/loadramp/Dockerfile -t loadramp .
# Run:   docker run --rm loadramp > results.json

FROM zeromcp:latest AS base

# Install Node.js benchmark harness deps
WORKDIR /bench
COPY zeromcp-benchmarks/overnight/loadramp/bench.mjs .
COPY zeromcp-benchmarks/package.json .

# Build Node.js ZeroMCP (if not already built in base)
RUN cd /zeromcp/nodejs && npm install --ignore-scripts 2>/dev/null; npm run build 2>/dev/null || true

CMD ["node", "bench.mjs"]
