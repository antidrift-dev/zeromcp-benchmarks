# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-aspnet -f zeromcp-benchmarks/runtimes/http-frameworks/csharp/Dockerfile .

# --- Stage 1: Build ---
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /build

# Copy ZeroMCP C# library (exclude build artifacts)
COPY zeromcp/csharp/ZeroMcp/*.cs /build/zeromcp-lib/
COPY zeromcp/csharp/ZeroMcp/ZeroMcp.csproj /build/zeromcp-lib/

# Copy bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/csharp/bench-aspnet.csproj .
COPY zeromcp-benchmarks/runtimes/http-frameworks/csharp/server-aspnet.cs Program.cs

# Fix project reference path
RUN sed -i 's|../../../zeromcp-lib/ZeroMcp.csproj|./zeromcp-lib/ZeroMcp.csproj|' bench-aspnet.csproj

RUN dotnet publish -c Release -o /publish

# --- Stage 2: Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:8.0
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /publish/ /bench/aspnet/

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/csharp/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/csharp/package.json .

CMD ["node", "bench.mjs"]
