# Build context: antidrift/
FROM node:22
WORKDIR /bench

COPY zeromcp/nodejs/ /zeromcp/nodejs/
RUN cd /zeromcp/nodejs && npm install && npm run build

COPY zeromcp-benchmarks/overnight/overhead/bench.mjs .
COPY zeromcp-benchmarks/package.json .

CMD ["node", "bench.mjs"]
