FROM gradle:8.10-jdk21 AS builder-official
WORKDIR /build
COPY benchmarks/kotlin/official/ .
RUN gradle installDist -x test 2>&1 | tail -5

FROM gradle:8.10-jdk21 AS builder-zeromcp
WORKDIR /build
COPY kotlin/ .
RUN gradle :example:installDist -x test 2>&1 | tail -5

# Runtime
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm procps && rm -rf /var/lib/apt/lists/*
WORKDIR /bench

COPY --from=builder-official /build/build/install/mcp-bench-official/ /bench/official/
COPY --from=builder-zeromcp /build/example/build/install/example/ /bench/zeromcp/

COPY benchmarks/harness.js .
COPY benchmarks/package.json .
COPY benchmarks/kotlin/config.json .

ENV JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8"
CMD ["node", "harness.js", "--config", "config.json"]
