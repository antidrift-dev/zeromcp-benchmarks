# Build context: antidrift/
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/chaos-official/java/pom.xml .
RUN mvn dependency:resolve -q
COPY zeromcp-benchmarks/overnight/chaos-official/java/Server.java src/main/java/
RUN mvn package -q -DskipTests

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /build/target/chaos-java-1.0.0.jar app.jar
COPY --from=builder /build/target/libs/ libs/
COPY zeromcp-benchmarks/overnight/chaos-official/chaos-runner.mjs .

ENV STARTUP_WAIT=5000
CMD ["node", "chaos-runner.mjs", "java", "java", "-cp", "app.jar:libs/*", "Server"]
