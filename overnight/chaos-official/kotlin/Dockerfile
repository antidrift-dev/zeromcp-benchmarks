# Build context: antidrift/
FROM gradle:8.10-jdk21 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/kotlin/build.gradle.kts .
COPY zeromcp-benchmarks/overnight/chaos-official/kotlin/settings.gradle.kts .
RUN gradle dependencies --no-daemon -q 2>/dev/null || true
COPY zeromcp-benchmarks/overnight/chaos-official/kotlin/Server.kt src/main/kotlin/
RUN gradle jar --no-daemon -q

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /build/build/libs/chaos-kotlin.jar app.jar
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

ENV STARTUP_WAIT=5000
CMD ["node", "chaos-runner.mjs", "kotlin", "java", "-jar", "app.jar"]
