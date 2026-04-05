FROM maven:3.9-eclipse-temurin-21 AS builder-official
WORKDIR /build
COPY benchmarks/java/official/ .
RUN mvn package -q -DskipTests && \
    mvn dependency:copy-dependencies -DoutputDirectory=target/deps -q

FROM maven:3.9-eclipse-temurin-21 AS builder-zeromcp
WORKDIR /build
COPY java/ .
RUN mvn package -q -DskipTests && \
    mvn dependency:copy-dependencies -DoutputDirectory=target/deps -q && \
    mkdir -p /tmp/java-out && \
    javac -cp "target/zeromcp-0.1.0.jar:target/deps/*" \
      -d /tmp/java-out example/src/main/java/Main.java 2>&1 || true

# Runtime
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

# Official: jar + deps
COPY --from=builder-official /build/target/*.jar /bench/official/
COPY --from=builder-official /build/target/deps/ /bench/official/

# ZeroMCP: jar + deps + compiled example
COPY --from=builder-zeromcp /build/target/zeromcp-0.1.0.jar /bench/zeromcp/
COPY --from=builder-zeromcp /build/target/deps/ /bench/zeromcp/
COPY --from=builder-zeromcp /tmp/java-out/ /bench/zeromcp/

COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/java/config.json .

CMD ["node", "harness.js", "--config", "config.json"]
