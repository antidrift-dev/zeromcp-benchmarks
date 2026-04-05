# Build context: antidrift/
FROM gradle:8.10-jdk21 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/kotlin/build.gradle.kts .
COPY zeromcp-benchmarks/overnight/official-http/kotlin/settings.gradle.kts .
RUN gradle dependencies --no-daemon -q 2>/dev/null || true
COPY zeromcp-benchmarks/overnight/official-http/kotlin/Server.kt src/main/kotlin/
RUN gradle jar --no-daemon -q

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /build/build/libs/official-kotlin.jar app.jar
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
ENV STARTUP_WAIT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "java", "-jar", "app.jar"]
