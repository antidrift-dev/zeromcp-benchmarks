Chaos Monkey Level 1: Resilience

# Can your MCP server  
survive bad input?

22 resilience attacks across all 10 languages. Malformed JSON, binary garbage, memory leaks, hanging tools. How does the official SDK hold up vs ZeroMCP?

Tested April 7, 2026 · zeromcp-benchmarks v1.0 · Reviewed by ZeroMCP Team

TL;DR

-   ZeroMCP: 21/22 or 22/22 across all 10 languages
-   Official SDKs: 19-21/22. Crashes and corrupted responses.
-   C# crashed on bad JSON. Ruby crashed on binary. PHP corrupted on large payloads.
-   ZeroMCP's only issue: `tool_hangs` degrades 3 of 10 languages. Recovers after timeout.
-   21 bugs found and fixed before v0.1.0 shipped

## How we tested

**Setup**

Fresh server per attack. Send chaos payload. Send normal hello request. Check if the response is correct.

**Three outcomes**

Survived: correct response. Corrupted: wrong response. Crashed: no response. Corrupted is worse. A crash is obvious. Corrupted data gets passed to an LLM that treats it as truth.

**What failed on the official SDKs**

C# threw unhandled `JsonDocument.Parse` on malformed JSON. Ruby called `JSON.parse` on raw binary. PHP couldn't reassemble 1MB payloads. Node.js and Python blocked on hanging tools.

**What failed on ZeroMCP**

`tool_hangs` degrades Node.js, Python, Swift. Server recovers after timeout. Ruby and PHP use process-level timeouts: 22/22. 21 bugs found and fixed before v0.1.0 shipped.

* * *

## 22 attacks in 4 categories

Fresh server spawned per attack. After each attack, a normal hello request verifies the server still works.

### Protocol (10)

Malformed JSON, truncated JSON, empty lines, missing ID, missing method, null ID, negative ID, duplicate ID, double initialize, unknown method

### Payload (4)

1MB giant string, 100-level deep nesting, empty tool name, null arguments

### Tool Behavior (6)

Binary garbage on stdin, tool throws exception, tool hangs forever, tool runs slow (2s), tool leaks memory (50 iterations), execute timeout

### Stress (2)

Tool corrupts stdout, 100 rapid-fire concurrent requests

* * *

## Results

Official SDK results vs ZeroMCP, every language.

✓ = survived.

### ZeroMCP

| Attack | Node.js | Python | Go | Rust | Java | Kotlin | Swift | C# | Ruby | PHP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Protocol: malformed json | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: truncated json | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: empty line | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: missing id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: missing method | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: null id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: negative id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: duplicate id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: double initialize | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: unknown method | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: giant string | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: deeply nested | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: empty tool name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: null arguments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: binary garbage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: tool throws | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: tool hangs | degraded | degraded | ✓ | ✓ | ✓ | ✓ | degraded | ✓ | ✓ | ✓ |
| Tool Behavior: tool slow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: tool leak memory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: execute timeout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stress: tool stdout corrupt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stress: rapid fire 100 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Official SDKs

| Attack | Node.js | Python | Go | Rust | Java | Kotlin | Swift | C# | Ruby | PHP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Protocol: malformed json | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | crashed | ✓ | ✓ |
| Protocol: truncated json | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: empty line | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: missing id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: missing method | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: null id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: negative id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: duplicate id | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: double initialize | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Protocol: unknown method | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: giant string | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | corrupted |
| Payload: deeply nested | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: empty tool name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payload: null arguments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: binary garbage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | crashed | ✓ |
| Tool Behavior: tool throws | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: tool hangs | degraded | degraded | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: tool slow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | corrupted | corrupted |
| Tool Behavior: tool leak memory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tool Behavior: execute timeout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stress: tool stdout corrupt | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stress: rapid fire 100 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

* * *

## What broke

Every failure listed is on the official SDK side.

**`tool_hangs`** Node.js, Python: degraded

Hanging tool blocks the event loop. Server recovers after timeout but is unresponsive during the hang.

**`malformed_json`** C#: crashed

`JsonDocument.Parse` threw an unhandled exception on invalid JSON input.

**`giant_string`** PHP: corrupted

1MB string payload caused malformed JSON-RPC response. Buffer handling couldn't reassemble.

**`tool_slow`** PHP, Ruby: corrupted

Slow tool response interleaved with next request's output. Output stream corruption.

**`binary_garbage`** Ruby: crashed

`JSON.parse` on raw binary without error handling. Process exited.

**`tool_hangs`** ZeroMCP (Node, Python, Swift): degraded

Hanging tool blocks but server recovers. Ruby and PHP handle it cleanly with process-level timeouts (22/22).

[Chaos Monkey: Stress →](./chaos-resilience-2.md) [All benchmarks →](./README.md)
