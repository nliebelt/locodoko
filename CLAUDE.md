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

## Architektur (Details → specs/)

Pragmatisches DDD: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase. Bounded Contexts: `lobby`, `partie`, `karten`, `session`. Frontend: Phaser 3, TypeScript strict, AppStore als zentraler Zustandsspeicher. Backend = einzige Wahrheitsquelle.
