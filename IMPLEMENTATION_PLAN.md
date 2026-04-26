# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-26
UNIFIED-5 implementiert: `armut-workflow.spec.ts` vollständig auf Bridge-Wrapper umgestellt. Inline-Fehlersammlung durch `aktiviereConsoleCapture(page, testInfo.title)` ersetzt. `page.waitForTimeout(100)` durch `warteAufNaechstesEreignis(page)` ersetzt. Vier neue Wrapper in helpers.ts ergänzt: `erstelleKonfiguriertenTisch`, `starteAktuellenTisch`, `spieleKarte`, `beantworteArmut`.
Nächster Schritt: UNIFIED-6 (`solo-spielfluss.spec.ts` — Timing-Fixes durch `isIdle()` via helpers.ts). Danach UNIFIED-7.

## Legende
- [x] Erledigt
- [~] Teilweise
- [ ] Offen
- [BLOCKED: <Grund>] Blockiert

---

## Phase 0 — Logging & Observability (LOG)
**Höchste Priorität.** Ziel: Ralph öffnet zuerst eine Log-Datei, nicht den Source-Code.
Stacktraces und Game-State-Events müssen ohne Code-Analyse lesbar sein.

### Strategie (aus Recherche bestätigt)
- **Backend**: Spring Boot 3.4+ natives strukturiertes JSON-Logging → `logs/locodoko.log`
- **E2E**: Playwright `page.on('console')` captured Logs als Test-Artefakte → `e2e/test-results/console-{test}.log`
- **Frontend HTTP-POST Logger entfernen**: `logger.ts` sendet aktuell jeden Log-Eintrag per `fetch('/api/debug/log', ...)` — das ist ein Antipattern (Latenz, Fehlerquelle, unstrukturiert). Ersetzen durch Playwright-Capture.
- **CLAUDE.md erweitern**: Ralph-Workflow dokumentieren: "Zuerst Logs lesen, dann Code."

- [x] **LOG-1 (Backend)**: Strukturiertes JSON-Logging in Spring Boot 3.4+ aktivieren.
  `application.properties`: `logging.structured.format=ecs` (Elastic Common Schema, kein Dependency nötig).
  Log-Datei: `logging.file.name=logs/locodoko.log`. Sicherstellen dass alle relevanten Logger
  (Tisch, Partie, KI, WebSocket) mit MDC-Kontext (SessionId, TischId, PartieId) loggen.
  Ziel: Ralph liest `logs/locodoko.log` und sieht sofort Stacktraces mit vollständigem Kontext.

- [x] **LOG-2 (E2E)**: Playwright-Console-Capture in allen Specs aktivieren.
  In `e2e/tests/helpers.ts` (→ CONS-1) eine `aktiviereConsoleCapture(page, testName)`-Funktion
  implementieren, die `page.on('console', ...)` und `page.on('pageerror', ...)` in eine Datei
  `e2e/test-results/console-{testName}.log` schreibt. Jeder Test ruft diese einmalig auf.
  Format pro Zeile: `[HH:MM:SS.mmm] [LEVEL] message | data`.
  Ziel: Nach einem fehlgeschlagenen E2E-Test liest Ralph zuerst diese Datei.

- [x] **LOG-3 (Frontend)**: HTTP-POST-Logging aus `frontend/src/logger.ts` entfernen.
  Die `fetch('/api/debug/log', ...)` Calls in `log()` und `logError()` streichen.
  Stattdessen: `console.log` / `console.error` bleiben (Playwright fängt sie ab via LOG-2).
  `DebugController.java` kann bestehen bleiben (harmlos) oder ebenfalls entfernt werden.
  Begründung: HTTP-POST pro Log-Eintrag erzeugt Latenz, maskiert Fehler durch `.catch(() => {})`,
  und ist im E2E-Build-Kontext (kein DEV-Flag) ohnehin stumm.

