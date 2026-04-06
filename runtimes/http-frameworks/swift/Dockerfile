# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-vapor -f zeromcp-benchmarks/runtimes/http-frameworks/swift/Dockerfile .

# --- Stage 1: Build ---
FROM swift:5.9-jammy AS builder
WORKDIR /build

# Copy ZeroMCP Swift library
COPY zeromcp/swift/ /build/zeromcp-lib/

# Copy Vapor bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/swift/Package.swift .
COPY zeromcp-benchmarks/runtimes/http-frameworks/swift/server-vapor.swift .

# Fix Package.swift to use local path
RUN sed -i 's|path: "../../../zeromcp-lib"|path: "./zeromcp-lib"|' Package.swift

RUN swift build -c release 2>&1

# --- Stage 2: Runtime ---
FROM swift:5.9-jammy-slim
RUN apt-get update && apt-get install -y curl procps && rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /build/.build/release/ServerVapor /bench/server-vapor

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/swift/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/swift/package.json .

CMD ["node", "bench.mjs"]
