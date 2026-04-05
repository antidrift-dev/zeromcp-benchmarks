FROM php:8.3-cli
RUN apt-get update && apt-get install -y nodejs npm procps unzip git && rm -rf /var/lib/apt/lists/*
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
WORKDIR /bench

# Official SDK
COPY benchmarks/php/official/ official/
RUN cd official && composer install --no-dev 2>/dev/null

# ZeroMCP source
COPY php/ /zeromcp/php/

# Harness
COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/php/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
