FROM python:3.12-slim

RUN pip install --no-cache-dir zeromcp

WORKDIR /app

COPY zeromcp-benchmarks/overnight/thirdparty-http/zeromcp-mrexodia/server.py server.py

EXPOSE 3000

CMD ["python", "server.py"]
