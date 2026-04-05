# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-lambda -f zeromcp-benchmarks/runtimes/lambda/Dockerfile .

FROM node:22 AS builder
WORKDIR /build
COPY zeromcp/nodejs/ ./nodejs/
RUN cd nodejs && npm install && npm run build

FROM public.ecr.aws/lambda/nodejs:22
WORKDIR /var/task

COPY --from=builder /build/nodejs /zeromcp/nodejs
COPY zeromcp-benchmarks/runtimes/lambda/handler.mjs .

CMD ["handler.handler"]
