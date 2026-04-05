# Build context: antidrift/
FROM rust:latest AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/rust/Cargo.toml .
COPY zeromcp-benchmarks/overnight/chaos-official/rust/server.rs .
RUN cargo build --release 2>&1 && cp target/release/chaos-server /chaos-server

FROM node:22-slim
WORKDIR /bench
COPY --from=builder /chaos-server /usr/local/bin/chaos-server
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

ENV STARTUP_WAIT=3000
CMD ["node", "chaos-runner.mjs", "rust", "/usr/local/bin/chaos-server"]
