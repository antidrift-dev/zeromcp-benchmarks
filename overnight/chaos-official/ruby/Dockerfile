# Build context: antidrift/
FROM ruby:3.3
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/chaos-official/ruby/Gemfile official/
RUN cd official && bundle install
COPY zeromcp-benchmarks/overnight/chaos-official/ruby/server.rb official/
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

CMD ["node", "chaos-runner.mjs", "ruby", "ruby", "official/server.rb"]
