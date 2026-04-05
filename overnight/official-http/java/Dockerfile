# Build context: antidrift/
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /build
COPY zeromcp-benchmarks/overnight/official-http/java/pom.xml .
RUN mvn dependency:resolve -q
COPY zeromcp-benchmarks/overnight/official-http/java/Server.java src/main/java/
RUN mvn package -q -DskipTests

FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*
WORKDIR /bench
COPY --from=builder /build/target/official-java-1.0.0.jar app.jar
COPY --from=builder /build/target/libs/ libs/
COPY zeromcp-benchmarks/overnight/official-http/proxy.mjs .

ENV PORT=3000
ENV STARTUP_WAIT=3000
EXPOSE 3000
CMD ["node", "proxy.mjs", "java", "-cp", "app.jar:libs/*", "Server"]
