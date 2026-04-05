# Build context: antidrift/
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/csharp/ChaosServer.csproj .
RUN dotnet restore
COPY zeromcp-benchmarks/overnight/chaos-official/csharp/Program.cs .
COPY zeromcp-benchmarks/overnight/chaos-official/csharp/Tools.cs .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:8.0
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /app/ app/
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

ENV STARTUP_WAIT=3000
CMD ["node", "chaos-runner.mjs", "csharp", "dotnet", "app/chaos-server.dll"]