- [ ] **LOG-4 (Backend)**: MDC-Kontext für alle Game-relevanten Operationen setzen.
  In `TischController`, `SpielAktionsService`, `KiService`: `MDC.put("tischId", ...)` und
  `MDC.put("partieId", ...)` am Anfang jeder Methode, `MDC.clear()` im finally-Block.
  Mit ECS-Format (LOG-1) erscheinen diese Felder automatisch im JSON-Log.
  Ziel: `grep "tischId=abc123" logs/locodoko.log` zeigt den kompletten Spielablauf.

- [ ] **LOG-5 (CLAUDE.md)**: Ralph-Debug-Workflow dokumentieren.
  Abschnitt "Debugging-Workflow" in `CLAUDE.md` ergänzen:
  1. Backend-Fehler: zuerst `logs/locodoko.log` lesen (strukturiertes JSON, grep nach tischId/partieId)
  2. E2E-Fehler: zuerst `e2e/test-results/console-{test}.log` lesen
  3. Playwright-Trace: `e2e/test-results/` enthält `.zip`-Traces, aufrufbar mit `npx playwright show-trace`
  4. Erst wenn kein Stacktrace/Hinweis → Source-Code-Analyse

---

## Phase 1 — E2E-Stabilität & Unified Architecture (UNIFIED)
Timing-Probleme behoben. Verbleibende Tests auf Bridge + Quiescence Pattern migrieren.

- [x] **UNIFIED-1 (Frontend)**: `isIdle()`-Methode in `AppStore.ts` und `TischSzene.ts`.
- [x] **UNIFIED-2 (E2E)**: `leseSpielZustand` in `mehrere-runden.spec.ts` wartet auf `isIdle()`.
- [x] **UNIFIED-3 (Backend)**: `@Version` wird strikt inkrementiert, Event-Bündelung optimiert.
- [x] **UNIFIED-4 (E2E)**: `schnellstart.spec.ts` auf Bridge umstellen (`alsGastStarten()`, `erstelleQuickGame()`).
  Außerdem: Zeile 33 — `appStore.isIdle()` durch `window.__locodoko.isIdle()` ersetzen
  (TischSzene-Level prüft auch Animationen, Store-Level prüft nur Event-Queue — Bug).
- [x] **UNIFIED-5 (E2E)**: `armut-workflow.spec.ts` — Timing-Fixes durch `isIdle()` (via helpers.ts).
- [ ] **UNIFIED-6 (E2E)**: `solo-spielfluss.spec.ts` — Timing-Fixes durch `isIdle()` (via helpers.ts).
- [ ] **UNIFIED-7 (E2E)**: `rundenauswertung.spec.ts` — auf helpers.ts umstellen.
- [x] **UNIFIED-8 (Frontend Cleanup)**: Veraltete Zeitstempel-Logik in `SpielverwaltungDto.ts` entfernt.
- [x] **UNIFIED-9 (Backend Cleanup)**: Redundanter `TISCH_SNAPSHOT` Push entfernt.
- [ ] **UNIFIED-10 (Validation)**: Gesamte Playwright-Testsuite grün.

---

## Phase 1.5 — E2E-Konsolidierung (CONS)
Reduziert ~400 Zeilen Duplikat-Code. Voraussetzung für UNIFIED-4 bis 7.
**CONS-1 zuerst — alle anderen CONS und UNIFIED-4–7 hängen davon ab.**

- [x] **CONS-1 (E2E)**: `e2e/tests/helpers.ts` anlegen.
  Exportiert: Bridge-Typ `LocodokoBridge`, `getBridge(page)`, `warteAufPhase(page, phase, timeout?)`,
  `warteAufEigenenZug(page, timeout?)`, `warteAufEigenenVorbehalt(page, timeout?)`,
  `warteAufNaechstesEreignis(page, timeout?)`, `spieleErsteHandkarte(page)`,
  `meldeVorbehalt(page, vorbehalt)`, `aktiviereConsoleCapture(page, testName)` (aus LOG-2).
  Kein Spiellogik-Code — nur Bridge-Wrapper und Typen.

