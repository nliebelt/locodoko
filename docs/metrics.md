# Locodoko — Metrik-Report

> Stand: 2026-06-13 (Session 120) — reproduzierbar via `mvn clean verify` (JaCoCo) + `cd frontend && npx vitest run --coverage` (Vitest/V8)

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

Test-Klassen: 68 · Tests: 485

### Frontend (TypeScript)

| Produktiv-Dateien | ~55 |
| LOC | ~9900 |
| Test-Dateien | 35 · Tests: 461 |

## Test-Coverage

### Backend (JaCoCo)

| Metrik | Abgedeckt | Gesamt | Quote |
|--------|-----------|--------|-------|
| Instructions | 22824 | 26858 | **85.0%** |
| Lines | 4315 | 5095 | **84.7%** |
| Branches | 1462 | 1994 | **73.3%** |
| Methods | 1246 | 1496 | **83.3%** |

> Deutliche Steigerung gegenüber Session 103 (82.8% / 82.2% / 68.9%) durch die Test-Offensive Phase 2 (Sektion J) + Review-Tests S120. Branch-Coverage 68.9% → **73.3%** (Ziel 75% nahezu erreicht). Verbleibende Lücke fast vollständig in env-gated Klassen (BugReport/Mail/OAuth, siehe unten).

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

**Coverage-Schwachstellen (verbleibend, < 40% Line-Coverage):**

| Klasse | Modul | Line-Cov | Branch-Cov | Testbar? |
|--------|-------|----------|------------|----------|
| `OAuth2ErfolgsHandler` | `spieler` | 22% | 0% | Google-OAuth-Flow, env-gated/schwer |
| `BugReportController` | `spieler` | 28% | 17% | env-gated (GH-Token) |
| `MailService` | `spieler` | 35% | 40% | env-gated (SMTP) |

> Die verbleibenden drei Schwachstellen sind allesamt **env-gated** (externe Credentials: OAuth, GitHub-Token, SMTP) → ohne Integrationsumgebung nicht sinnvoll unit-testbar.

**Behoben seit Session 103 (Test-Offensive J + Review S120):**

| Klasse | vorher | jetzt (Line/Branch) | Quelle |
|--------|--------|---------------------|--------|
| `Stichverlauf` | 50% | **100% / 100%** | S106 StichverlaufTest |
| `ArmutStatus` | 66% | **100% / 100%** | S104 ArmutStatusTest |
| `KiOrchestrierungService` | 55% | **100% / 95%** | S107 |
| `KiTischOrchestrator` | 64% | **72% / 55%** | S108 |
| `TischSicherheit` | 70% | **100% / 96%** | S108 |
| `SpielverwaltungWebSocketController` | 74% | **82% / 88%** | S109 |
| `RateLimitingFilter` | 36% | **100% / 96%** | S111 + S120 Cleanup-Tests |
| `VerbindungsSessionEreignisListener` | 9% | **100% / 70%** | S120 Review-Test |

### Frontend (Vitest/V8)

| Metrik | Quote |
|--------|-------|
| Statements | **84.75%** |
| Branches | **83.48%** |
| Functions | **81.08%** |
| Lines | **84.75%** |

> Deutlich über Session-103-Wert (78.46% / 80.40% / 76.67%) durch die FE-Test-Offensive J (Store/Abonnements/Controller/Bridge/Animation/HUD). Alle ursprünglichen Schwachstellen-Dateien sind inzwischen abgedeckt; die einzige verbleibende Lücke ist env-gated.

**Frontend-Schwachstellen (verbleibend):**

| Datei | Stmts | Hinweis |
|-------|-------|---------|
| `szenen/BugreportDialog.ts` | 1.85% | env-gated (DOM-Dialog, kein sinnvoller Unit-Test) |
| `szenen/TischRenderKontroller.ts` | 76% | Phaser-Render-Pfad, mittlerer Rest |
| `ui/PhaserList.ts` | 78% | Scroll-/Layout-Primitive |

> Behoben seit S103: `TischAbonnements` 38%→**100%**, `TischRundenEndeController` 42%→**99%**, `TischStore` 70%→**93%**, `TischBrücke`/`TischAnimationOrchestrator`/`TischHudRenderer` jetzt 86–91%.

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
| ~~🟡 Mittel~~ | ~~`KiTischOrchestrator`~~ | ~~64% Coverage~~ → 72% | ✅ Tests S108 |
| ~~🟢 Niedrig~~ | ~~`VerbindungsSessionEreignisListener`~~ | ~~9%~~ → 100% | ✅ Test S120 |
| ~~🟢 Niedrig~~ | ~~`RateLimitingFilter`~~ | ~~36%~~ → 100% | ✅ Tests S111/S120 |

