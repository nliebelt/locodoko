# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-27 (Aktualisiert nach 5-Agenten-Analyse aller Bounded Contexts — zweiter Durchlauf)

**Frontend-Overlays (FEAT-6/7/8):** `renderVorbehaltDialog`, `renderArmutBereich`, `renderAnsageButtons` sind als Phaser-Objekte implementiert. Fehlend sind nur die individuellen DOM-Marker mit `data-testid` für E2E-Testbarkeit. Deshalb [~] statt [ ].

**ARCH-REF:** SpielRegistry.java existiert noch und wird aktiv genutzt. `@TransactionalEventListener(AFTER_COMMIT)` fehlt in KiEventAdapter und TischEchtzeitService. SpielAktionsService (M im git status) ist noch nicht auf DB-only-Pattern umgestellt.

**Neu gefundene Bugs:** BUGFIX-3 (Schweinchen ohne Spielwirkung), BUGFIX-4 (DKV-Preset: Spiel schließt nicht ab).

**Spec-DoD veraltet:** tischkonfiguration.md (SPEC-6) + authentifizierung.md (neu SPEC-8) haben `[ ]`-Checkboxen für längst implementierte Features.

Nächster Schritt: ARCH-REF danach BUGFIX-1 ("Gegen die Alten" Bug, hohe Priorität), dann BUGFIX-2, dann FEAT-5/6/7/8 restliche data-testids.

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

- [x] **LOG-4 (Backend)**: MDC-Kontext für alle Game-relevanten Operationen setzen.
  In `TischController`, `SpielAktionsService`, `KiService`: `MDC.put("tischId", ...)` und
  `MDC.put("partieId", ...)` am Anfang jeder Methode, `MDC.clear()` im finally-Block.
  Mit ECS-Format (LOG-1) erscheinen diese Felder automatisch im JSON-Log.
  Ziel: `grep "tischId=abc123" logs/locodoko.log` zeigt den kompletten Spielablauf.

- [x] **LOG-5 (CLAUDE.md)**: Ralph-Debug-Workflow dokumentieren.
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
- [x] **UNIFIED-6 (E2E)**: `solo-spielfluss.spec.ts` — Timing-Fixes durch `isIdle()` (via helpers.ts).
- [x] **UNIFIED-7 (E2E)**: `rundenauswertung.spec.ts` — auf helpers.ts umstellen.
- [x] **UNIFIED-8 (Frontend Cleanup)**: Veraltete Zeitstempel-Logik in `SpielverwaltungDto.ts` entfernt.
- [x] **UNIFIED-9 (Backend Cleanup)**: Redundanter `TISCH_SNAPSHOT` Push entfernt.
- [x] **UNIFIED-10 (Validation)**: Gesamte Playwright-Testsuite grün.

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
  Abgeschlossen in UNIFIED-10: einladungslink, mehrere-runden-ohne-neunen, partie-gegen-ki, ungueltige-karte migriert.

- [x] **CONS-3 (E2E)**: `vision-loop.spec.ts` aus Default-Test-Run herausnehmen.
  Neue `playwright.config.vision.ts` anlegen mit `testMatch: ['**/vision-loop.spec.ts']`.
  Aus `playwright.config.ts` ausschließen (`testIgnore: ['**/vision-loop.spec.ts']`).
  `vision-loop.spec.ts` eigene Hilfsfunktionen belassen (kein Nutzen durch helpers.ts dort).
  Ausführung weiterhin: `npx playwright test --config playwright.config.vision.ts`.

---
## Phase 1.8 — Architektur-Bereinigung (ARCH-REF)
Status: KRITISCH / BLOCKIEREND. Rückbau der In-Memory-Logik gemäß den neuen Architektur-Specs.
Spec: `specs/architektur-ddd.md` § „Concurrency (Optimistic Locking)".

- [ ] **ARCH-REF-1 (Backend)**: Löschung der `SpielRegistry.java`.
  Vollständige Entfernung von `src/main/java/de/locodoko/tisch/SpielRegistry.java`.
  Ersatzlose Streichung der Caches (`spielCache`, `locks`, `kommandoCache`).
  Alle Imports in `SpielAktionsService` und `KiEventAdapter` entfernen.
  Voraussetzung für ARCH-REF-3. Validation: `mvn test`.

- [ ] **ARCH-REF-2 (Domain)**: `@Version` in `Partie.java`.
  Einführung von `private Long version` mit `@Version`-Annotation im Aggregate Root `Partie`.
  Entfernung aller manuellen `isNew`-Flags oder Persistable-Hacks.
  Spring Data JDBC wirft `OptimisticLockingFailureException` bei Konflikt → HTTP 409.
  Validation: `mvn test`.

