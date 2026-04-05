# Build context: antidrift/
FROM swift:6.0.3-jammy AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/swift/Package.swift .
RUN swift package resolve
COPY zeromcp-benchmarks/overnight/official-http/swift/Sources/ Sources/
RUN swift build -c release 2>&1 && cp .build/release/official-server /official-server

FROM swift:6.0.3-jammy
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /official-server /usr/local/bin/official-server
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
ENV STARTUP_WAIT=1000
ENV USE_CONTENT_LENGTH=1
EXPOSE 3000
CMD ["node", "proxy.mjs", "/usr/local/bin/official-server"]
