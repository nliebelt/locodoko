# Locodoko — Metrik-Report

> Stand: 2026-06-11 (Session 103) — reproduzierbar via `mvn clean verify` (JaCoCo) + `cd frontend && npx vitest run --coverage` (Vitest/V8)

## Codebase-Größe

### Backend (Java)

| Modul | Dateien | LOC |
|-------|---------|-----|
| `karten` | 19 | 1201 |
| `partie` | 48 | 3775 |
| `spieler` | 39 | 2320 |
| `ki` | 12 | 921 |
| `tisch` | 71 | 6896 |
| `system` | 8 | 291 |
| **Gesamt** | **198** | **15436** |

Test-Klassen: 62 · Tests: 371

### Frontend (TypeScript)

| Produktiv-Dateien | ~55 |
| LOC | ~9900 |
| Test-Dateien | 28 · Tests: 299 |

## Test-Coverage

### Backend (JaCoCo)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Instructions | 22203 | 26801 | **82.8%** |
| Lines | 4192 | 5100 | **82.2%** |
| Branches | 1373 | 1994 | **68.9%** |

> Leichter Rückgang gegenüber Session 47 (84%/83%/71%) — mehr Code durch Features (DSGVO, BugReport, Statistik, SEC-Hardening) ohne proportionales Test-Wachstum. Ziel Phase 2: Branches →75%+.

**Coverage nach Modul:**

| Modul | Lines | Coverage |
|-------|-------|----------|
| `de.locodoko.betrieb` | 39 | 97% █████████░ |
| `de.locodoko.karten` | 264 | 93% █████████░ |
| `de.locodoko.ki` | 300 | 92% █████████░ |
| `de.locodoko.partie` | 1444 | 88% ████████░░ |
| `de.locodoko.tisch` | 1853 | 84% ████████░░ |
| `(root)` | 10 | 80% ████████░░ |
| `de.locodoko.spieler` | 854 | 69% ██████░░░░ |
| `de.locodoko.tisch.persistenz` | 206 | 67% ██████░░░░ |
| `de.locodoko.system` | 81 | 63% ██████░░░░ |
| `de.locodoko.ki.orchestrierung` | 39 | 62% ██████░░░░ |
| `de.locodoko.partie.ereignisse` | 10 | 50% █████░░░░░ |

**Coverage-Schwachstellen (< 70% Line-Coverage, > 20 Zeilen):**

| Klasse | Modul | Lines | Line-Cov | Branch-Cov | Testbar? |
|--------|-------|-------|----------|------------|----------|
| `VerbindungsSessionEreignisListener` | `tisch` | 29 | 9% | 0% | WS-Session, Integration |
| `OAuth2ErfolgsHandler` | `spieler` | 23 | 12% | 0% | Google-OAuth-Flow, schwer |
| `BugReportController` | `spieler` | 90 | 28% | 17% | env-gated (GH-Token) |
| `MailService` | `spieler` | 40 | 28% | 40% | env-gated (SMTP) |
| `RateLimitingFilter` | `spieler` | 42 | 36% | 15% | Request-Simulation, mittel |
| `Stichverlauf` | `partie` | 21 | 50% | 0% | ✅ Domain, hoher ROI |
| `KiOrchestrierungService` | `ki.orchestrierung` | 38 | 55% | 32% | ✅ Unit-testbar |
| `ArmutStatus` | `partie` | 38 | 66% | — | ✅ Domain, hoher ROI |
| `KiTischOrchestrator` | `tisch` | 145 | 64% | 51% | ✅ Unit-testbar |
| `TischSicherheit` | `tisch` | 36 | 70% | 38% | ✅ Guard-Logik |
| `SpielverwaltungWebSocketController` | `tisch` | 73 | 74% | 25% | SpringBootTest nötig |

### Frontend (Vitest/V8)

| Metrik | Quote |
|--------|-------|
| Statements | **78.46%** |
| Branches | **80.40%** |
| Functions | **76.67%** |
| Lines | **78.46%** |

> Leicht unter Session-47-Wert (79%) — mehr Produktivcode durch Redesigns, Bridge-Erweiterungen. `AppStore.ts` ist korrekt im Report enthalten (wurde fälschlich als excluded vermutet — war nie in der Exclude-Liste).

**Frontend-Schwachstellen (< 70% Statements, signifikante Dateien):**

| Datei | Stmts | Branches | Hinweis |
|-------|-------|----------|---------|
| `szenen/BugreportDialog.ts` | 1.85% | 100% | env-gated, kein sinnvoller Unit-Test |
| `szenen/TischAbonnements.ts` | 37.87% | 42.85% | ✅ WebSocket-Abos, mittel |
| `szenen/TischAnimationOrchestrator.ts` | 38.51% | 50% | ✅ Orchestrierung |
| `szenen/TischBrücke.ts` | 42.37% | 100% | e2e-Bridge, eher E2E-Test |
| `szenen/TischHudRenderer.ts` | 40.86% | 66.66% | Phaser-Mock nötig |
| `szenen/TischRundenEndeController.ts` | 42.42% | 62.85% | ✅ Controller, testbar |
| `szenen/TischEreignisHandler.ts` | 66.48% | 65% | ✅ nach Refactoring testbar |
| `store/TischStore.ts` | 70.14% | 100% | ✅ Store-Logic |
| `store/SessionStore.ts` | 69.73% | 100% | ✅ wichtige Auth-Pfade |

