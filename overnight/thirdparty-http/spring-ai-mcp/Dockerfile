# Build context: antidrift/
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY zeromcp-benchmarks/overnight/thirdparty-http/spring-ai-mcp/pom.xml .
RUN mvn dependency:go-offline -B
COPY zeromcp-benchmarks/overnight/thirdparty-http/spring-ai-mcp/src src
RUN mvn package -B -DskipTests && \
    cp target/*.jar app.jar

FROM eclipse-temurin:21-jre
WORKDIR /bench
COPY --from=build /build/app.jar app.jar

EXPOSE 3000
CMD ["java", "-jar", "app.jar"]
