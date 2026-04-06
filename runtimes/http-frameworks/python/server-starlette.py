"""ZeroMCP over Starlette."""

import asyncio
import os
from contextlib import asynccontextmanager

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
import uvicorn
from zeromcp.server import create_handler

handler = None
tool_count = 0


@asynccontextmanager
async def lifespan(app):
    global handler, tool_count
    handler = await create_handler({"tools": ["./tools"]})
    resp = await handler({
        "jsonrpc": "2.0", "id": 0, "method": "tools/list"
    })
    tool_count = len(resp.get("result", {}).get("tools", []))
    yield


async def health(request):
    return JSONResponse({"status": "ok", "tools": tool_count})


async def mcp(request):
    body = await request.json()
    result = await handler(body)
    if result is None:
        return JSONResponse({})
    return JSONResponse(result)


app = Starlette(
    routes=[
        Route("/health", health, methods=["GET"]),
        Route("/mcp", mcp, methods=["POST"]),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"[starlette] listening on :{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
