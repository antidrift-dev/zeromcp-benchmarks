FROM python:3.12-slim
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Official SDK
RUN pip install --no-cache-dir "mcp[cli]"

# ZeroMCP source (no install needed — stdlib only)
COPY python/ /zeromcp/python/

# Benchmark files
COPY benchmarks/python/official.py .
COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/python/config.json .

ENV PYTHONUNBUFFERED=1
CMD ["node", "harness.js", "--config", "config.json"]
