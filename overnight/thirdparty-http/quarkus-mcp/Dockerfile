# Build context: antidrift/
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY zeromcp-benchmarks/overnight/thirdparty-http/quarkus-mcp/pom.xml .
COPY zeromcp-benchmarks/overnight/thirdparty-http/quarkus-mcp/src src
RUN mvn package -DskipTests -Dquarkus.package.jar.type=uber-jar

FROM eclipse-temurin:21-jre
WORKDIR /bench

COPY --from=build /build/target/*-runner.jar app.jar

EXPOSE 3000
CMD ["java", "-jar", "app.jar"]
