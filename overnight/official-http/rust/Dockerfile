# Build context: antidrift/
FROM rust:latest AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/rust/Cargo.toml .
COPY zeromcp-benchmarks/overnight/official-http/rust/server.rs .
RUN cargo build --release 2>&1 && cp target/release/official-server /official-server

FROM node:22-slim
WORKDIR /bench
COPY --from=builder /official-server /usr/local/bin/official-server
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
ENV STARTUP_WAIT=1000
EXPOSE 3000
CMD ["node", "proxy.mjs", "/usr/local/bin/official-server"]
