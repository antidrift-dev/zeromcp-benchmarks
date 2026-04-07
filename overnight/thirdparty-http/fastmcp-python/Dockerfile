# Build context: antidrift/
FROM python:3.12-slim
RUN pip install --no-cache-dir fastmcp
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/thirdparty-http/fastmcp-python/server.py server.py

ENV PYTHONUNBUFFERED=1
ENV PORT=3000
EXPOSE 3000
CMD ["python", "server.py"]
