FROM ruby:3.3
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Official SDK
COPY zeromcp-benchmarks/ruby/official/ official/
RUN cd official && bundle install 2>/dev/null

# ZeroMCP source
COPY zeromcp/ruby/ /zeromcp/ruby/

# Harness
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/ruby/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
