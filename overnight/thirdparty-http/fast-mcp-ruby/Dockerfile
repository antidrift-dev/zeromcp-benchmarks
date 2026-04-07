# Build context: antidrift/
FROM ruby:3.3
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/thirdparty-http/fast-mcp-ruby/Gemfile Gemfile
RUN bundle install

COPY zeromcp-benchmarks/overnight/thirdparty-http/fast-mcp-ruby/server.rb server.rb

ENV PORT=3000
ENV STARTUP_WAIT=1000
EXPOSE 3000
CMD ["bundle", "exec", "ruby", "server.rb"]
