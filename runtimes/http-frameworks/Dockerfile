# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http -f zeromcp-benchmarks/runtimes/http-frameworks/Dockerfile .

FROM node:22
WORKDIR /bench

# Build ZeroMCP
COPY zeromcp/nodejs/ ./zeromcp-src/
RUN cd zeromcp-src && npm install && npm run build
RUN cp -r zeromcp-src/dist zeromcp/ && cp zeromcp-src/package.json zeromcp/

# Copy tools
COPY zeromcp/nodejs/examples/tools ./tools/

# Install HTTP framework deps
COPY zeromcp-benchmarks/runtimes/http-frameworks/package.json .
RUN npm install

# Copy servers and bench
COPY zeromcp-benchmarks/runtimes/http-frameworks/server-bare.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/server-express.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/server-fastify.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/server-hono.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/bench.mjs .

# Cleanup
RUN rm -rf zeromcp-src

# Default: 5 min per framework. Set DURATION=30 for quick test.
CMD ["node", "bench.mjs"]
