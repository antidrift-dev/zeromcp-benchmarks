"""ZeroMCP over FastAPI."""

import asyncio
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn
from zeromcp.server import create_handler

handler = None
tool_count = 0

app = FastAPI()


@app.on_event("startup")
async def startup():
    global handler, tool_count
    handler = await create_handler("./tools")
    resp = await handler({
        "jsonrpc": "2.0", "id": 0, "method": "tools/list"
    })
    tool_count = len(resp.get("result", {}).get("tools", []))


@app.get("/health")
async def health():
    return {"status": "ok", "tools": tool_count}


@app.post("/mcp")
async def mcp(request: Request):
    body = await request.json()
    result = await handler(body)
    if result is None:
        return JSONResponse(content={})
    return JSONResponse(content=result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"[fastapi] listening on :{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
