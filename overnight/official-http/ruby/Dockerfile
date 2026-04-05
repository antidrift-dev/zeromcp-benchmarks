# Build context: antidrift/
FROM ruby:3.3
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/official-http/ruby/Gemfile official/
RUN cd official && bundle install
COPY zeromcp-benchmarks/overnight/official-http/ruby/server.rb official/
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "ruby", "official/server.rb"]
