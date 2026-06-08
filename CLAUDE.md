# Locodoko — Operativer Kontext

## Build & Run

Backend: `mvn test` | `mvn clean verify` | `mvn spring-boot:run`
Frontend: `cd frontend && npm test` | `npm run build` | `npm run lint`
E2E (Backend muss laufen): `cd e2e && npx playwright test`
Vollständiges Paket: `mvn clean package` (baut Frontend ein, erzeugt JAR)

## Validation nach Implementierung

> **Backend immer mit `mvn clean test` validieren, nicht nur `mvn test`.** Inkrementelle Builds verwenden teils veraltete `.class`-Dateien aus `target/` und maskieren so Compile-Brüche in unverändert wirkenden Dateien (so blieb ein gebrochener Clean-Build über mehrere Sessions unbemerkt).

1. Backend-Änderungen: `mvn clean test`
2. Frontend-Änderungen: `cd frontend && npm test && npm run build && npm run lint`
3. Beide betroffen: beide Schritte ausführen
4. Logs auf Warnungen und Fehler prüfen

## Visuelles Feedback (UI-Änderungen)

Nach Frontend-UI-Änderungen Vision Loop ausführen (Backend muss laufen):

```sh
cd e2e && npx playwright test vision-loop.spec.ts --headed
```

Screenshots landen in `e2e/screenshots/`. Mit dem Read-Tool einlesen und visuell prüfen — kein manueller Screenshot nötig. Nur bei UI-relevanten Änderungen, nicht bei reinen Backend- oder Logik-Fixes.

## Debugging-Workflow

1. **Backend-Fehler**: zuerst `logs/locodoko.log` lesen (strukturiertes JSON)
   - `grep "tischId=<id>" logs/locodoko.log` — kompletter Spielablauf für einen Tisch
   - `grep "partieId=<id>" logs/locodoko.log` — Ereignisse einer bestimmten Partie
   - Stacktraces und MDC-Felder (tischId, partieId) erscheinen automatisch im JSON-Log
2. **E2E-Fehler**: zuerst `e2e/test-results/console-<testname>.log` lesen (Playwright Console Capture)
3. **Playwright-Trace**: `e2e/test-results/` enthält `.zip`-Traces → `npx playwright show-trace <datei.zip>`
4. Erst wenn kein Stacktrace/Hinweis → Source-Code-Analyse

## Domänensprache

Code, Kommentare, Klassen, Methoden auf **Deutsch**. Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit.

## Architektur (Details → specs/architektur.md)

Module: `partie/` (Domain-Kern), `karten/` (Shared Kernel), `spieler/` (Identität/Auth), `ki/` (Autonomer Agent), `tisch/` (Application Layer + Delivery). Spring Data JDBC (kein JPA) + Liquibase. Frontend: Phaser 3, TypeScript strict, AppStore + Snapshot+Hint Modell. Backend = einzige Wahrheitsquelle.

## Projektstatus & Fertigstellung

Spielkern **feature-complete** (alle fachlichen Specs *Implementiert/Stabil/Abgeschlossen*). Offen: Fertigstellung für den **öffentlichen Betrieb**.

- **Roadmap (fachlich):** `specs/fertigstellung.md` — Backlog, Live-Gang-Blocker, offene Entscheidungen.
- **Task-Liste (operativ):** `IMPLEMENTATION_PLAN.md`, Sektion „Fertigstellung — Öffentlicher Betrieb".

Erster, blockierender Task: **BUG-PROD-CHANGELOG** (behoben, prod-Boot gegen echtes PG via DEPLOY-COMPOSE-SMOKE noch offen). Hosting-Anforderung: EU/DE.