- [x] **CONS-2 (E2E)**: Alle 10 Specs auf `helpers.ts` umstellen.
  Inline-Typdefinitionen (`interface LocodokoBridge { ... }`) und doppelte Hilfsfunktionen
  aus allen Specs entfernen und durch Imports aus `helpers.ts` ersetzen.
  Erwartete Einsparung: ~400 Zeilen, alle Specs unter 100 Zeilen.

- [x] **CONS-3 (E2E)**: `vision-loop.spec.ts` aus Default-Test-Run herausnehmen.
  Neue `playwright.config.vision.ts` anlegen mit `testMatch: ['**/vision-loop.spec.ts']`.
  Aus `playwright.config.ts` ausschließen (`testIgnore: ['**/vision-loop.spec.ts']`).
  `vision-loop.spec.ts` eigene Hilfsfunktionen belassen (kein Nutzen durch helpers.ts dort).
  Ausführung weiterhin: `npx playwright test --config playwright.config.vision.ts`.

---

## Phase 2 — Spielfeatures & Regel-Erweiterungen (FEAT)

- [ ] **FEAT-1 (Backend)**: Schmeißen-Varianten "Fünf Neunen" und "Wenig Trumpf" in `VorbehaltAnsage.java`.
- [ ] **FEAT-2 (Backend)**: Bockrunden-Trigger "Einwurf-Bockrunde" (ausgelöst wenn Spiel geschmissen).
- [ ] **FEAT-3 (Backend)**: `TischkonfigurationEmbeddable` Factory-Methoden für Regel-Presets.
- [ ] **FEAT-4 (Frontend)**: Partie-Ende Modal in `TischSzene.ts` ausarbeiten und an Event-Loop anbinden.
- [ ] **FEAT-5 (Frontend)**: Fehlende `data-testid`-Attribute gemäß `specs/e2e-tests.md`.

---

## Phase 3 — Spezifikations-Updates (SPEC)

- [ ] **SPEC-1**: `specs/schweinchen.md`: Event `SchweinchenGemeldet` ist implementiert — dokumentieren.
- [ ] **SPEC-2**: `specs/spielablauf.md`: Phasen-Namen `SPIELENDE`/`PARTIEENDE` → `AUSWERTUNG`/`GESAMTSTAND_AKTUALISIEREN`.
- [ ] **SPEC-3**: `specs/frontend-ui-logik.md`: Unsichtbare DOM-Marker (`vorbehaltMarker`, `actionBarMarker`) als legitime E2E-Hooks dokumentieren.
- [ ] **SPEC-4**: `specs/ki-strategie.md`: KI-Hänger-Warnung entfernen (gefixt).
- [ ] **SPEC-5**: `specs/e2e-tests.md`: Quiescence Pattern als Architektur-Entscheidung dokumentieren.
  Erklären: warum `window.__locodoko.isIdle()` (TischSzene-Ebene, prüft Store + Animationen)
  statt `appStore.isIdle()` (prüft nur Event-Queue). Vier Bedingungen für `isIdle() === true`:
  Event-Queue leer + kein Event in Verarbeitung + keine Animation + kein Austeilen.
  Warnung: `appStore.isIdle()` direkt aufrufen ist ein Bug (zu früh true bei laufenden Animationen).

---

## Kürzlich erledigte Aufgaben (Referenz)
Aus `IMPLEMENTATION_PLAN_ARCHIVE.md` (Stand 2026-04-21):
- [x] **STAB-1–3**: Test-Suite Stabilisierung (HochzeitTest, DreissigAugenPflichtTest, AnsagenTest, BockrundenTest).
- [x] **ARCH-1–5**: Architektur-Cleanup, Entity-Bereinigung, DDD Modulgrenzen.
- [x] **REGELN-1–3**: Schweinchen-Logik, KI-Hänger, KI-Strategie Tuning.
- [x] **POLISH-1–3**: DKV-Turnier Bugfix, Karlchen-Sonderpunkte, serielle Animations-Queue.
