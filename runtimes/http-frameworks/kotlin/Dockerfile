# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-ktor -f zeromcp-benchmarks/runtimes/http-frameworks/kotlin/Dockerfile .

# --- Stage 1: Build ZeroMCP Kotlin library ---
FROM gradle:8.10-jdk21 AS builder-zeromcp
WORKDIR /build
COPY zeromcp/kotlin/ .
RUN gradle jar --no-daemon -q

# --- Stage 2: Build Ktor server ---
FROM gradle:8.10-jdk21 AS builder-ktor
WORKDIR /build

# Copy ZeroMCP jar
COPY --from=builder-zeromcp /build/build/libs/zeromcp-0.1.1.jar /build/lib/zeromcp.jar

# Copy bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/kotlin/build.gradle.kts .
COPY zeromcp-benchmarks/runtimes/http-frameworks/kotlin/settings.gradle.kts .
RUN mkdir -p src/main/kotlin
COPY zeromcp-benchmarks/runtimes/http-frameworks/kotlin/server-ktor.kt src/main/kotlin/

RUN gradle installDist --no-daemon -q

# --- Stage 3: Runtime ---
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder-ktor /build/build/install/bench-ktor/ /bench/ktor/

# Copy bench harness
COPY zeromcp-benchmarks/runtimes/http-frameworks/kotlin/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/kotlin/package.json .

CMD ["node", "bench.mjs"]