- [ ] **ARCH-REF-3 (Service)**: Refactoring `SpielAktionsService.java`.
  Umstellung der Methoden `spieleKarte`, `meldeVorbehalt`, `sageAn`, `verarbeiteArmutAntwort`
  auf linearen DB-Ablauf: 1. `partieRepository.findById(...)` → 2. Aktion auf Domain-Objekt → 3. `partieRepository.save(...)`.
  Entfernung aller Lock- und Registry-Aufrufe. Hängt von ARCH-REF-1 ab.
  Validation: `mvn test` + volle E2E-Suite.

- [ ] **ARCH-REF-4 (Events)**: AFTER_COMMIT-Garantie.
  `KiEventAdapter` und `TischEchtzeitService`: Events dürfen erst nach DB-Commit gefeuert werden.
  `@ApplicationModuleListener` allein reicht nicht — muss auf `@TransactionalEventListener(phase = AFTER_COMMIT)`
  umgestellt werden, damit keine Race Conditions zwischen Event-Delivery und Persistenz entstehen.
  Validation: `mvn test`.




## Phase 2 — Spielfeatures, Bugfixes & Frontend-UI (FEAT/BUGFIX)

- [x] **FEAT-1 (Backend)**: Schmeißen-Varianten "Fünf Neunen" und "Wenig Trumpf" in `VorbehaltAnsage.java`.
- [x] **FEAT-2 (Backend)**: Bockrunden-Trigger "Einwurf-Bockrunde" (ausgelöst wenn Spiel geschmissen).
- [x] **FEAT-3 (Backend)**: `TischkonfigurationEmbeddable` Factory-Methoden für Regel-Presets.
- [x] **FEAT-4 (Frontend)**: Partie-Ende Modal in `TischSzene.ts` ausarbeiten und an Event-Loop anbinden.

- [ ] **BUGFIX-1 (Backend)**: „Gegen die Alten" Sonderpunkt-Berechnung korrigieren.
  In `PunkteRechner.bewerteGegenDieAlten()`: die Prüfung auf `ansagen.hatGrundansage(Partei.RE, parteien)`
  entfernen. Laut `specs/punkteberechnung.md` Req. 12 gilt dieser Sonderpunkt immer, wenn die
  Kontra-Partei gewinnt — unabhängig davon ob Re angesagt wurde. Der Code hat aktuell die falsche
  Zusatzbedingung (Zeile ~132). Validation: `mvn test`.

- [ ] **BUGFIX-3 (Backend)**: Schweinchen hat keine Spielwirkung im Spielbetrieb.
  Laut `specs/schweinchen.md` (Zeile ~39): „Schweinchen zeigt im Spielbetrieb keine Wirkung —
  Ursache ungeklärt." Die Domain-Klasse `SchweinchenTrumpfOrdnung` und das Event `SchweinchenGemeldet`
  existieren, aber der Spieleffekt (Kreuz-Ass schlägt Dulle) ist nicht korrekt aktiv.
  Schritt 1: Diagnosieren in welcher Klasse (`SchweinchenTrumpfOrdnung`, `SpielFactory`, `Partie`)
  die `schweinchenAktiv`-Konfiguration nicht korrekt weitergereicht wird.
  Schritt 2: Fix und Validation: `mvn test`.

- [ ] **BUGFIX-4 (Backend)**: Spiel schließt nicht ab bei DKV-Preset.
  Laut `specs/regelkatalog.md` (Zeile ~77): Beim DKV-Regelset (`dkvRegeln()`) wird das Spiel
  nicht korrekt beendet. Diagnosieren ob der Bug in der Factory-Methode (`TischkonfigurationEmbeddable.dkvRegeln()`),
  im Spielablauf-Handler oder in einer Regel-Kombination liegt.
  Validation: Integrations-Test der DKV-Preset-Konfiguration. `mvn test`.

- [ ] **BUGFIX-2 (Backend)**: `Thread.sleep(600ms)` aus `KiOrchestrierungService.java` entfernen.
  `specs/ki-strategie.md` schreibt vor: "Kein Thread.sleep, keine künstliche Pause — Backend antwortet
  immer sofort." Der Sleep (Zeile ~160, nur bei Mensch-Tischen) wurde als Animations-Workaround
  eingebaut, ist aber seit Einführung der seriellen AnimationenService-Queue (POLISH-3) nicht mehr
  nötig — das Frontend puffert selbst. Nach Entfernung: `mvn test` + volle E2E-Suite ausführen,
  um Timing-Regressionen auszuschließen.

