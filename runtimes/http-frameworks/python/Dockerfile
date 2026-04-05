# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-python -f zeromcp-benchmarks/runtimes/http-frameworks/python/Dockerfile .

FROM python:3.12-slim

WORKDIR /bench

# Install Python HTTP frameworks
RUN pip install --no-cache-dir flask fastapi uvicorn starlette

# Copy ZeroMCP Python source
COPY zeromcp/python/zeromcp/ ./zeromcp-src/zeromcp/
COPY zeromcp/python/pyproject.toml ./zeromcp-src/
RUN pip install --no-cache-dir ./zeromcp-src

# Copy example tools
COPY zeromcp/python/examples/tools/ ./tools/

# Copy server files
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-flask.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-fastapi.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-starlette.py .

# Copy bench harness (Node-based)
FROM node:22-slim AS harness
WORKDIR /bench
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/bench-python.mjs .

# Final image: Python + Node for harness
FROM python:3.12-slim
WORKDIR /bench

# Install Node.js
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Re-install Python deps
RUN pip install --no-cache-dir flask fastapi uvicorn starlette

# Copy ZeroMCP Python source and install
COPY zeromcp/python/zeromcp/ ./zeromcp-src/zeromcp/
COPY zeromcp/python/pyproject.toml ./zeromcp-src/
RUN pip install --no-cache-dir ./zeromcp-src

# Copy tools
COPY zeromcp/python/examples/tools/ ./tools/

# Copy server files
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-flask.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-fastapi.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-starlette.py .

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/bench-python.mjs .

CMD ["node", "bench-python.mjs"]
