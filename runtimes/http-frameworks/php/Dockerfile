# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-php -f zeromcp-benchmarks/runtimes/http-frameworks/php/Dockerfile .

FROM php:8.3-cli
RUN apt-get update && apt-get install -y nodejs npm procps git unzip && rm -rf /var/lib/apt/lists/*

# Install Composer
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /bench

# Copy ZeroMCP PHP library
COPY zeromcp/php/ /bench/zeromcp-lib/

# Copy bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/php/composer.json .
COPY zeromcp-benchmarks/runtimes/http-frameworks/php/server-slim.php .

# Fix composer.json path to local zeromcp
RUN sed -i 's|../../../zeromcp-lib|/bench/zeromcp-lib|' composer.json

RUN composer install --no-dev --optimize-autoloader

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/php/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/php/package.json .

CMD ["node", "bench.mjs"]
