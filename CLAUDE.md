# Locodoko — Operativer Kontext

## Build & Run

Backend: `mvn test` | `mvn clean verify` | `mvn spring-boot:run`
Frontend: `cd frontend && npm test` | `npm run build` | `npm run lint`
E2E (Backend muss laufen): `cd e2e && npx playwright test`
Vollständiges Paket: `mvn clean package` (baut Frontend ein, erzeugt JAR)

## Validation nach Implementierung

1. Backend-Änderungen: `mvn test`
2. Frontend-Änderungen: `cd frontend && npm test && npm run build && npm run lint`
3. Beide betroffen: beide Schritte ausführen
4. Logs auf Warnungen und Fehler prüfen

## Visuelles Feedback (UI-Änderungen)

Nach Frontend-UI-Änderungen Vision Loop ausführen (Backend muss laufen):

```sh
cd e2e && npx playwright test vision-loop.spec.ts --headed
```

Screenshots landen in `e2e/screenshots/`. Mit dem Read-Tool einlesen und visuell prüfen — kein manueller Screenshot nötig. Nur bei UI-relevanten Änderungen, nicht bei reinen Backend- oder Logik-Fixes.

## Domänensprache

Code, Kommentare, Klassen, Methoden auf **Deutsch**. Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit.

## Architektur (Details → specs/)

Pragmatisches DDD: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase. Bounded Contexts: `lobby`, `partie`, `karten`, `session`. Frontend: Phaser 3, TypeScript strict, AppStore als zentraler Zustandsspeicher. Backend = einzige Wahrheitsquelle.
