# Build context: antidrift/
FROM python:3.12-slim
WORKDIR /bench

# Install Node.js for harness
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python HTTP frameworks
RUN pip install --no-cache-dir flask fastapi uvicorn starlette

# Copy ZeroMCP Python source (no install, use PYTHONPATH)
COPY zeromcp/python/ /zeromcp/python/

# Copy tools, resources, prompts
COPY zeromcp/python/examples/tools/ ./tools/
COPY zeromcp/tests/conformance/test-resources-python/ ./resources/
COPY zeromcp/tests/conformance/test-prompts-python/ ./prompts/

# Copy server files
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-flask.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-fastapi.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/server-starlette.py .
COPY zeromcp-benchmarks/runtimes/http-frameworks/python/bench-python.mjs .
COPY zeromcp-benchmarks/package.json .

ENV PYTHONPATH=/zeromcp/python
ENV PYTHONUNBUFFERED=1

CMD ["node", "bench-python.mjs"]
