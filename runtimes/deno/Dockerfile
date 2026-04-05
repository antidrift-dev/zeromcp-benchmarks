# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-deno -f zeromcp-benchmarks/runtimes/deno/Dockerfile .

FROM node:22 AS builder
WORKDIR /build
COPY zeromcp/nodejs/ ./nodejs/
RUN cd nodejs && npm install && npm run build

FROM denoland/deno:latest
USER root
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /build/nodejs /zeromcp/nodejs
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/runtimes/deno/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
