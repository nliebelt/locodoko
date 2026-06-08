# Locodoko — Operativer Kontext

## Build & Run

Backend: `mvn test` | `mvn clean verify` | `mvn spring-boot:run`
Frontend: `cd frontend && npm test` | `npm run build` | `npm run lint`
E2E (Backend muss laufen): `cd e2e && npx playwright test`
Vollständiges Paket: `mvn clean package` (baut Frontend ein, erzeugt JAR)

## Validation nach Implementierung

> **Backend immer mit `mvn clean test` validieren, nicht nur `mvn test`.** Inkrementelle Builds verwenden teils veraltete `.class`-Dateien aus `target/` und maskieren so Compile-Brüche in unverändert wirkenden Dateien.

1. `mvn clean test` — Backend-Tests
2. `cd frontend && npm test && npm run build && npm run lint` — Frontend komplett
3. `cd e2e && npm run test` - e2e Test müssen laufen
4. Logs auf Warnungen und Fehler prüfen

## Domänensprache

Code, Kommentare, Klassen, Methoden auf **Deutsch**. Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit.

## Architektur (Details → specs/architektur.md)

Module: `partie/` (Domain-Kern), `karten/` (Shared Kernel), `spieler/` (Identität/Auth), `ki/` (Autonomer Agent), `tisch/` (Application Layer + Delivery). Spring Data JDBC (kein JPA) + Liquibase. Frontend: Phaser 3, TypeScript strict, AppStore + Snapshot+Hint Modell. Backend = einzige Wahrheitsquelle.

## Projektstatus & Fertigstellung

Der Spielkern ist **feature-complete** (alle fachlichen Specs *Implementiert/Stabil/Abgeschlossen*). Offen ist die Fertigstellung für den **öffentlichen Betrieb** (Deployment, Ops, Recht, Reife, offene Entscheidungen):

- **Roadmap (fachlich):** `specs/fertigstellung.md` — Backlog, Live-Gang-Blocker, offene Entscheidungen.
- **Task-Liste (operativ):** `IMPLEMENTATION_PLAN.md`, Sektion „Fertigstellung — Öffentlicher Betrieb" — kleingranular mit „Erste Datei zuerst"-Hinweisen.

Erster, blockierender Task: **BUG-PROD-CHANGELOG** (behoben, prod-Boot gegen echtes PG via DEPLOY-COMPOSE-SMOKE noch offen). Hosting-Anforderung: EU/DE.
