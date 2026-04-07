# Build context: antidrift/
FROM golang:1.23 AS build
WORKDIR /src
COPY zeromcp-benchmarks/overnight/thirdparty-http/mcp-go-mark3labs/server.go .
RUN go mod init mcp-go-bench && \
    go mod tidy && \
    CGO_ENABLED=0 go build -o /server server.go

FROM gcr.io/distroless/static-debian12
COPY --from=build /server /server

ENV PORT=3000
EXPOSE 3000
CMD ["/server"]
