# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-ruby -f zeromcp-benchmarks/runtimes/http-frameworks/ruby/Dockerfile .

FROM ruby:3.3
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Copy ZeroMCP Ruby library
COPY zeromcp/ruby/ /bench/zeromcp-lib/

# Copy bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/ruby/Gemfile .
COPY zeromcp-benchmarks/runtimes/http-frameworks/ruby/server-sinatra.rb .
COPY zeromcp-benchmarks/runtimes/http-frameworks/ruby/server-rack.rb .

# Fix Gemfile path to local zeromcp
RUN sed -i "s|path: '../../../zeromcp-lib'|path: '/bench/zeromcp-lib'|" Gemfile

RUN bundle install

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/ruby/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/ruby/package.json .

CMD ["node", "bench.mjs"]
