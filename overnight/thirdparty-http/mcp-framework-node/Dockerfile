# Build context: antidrift/
FROM node:22
WORKDIR /bench

# mcp-framework server
COPY zeromcp-benchmarks/overnight/thirdparty-http/mcp-framework-node/package.json server/
COPY zeromcp-benchmarks/overnight/thirdparty-http/mcp-framework-node/server.mjs server/
RUN cd server && npm install 2>/dev/null

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/server.mjs"]
