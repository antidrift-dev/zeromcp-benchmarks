# Build context: antidrift/
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/csharp/OfficialServer.csproj .
RUN dotnet restore
COPY zeromcp-benchmarks/overnight/official-http/csharp/Program.cs .
COPY zeromcp-benchmarks/overnight/official-http/csharp/Tools.cs .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:8.0
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /app/ app/
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
ENV STARTUP_WAIT=1000
EXPOSE 3000
CMD ["node", "proxy.mjs", "dotnet", "app/official-server.dll"]
