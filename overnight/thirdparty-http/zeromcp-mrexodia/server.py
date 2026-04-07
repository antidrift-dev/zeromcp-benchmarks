import os

from zeromcp import McpServer

server = McpServer("benchmark", "1.0.0")


@server.tool
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"


@server.tool
def add(a: float, b: float) -> str:
    """Add two numbers"""
    return str(a + b)


server.serve("0.0.0.0", int(os.environ.get("PORT", "3000")), background=False)
