from mcp.server.fastmcp import FastMCP
import json

mcp = FastMCP("bench-official")


@mcp.tool()
def hello(name: str) -> str:
    """Say hello to someone"""
    return f"Hello, {name}!"


@mcp.tool()
def add(a: float, b: float) -> str:
    """Add two numbers together"""
    return json.dumps({"sum": a + b})


if __name__ == "__main__":
    import os
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    mcp.run(transport="stdio")
