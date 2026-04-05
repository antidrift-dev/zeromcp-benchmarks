# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-go -f zeromcp-benchmarks/runtimes/http-frameworks/go/Dockerfile .

# --- Build stage ---
FROM golang:1.22 AS builder

WORKDIR /build

# Copy ZeroMCP Go source
COPY zeromcp/go/ /zeromcp/go/

# Copy benchmark Go sources
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/go.mod .
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-nethttp.go .
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-gin.go .
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-chi.go .

# Download dependencies and build all three servers
RUN go mod tidy
RUN go build -o server-nethttp server-nethttp.go
RUN go build -o server-gin server-gin.go
RUN go build -o server-chi server-chi.go

# --- Runtime stage ---
FROM node:22-slim

WORKDIR /bench

# Copy compiled Go binaries
COPY --from=builder /build/server-nethttp .
COPY --from=builder /build/server-gin .
COPY --from=builder /build/server-chi .

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/bench-go.mjs .

CMD ["node", "bench-go.mjs"]