Detailbericht: `frontend/coverage/index.html` (nach `npx vitest run --coverage`)

## Komplexitäts-Hotspots

### Frontend (ESLint Cyclomatic Complexity > 10)

| Datei | Methode | Komplexität |
|-------|---------|-------------|
| `szenen/TischEreignisHandler.ts:12` | `verarbeitePartieEreignis` | **68** |
| `store/PartieStore.ts:128` | `_verarbeiteEventQueue` | **60** |
| `szenen/TischKartenRenderer.ts:136` | `renderKartenFaecher` | **53** |
| `modelle/TischAnsichtModell.ts:269` | `erstelleTischAnsichtAusStatus` | **36** |
| `ui/SpielerProfilModal.ts:123` | `erstelleStatistikInhalt` | **33** |
| `szenen/TischKartenRenderer.ts:232` | `setzeKartenInteraktion` | **32** |
| `szenen/TischInputHandler.ts:51` | `verarbeiteTastatureingabe` | **27** |
| `services/SpielverwaltungApi.ts:76` | `holeJson` | **27** |
| `modelle/TischKartenSortierung.ts:4` | `istTrumpfFuerSpieltyp` | **21** |
| `szenen/TischAnimationOrchestrator.ts:105` | `starteAusteilen` | **20** |
| `szenen/TischRundenEndeController.ts:138` | `zeigePartieEndeModal` | **19** |
| `szenen/TischHudRenderer.ts:108` | `renderTopBar` | **19** |
| `szenen/TischBrücke.ts:26` | `?` | **18** |
| `szenen/TischRundenEndeController.ts:30` | `zeigeRundenEndeModal` | **17** |
| `szenen/TischRenderKontroller.ts:47` | `triggerRender` | **16** |
| `szenen/TischHudRenderer.ts:26` | `erstellePhaserButton` | **16** |
| `szenen/BestenlisterSzene.ts:111` | `zeigeEintraege` | **16** |
| `store/PartieStore.ts:91` | `verarbeitePartieBatch` | **16** |
| `szenen/TischRenderKontroller.ts:84` | `renderTisch` | **15** |
| `store/TischStore.ts:191` | `verarbeiteTischEreignis` | **15** |

### Backend (Java) — Größte Klassen (Proxy für Komplexität)

| Klasse | LOC | Modul |
|--------|-----|-------|
| `JsonbConverter` | 948 | `tisch` |
| `Spiel` | 534 | `partie` |
| `PartieStandAntwort` | 529 | `tisch` |
| `StandardKiStrategie` | 504 | `ki` |
| `Partie` | 466 | `partie` |
| `TischVerwaltungsService` | 455 | `tisch` |
| `Spielregeln` | 438 | `karten` |
| `SpielAktionsService` | 378 | `tisch` |
| `TischkonfigurationEmbeddable` | 310 | `tisch` |
| `VerbindungsabbruchService` | 283 | `tisch` |
| `TischController` | 283 | `tisch` |

## Architektur-Check (Modul-Grenzen)

Erlaubte Abhängigkeitsrichtung: `tisch → partie, spieler, ki` · `ki → partie, karten` · `partie → karten` · `spieler → partie.ereignisse`

| Prüfung | Ergebnis |
|---------|----------|
| `partie` → `tisch` (verboten) | ✅ OK |
| `ki` → `spieler` (verboten) | ✅ OK |
| `karten` → `partie` (verboten) | ✅ OK |

## Top-Refactoring-Kandidaten

Abgeleitet aus den obigen Metriken (Details: IMPLEMENTATION_PLAN.md, Sektion Entdeckungen).

| Priorität | Kandidat | Metrik | Status |
|-----------|----------|--------|--------|
| ~~🔴 Hoch~~ | ~~`TischEreignisHandler.verarbeitePartieEreignis`~~ | ~~Komplexität 68~~ | ✅ Erledigt (S59) |
| ~~🔴 Hoch~~ | ~~`PartieStore._verarbeiteEventQueue`~~ | ~~Komplexität 60~~ | ✅ Erledigt (S61) |
| ~~🔴 Hoch~~ | ~~`TischKartenRenderer.renderKartenFaecher/setzeKartenInteraktion`~~ | ~~Komplexität 53/32~~ | ✅ Erledigt (S100i) |
| 🟡 Mittel | `TischAnsichtModell.erstelleTischAnsichtAusStatus` | Komplexität 36 | Offen — Builder-Pattern oder Teilmethoden |
| 🟡 Mittel | `KiTischOrchestrator` | 64% Coverage, 145 LOC | Offen — Unit-Tests (Phase 2) |
| 🟢 Niedrig | `VerbindungsSessionEreignisListener` | 9% Coverage, 29 LOC | Offen — Integration-Test ergänzen |
| 🟢 Niedrig | `RateLimitingFilter` | 36% Coverage, 42 LOC | Offen — Request-Simulation (Security) |

