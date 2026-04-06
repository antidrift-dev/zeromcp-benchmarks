# Build context: antidrift/ (parent of both zeromcp and zeromcp-benchmarks)
# docker build -t zeromcp-bench-http-javalin -f zeromcp-benchmarks/runtimes/http-frameworks/java/Dockerfile .

# --- Stage 1: Build ZeroMCP library ---
FROM maven:3.9-eclipse-temurin-21 AS builder-zeromcp
WORKDIR /build
COPY zeromcp/java/ .
RUN mvn package -q -DskipTests && \
    mvn dependency:copy-dependencies -DoutputDirectory=target/deps -q

# --- Stage 2: Build Javalin server ---
FROM maven:3.9-eclipse-temurin-21 AS builder-javalin
WORKDIR /build

# Copy ZeroMCP jar as local dependency
COPY --from=builder-zeromcp /build/target/zeromcp-0.1.0.jar /build/lib/zeromcp-0.1.0.jar
COPY --from=builder-zeromcp /build/target/deps/gson-2.11.0.jar /build/lib/

# Copy bench project
COPY zeromcp-benchmarks/runtimes/http-frameworks/java/pom.xml .
COPY zeromcp-benchmarks/runtimes/http-frameworks/java/server-javalin.java ServerJavalin.java

RUN mvn package -q -DskipTests && \
    mvn dependency:copy-dependencies -DoutputDirectory=target/deps -q

# --- Stage 3: Runtime ---
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Copy all jars
COPY --from=builder-javalin /build/target/*.jar /bench/jars/
COPY --from=builder-javalin /build/target/deps/ /bench/jars/
COPY --from=builder-javalin /build/lib/ /bench/jars/

# Copy bench harness (Node.js based, same pattern as existing)
COPY zeromcp-benchmarks/runtimes/http-frameworks/java/bench.mjs .
COPY zeromcp-benchmarks/runtimes/http-frameworks/java/package.json .
RUN npm install 2>/dev/null || true

# Default: 5 min per framework. Set DURATION=30 for quick test.
CMD ["node", "bench.mjs"]
