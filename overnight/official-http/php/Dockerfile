# Build context: antidrift/
FROM php:8.3-cli
RUN apt-get update && apt-get install -y nodejs npm unzip git && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /bench

COPY zeromcp-benchmarks/overnight/official-http/php/composer.json official/
RUN cd official && composer install --no-interaction --no-dev 2>/dev/null
COPY zeromcp-benchmarks/overnight/official-http/php/server.php official/
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "php", "official/server.php"]
