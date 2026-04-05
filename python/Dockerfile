FROM python:3.12-slim
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Official SDK
RUN pip install --no-cache-dir "mcp[cli]"

# ZeroMCP source (no install needed — stdlib only)
COPY zeromcp/python/ /zeromcp/python/

# Benchmark files
COPY zeromcp-benchmarks/python/official.py .
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/python/config.json .

ENV PYTHONUNBUFFERED=1
CMD ["node", "harness.js", "--config", "config.json"]
