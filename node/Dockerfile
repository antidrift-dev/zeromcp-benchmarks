FROM node:22
WORKDIR /bench

# Official SDK
COPY benchmarks/node/official/ official/
RUN cd official && npm install 2>/dev/null

# ZeroMCP source
COPY nodejs/ /zeromcp/nodejs/
RUN cd /zeromcp/nodejs && npm install && npm run build

# Benchmark tools for time-series
COPY benchmarks/node/tools-bench/ tools-bench/

# Harness files
COPY benchmarks/harness.js .
COPY benchmarks/harness-timeseries.js .
COPY benchmarks/package.json .
COPY benchmarks/node/config.json .
COPY benchmarks/node/config-timeseries.json .
COPY benchmarks/node/config-timeseries-quick.json .

CMD ["node", "harness-timeseries.js", "--config", "config-timeseries.json"]
