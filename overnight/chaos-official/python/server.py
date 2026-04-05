"""Official MCP Python SDK server with chaos tools."""
import asyncio
import json
import sys
import os

os.environ["PYTHONUNBUFFERED"] = "1"

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("official-chaos")
leaks = []

@mcp.tool()
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"

@mcp.tool()
def throw_error() -> str:
    """Tool that throws"""
    raise RuntimeError("Intentional chaos: unhandled exception")

@mcp.tool()
def hang() -> str:
    """Tool that hangs forever"""
    import time
    time.sleep(86400)
    return "unreachable"

@mcp.tool()
def slow() -> str:
    """Tool that takes 3 seconds"""
    import time
    time.sleep(3)
    return json.dumps({"status": "ok", "delay_ms": 3000})

@mcp.tool()
def leak_memory() -> str:
    """Tool that leaks memory"""
    leaks.append(bytearray(1024 * 1024))
    return json.dumps({"leaked_buffers": len(leaks), "total_mb": len(leaks)})

@mcp.tool()
def stdout_corrupt() -> str:
    """Tool that writes to stdout"""
    sys.stdout.write("CORRUPTED OUTPUT\n")
    sys.stdout.flush()
    return json.dumps({"status": "ok"})

if __name__ == "__main__":
    mcp.run(transport="stdio")
