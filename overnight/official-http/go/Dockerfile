# Build context: antidrift/
FROM golang:1.25 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/go/server.go .
RUN go mod init official-go && \
    go get github.com/modelcontextprotocol/go-sdk@latest && \
    go mod tidy && \
    CGO_ENABLED=0 go build -o /official-server server.go

FROM node:22-slim
WORKDIR /bench
COPY --from=builder /official-server /usr/local/bin/official-server
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "/usr/local/bin/official-server"]
