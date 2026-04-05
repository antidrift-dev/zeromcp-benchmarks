FROM node:22
WORKDIR /bench

# Official SDK
COPY zeromcp-benchmarks/node/official/ official/
RUN cd official && npm install 2>/dev/null

# ZeroMCP source
COPY zeromcp/nodejs/ /zeromcp/nodejs/
RUN cd /zeromcp/nodejs && npm install && npm run build

# Benchmark tools for time-series
COPY zeromcp-benchmarks/node/tools-bench/ tools-bench/

# Harness files
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/harness-timeseries.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/node/config.json .
COPY zeromcp-benchmarks/node/config-timeseries.json .
COPY zeromcp-benchmarks/node/config-timeseries-quick.json .

CMD ["node", "harness-timeseries.js", "--config", "config-timeseries.json"]
