# ZeroMCP Benchmarks

Performance benchmarks comparing [ZeroMCP](https://github.com/antidrift-dev/zeromcp) against the official MCP SDKs across 10 languages.

## Quick start

```sh
# Run a single language benchmark
./run-all.sh node

# Run all 10 languages
./run-all.sh

# Run time-series benchmark (5 min per tier, Node.js)
docker build -t zeromcp-bench-node -f node/Dockerfile ../zeromcp/
docker run --rm zeromcp-bench-node
```

Each language has its own `Dockerfile` that builds both the official SDK server and ZeroMCP, then runs the harness.

## Harness

- `harness.js` — aggregate benchmark (1000 requests, reports p50/p95/p99, rps, cpu, memory)
- `harness-timeseries.js` — time-series benchmark (snapshots every 10s for 5 min, 4 complexity tiers)
- `report.js` — reads results/ and outputs a markdown comparison table

## Results

Write-ups, with charts and tables, are in [`writeups/`](writeups/):

- [Overview: every test we've run](writeups/README.md)
- [Chaos resilience, level 1](writeups/chaos-resilience.md)
- [Chaos resilience, level 2](writeups/chaos-resilience-2.md)
- [Express vs Fastify vs Hono](writeups/express-vs-fastify-vs-hono.md)
- [Node.js vs Bun vs Deno](writeups/node-vs-bun-vs-deno.md)
- [Version compatibility](writeups/version-compatibility.md)

Raw results are in `results/`. Run `node report.js` to generate a summary.

## Requires

Each Dockerfile needs the ZeroMCP source at `../zeromcp/` (sibling directory) as the Docker build context. Clone both repos side by side:

```
antidrift/
  zeromcp/           # the SDK
  zeromcp-benchmarks/ # this repo
```

Then run benchmarks from this directory with the parent as context:

```sh
docker build -t zeromcp-bench-node -f node/Dockerfile ..
```

## Languages

| Language | Dockerfile | Official SDK |
|----------|-----------|-------------|
| Node.js | `node/Dockerfile` | `@modelcontextprotocol/sdk` |
| Python | `python/Dockerfile` | `mcp[cli]` (FastMCP) |
| Go | `go/Dockerfile` | `github.com/modelcontextprotocol/go-sdk` |
| Rust | `rust/Dockerfile` | `rmcp` |
| C# | `csharp/Dockerfile` | `ModelContextProtocol` |
| Java | `java/Dockerfile` | `io.modelcontextprotocol.sdk:mcp` |
| Kotlin | `kotlin/Dockerfile` | `io.modelcontextprotocol:kotlin-sdk` |
| Ruby | `ruby/Dockerfile` | `mcp` gem |
| PHP | `php/Dockerfile` | `mcp/sdk` |
| Swift | `swift/Dockerfile` | `modelcontextprotocol/swift-sdk` |
