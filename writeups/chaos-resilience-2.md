Chaos Monkey Level 2: Stress

# 37 attacks. One survivor.

Level 1 tested resilience. Level 2 tests stress. 10MB payloads, 1,000 concurrent requests, max int IDs, wrong types everywhere. Which frameworks survive under pressure?

Tested April 7, 2026 · zeromcp-benchmarks v1.0 · Reviewed by ZeroMCP Team

37/37 ZeroMCP

36/37 mcp-go, fastmcp (Python)

15 New L2 attacks

## Combined results (L1 + L2)

22 Level 1 attacks + 15 Level 2 attacks = 37 total. ZeroMCP is the only framework that passes all of them.

| Framework | Language | L1 (22) | L2 (15) | Total (37) | Failures |
| --- | --- | --- | --- | --- | --- |
| ZeroMCP | Node.js | 22/22 | 15/15 | 37/37 | None |
| Official SDK | Node.js | 22/22 | 15/15 | 37/37 | None |
| fastmcp | Node.js | 22/22 | 15/15 | 37/37 | None |
| mcp-framework | Node.js | 22/22 | 15/15 | 37/37 | None |
| mcp-go (mark3labs) | Go | 22/22 | 14/15 | 36/37 | max\_int\_id corrupted |
| fastmcp | Python | 22/22 | 14/15 | 36/37 | max\_int\_id corrupted |
| zeromcp-mrexodia | Python | 22/22 | 14/15 | 36/37 | string\_id crashed |
| Spring AI MCP | Java | 23/23 (SSE) | 23/23 | None |
| fast-mcp | Ruby | 23/23 (SSE) | 23/23 | None |

* * *

## Level 2 attack list

15 attacks designed to break edge cases that Level 1 doesn't cover.

**10MB payload**

Single tool call with a 10MB string argument. Tests memory handling and request size limits.

**1,000-level nesting**

Deeply nested JSON object as tool argument. Tests recursion limits and stack depth.

**50 concurrent calls**

50 simultaneous tool calls. Tests connection handling and response routing.

**Unicode/emoji args**

Tool arguments full of emoji, RTL text, and Unicode edge cases. Tests string handling.

**Null bytes**

Null bytes embedded in tool arguments. Tests binary safety of JSON parsing.

**Interleaved calls**

Multiple tool calls sent before any response. Tests out-of-order response handling.

**1,000 rapid fire**

1,000 requests as fast as possible. Tests throughput under extreme concurrency.

**10,000 arguments**

A single tool call with 10,000 key-value pairs. Tests schema validation performance.

**Max int ID**

JSON-RPC request ID set to Number.MAX\_SAFE\_INTEGER. Tests large integer handling.

**Float ID**

JSON-RPC request ID as a floating point number. Tests ID type handling.

**String ID**

JSON-RPC request ID as a string. Valid per spec but many implementations assume integer.

**Empty string args**

All arguments set to empty strings. Tests null vs empty handling.

**Array arguments**

Arguments passed as arrays instead of objects. Tests type validation.

**Boolean arguments**

Arguments passed as booleans where strings expected. Tests type coercion.

**Number arguments**

Arguments passed as numbers where strings expected. Tests type coercion.

* * *

## What broke

**max\_int\_id** mcp-go, fastmcp (Python)

Go and Python frameworks corrupt Number.MAX\_SAFE\_INTEGER (9007199254740991) in JSON-RPC response IDs. Large integer IDs are valid per JSON-RPC spec.

**string\_id** zeromcp-mrexodia

Crashes on string request IDs. JSON-RPC 2.0 spec allows string, number, or null.

[← Chaos Monkey: Resilience](./chaos-resilience.md) [All benchmarks →](./README.md)
