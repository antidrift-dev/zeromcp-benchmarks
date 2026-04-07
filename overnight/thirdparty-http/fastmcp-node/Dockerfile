# Build context: antidrift/
FROM node:22
WORKDIR /app

COPY zeromcp-benchmarks/overnight/thirdparty-http/fastmcp-node/package.json .
COPY zeromcp-benchmarks/overnight/thirdparty-http/fastmcp-node/server.mjs .
RUN npm install 2>/dev/null

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
