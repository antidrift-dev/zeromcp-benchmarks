"""FastMCP (PyPI: fastmcp) benchmark server — hello + add tools over streamable HTTP."""
import os

from fastmcp import FastMCP

mcp = FastMCP("fastmcp-python")

@mcp.tool()
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"

@mcp.tool()
def add(a: float, b: float) -> str:
    """Add two numbers"""
    return str(a + b)

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=int(os.environ.get("PORT", "3000")))
