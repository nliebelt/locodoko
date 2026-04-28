# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-28 (Plan-Run #87)

**Was wurde implementiert (Plan-Run #87):**
- BUG-STICH-UMDREHEN: Klick auf jeden Stich-Stapel (alle 4 Spieler, nicht nur SUED) zeigt den letzten Stich dieses Spielers im Overlay. Fix: `if (spieler.istSelbst)`-Guard entfernt, Filter von hardcoded `'SUED'` auf `spieler.position` geändert (`TischSzene.renderStichStapel()`). 3 neue Tests. Build-Fehler von Plan-Run #86 (FEAT-PRESET-API) behoben: `TischPresetAntwort` in `SpielverwaltungDto.ts` ergänzt, Imports korrigiert, `AppStore.instanz()` → modul-globales `appStore`, `FakeApi.gibPresets()` in Tests ergänzt. 80 Frontend-Tests grün, Build erfolgreich.

**Nächste Priorität:** `FEAT-LOBBY-POLLING` (Liste offener Tische im Startscreen reaktiv machen).

**Was wurde implementiert (Plan-Run #86):**
- FEAT-PRESET-API: Backend-Endpoint `GET /api/tische/presets` liefert verfügbare Regel-Presets (Loco-Blatt, DKV-Turnier). `TischErstellenAnfrage` um `presetName` erweitert; `TischVerwaltungsService.erstelleTisch` nutzt diesen zur Konfiguration. Frontend: `SpielverwaltungApi` und `AppStore` um Preset-Unterstützung ergänzt. `SpielverwaltungsSzene` zeigt nun ein DOM-basiertes Modal zur Tisch-Erstellung mit Preset-Auswahl und Beschreibung. Alle 299 Backend- und 77 Frontend-Tests grün.

**Nächste Priorität:** `BUG-STICH-UMDREHEN` (nur letzten Stich umdrehen erlauben) oder `FEAT-LOBBY-POLLING` (Liste offener Tische reaktiv machen).

**Was wurde implementiert (Plan-Run #81):**
- TASK-PRESET-UNIT-TESTS: `SpielregelnTest` um zwei vollständige Feldprüfungs-Tests erweitert: `locoBlatRegelnHatKorrekteWerteFuerAlleFelder()` und `dkvRegelnHatKorrekteWerteFuerAlleFelder()`. Jeder Test prüft alle 21 Felder des `Spielregeln`-Records explizit — sichert ab, dass ein Refactoring keine Preset-Werte unbemerkt verändert. 295 Backend-Tests grün (SpielregelnTest: 3→5 Tests).

**Was wurde implementiert (Plan-Run #80):**
- FEAT-TASTATUR-AUTOFOKUS-SHORTCUTS: Codeanalyse ergab — beide Features waren bereits vollständig implementiert. Auto-Fokus in `TischSzene.aktualisiereKartenNavigationsIndex()` (setzt `tastaturKarteIndex=0` beim Spielzug-Beginn), R/K-Shortcuts in `TischInputHandler.verarbeiteAnsageTaste()`. Spec-DoD `frontend-tastatursteuerung.md` auf [x] gesetzt (7 von 9 Punkten; E2E-Tests + manueller Test-Durchlauf offen). 60 Frontend-Tests grün.

**Was wurde implementiert (Plan-Run #78):**
- FEAT-BOCK-CONFIG: `herzDurchgegangenNurHoch: boolean` in `Spielregeln`, `TischkonfigurationEmbeddable`, `TischKonfigurationDto`, Frontend-DTOs. `Spiel.istHerzDurchgegangen()` wertet neue Option aus: `true` → nur Herz-As-Stiche triggern Bockrunde, `false` (Standard) → beliebiger Fehlherz-Stich. Liquibase-Migration 022, Baseline aktualisiert. 3 neue BockrundenTests. Spec-Updates in `bockrunden.md` + `tischkonfiguration.md`. 295 Backend-Tests, 60 Frontend-Tests grün.

**Was wurde implementiert (Plan-Run #77):**
- SPEC-Updates: `authentifizierung.md` (alle DoD [x]), `spieler-profil.md` (Status → Abgeschlossen, alle DoD [x]), `verbindungsabbruch.md` (KI-Timeout-Einzelspieler [x]), `tischkonfiguration.md` (neue Optionen [x]). `schweinchen.md` war bereits vollständig aktuell.
- FEAT-SONDERPUNKT-DOMAIN-EVENTS: `FuchsGefangen`, `KarlchenGespielt`, `DoppelkopfGestochen` als Spring ApplicationEvents in `partie.ereignisse.*` eingeführt. Werden nach Stich-Abschluss in `SpielAktionsService` und `KiOrchestrierungService` publiziert. `default`-Case aus versiegelten Interface-Switches entfernt (typsichere Exhaustivitäts-Prüfung). Integrationstest `SonderpunktDomainEreignisTest` mit `@RecordApplicationEvents` — verifiziert FuchsGefangen bei Mensch-Fuchs-Fang. 292 Tests grün.

**Was wurde implementiert (Plan-Run #75):**
- BUG-DKV-PRESET: Diagnose ergab — Bug lag in der KI-Orchestrierung (bereits in Plan-Run #73 behoben). `Spiel.werteAus()` und `PunkteRechner` sind korrekt. Neuer Regression-Test `spielSchliesstAbMitDkvPreset` in `SpielTest` hinzugefügt. `specs/regelkatalog.md` Bug-Eintrag als behoben markiert. 291 Tests grün.

**Was wurde entdeckt (Plan-Run #74):**
- BUG-TRUMPFSOLO-NEUN implementiert → [x]
- BUG-DKV-PRESET in Phase 1 ergänzt

**Nächste Priorität:** Spec-Updates (SPEC-SCHWEINCHEN, SPEC-AUTH, SPEC-SPIELER-PROFIL etc.). Dann FEAT-BOCK-CONFIG.

---

## Phase 1 — Kern-Stabilität & Spec-Fixes (PRIO)

### BUG-TRUMPFSOLO-NEUN (Backend) ← NEU Plan-Run #73
**Problem:** `VariableTrumpfsoloTrumpfOrdnung.java` Zeile ~49: Bedingung `karte.wert() != Kartenwert.NEUN || !spielregeln.ohneNeunen()` ist logisch invertiert. Neunen könnten bei aktivem `ohneNeunen=true` fälschlich als Trumpf gewertet werden.
Entscheidung: Code ist fehlerhaft — laut Spec dürfen Neunen bei `ohneNeunen=true` grundsätzlich nie Trumpf sein.
- [x] Backend: `VariableTrumpfsoloTrumpfOrdnung.java` — Neun-Ausschluss-Bedingung auf `karte.wert() == Kartenwert.NEUN && spielregeln.ohneNeunen()` korrigieren (kein Trumpf wenn Neun UND ohneNeunen aktiv).
- [x] Validation: neuer Test `neunIstKeinTrumpfBeiTrumpfsoloMitOhneNeunenRegeln`. 290 Tests grün.

### BUG-DKV-PRESET (Backend) ← Plan-Run #73, abgeschlossen Plan-Run #75
**Problem:** Spiel schließt mit DKV-Turnier-Preset (alle Sonderregeln deaktiviert) nicht korrekt ab. Reproduzierbar.
Diagnose (Plan-Run #75): Bug lag in der KI-Orchestrierung, nicht in `Spiel.werteAus()` / `PunkteRechner`. Beide sind korrekt. Bereits durch Plan-Run #73 behoben (`KiOrchestrierungServiceIntegrationTest.spieltEineKompletteVierKiPartieMitDkvRegelnZuEnde` grün).
- [x] Backend: Ursache lokalisiert — KI-Orchestrierung, nicht PunkteRechner.
- [x] Backend: Regression-Test: `SpielTest.spielSchliesstAbMitDkvPreset()` — 12 Stiche (48 Karten), 240 Augen, Nullsumme.
- [x] Validation: 291 Tests grün.

### BUG-KI-HAENGER-FUCHS (Backend)
**Problem:** KI bleibt stehen nach Sonderpunkten (Fuchs gefangen etc.).
- [x] Backend: `triggereKi()` wird korrekt via `finally`-Block in `automatisiereTisch()` aufgerufen. Behoben in Commit `4f705b1 REGELN-2`.
- [x] Validation: `KiOrchestrierungServiceIntegrationTest` — alle 5 Tests grün.

### FEAT-LOCO-PRESET (Backend)
**Problem:** Code nutzte 48 Karten, Spec fordert 40 (ohne Neunen).
- [x] Backend: `Spielregeln.locoBlatRegeln()` auf `ohneNeunen = true`, Ansagegrenzen `9,8,7,6,5`.
- [x] Backend: Kommentar verweist auf `specs/regelkatalog.md`.
- [x] Spec: `specs/tischkonfiguration.md` — `ohneNeunen` auf `true` korrigiert.
- [x] Tests: Alle betroffenen Tests angepasst.
- [x] Validation: `mvn test` — alle 282 Tests grün.

### BUG-SCHWEINCHEN (Backend)
**Problem:** Karo-Asse werden trotz aktivem Schweinchen nicht als höchste Trümpfe behandelt.
Analyse (Plan-Run #65): `SchweinchenTrumpfOrdnung` weist korrekte Ränge 14/15 zu — der Bug lag in der Spieltyp-Zuordnung, nicht in der Trumpfordnung selbst.
- [x] Backend: `trumpfOrdnungFuer(SOLO_TRUMPF)` → `hatSchweinchen()` ? SchweinchenTrumpfOrdnung : NormaleTrumpfOrdnung (vorher ignoriert).
- [x] Backend: `trumpfOrdnungFuer(HOCHZEIT/ARMUT)` → immer NormaleTrumpfOrdnung (vorher fälschlicherweise Schweinchen aktiv).
- [x] Backend: `nimmArmutAn()` → immer NormaleTrumpfOrdnung nach Kartentausch (Armut nutzt nie Schweinchen).
- [x] Backend: `trumpfOrdnungFuerPersistiertenStand()` → HOCHZEIT/ARMUT liefern NormaleTrumpfOrdnung.
- [x] Validation: 3 fehlerhafte Tests korrigiert, 2 neue Tests (Stichgewinner + Armut-Ausschluss). 283 Tests grün.

### BUG-FE-SORTIERUNG (Frontend)
**Problem:** Farbsoli werden wie Normalspiele sortiert (Herz-10 falsch oben).
- [x] Frontend: `TischAnsichtModell.ts` — `farbsoloTrumpfRang()` für SOLO_TRUMPF_HERZ/PIK/KREUZ implementiert. `SOLO_FARBE_KARO` aus Spieltyp-Union entfernt (kein Backend-Enum-Pendant).
- [x] Validation: 3 neue Tests (Herz-, Pik-, Kreuzsolo). 59 Tests grün, Build + Lint (keine neuen Fehler).

### BUG-SICHERHEIT-PROFIL (Backend)
**Problem (neu — Plan-Run #65):** `SpielerProfilController` PUT-Endpoint hat keine Autorisierungsprüfung — jeder Spieler kann fremde Profile überschreiben.
Entscheidung: Spec ist korrekt (nur eigenes Profil darf geändert werden).
- [x] Backend: Neue `SpielerZugriffVerweigertException`; `SpielverwaltungExceptionHandler` → HTTP 403.
- [x] Backend: `SpielerProfilController.aktualisiereProfil()` — `SpielerSessionService.ladeAktivenSpieler(request)`, ID-Vergleich, bei Mismatch 403.
- [x] Validation: 3 Integrationstests (eigenes Profil 200, fremdes Profil 403, keine Session 401). 286 Tests grün.

### BUG-DTO-MASKIERUNG (Backend)
**Problem (neu — Plan-Run #65):** `sichtbareHandkarten` in der Snapshot-Antwort darf für andere Spieler keine `karteId` enthalten (sonst können andere Spieler Karten einsehen).
Entscheidung: Spec ist korrekt — karteId ist nur dem Karteninhaber sichtbar.
- [x] Backend: `sichtbareHandkarten = null` für fremde Spieler; `verbleibendeKarten` immer sichtbar (bereits korrekt implementiert).
- [x] Validation: `PartieControllerTest.maskiertGegnerHandkartenImPartieStandViaREST()` — vollständiger HTTP-Pfad. 287 Tests grün.

---

## Phase 2 — KI-Kalibrierung & Bockrunden (UX)

### FEAT-KI-SOLO-VORSICHT (Backend)
**Problem:** KI spielt zu viele (verlierende) Soli, besonders ohne Neunen.
Hinweis (Plan-Run #65): `specs/solo-farbsolo.md` definiert eine 46-Punkte-Schwelle für KI-Farbsolo-Bewertung — prüfen ob diese in `StandardKiStrategie` fehlt (separate Logik von `soloSchwelle`).
- [x] Backend: `StandardKiStrategie.java` — `soloSchwelle` Multiplikator von 13% auf 25% erhöht.
- [x] Backend: ohneNeunen-Malus (+5 Punkte) eingebaut wenn `spielregeln.ohneNeunen()` aktiv ist.
- [x] Backend: Farbsolo-Bewertung geprüft — war bereits korrekt (nutzt dieselbe soloSchwelle-Methode wie SOLO_TRUMPF).
- [x] Validation: 1 neuer Test (`meldetKeinSoloBeiGrenzwertHandMitOhneNeunenRegeln`). 288 Tests grün.

### FEAT-SCHWEINCHEN-ANSAGE (Backend)
**Problem (neu — Plan-Run #65):** DKV-Regel: Wenn ein Spieler das erste Karo-As ausspielt und Schweinchen aktiv ist, soll eine explizite `SCHWEINCHEN_GEMELDET`-Meldung ans Frontend gesendet werden (Anzeige "Schweinchen!").
Entscheidung: Spec ist korrekt, bisher nur implizit.
- [x] Backend: `spielerPosition` in `PartieEreignisAntwort.SchweinchenGemeldet` ergänzt; Event-Pipeline vereinfacht.
- [x] Backend: `KiOrchestrierungService` — doppelten Broadcast beseitigt (proaktiver Check entfernt).
- [x] Frontend: `SchweinchenGemeldetEreignis` DTO um `spielerPosition` erweitert; `TischSzene.ts` auf `absolutePosition` umgestellt.
- [x] Validation: 289 Backend-Tests, 60 Frontend-Tests grün.

### FEAT-SONDERPUNKT-DOMAIN-EVENTS (Backend) ← Plan-Run #76
**Problem:** `FuchsGefangen`, `KarlchenGespielt`, `DoppelkopfGestochen` existieren nur als Sonderpunkt-Felder in der Snapshot-Antwort, nicht als Domain Events. Dadurch kann der `KiEventAdapter` nicht darauf reagieren — möglicherweise Ursache für KI-Hänger nach Sonderpunkten (trotz BUG-KI-HAENGER-FUCHS-Fix).
Entscheidung: Spec (`architektur-domain-events.md`) fordert Domain Events für spielrelevante Ereignisse. Code ist unvollständig.
- [x] Backend: `partie/ereignisse/` — `FuchsGefangen`, `KarlchenGespielt`, `DoppelkopfGestochen` als Spring ApplicationEvent-Records (nicht in sealed SpielEreignis, da in StichAbgeschlossenEreignis.sonderpunkte() bereits enthalten).
- [x] Backend: `SpielAktionsService.sendeStichAbgeschlossen()` + `KiOrchestrierungService.sendeStichAbgeschlossen()` — Events nach Sonderpunktermittlung via `ApplicationEventPublisher.publishEvent()` publizieren. `default`-Case aus sealed-Interface-Switch entfernt.
- [x] Backend: Kein KiEventAdapter-Listener nötig (laut spec: `—`).
- [x] Validation: `SonderpunktDomainEreignisTest` mit `@RecordApplicationEvents`. 292 Tests grün.

### FEAT-BOCK-CONFIG (Backend) ← Plan-Run #78
**Problem:** "Herz durchgegangen" soll konfigurierbar sein.
- [x] Backend: `TischKonfiguration` um `herzDurchgegangenNurHoch: boolean` erweitern.
- [x] Backend: `Spiel.java` — Trigger-Bedingung für Bockrunde von dieser Option abhängig machen.

---

## Phase 3 — Spielfluss-Automatisierung

### FEAT-COUNTDOWN (Backend + Frontend) ← Plan-Run #82
- [x] Backend: `TischEreignisTyp.COUNTDOWN_TICK` eingeführt.
- [x] Backend: Nach `markiereAlsBeendet()` startet `PartieCountdownService` einen 10s-Timer, der jede Sekunde ein `COUNTDOWN_TICK`-Event sendet. Konfigurierbar via `locodoko.countdown.dauer-sekunden`.
- [x] Backend: Bei Ablauf ruft der Countdown `TischVerwaltungsService.starteNeuePartieAutomat()` auf (neue `@Transactional`-Methode ohne Session-Validierung). Duplikate idempotent abgesichert.
- [x] Frontend: `AppZustand.countdownSekunden` eingeführt; `COUNTDOWN_TICK` in `AppStore.verarbeiteTischEreignis` VOR dem `!tisch`-Check verarbeitet. Countdown wird bei `SPIEL_GESTARTET`, `PARTIE_ABGEBROCHEN`, `TISCH_ENTFERNT` zurückgesetzt.
- [x] Frontend: Countdown-Anzeige im Partie-Ende-Modal (`„Neue Partie startet in N…"`). Modal schließt sich automatisch wenn neues `laufendesSpiel` verfügbar ist (Auto-Start).
- [x] Validation: 299 Backend-Tests, 60 Frontend-Tests grün; Build erfolgreich.

---

## Phase 4 — Offene UI-Punkte

- [x] FEAT-HUD-SIDEBAR: "Letzte 3 Stiche" in der Phaser-Sidebar implementiert (Teil von FEAT-SEITENLADE, Plan-Run #84).
- [x] BUG-STICH-UMDREHEN: Erlauben, alle Stiche umzudrehen (nicht nur den eigenen).
- [ ] FEAT-LOBBY-POLLING: Liste offener Tische im Startscreen funktional machen.

### FEAT-TASTATUR-AUTOFOKUS-SHORTCUTS (Frontend) ← NEU Plan-Run #73, abgeschlossen Plan-Run #80
**Problem:** `frontend-tastatursteuerung.md` fordert (a) automatischen Fokus auf die erste spielbare Karte bei Spielzug-Beginn, und (b) Ansage-Shortcuts `R` (Re) und `K` (Kontra).
Analyse (Plan-Run #80): Beide Features waren bereits vollständig implementiert — Auto-Fokus in `TischSzene.aktualisiereKartenNavigationsIndex()` (setzt Index auf 0 beim Spielzug-Beginn), R/K-Shortcuts in `TischInputHandler.verarbeiteAnsageTaste()` (prüft `modell.moeglicheAnsagen`). Spec-DoD in `frontend-tastatursteuerung.md` aktualisiert. 60 Frontend-Tests, Build grün.
- [x] Frontend: Auto-Fokus erste spielbare Karte bei Spielzug-Beginn (in `TischSzene.aktualisiereKartenNavigationsIndex()`).
- [x] Frontend: KeyHandler für `R` und `K` (in `TischInputHandler.verarbeiteAnsageTaste()`).
- [x] Validation: 60 Frontend-Tests grün, Build erfolgreich.

### FEAT-ANSAGEN-FAB (Frontend) ← abgeschlossen Plan-Run #83
**Problem (neu — Plan-Run #65):** `frontend-ui-logik.md` fordert eine "Floating Action Bar" für Re/Kontra-Ansagen zwischen Stichmitte und Kartenfächer.
Analyse (Plan-Run #83): Feature war bereits vollständig in `TischSzene.renderAnsageButtons()` implementiert (Phaser-Buttons mit DOM-Markern, R/K-Shortcuts in `TischInputHandler.verarbeiteAnsageTaste()`). Nur Tests fehlten.
- [x] Frontend: `TischSzene.renderAnsageButtons()` — Phaser FAB mit allen Ansage-Typen (Re bis Schwarz), nur sichtbar bei SUED + moeglicheAnsagen > 0.
- [x] Frontend: Buttons triggern `appStore.sageAnsageAn(a)` → WebSocket `/app/tisch/{id}/ansage`.
- [x] Frontend: R/K-Tastatur-Shortcuts in `TischInputHandler.verarbeiteAnsageTaste()`.
- [x] Validation: 7 neue Tests (DOM-Marker-Präsenz, Zustandsübergang, R/K-Shortcuts, Negativ-Test). 67 Tests grün, Build erfolgreich.

### FEAT-SEITENLADE (Frontend) ← abgeschlossen Plan-Run #84
**Problem (neu — Plan-Run #65):** Info-Panel (Spielerstand, Ansagehistorie, Stichübersicht) ist laut `frontend-ui-logik.md` spezifiziert, aktuell nur Stub.
- [x] Frontend: `[≡]`-Button öffnet Panel mit aktuellem Spielerstand (Augen pro Partei), Ansagehistorie und letzten Stichen.
- [x] Frontend: Panel schließt sich bei erneutem Klick oder Escape.
- [x] Validation: 71 Frontend-Tests grün, Build erfolgreich.

### FEAT-EINSTELLUNGS-MODAL (Frontend) ← abgeschlossen Plan-Run #85
**Problem (neu — Plan-Run #65):** Einstellungs-Modal (`[⚙]`) für Hintergrund, KI-Schwierigkeit und Animationsgeschwindigkeit ist laut `frontend-ui-logik.md` spezifiziert, aktuell nur `getEinstellungsModalEl()` ohne Implementierung.
- [x] Frontend: Einstellungs-Modal mit drei Optionen implementieren.
- [x] Frontend: Animationsgeschwindigkeit persistiert in `localStorage` und wird beim Start aus `AppStore` übernommen.
- [x] Validation: `npm test` + `npm run build`.

---

## Phase 5 — Backlog (kein aktueller Blocker)

### FEAT-SCHMEISSEN (Backend)
**Problem (neu — Plan-Run #65):** `specs/spielablauf.md` definiert Schmeißen-Regeln ("Fünf Neunen", "Wenig Trumpf").
**Plan-Run #73:** Bereits vollständig implementiert (3 Varianten: 5+ Könige, 5+ Neunen, ≤2 Trümpfe + Wiederholungsschutz, Priorität 4).
- [x] Backend: `Vorbehalt.java` / `VorbehaltPhase` — Schmeißen als höchste Priorität (Prio 4) implementiert.
- [x] Backend: Drei Schmeißen-Gründe: `FUENF_KOENIGE`, `FUENF_NEUNEN`, `WENIG_TRUMPF` + Wiederholungsschutz.
- [x] Backend: Bei Schmeißen: Karten neu mischen und verteilen (neue VorbehaltRunde).
- [x] Validation: Unit-Tests vorhanden.

### FEAT-PRESET-API (Backend) ← abgeschlossen Plan-Run #86
**Problem:** Verfügbare Regel-Presets (locoBlatRegeln, dkvRegeln, ohneNeunenLocoBlatRegeln) existieren nur als Backend-Factory-Methoden. Kein REST-Endpoint zur Auslesung, daher kann das Frontend kein Preset-Dropdown im Tisch-Erstellungs-Dialog anbieten.
- [x] Backend: `GET /api/tische/presets` — gibt Liste verfügbarer Preset-Namen mit Beschreibung zurück.
- [x] Backend: `POST /api/tische` — akzeptiert optional `presetName` statt manueller Konfiguration.
- [x] Frontend: Preset-Dropdown im Tisch-Erstellungs-Dialog (DOM-Modal).
- [x] Validation: `mvn test` + `npm test`.

### TASK-PRESET-UNIT-TESTS (Backend) ← NEU Plan-Run #79, abgeschlossen Plan-Run #81
**Problem:** `specs/regelkatalog.md` fordert dedizierte Unit-Tests für `locoBlatRegeln()` und `dkvRegeln()`, die explizit alle Feldwerte prüfen. Bisher nur indirekte Nutzung in SpielTest.
- [x] Backend: `SpielregelnTest` — je einen Test für `locoBlatRegeln()` und `dkvRegeln()` mit allen 21 Feld-Assertions.
- [x] Validation: 295 Backend-Tests grün.


**Problem (neu — Plan-Run #65):** `authentifizierung.md` spricht von Username/Passwort parallel zu OAuth2, aber `formLogin` war im Code fraglich.
**Plan-Run #73:** Passwort-Auth mit Rate-Limiting (10 Versuche/Min) ist bereits aktiv implementiert. Kein Code-Task nötig.
- [x] Entscheidung: Passwort-Auth (`formLogin` + `LocodokoBenutzerdienst`) ist aktiv. Rate-Limiting bereits vorhanden.
- [x] Spec: `specs/authentifizierung.md` — DoD-Status aktualisieren (→ SPEC-AUTH).

---

## Spec-Updates
- [x] SPEC-SOLO: Text an 25% Anpassung anpassen.
- [x] SPEC-LOCO: Im Code dokumentiert.
- [x] SPEC-SCHWEINCHEN: `specs/schweinchen.md` — war bereits vollständig aktuell (kein Bug-Eintrag, Soli-Gültigkeit bereits dokumentiert).
- [x] SPEC-AUTH: `specs/authentifizierung.md` — DoD-Status aktualisiert: Passwort-Auth + OAuth2 + Rate-Limiting alle [x].
- [x] SPEC-SPIELER-PROFIL: `specs/spieler-profil.md` — Status → "Abgeschlossen", alle DoD-Checkboxen [x].
- [x] SPEC-VERBINDUNGSABBRUCH: `specs/verbindungsabbruch.md` — KI-Übernahme-Timeout Einzelspieler als [x] markiert.
- [x] SPEC-TISCHKONFIGURATION: `specs/tischkonfiguration.md` — "Neue Optionen ergänzt: bockrundenAktiv..." als [x] markiert.
- [x] SPEC-BOCKRUNDEN: `specs/bockrunden.md` — 3 Frontend-DoD-Punkte auf [x] gesetzt; Klassenname `LaufendesSpielAntwort` → `PartieStandAntwort` korrigiert.
- [x] SPEC-SPIELABLAUF-SCHMEISSEN: `specs/spielablauf.md` — alle DoD-Items bereits [x], kein Update nötig.
- [x] SPEC-REGELKATALOG: `specs/regelkatalog.md` — `locoBlatRegeln()` + `dkvRegeln()` auf [x]; `ohneNeunenLocoBlatRegeln()` aus Spec + Code + Tests entfernt (war identisch mit `locoBlatRegeln()`). Unit-Test-Item umformuliert: nur noch `locoBlatRegeln()` + `dkvRegeln()` → als TASK-PRESET-UNIT-TESTS in Phase 5 geführt.
