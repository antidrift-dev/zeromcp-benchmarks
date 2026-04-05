FROM php:8.3-cli
RUN apt-get update && apt-get install -y nodejs npm procps unzip git && rm -rf /var/lib/apt/lists/*
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
WORKDIR /bench

# Official SDK
COPY zeromcp-benchmarks/php/official/ official/
RUN cd official && composer install --no-dev 2>/dev/null

# ZeroMCP source
COPY zeromcp/php/ /zeromcp/php/

# Harness
COPY zeromcp-benchmarks/harness.js .
COPY zeromcp-benchmarks/package.json .
COPY zeromcp-benchmarks/php/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
