# Build context: antidrift/
FROM python:3.12-slim
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "mcp[cli]"
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/official-http/python/server.py official/
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PYTHONUNBUFFERED=1
ENV PORT=3000
ENV STARTUP_WAIT=1000
EXPOSE 3000
CMD ["node", "proxy.mjs", "python", "official/server.py"]
