FROM oven/bun:1 AS builder
WORKDIR /build

# Copy ZeroMCP source and build
COPY zeromcp/nodejs/ /zeromcp/nodejs/
RUN cd /zeromcp/nodejs && bun install && bun run build

# Runtime
FROM oven/bun:1
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /zeromcp/nodejs /zeromcp/nodejs

# Harness (inline — no external deps)
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/runtimes/bun/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
