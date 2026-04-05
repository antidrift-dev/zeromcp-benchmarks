FROM golang:1.25 AS builder-official
WORKDIR /build
COPY zeromcp-benchmarks/go/official/ .
RUN go mod tidy && go build -o /official-server .

FROM golang:1.22 AS builder-zeromcp
WORKDIR /build
COPY zeromcp/go/ .
RUN go build -o /zeromcp-go ./examples/basic/

# Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder-official /official-server /bench/official-server
COPY --from=builder-zeromcp /zeromcp-go /usr/local/bin/zeromcp-go
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/go/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
