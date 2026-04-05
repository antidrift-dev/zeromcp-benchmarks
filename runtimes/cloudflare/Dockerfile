# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-cloudflare -f zeromcp-benchmarks/runtimes/cloudflare/Dockerfile .

FROM node:22 AS builder
WORKDIR /build
COPY zeromcp/nodejs/ ./nodejs/
RUN cd nodejs && npm install && npm run build

FROM node:22
RUN npm install -g wrangler
WORKDIR /bench

# Copy ZeroMCP built output
COPY --from=builder /build/nodejs/dist ./zeromcp/dist/
COPY --from=builder /build/nodejs/package.json ./zeromcp/

# Copy worker + tools
COPY zeromcp-benchmarks/runtimes/cloudflare/worker.mjs .
COPY zeromcp-benchmarks/runtimes/cloudflare/wrangler.toml .
COPY zeromcp/nodejs/examples/tools ./tools/

# Harness for HTTP benchmarking
COPY zeromcp-benchmarks/runtimes/cloudflare/bench.js .
COPY zeromcp-benchmarks/package.json .

CMD ["node", "bench.js"]
