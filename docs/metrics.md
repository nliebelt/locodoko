# Locodoko — Metrik-Report

> Stand: 2026-06-04 — reproduzierbar via `scripts/metrics.sh`

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

Test-Klassen: 60

### Frontend (TypeScript)

| Produktiv-Dateien | 53 |
| LOC | 9092 |
| Test-Dateien | 25 |

## Test-Coverage

### Backend (JaCoCo)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Instructions | 21477 | 25462 | **84%** |
| Lines | 4030 | 4803 | **83%** |
| Branches | 1337 | 1882 | **71%** |

**Coverage nach Modul:**

| Modul | Lines | Coverage |
|-------|-------|----------|
| `(root)` | 10 | 80% ████████░░ |
| `de.locodoko.karten` | 264 | 92% █████████░ |
| `de.locodoko.ki` | 300 | 91% █████████░ |
| `de.locodoko.ki.orchestrierung` | 39 | 61% ██████░░░░ |
| `de.locodoko.partie` | 1441 | 87% ████████░░ |
| `de.locodoko.partie.ereignisse` | 10 | 50% █████░░░░░ |
| `de.locodoko.spieler` | 627 | 75% ███████░░░ |
| `de.locodoko.system` | 58 | 79% ███████░░░ |
| `de.locodoko.tisch` | 1840 | 84% ████████░░ |
| `de.locodoko.tisch.persistenz` | 214 | 67% ██████░░░░ |

**Coverage-Schwachstellen (< 70% Line-Coverage, > 20 Zeilen):**

| Klasse | Modul | Lines | Coverage |
|--------|-------|-------|----------|
| `Tisch` | `de.locodoko.partie` | 25 | 0% |
| `VerbindungsSessionEreignisListener` | `de.locodoko.tisch` | 29 | 13% |
| `OAuth2ErfolgsHandler` | `de.locodoko.spieler` | 23 | 21% |
| `JsonbConverter` | `de.locodoko.tisch.persistenz` | 45 | 55% |
| `Stichverlauf` | `de.locodoko.partie` | 21 | 57% |
| `KiOrchestrierungService` | `de.locodoko.ki.orchestrierung` | 38 | 60% |
| `SpielverwaltungWebSocketController` | `de.locodoko.tisch` | 71 | 64% |
| `ArmutStatus` | `de.locodoko.partie` | 38 | 65% |
| `KiTischOrchestrator` | `de.locodoko.tisch` | 141 | 68% |
| `TischSicherheit` | `de.locodoko.tisch` | 36 | 69% |

### Frontend (Vitest/V8)

Gesamt-Coverage: **79%** (Statements, Branches, Lines, Functions)
Detailbericht: `frontend/coverage/index.html`

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

| Priorität | Kandidat | Metrik | Empfehlung |
|-----------|----------|--------|------------|
| 🔴 Hoch | `TischEreignisHandler.verarbeitePartieEreignis` | Komplexität 68 | In Teilhandler je Ereignistyp aufteilen |
| 🔴 Hoch | `PartieStore._verarbeiteEventQueue` | Komplexität 60 | Dispatcher-Methoden extrahieren |
| 🔴 Hoch | `TischKartenRenderer.renderKartenFaecher` | Komplexität 53 | Render-Schritte extrahieren |
| 🟡 Mittel | `TischAnsichtModell.erstelleTischAnsichtAusStatus` | Komplexität 36 | Builder-Pattern oder Teilmethoden |
| 🟡 Mittel | `JsonbConverter.java` | 948 LOC | Generische Basisklassen (optionale Weiterführung) |
| 🟡 Mittel | `KiTischOrchestrator` | 68% Coverage, 141 LOC | Mehr Unit-Tests |
| 🟢 Niedrig | `VerbindungsSessionEreignisListener` | 13% Coverage, 29 LOC | Integration-Test ergänzen |

