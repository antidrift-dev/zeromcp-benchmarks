# Build context: antidrift/
FROM swift:6.0.3-jammy AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/swift/Package.swift .
RUN swift package resolve
COPY zeromcp-benchmarks/overnight/chaos-official/swift/Sources/ Sources/
RUN swift build -c release 2>&1 && cp .build/release/chaos-server /chaos-server

FROM swift:6.0.3-jammy
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /chaos-server /usr/local/bin/chaos-server
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

ENV STARTUP_WAIT=3000
CMD ["node", "chaos-runner.mjs", "swift", "/usr/local/bin/chaos-server"]