- [ ] **FEAT-5 (Frontend)**: Fehlende `data-testid`-Attribute gemäß `specs/e2e-tests.md`.
  Startscreen: `btn-offene-tische`, `btn-session-recovery`, `input-tischname`, `btn-tisch-erstellen`,
  `tisch-config-modal`, `einstellungen-modal`.
  Spielfläche: `btn-spiel-starten`, `btn-rundenauswertung-weiter`.
  Vorbehalt (ergänzt FEAT-6): `btn-vorbehalt-{typ}` DOM-Marker für jeden Button in `renderVorbehaltDialog`.
  Armut (ergänzt FEAT-7): `armut-overlay`, `btn-armut-bestaetigen`, `btn-armut-ablehnen` DOM-Marker.
  Ansage (ergänzt FEAT-8): `btn-ansage-RE`, `btn-ansage-KONTRA`, `btn-ansage-KEINE_90`,
  `btn-ansage-KEINE_60`, `btn-ansage-KEINE_30`, `btn-ansage-SCHWARZ` DOM-Marker.
  Ansatz: unsichtbare DOM-Marker analog zu `vorbehalt-overlay`-Marker in `TischUIManager.ts:73`.
  Bei Phaser-Buttons: Marker per JS neben den Canvas-Elementen erzeugen und synchron halten.
  Validation: `cd frontend && npm test && npm run build`.

- [~] **FEAT-6 (Frontend)**: Vorbehalt-Auswahl-Overlay auf der Spielfläche implementieren.
  **Stand**: `renderVorbehaltDialog` in `TischSzene.ts:1095` ist implementiert. Zeigt dynamische
  Buttons für `moeglicheVorbehalte`, Tastaturnavigation via `tastaturVorbehaltIndex` verdrahtet.
  DOM-Marker `vorbehalt-overlay` in `TischUIManager.ts:73` gesetzt.
  **Fehlt**: Individuelle `btn-vorbehalt-{typ}`-Marker (z.B. `btn-vorbehalt-HOCHZEIT`) — siehe FEAT-5.
  Validation: `cd frontend && npm test && npm run build`.

- [~] **FEAT-7 (Frontend)**: Armut-Dialog mit Kartenauswahl auf der Spielfläche.
  **Stand**: `renderArmutBereich` in `TischSzene.ts:1145` ist implementiert. Unterstützt
  ANBIETEN-Modus (Trumpfauswahl + Bestätigen-Button) und ANNEHMEN-Modus (Annehmen/Ablehnen +
  Kartenrückgabe). Tastaturkürzel in `TischInputHandler.ts` verdrahtet.
  **Fehlt**: DOM-Marker `armut-overlay`, `btn-armut-bestaetigen`, `btn-armut-ablehnen` — siehe FEAT-5.
  Validation: `cd frontend && npm test && npm run build`.

- [~] **FEAT-8 (Frontend)**: Floating Action Bar für Re/Kontra-Ansagen.
  **Stand**: `renderAnsageButtons` in `TischSzene.ts:1128` ist implementiert. Erscheint dynamisch
  wenn `moeglicheAnsagen` nicht leer. Buttons für Re/Kontra/Verschärfungen. Positioniert rechts
  neben dem Kartenfächer. DOM-Marker `floating-action-bar` in `TischUIManager.ts:76` gesetzt.
  **Fehlt**: Individuelle `btn-ansage-{typ}`-Marker (RE, KONTRA, KEINE_90, etc.) — siehe FEAT-5.
  Validation: `cd frontend && npm test && npm run build`.

- [ ] **FEAT-9 (Frontend)**: Tisch-Konfigurations-Modal im Startscreen implementieren.
  Spec: `specs/frontend-startscreen.md` § „Tisch-Konfigurations-Modal". In
  `frontend/src/SpielverwaltungsSzene.ts` ersetze das `// TODO: Phaser Modal` (Zeile ~106) durch
  ein HTML-Overlay (analog zu anderen Modals). Das Modal zeigt alle `TischkonfigurationEmbeddable`-
  Optionen als Toggles/Dropdowns: Bockrunden, Schweinchen, 30-Augen-Pflicht, Solo-erlaubt,
  Neunen-entfernt, Regel-Preset-Auswahl. Absenden via `POST /api/tische` mit `TischKonfigurationDto`.
  Pflicht-`data-testid`: `tisch-konfig-modal`, `btn-tisch-erstellen`.
  Validation: `cd frontend && npm test && npm run build`.

