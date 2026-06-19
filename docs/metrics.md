# Locodoko — Metrik-Report

> Stand: 2026-06-19 — reproduzierbar via `scripts/metrics.sh`

## Codebase-Größe

### Backend (Java)

| Modul | Dateien | LOC |
|-------|---------|-----|
| `karten` | 19 | 1201 |
| `partie` | 48 | 3788 |
| `spieler` | 43 | 3190 |
| `ki` | 12 | 921 |
| `tisch` | 71 | 6939 |
| `system` | 9 | 363 |
| **Gesamt** | **204** | **16525** |

Test-Klassen: 72 | Tests: **503**

### Frontend (TypeScript)

| Produktiv-Dateien | 60 |
| LOC | 10577 |
| Test-Dateien | 36 |
| Tests | **478** |

## Test-Coverage

### Backend (JaCoCo)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Instructions | 23611 | 27448 | **86%** |
| Lines | 4497 | 5237 | **85%** |
| Branches | 1526 | 2044 | **74%** |

**Coverage nach Modul:**

| Modul | Lines | Coverage |
|-------|-------|----------|
| `(root)` | 10 | 80% ████████░░ |
| `de.locodoko.betrieb` | 39 | 97% █████████░ |
| `de.locodoko.karten` | 264 | 90% █████████░ |
| `de.locodoko.ki` | 300 | 91% █████████░ |
| `de.locodoko.ki.orchestrierung` | 39 | 100% ██████████ |
| `de.locodoko.partie` | 1444 | 89% ████████░░ |
| `de.locodoko.partie.ereignisse` | 10 | 50% █████░░░░░ |
| `de.locodoko.spieler` | 981 | 80% ████████░░ |
| `de.locodoko.system` | 81 | 62% ██████░░░░ |
| `de.locodoko.tisch` | 1863 | 86% ████████░░ |
| `de.locodoko.tisch.persistenz` | 206 | 68% ██████░░░░ |

**Coverage-Schwachstellen (< 70% Line-Coverage, > 20 Zeilen):**

| Klasse | Modul | Lines | Coverage |
|--------|-------|-------|----------|
| `Tisch` | `de.locodoko.partie` | 25 | 0% |
| `SpielerProfilAntwort` | `de.locodoko.spieler` | 70 | 12% |
| `SentryKonfiguration` | `de.locodoko.system` | 23 | 21% |
| `JsonbConverter` | `de.locodoko.tisch.persistenz` | 45 | 55% |

### Frontend (Vitest/V8)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Statements | 3266 | 4100 | **79%** |
| Branches | 1516 | 2131 | **71%** |
| Functions | 634 | 844 | **75%** |

Detailbericht: `frontend/coverage/index.html`

## Komplexitäts-Hotspots

### Frontend (ESLint Cyclomatic Complexity > 10)

| Datei | Methode | Komplexität |
|-------|---------|-------------|
| `szenen/TischEreignisHandler.ts:148` | `verarbeiteAnsagen` | **25** |
| `szenen/TischEreignisHandler.ts:61` | `verarbeiteSpielfluss` | **21** |
| `modelle/TischKartenSortierung.ts:4` | `istTrumpfFuerSpieltyp` | **21** |
| `szenen/TischHudRenderer.ts:118` | `renderTopBar` | **20** |
| `ui/SpielerProfilModal.ts:88` | `berechneStatistikWerte` | **18** |
| `szenen/TischKartenRenderer.ts:290` | `setzeKartenInteraktion` | **18** |
| `szenen/TischBrücke.ts:26` | `?` | **18** |
| `szenen/bugreportDialog.ts:73` | `?` | **17** |
| `szenen/TischKartenRenderer.ts:237` | `berechneKartenFlags` | **17** |
| `szenen/TischKartenRenderer.ts:179` | `berechneFaecherKontext` | **17** |
| `ui/SpielerProfilModal.ts:106` | `erstelleStatistikInhalt` | **16** |
| `szenen/TischRenderKontroller.ts:47` | `triggerRender` | **16** |
| `szenen/TischEreignisHandler.ts:112` | `verarbeiteSpielzug` | **16** |
| `szenen/PhaserButton.ts:39` | `?` | **16** |
| `store/PartieStore.ts:91` | `verarbeitePartieBatch` | **16** |
| `szenen/TischRenderKontroller.ts:84` | `renderTisch` | **15** |
| `szenen/TischInputHandler.ts:107` | `verarbeiteTastatureingabe` | **15** |
| `store/TischStore.ts:191` | `verarbeiteTischEreignis` | **15** |
| `services/SpielverwaltungApi.ts:76` | `erstelleFetchInit` | **15** |
| `ui/FlashTextManager.ts:60` | `zeigeSpielevent` | **14** |

### Backend (Java) — Komplexitäts-Hotspots (lizard CCN, Top 20)

| Funktion | Modul | CCN | NLOC |
|----------|-------|-----|------|
| `StandardKiStrategie::waehleFolgeKarte` | `ki` | **16** | 41 |
| `PartieLifecycleService::veroeffentlicheSpielBeendet` | `tisch` | **15** | 68 |
| `KiTischOrchestrator::veroeffentlicheKiEreignisse` | `tisch` | **14** | 45 |
| `KiTischOrchestrator::automatisiereTisch` | `tisch` | **14** | 44 |
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
| 🟡 Mittel | `TischEreignisHandler.verarbeiteAnsagen` | FE CCN 25 | Dispatcher je Ansage-Typ |
| 🟡 Mittel | `TischEreignisHandler.verarbeiteSpielfluss` | FE CCN 21 | Teilmethoden je Phase |
| 🟡 Mittel | `TischKartenSortierung.istTrumpfFuerSpieltyp` | FE CCN 21 | Lookup-Tabelle statt if-Kette |
| 🟡 Mittel | `TischHudRenderer.renderTopBar` | FE CCN 20 | Render-Blöcke extrahieren |
| 🟡 Mittel | `StandardKiStrategie::waehleFolgeKarte` | BE CCN 16 | Strategie je Spielsituation |
| 🟡 Mittel | `PartieLifecycleService::veroeffentlicheSpielBeendet` | BE CCN 15, 68 NLOC | Ereignis-Handler extrahieren |
| 🟢 Niedrig | `JsonbConverter.java` | 948 LOC | Generische Basisklassen (optionale Weiterführung) |

