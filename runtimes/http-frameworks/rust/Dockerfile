# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-rust -f zeromcp-benchmarks/runtimes/http-frameworks/rust/Dockerfile .

# --- Build stage ---
FROM rust:1.78 AS builder

WORKDIR /build

# Copy ZeroMCP Rust source
COPY zeromcp/rust/ /zeromcp/rust/

# Copy benchmark Rust sources
COPY zeromcp-benchmarks/runtimes/http-frameworks/rust/Cargo.toml .
COPY zeromcp-benchmarks/runtimes/http-frameworks/rust/server-actix.rs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/rust/server-axum.rs .

# Build both binaries in release mode
RUN cargo build --release --bin server-actix --bin server-axum

# --- Runtime stage ---
FROM node:22-slim

WORKDIR /bench

# Copy compiled Rust binaries
COPY --from=builder /build/target/release/server-actix .
COPY --from=builder /build/target/release/server-axum .

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/rust/bench-rust.mjs .

CMD ["node", "bench-rust.mjs"]
