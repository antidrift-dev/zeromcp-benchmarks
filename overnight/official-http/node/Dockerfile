# Build context: antidrift/
FROM node:22
WORKDIR /bench

# Official SDK server
COPY zeromcp-benchmarks/overnight/official-http/node/package.json official/
COPY zeromcp-benchmarks/overnight/official-http/node/server.mjs official/
RUN cd official && npm install 2>/dev/null

# Shared HTTP proxy
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "node", "official/server.mjs"]
