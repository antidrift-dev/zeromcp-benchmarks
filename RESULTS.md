# ZeroMCP Benchmark Results

All data collected April 2026. Results in `antidrift-dev/zeromcp-benchmarks` repo.

## Head-to-Head: ZeroMCP vs Official SDKs (stdio, 1000 requests)

| Language | Official req/s | ZeroMCP req/s | Ratio | Official mem | ZeroMCP mem |
|----------|---------------|---------------|-------|-------------|-------------|
| Node.js | 8,832 | 14,173 | 1.6x | 70 MB | 54 MB |
| Python | 1,018 | 12,936 | 12.7x | 59 MB | 24 MB |
| Go | 1,039 | 13,317 | 12.8x | 7 MB | 9 MB |
| Rust | 8,114 | 9,273 | 1.1x | 4 MB | 2 MB |
| C# | 9,776 | 14,013 | 1.4x | 50 MB | 33 MB |
| Java | 4,469 | 11,168 | 2.5x | 99 MB | 47 MB |
| Kotlin | 998 | 8,396 | 8.4x | 82 MB | 59 MB |
| Ruby | 12,935 | 15,327 | 1.2x | 24 MB | 12 MB |
| PHP | 18 | 13,333 | 740x | 25 MB | 23 MB |
| Swift | 80 | 7,947 | 99x | 26 MB | 19 MB |

## Chaos Monkey: ZeroMCP vs Official SDKs (22 attacks)

| Language | ZeroMCP | Official SDK |
|----------|---------|-------------|
| Node.js | 21/22 | 20/21 |
| Python | 21/22 | 20/21 |
| Go | 21/22 | (20/21 est) |
| Rust | 21/22 | (20/21 est) |
| Java | 21/22 | (20/21 est) |
| Kotlin | 21/22 | (20/21 est) |
| Swift | 21/22 | (20/21 est) |
| C# | 21/22 | 20/21 |
| Ruby | 22/22 | 19/21 |
| PHP | 22/22 | 19/21 |

Ruby official: crashed on binary_garbage, corrupted on tool_slow
PHP official: corrupted on giant_string and tool_slow

## JS Runtime Comparison (ZeroMCP)

| Runtime | Startup | p50 | req/s | Memory |
|---------|---------|-----|-------|--------|
| Bun | 24ms | 0.07ms | 12,040 | 48-73 MB |
| Deno | 34ms | 0.09ms | 11,101 | 67-81 MB |
| Node 22 | 50ms | 0.10ms | 8,126-9,738 | 50-59 MB |

## JS Runtime Comparison (Official SDK)

| Runtime | Startup | p50 | req/s | Memory |
|---------|---------|-----|-------|--------|
| Bun | 52ms | 0.09ms | 7,276 | 97-122 MB |
| Deno | 67ms | 0.14ms | 6,534 | 88-140 MB |
| Node 22 | 120ms | 0.14ms | 6,499 | 78-107 MB |

## Version Compatibility

| Language | ZeroMCP min | Official min | Advantage |
|----------|------------|-------------|-----------|
| Node.js | 14 | 15 | ZeroMCP +1 |
| Python | 3.9 | 3.10 | ZeroMCP +1 |
| Go | 1.22 | 1.25 | ZeroMCP +3 |
| Rust | 1.78 | 1.88 | ZeroMCP +10 |
| Ruby | 3.0 | 3.2 | ZeroMCP +2 |
| Kotlin | 2.0 | 2.2 | ZeroMCP +2 |
| Java | 17 | 17 | Tied |
| Swift | 5.9 | 5.9 | Tied |
| C# | .NET 8 | .NET 8 | Tied |
| PHP | 8.1 | 8.1 | Tied |

## Node.js HTTP Frameworks (5 min sustained, ZeroMCP)

| Framework | avg rps | p50 | Memory | CPU/10s |
|-----------|---------|-----|--------|---------|
| bare http | 6,931 | 0.12ms | 67-77 MB | 2,712ms |
| Fastify | 6,505 | 0.13ms | 123-124 MB | 3,373ms |
| Express | 5,267 | 0.17ms | 118 MB | 4,775ms |
| Hono | 5,328 | 0.14ms | 122-739 MB (leak!) | 4,011ms |

## Node.js Time-Series (5 min sustained, 4 complexity tiers)

| Tier | Official avg rps | ZeroMCP avg rps | Ratio |
|------|-----------------|-----------------|-------|
| Low (hello) | 12,349 | 20,463 | 1.7x |
| Medium (invoice) | 10,875 | 17,555 | 1.6x |
| High (data proc) | 6,080 | 12,080 | 2.0x |
| Extreme (pipeline) | 5,280 | 6,604 | 1.3x |

## Conformance Tests

10 suites, 39 implementations, ~461 test runs, 0 failures.

Suites: Protocol (30 tests × 10 languages), Sandbox (8 × 10), Credentials env (4 × 3), Credentials file (3 × 2), Namespaces (6 × 4), Execute Timeout (4 × 2), Bypass Permissions (3 × 2), Custom Separator (4 × 2), Multiple Dirs (5 × 2), HTTP Auth (7 × 1).
