# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-23
Frontend-Architektur auf "Locodoko Unified Architecture" umgebaut. Die E2E-Tests sind aufgrund asynchroner Events aktuell blockiert. Plan integriert die Stabilisierungsmaßnahmen und neue Erkenntnisse aus der Code-Analyse.

## Legende
- [x] Erledigt
- [~] Teilweise
- [ ] Offen
- [BLOCKED: <Grund>] Blockiert

---

## Phase 1 — E2E-Stabilität & Unified Architecture (UNIFIED)
Höchste Priorität. Repariert die asynchronen Timing-Probleme in Playwright nach dem Architektur-Umbau.

- [x] **UNIFIED-1 (Frontend)**: Implementiere eine `isIdle()`-Methode im `AppStore.ts` und `TischSzene.ts`.
- [ ] **UNIFIED-2 (E2E)**: Aktualisiere die Hilfsfunktion `leseSpielZustand` in `e2e/tests/mehrere-runden.spec.ts`. Der E2E-Test darf den Zustand erst zurückgeben, wenn `window.__locodoko.appStore.isIdle() === true` ist.
- [ ] **UNIFIED-3 (Backend)**: Optimiere das Event-Bündeln in `SpielAktionsService.java`. Fasse `KI_ZUG_SEQUENZ` und `TISCH_SNAPSHOT` zusammen oder stelle sicher, dass die `@Version` strikt erhöht wird.
- [ ] **UNIFIED-4 (E2E)**: Repariere `e2e/tests/schnellstart.spec.ts`. Auf die JS-Bridge (`appStore.alsGastStarten()` und `appStore.erstelleQuickGame()`) umstellen.
- [ ] **UNIFIED-5 (E2E)**: Repariere `e2e/tests/armut-workflow.spec.ts`. Timing-Fixes durch `isIdle()`.
- [ ] **UNIFIED-6 (E2E)**: Repariere `e2e/tests/solo-spielfluss.spec.ts`. Timing-Fixes durch `isIdle()`.
- [ ] **UNIFIED-7 (E2E)**: Repariere `e2e/tests/rundenauswertung.spec.ts`.
- [ ] **UNIFIED-8 (Frontend Cleanup)**: Bereinige `frontend/src/modelle/SpielverwaltungDto.ts`. Veraltete Zeitstempel-Logik entfernen.
- [ ] **UNIFIED-9 (Backend Cleanup)**: Entferne den redundanten `TISCH_SNAPSHOT` Push via WebSocket im `TischController` nach einem `PARTIE_SNAPSHOT`.
- [ ] **UNIFIED-10 (Validation)**: Führe die gesamte Playwright-Testsuite aus.

## Phase 2 — Spielfeatures & Regel-Erweiterungen (FEAT)
- [ ] **FEAT-1 (Backend)**: Schmeißen erweitern. Varianten "Fünf Neunen" und "Wenig Trumpf" in `VorbehaltAnsage.java` (bisher nur Fünf Könige) inkl. Erkennungslogik implementieren.
- [ ] **FEAT-2 (Backend)**: Bockrunden-Trigger ergänzen. Den optionalen Trigger "Einwurf-Bockrunde" umsetzen (ausgelöst, wenn ein Spiel geschmissen wird).
- [ ] **FEAT-3 (Backend)**: `TischkonfigurationEmbeddable`. Factory-Methoden für die Regel-Presets (Loco Blatt, DKV-Turnier, Ohne Neunen, Benutzerdefiniert) als Brücke zu `Spielregeln.java` ergänzen.
- [ ] **FEAT-4 (Frontend)**: Partie-Ende Modal. Das `partieEndeModal` (DOM) in `TischSzene.ts` vollständig ausarbeiten und an den Event-Loop anbinden (analog zur Runden-Auswertung).
- [ ] **FEAT-5 (Frontend)**: UI Test-Attribute. Fehlende `data-testid`-Attribute in neuen UI-Komponenten (gemäß `e2e-tests.md`) ergänzen.

## Phase 3 — Spezifikations-Updates (SPEC)
Inkonsistenzen zwischen Code (Wahrheit) und Specs auflösen.
- [ ] **SPEC-1**: `specs/schweinchen.md` aktualisieren: Das Event `SchweinchenGemeldet` ist bereits implementiert.
- [ ] **SPEC-2**: `specs/spielablauf.md` aktualisieren: Die Phasen-Namen `SPIELENDE`/`PARTIEENDE` im Dokument auf `AUSWERTUNG` und `GESAMTSTAND_AKTUALISIEREN` korrigieren (Code = Wahrheit).
- [ ] **SPEC-3**: `specs/frontend-ui-logik.md` aktualisieren: Dokumentieren, dass unsichtbare HTML-Divs (`vorbehaltMarker`, `actionBarMarker`) in `TischUIManager.ts` legitime E2E-Hooks sind (pragmatischer Kompromiss).
- [ ] **SPEC-4**: `specs/ki-strategie.md` aktualisieren: KI-Hänger nach Sonderpunkten ist gefixt. Entsprechende Warnungen entfernen.

---

## Kürzlich erledigte Aufgaben (Referenz)
Zuvor im `IMPLEMENTATION_PLAN_ARCHIVE.md` (Stand 2026-04-21) dokumentiert:
- [x] **STAB-1 bis STAB-3**: Test-Suite Stabilisierung (HochzeitTest, DreissigAugenPflichtTest, AnsagenTest, BockrundenTest).
- [x] **ARCH-1 bis ARCH-5**: Architektur-Cleanup, Entity-Bereinigung und DDD Modulgrenzen gesichert.
- [x] **REGELN-1 bis REGELN-3**: Schweinchen-Logik repariert, KI-Hänger behoben, KI-Strategie Tuning für Loco-Blatt vollendet.
- [x] **POLISH-1 bis POLISH-3**: DKV-Turnier Bugfix, Karlchen-Sonderpunkte repariert, serielle Animations-Queue robust.