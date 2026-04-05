"""Official MCP Python SDK server — hello + add tools over stdio."""
import os
os.environ["PYTHONUNBUFFERED"] = "1"

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("official-python")

@mcp.tool()
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"

@mcp.tool()
def add(a: float, b: float) -> str:
    """Add two numbers"""
    return str(a + b)

if __name__ == "__main__":
    mcp.run(transport="stdio")
