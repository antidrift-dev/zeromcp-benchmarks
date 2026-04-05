FROM rust:latest AS builder-official
WORKDIR /build
COPY zeromcp-benchmarks/rust/official/ .
RUN cargo build --release 2>&1 | tail -5

FROM rust:latest AS builder-zeromcp
WORKDIR /build
COPY zeromcp/rust/ .
RUN cargo build --example hello --release

# Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder-official /build/target/release/mcp-bench-official /bench/official-server
COPY --from=builder-zeromcp /build/target/release/examples/hello /bench/zeromcp-server
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/rust/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
