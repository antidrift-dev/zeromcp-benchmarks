FROM swift:6.0.3-jammy AS builder-official
WORKDIR /build
COPY benchmarks/swift/official/ .
RUN swift build -c release 2>&1 | tail -5; \
    cp .build/release/McpBenchOfficial /official-server 2>/dev/null || \
    cp $(find .build -name McpBenchOfficial -type f | head -1) /official-server 2>/dev/null || \
    echo "Official build failed"

FROM swift:6.0.3-jammy AS builder-zeromcp
WORKDIR /build
COPY swift/ .
RUN rm -rf .build && swift build -c release 2>&1 | tail -5; \
    cp .build/release/zeromcp-example /zeromcp-server 2>/dev/null || \
    cp $(find .build -name zeromcp-example -type f | head -1) /zeromcp-server 2>/dev/null || \
    echo "ZeroMCP build failed"

FROM node:22 AS node-source

# Runtime
FROM swift:6.0.3-jammy
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
COPY --from=node-source /usr/local/bin/node /usr/local/bin/node
WORKDIR /bench

COPY --from=builder-official /official-server /bench/official-server
COPY --from=builder-zeromcp /zeromcp-server /bench/zeromcp-server
COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/swift/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
