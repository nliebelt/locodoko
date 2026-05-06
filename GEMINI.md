# Locodoko — Operativer Kontext

## Build & Run

Backend: `mvn test` | `mvn clean verify` | `mvn spring-boot:run`
Frontend: `cd frontend && npm test` | `npm run build` | `npm run lint`
E2E (Backend muss laufen): `cd e2e && npx playwright test`
Vollständiges Paket: `mvn clean package` (baut Frontend ein, erzeugt JAR)

## Validation nach Implementierung

1. `mvn test` — Backend-Tests
2. `cd frontend && npm test && npm run build && npm run lint` — Frontend komplett
3. `cd e2e && npm run test` - e2e Test müssen laufen
4. Logs auf Warnungen und Fehler prüfen

## Domänensprache

Code, Kommentare, Klassen, Methoden auf **Deutsch**. Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit.

## Architektur (Details → specs/architektur.md)

Module: `partie/` (Domain-Kern), `karten/` (Shared Kernel), `spieler/` (Identität/Auth), `ki/` (Autonomer Agent), `tisch/` (Application Layer + Delivery). Spring Data JDBC (kein JPA) + Liquibase. Frontend: Phaser 3, TypeScript strict, AppStore + Snapshot+Hint Modell. Backend = einzige Wahrheitsquelle.
