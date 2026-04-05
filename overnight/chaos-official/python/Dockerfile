# Build context: antidrift/
FROM python:3.12-slim
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "mcp[cli]"
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/chaos-official/python/server.py official/
COPY zeromcp-benchmarks/overnight/chaos-official/node/run.mjs chaos-template.mjs
COPY zeromcp-benchmarks/overnight/chaos-official/python/run.mjs .
COPY zeromcp-benchmarks/package.json .

ENV PYTHONUNBUFFERED=1
CMD ["node", "run.mjs"]
