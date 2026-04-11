# Locodoko — Entdeckte Gotchas

Build-Befehle und Architektur: siehe CLAUDE.md (wird automatisch geladen).

## Spring Boot 4 / Java 25 Migration (2026-03-29)

- `export JAVA_HOME=/usr/lib/jvm/temurin-25-jdk-arm64` nötig, da JAVA_HOME nicht gesetzt ist
- SB4 hat `@AutoConfigureMockMvc` entfernt → `MockMvcBuilders.webAppContextSetup(wac).build()` in `@BeforeEach`
- SB4 hat `TestRestTemplate` entfernt → plain `RestTemplate` + `@LocalServerPort` für RANDOM_PORT-Tests
- SB4 verwendet Jackson 3 (`tools.jackson.databind.ObjectMapper`), nicht mehr `com.fasterxml.jackson`
- SB4: `liquibase-core` allein reicht nicht → `spring-boot-starter-liquibase` nötig (Autoconfig eigener Starter)
- SB4: `spring-boot-test-autoconfigure` hat nur noch `jdbc` und `json` Test-Slices (kein `web.servlet` mehr)

## Vision Loop Bridge (2026-04-11)

- `vision-loop.spec.ts` nutzt `window.__locodoko.appStore.spieleKarte()` direkt — bypassed Keyboard-Handler
- Nach **R7** (TischSzene aufteilen): Bridge-Schnittstelle prüfen ob AppStore-Methode noch gleich heißt
- Falls Bridge bricht: `vision-loop.spec.ts` auf Tastatur-Input (`ArrowRight` + `Enter`) umstellen

<!-- Ralph trägt hier neue Erkenntnisse über den Build-Prozess ein. -->
