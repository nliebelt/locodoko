# Locodoko — Metrik-Report

> Stand: 2026-06-15 — reproduzierbar via `scripts/metrics.sh`

## Codebase-Größe

### Backend (Java)

| Modul | Dateien | LOC |
|-------|---------|-----|
| `karten` | 19 | 1201 |
| `partie` | 48 | 3788 |
| `spieler` | 42 | 3080 |
| `ki` | 12 | 921 |
| `tisch` | 71 | 6915 |
| `system` | 9 | 363 |
| **Gesamt** | **203** | **16391** |

Test-Klassen: 72 | Tests: **503**

### Frontend (TypeScript)

| Produktiv-Dateien | 59 |
| LOC | 10305 |
| Test-Dateien | 35 |
| Tests | **467** |

## Test-Coverage

### Backend (JaCoCo)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Instructions | 23583 | 27035 | **87%** |
| Lines | 4488 | 5160 | **86%** |
| Branches | 1528 | 2022 | **75%** |

**Coverage nach Modul:**

| Modul | Lines | Coverage |
|-------|-------|----------|
| `(root)` | 10 | 80% ████████░░ |
| `de.locodoko.betrieb` | 39 | 97% █████████░ |
| `de.locodoko.karten` | 264 | 92% █████████░ |
| `de.locodoko.ki` | 300 | 91% █████████░ |
| `de.locodoko.ki.orchestrierung` | 39 | 100% ██████████ |
| `de.locodoko.partie` | 1444 | 89% ████████░░ |
| `de.locodoko.partie.ereignisse` | 10 | 50% █████░░░░░ |
| `de.locodoko.spieler` | 910 | 86% ████████░░ |
| `de.locodoko.system` | 81 | 62% ██████░░░░ |
| `de.locodoko.tisch` | 1857 | 86% ████████░░ |
| `de.locodoko.tisch.persistenz` | 206 | 68% ██████░░░░ |

**Coverage-Schwachstellen (< 70% Line-Coverage, > 20 Zeilen):**

| Klasse | Modul | Lines | Coverage |
|--------|-------|-------|----------|
| `Tisch` | `de.locodoko.partie` | 25 | 0% |
| `SentryKonfiguration` | `de.locodoko.system` | 23 | 21% |
| `JsonbConverter` | `de.locodoko.tisch.persistenz` | 45 | 55% |

### Frontend (Vitest/V8)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Statements | 5908 | 6966 | **84%** |
| Branches | 1599 | 1918 | **83%** |
| Functions | 444 | 548 | **81%** |

Detailbericht: `frontend/coverage/index.html`

## Komplexitäts-Hotspots

### Frontend (ESLint Cyclomatic Complexity > 10)

| Datei | Methode | Komplexität |
|-------|---------|-------------|
| `szenen/TischInputHandler.ts:53` | `verarbeiteTastatureingabe` | **35** |
| `ui/SpielerProfilModal.ts:132` | `erstelleStatistikInhalt` | **33** |
| `services/SpielverwaltungApi.ts:76` | `holeJson` | **27** |
| `szenen/TischEreignisHandler.ts:148` | `verarbeiteAnsagen` | **25** |
| `szenen/TischHudRenderer.ts:26` | `erstellePhaserButton` | **22** |
| `szenen/TischEreignisHandler.ts:61` | `verarbeiteSpielfluss` | **21** |
| `modelle/TischKartenSortierung.ts:4` | `istTrumpfFuerSpieltyp` | **21** |
| `szenen/TischHudRenderer.ts:111` | `renderTopBar` | **20** |
| `szenen/TischAnimationOrchestrator.ts:105` | `starteAusteilen` | **20** |
| `szenen/TischRundenEndeController.ts:146` | `zeigePartieEndeModal` | **19** |
| `szenen/TischKartenRenderer.ts:290` | `setzeKartenInteraktion` | **18** |
| `szenen/TischBrücke.ts:26` | `?` | **18** |
| `szenen/bugreportDialog.ts:73` | `?` | **17** |
| `szenen/TischRundenEndeController.ts:32` | `zeigeRundenEndeModal` | **17** |
| `szenen/TischKartenRenderer.ts:237` | `berechneKartenFlags` | **17** |
| `szenen/TischKartenRenderer.ts:179` | `berechneFaecherKontext` | **17** |
| `szenen/TischRenderKontroller.ts:47` | `triggerRender` | **16** |
| `szenen/TischEreignisHandler.ts:112` | `verarbeiteSpielzug` | **16** |
| `szenen/PhaserButton.ts:39` | `?` | **16** |
| `szenen/BestenlisterSzene.ts:113` | `zeigeEintraege` | **16** |

### Backend (Java) — Komplexitäts-Hotspots (lizard CCN, Top 20)

| Funktion | Modul | CCN | NLOC |
|----------|-------|-----|------|
| `KiTischOrchestrator::automatisiereTisch` | `tisch` | **20** | 81 |
| `StandardKiStrategie::waehleFolgeKarte` | `ki` | **16** | 41 |
| `PartieLifecycleService::veroeffentlicheSpielBeendet` | `tisch` | **15** | 68 |
| `KiTischOrchestrator::veroeffentlicheKiEreignisse` | `tisch` | **14** | 45 |
| `SpielAktionsService::veroeffentlicheSpielKarteEreignisse` | `tisch` | **14** | 41 |
| `BugReportController::erstelleGithubIssue` | `spieler` | **13** | 63 |
| `Spiel::spieleKarte` | `partie` | **13** | 46 |
| `SpielVorbehaltAufloesung::aufloesen` | `partie` | **13** | 42 |
| `KiOrchestrierungService::fuehreAktionAus` | `ki` | **12** | 51 |
| `SpielVorbehaltAufloesung::trumpfOrdnungFuer` | `partie` | **12** | 14 |
| `Partie::schliesseAktuellesSpielAb` | `partie` | **11** | 41 |
| `SpielerStatistik::verarbeiteSpiel` | `spieler` | **11** | 30 |
| `RateLimitingFilter::pruefRateLimit` | `spieler` | **11** | 28 |
| `StandardKiStrategie::waehleVorbehalt` | `ki` | **10** | 40 |
| `TischSicherheit::extrahiereSpielerId` | `tisch` | **10** | 26 |
| `SpielVorbehaltAufloesung::trumpfOrdnungFuerPersistiertenStand` | `partie` | **10** | 12 |
| `SonderpunktBewerter::bewerte` | `partie` | **9** | 34 |
| `Stich::sticht` | `partie` | **9** | 29 |
| `Spiel::sageAn` | `partie` | **9** | 29 |
| `StandardKiStrategie::soloWert` | `ki` | **9** | 23 |

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
| 🟡 Mittel | `KiTischOrchestrator::automatisiereTisch` | CCN 20, 81 NLOC | Teilmethoden je Spielphase |
| 🟡 Mittel | `PartieLifecycleService::veroeffentlicheSpielBeendet` | CCN 15, 68 NLOC | Ereignis-Handler extrahieren |
| 🟡 Mittel | `JsonbConverter.java` | 948 LOC | Generische Basisklassen (optionale Weiterführung) |
| 🟢 Niedrig | `KiTischOrchestrator` | Coverage prüfen | Mehr Unit-Tests |

