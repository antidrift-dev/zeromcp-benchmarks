FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

# Build official SDK server
WORKDIR /build/official
COPY benchmarks/csharp/official/ .
RUN dotnet publish -c Release -o /out/official 2>&1 | tail -3

# Build ZeroMCP server
WORKDIR /build/zeromcp
COPY csharp/ .
RUN dotnet publish Example -c Release -o /out/zeromcp 2>&1 | tail -3

# Runtime
FROM mcr.microsoft.com/dotnet/runtime:8.0
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /out/official /bench/official-server/
COPY --from=builder /out/zeromcp /bench/zeromcp-server/
COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/csharp/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
