# Build context: antidrift/
FROM golang:1.25 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/go/server.go .
RUN go mod init chaos-go && \
    go get github.com/modelcontextprotocol/go-sdk@latest && \
    go mod tidy && \
    CGO_ENABLED=0 go build -o /chaos-server server.go

FROM node:22-slim
WORKDIR /bench
COPY --from=builder /chaos-server /usr/local/bin/chaos-server
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .
CMD ["node", "chaos-runner.mjs", "go", "/usr/local/bin/chaos-server"]
