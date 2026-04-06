# Build context: antidrift/
FROM golang:1.22 AS builder

# Copy ZeroMCP Go source as the base module
COPY zeromcp/go/ /zeromcp/go/
WORKDIR /zeromcp/go

# Copy benchmark server files into the module (strip build ignore tag)
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-nethttp.go /tmp/
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-gin.go /tmp/
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/server-chi.go /tmp/
RUN mkdir -p cmd/bench-nethttp cmd/bench-gin cmd/bench-chi && \
    sed '/^\/\/go:build/d' /tmp/server-nethttp.go > cmd/bench-nethttp/main.go && \
    sed '/^\/\/go:build/d' /tmp/server-gin.go > cmd/bench-gin/main.go && \
    sed '/^\/\/go:build/d' /tmp/server-chi.go > cmd/bench-chi/main.go

# Get framework dependencies and build
RUN go get github.com/gin-gonic/gin@v1.10.0 github.com/go-chi/chi/v5@v5.1.0 && \
    go mod tidy && \
    go build -o /server-nethttp ./cmd/bench-nethttp/ && \
    go build -o /server-gin ./cmd/bench-gin/ && \
    go build -o /server-chi ./cmd/bench-chi/

# Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder /server-nethttp .
COPY --from=builder /server-gin .
COPY --from=builder /server-chi .
COPY zeromcp-benchmarks/runtimes/http-frameworks/go/bench-go.mjs .
COPY zeromcp-benchmarks/package.json .

CMD ["node", "bench-go.mjs"]
