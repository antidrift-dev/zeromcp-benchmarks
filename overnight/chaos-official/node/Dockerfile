# Build context: antidrift/
FROM node:22
WORKDIR /bench

# Official SDK server with chaos tools
COPY zeromcp-benchmarks/overnight/chaos-official/node/package.json official/
COPY zeromcp-benchmarks/overnight/chaos-official/node/server.mjs official/
RUN cd official && npm install 2>/dev/null

# Chaos runner from main repo
COPY zeromcp/tests/chaos/run-chaos.js .
COPY zeromcp-benchmarks/package.json .

# Override implementations to test official SDK only
COPY zeromcp-benchmarks/overnight/chaos-official/node/run.mjs .

CMD ["node", "run.mjs"]
