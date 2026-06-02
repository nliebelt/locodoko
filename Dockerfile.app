# Locodoko — Produktions-Image (Multi-Stage Build)
#
# Stage 1: Maven-Build (inkl. Frontend via maven-frontend-plugin)
# Stage 2: Schlankes JRE-Image fuer den Betrieb

# --- Build-Stage ---
FROM eclipse-temurin:25-jdk AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    maven nodejs npm git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pom.xml ./
COPY src/ src/
COPY frontend/ frontend/

RUN mvn clean package -DskipTests -q

# --- Runtime-Stage ---
FROM eclipse-temurin:25-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 app && useradd --uid 1000 --gid 1000 -m app

WORKDIR /app
COPY --from=build /build/target/*.jar app.jar

USER app

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]
