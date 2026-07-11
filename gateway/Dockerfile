FROM eclipse-temurin:21-jre-alpine
COPY target/gateway-*.jar app.jar
ENTRYPOINT ["java", \
  "-XX:+UseZGC", \
  "-XX:+ZGenerational", \
  "-XX:MaxRAMPercentage=75", \
  "-jar", "/app.jar"]