- [ ] **FEAT-10 (Frontend)**: Offene-Tische-Liste mit 5-Sekunden-Polling im Startscreen.
  Spec: `specs/frontend-startscreen.md` § „Offene-Tische-Liste". In `SpielverwaltungsSzene.ts`
  ab Zeile ~100: `setInterval`-basiertes Polling via `GET /api/tische` alle 5 Sekunden. Zeigt für
  jeden offenen Tisch: Name, aktuelle Spielerzahl / Maximum, Beitritt-Button. Polling im
  `shutdown()`/`destroy()`-Lifecycle stoppen (`clearInterval`). Beitritt sendet
  `POST /api/tische/{id}/beitreten`.
  Pflicht-`data-testid`: `offene-tische-liste`, `btn-tisch-beitreten-{tischId}`.
  Validation: `cd frontend && npm test && npm run build`.

- [ ] **FEAT-11 (Backend + Frontend)**: PartieEreignisBatch — Sequenznummerierung und Self-Healing.
  Spec: `specs/architektur-domain-events.md` § „Batch-Protokoll". Niedriger Priorität, erst nach
  FEAT-6–10 angehen. Backend: jedes WS-Event erhält eine monoton steigende Sequenznummer
  (basierend auf `@Version`). Frontend: `AppStore.ts` erkennt Lücken in der Sequenz und fordert
  automatisch einen HTTP-Snapshot via `POST /api/tische/{id}/snapshot` an (Self-Healing).
  Validation: `mvn test` + `cd frontend && npm test`.

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
- [ ] **SPEC-6**: `specs/tischkonfiguration.md` Definition of Done aktualisieren.
  Die DoD-Checkboxen für Bockrunden-Option, Schweinchen-Option und 30-Augen-Pflicht-Option sind
  noch mit `[ ]` markiert, obwohl der Code diese Felder bereits in `TischkonfigurationEmbeddable`
  und `TischKonfigurationDto` hat. Alle drei auf `[x]` setzen. Kein Code-Änderung nötig.
- [ ] **SPEC-7**: `specs/ki-strategie.md` Thread.sleep-Regel nach BUGFIX-2 aktualisieren.
  Nach Umsetzung von BUGFIX-2 (Sleep-Entfernung): die Formulierung „Kein Thread.sleep, keine
  künstliche Pause — Backend antwortet immer sofort" als eingehaltene Invariante bestätigen
  und den Kontext ergänzen: Frontend-seitige Verzögerungen (AnimationenService-Queue) sind
  legitim und erwünscht, Backend-seitige Sleeps sind verboten.

- [ ] **SPEC-8**: `specs/authentifizierung.md` DoD-Checkboxen aktualisieren.
  OAuth2-Google (`OAuth2ErfolgsHandler`) und `UserDetailsService` (`LocodokoBenutzerdienst`) sind
  vollständig implementiert (`SecurityConfig`, `AuthentifizierungsController` existieren).
  Die DoD-Checkbox `[ ] OAuth2 / UserDetailsService` auf `[x]` setzen. Kein Code-Änderung nötig.

---

## Phase 4 — Test-Coverage (TEST)

- [ ] **TEST-1 (Backend)**: Unit-Test für Dulle-Verhalten im Herzsolo.
  In `SoloTrumpfOrdnungenTest.java`: Test hinzufügen, der verifiziert dass Herz-Zehn bei
  `VariableTrumpfsoloTrumpfOrdnung` (Spieltyp `SOLO_TRUMPF_HERZ`) `istDulle() == false` zurückgibt.
  Die Implementierung in `VariableTrumpfsoloTrumpfOrdnung` ist bereits korrekt — der Test fehlt nur.
  Spec: `specs/solo-trumpf.md` / `specs/trumpfhierarchie.md` (Herz-Zehn ist im Herzsolo keine Dulle).
  Validation: `mvn test`.

---

## Kürzlich erledigte Aufgaben (Referenz)
Aus `IMPLEMENTATION_PLAN_ARCHIVE.md` (Stand 2026-04-21):
- [x] **STAB-1–3**: Test-Suite Stabilisierung (HochzeitTest, DreissigAugenPflichtTest, AnsagenTest, BockrundenTest).
- [x] **ARCH-1–5**: Architektur-Cleanup, Entity-Bereinigung, DDD Modulgrenzen.
- [x] **REGELN-1–3**: Schweinchen-Logik, KI-Hänger, KI-Strategie Tuning.
- [x] **POLISH-1–3**: DKV-Turnier Bugfix, Karlchen-Sonderpunkte, serielle Animations-Queue.
