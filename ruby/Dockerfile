FROM ruby:3.3
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Official SDK
COPY benchmarks/ruby/official/ official/
RUN cd official && bundle install 2>/dev/null

# ZeroMCP source
COPY ruby/ /zeromcp/ruby/

# Harness
COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/ruby/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
