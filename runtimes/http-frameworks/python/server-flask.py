"""ZeroMCP over Flask."""

import asyncio
import os

from flask import Flask, request, jsonify
from zeromcp.server import create_handler

loop = asyncio.new_event_loop()
handler = loop.run_until_complete(create_handler("./tools"))

# Count tools by sending a tools/list request
_list_resp = loop.run_until_complete(handler({
    "jsonrpc": "2.0", "id": 0, "method": "tools/list"
}))
tool_count = len(_list_resp.get("result", {}).get("tools", []))

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "tools": tool_count})


@app.post("/mcp")
def mcp():
    body = request.get_json(force=True)
    result = loop.run_until_complete(handler(body))
    if result is None:
        return jsonify({})
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    print(f"[flask] listening on :{port}", flush=True)
    app.run(host="0.0.0.0", port=port, threaded=True)
