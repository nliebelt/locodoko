# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-05 (Plan-Run #33)

## Notiz

**2026-04-06 (Plan-Run #36):** Task 6 (Regelkatalog-Presets) vollständig erledigt — `Spielregeln.locoBlatRegeln()` (alle Sonderregeln aktiv), `Spielregeln.dkvRegeln()` (ohne Bockrunden/Schweinchen/30AP), `Spielregeln.ohneNeunenLocoBlatRegeln()` (wie Loco Blatt + ohneNeunen + angepasste Mindestkarten), `SpielregelnTest.java` (4 neue Tests), `frontend/src/modelle/regelPresets.ts` (TypeScript-Konstanten + `standardMindestkarten()`), `SpielverwaltungsSzene.ts` Konfigurations-Modal um Preset-Dropdown erweitert (Loco Blatt / DKV-Turnier / Ohne Neunen / Benutzerdefiniert) mit dynamischer Regel-Checkbox-Grid (schreibgeschützt für Presets, editierbar für Benutzerdefiniert). 179 Backend-Tests grün, 62 Frontend-Tests grün, Build + Lint sauber.
Nächster logischer Schritt: Task 8 (Frontend-Animationen: Stich-Visualisierung) oder Task 9 (Rundenauswertungs-Overlay).
Offene Fragen: keine.

**2026-04-06 (Plan-Run #37):** Bug #6 (KI-Karten-Timing — 800ms Verzögerung zwischen KI-Zügen in STICHPHASE bei menschlichem Mitspieler, kein Delay nach eigener Ansage), Bug #7 (Letzter-Stich-Flip per Klick auf Stich-Stapel — `letzterStichOverlay`) und Bug #8 (Spielansage-Flash-Banner bei Spieltyp-Wechsel NORMALSPIEL→Solo/Hochzeit/Armut — `ermittleSpielankuendigung`/`zeigeSpielankuendigung` in TischSzene.ts) implementiert und committed. data-testids `tischszene`, `vorbehalt-overlay`, `floating-action-bar`, `rundenauswertung-overlay`, `btn-rundenauswertung-weiter` gesetzt. E2E-Tests (`partie-gegen-ki.spec.ts`, `rundenauswertung.spec.ts`) teilweise umgestellt. **Nächster Schritt: Task 8 (E2E-Tests stabilisieren)** vor Task 9 (Animationen-Rest) — KI-Timing (800ms/Karte) macht `rundenauswertung.spec.ts` noch instabil.
Offene Fragen: `rundenauswertung.spec.ts` Schleife bei rein-KI-Stichen noch nicht stabil.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## 1. Spielregeln-Felder erweitern (Backend-Blocker)

> **Blockiert:** 2, 3, 4, 5 — alle Sonderregeln benötigen diese Felder.

- [x] **1.1** `Spielregeln` record um 3 Felder erweitern: `bockrundenAktiv`, `schweinchenAktiv`, `dreissigAugenPflichtAktiv`
- [x] **1.2** `TischkonfigurationEmbeddable` um 3 korrespondierende Felder erweitern + `alsSpielregeln()` anpassen
- [x] **1.3** Liquibase-Migration: 3 neue `BOOLEAN NOT NULL DEFAULT FALSE`-Spalten in `tisch`-Tabelle (Changeset 005)
- [x] **1.4** Frontend `TischKonfigurationDto` in `SpielverwaltungDto.ts` um 3 neue Felder erweitert
- [x] **1.5** Bestehende Tests angepasst (`TischControllerTest`, `AppStore.test.ts`, `TischAnsichtModell.test.ts`, `TischSzene.test.ts`)

---

## 2. Bockrunden (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/bockrunden.md`

- [x] **2.1** `Partie`: Feld `bockrundenZaehler: int` hinzufügen, in Konstruktor und `neu()` mitführen
  - Datei: `src/main/java/de/locodoko/partie/Partie.java`
- [x] **2.2** Liquibase-Migration: `bockrunden_zaehler INTEGER NOT NULL DEFAULT 0` in `partie`-Tabelle
- [x] **2.3** Trigger-Erkennung "Herz durchgegangen": `Spiel.hatHerzDurchgegangenenStich()` — prüft ob ein Stich nur Fehlherz enthält (kein Trumpf per TrumpfOrdnung)
- [x] **2.4** Trigger-Erkennung "verlorenes Kontra": `ergebnis.siegerPartei() == RE && ansagen.hatGrundansage(KONTRA)`
- [x] **2.5** `Partie.schliesseAktuellesSpielAb()`: Trigger prüfen → Zähler erhöhen → wenn Zähler > 0: Spielpunkte × 2 → Zähler -1 → in neue Partie-Instanz übernehmen
- [x] **2.6** Persistenz: `bockrundenZaehler` in `PartieEntity` + `KiOrchestrierungService.schliesseSpielAbUndStarteNaechstes()`
- [x] **2.7** Unit-Tests: Multiplikation+Dekrementierung, beide Trigger einzeln+kombiniert, Deaktivierung

---

## 3. Schweinchen (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/schweinchen.md`

- [x] **3.1** `SchweinchenTrumpfOrdnung`: Decorator/Unterklasse von `NormaleTrumpfOrdnung` — Karo-As exemplarIndex 1 → Rang 14, exemplarIndex 2 → Rang 15, `spaetereGleicheKarteGewinnt(Karte)` = true für Karo-As
  - Neuer Typ in `src/main/java/de/locodoko/karten/`
- [x] **3.2** Schweinchen-Erkennung in `Spiel.teileKartenAus()`: prüfe ob ein Spieler beide Karo-Asse hält + Spieltyp NORMALSPIEL + Regel aktiv → ersetze `trumpfOrdnung` durch `SchweinchenTrumpfOrdnung`
- [x] **3.3** Solo-Ausschluss: Schweinchen nur bei NORMALSPIEL (nicht bei SOLO_DAME, SOLO_BUBE, SOLO_FLEISCHLOS, Hochzeit, Armut, SOLO_TRUMPF)
- [x] **3.4** Unit-Tests: Trumpfrang mit/ohne Schweinchen, zweites Schweinchen schlägt erstes, Solo-Ausschluss, Deaktivierung

---

## 4. Dreißig-Augen-Pflicht (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/dreissig-augen-pflicht.md` | **Priorität: Hoch**

- [x] **4.1** `Spiel`: Feld `pflichtansageAusstehend: Set<Partei>` hinzufügen (leer = kein Block)
  - Datei: `src/main/java/de/locodoko/partie/Spiel.java`
- [x] **4.2** Prüfung in `Spiel.spieleKarte()` nach vollständigem 1./2. Stich: wenn `stich.augen() > 30` und betroffene Partei noch kein Re/Kontra → Pflichtansage-Set füllen
- [x] **4.3** Blockierung in `spieleKarte()`: wenn `pflichtansageAusstehend` nicht leer → Exception werfen
- [x] **4.4** `Ansagen.kannAnsagen()`: separater Pfad für Pflichtansagen — Mindestkartenanzahl ignorieren
- [x] **4.5** Solo-Ausschluss: Nur Normalspiel und Hochzeit
- [x] **4.6** Persistenz: `pflichtansageAusstehend` im Spiel-Entity mitspeichern
- [x] **4.7** Unit-Tests: Blockierung+Entsperrung, Solo-Ausschluss, Stich 3+ kein Trigger, Deaktivierung

---

## 5. Solo-Nachgeben (Backend)

> **Blockiert von:** nichts | **Spec:** `specs/spielablauf.md` Zeilen 90-91, 101 | **TODO im Code:** `Partie.java:115-119`

- [x] **5.1** `Partie.schliesseAktuellesSpielAb()`: Wenn Spiel ein Solo war (`parteien.spielerVon(RE).size() == 1`), `naechsterGeber = spiel.geber()` statt `spiel.geber().naechsteImUhrzeigersinn()`
- [x] **5.2** Solist-Anspielrecht: Partie merkt sich Solist, `starteNaechstesSpiel()` → `Spiel.neuMitSolistAufspieler()` → `loeseVorbehalteAuf()` nutzt `solistAufspieler` für ersten Stich
- [x] **5.3** Gleiche Logik in `KiOrchestrierungService.java` angepasst
- [x] **5.4** Persistenz: `solist_des_letzten_spiels` Spalte in `partie`-Tabelle (nullable VARCHAR), Changeset 009
- [x] **5.5** Unit-Tests: Geber bleibt nach Solo gleich, Solist spielt auf, normales Spiel rotiert weiter

---

## 6. Regelkatalog-Presets (Backend + Frontend)

> **Blockiert von:** 1 (Spielregeln-Felder für Bockrunden/Schweinchen/30AP) | **Spec:** `specs/regelkatalog.md`

- [x] **6.1** Backend: `Spielregeln.locoBlatRegeln()` — statische Factory-Methode mit allen Werten aus Spec
- [x] **6.2** Backend: `Spielregeln.dkvRegeln()` — ohne Bockrunden/Schweinchen/30AP
- [x] **6.3** Backend: `Spielregeln.ohneNeunenLocoBlatRegeln()` — wie Loco Blatt mit `ohneNeunen=true`
- [x] **6.4** Backend: Unit-Tests für alle Factory-Methoden
- [x] **6.5** Frontend: `regelPresets.ts` mit TypeScript-Konstanten für die 3 Presets
- [x] **6.6** Frontend: Preset-Dropdown im Tisch-Konfigurations-Modal (SpielverwaltungsSzene.ts)
  - Bei Preset-Wechsel: alle Felder automatisch vorbelegen
  - "Benutzerdefiniert": alle Felder editierbar
  - Andere Presets: Felder schreibgeschützt sichtbar

---

## 7. Frontend-Bug: Szenen-Name (Quick Fix)

> **Blockiert von:** nichts | **Priorität: Hoch** (verhindert Rückkehr zur Lobby)

- [x] **7.1** `TischSzene.ts:396` und `TischSzene.ts:619`: `'LobbySzene'` → `'SpielverwaltungsSzene'`
- [x] **7.2** `TischSzene.ts:430` und `AppStore.ts:269`: Kommentare aktualisieren (LobbySzene → SpielverwaltungsSzene)

---

## 8. E2E-Tests stabilisieren und erweitern

> **Nächster Schritt** | **Spec:** `specs/e2e-tests.md` | **Hinweis:** KI-Karten-Delay (800ms/Karte in STICHPHASE) erfordert `playwright.config.ts timeout: 300_000` und ausreichende Wartezeiten in den Testschleifen

- [~] **8.1** `partie-gegen-ki.spec.ts`: data-testid-Selektoren, TypeScript-Helper (`warteAufPhase`, `warteAufEigenenZug`, `bridge`) und KI-Timing-Wartezeiten — weitgehend umgestellt
- [~] **8.2** `rundenauswertung.spec.ts`: Vorbehalt → alle Stiche spielen → Overlay prüfen → Enter schließen — implementiert, aber Schleife bei rein-KI-Stichen (kein eigener Zug in einem `waitForFunction`-Durchlauf) noch instabil
- [ ] **8.3** Beide Tests lokal grün gegen `mvn spring-boot:run` verifizieren

---

## 9. Frontend-Animationen: Stich-Visualisierung

> **Setzt voraus:** Task 8 (E2E grün) | **Spec:** `specs/frontend-animationen.md` DoD, `specs/frontend-tischansicht.md` Abschnitt "Stich-Stapel beim Gewinner"

- [ ] **9.1** Gewinn-Flash: Nameplate des Stichgewinners leuchtet kurz auf (Phaser-Tween, ~300ms Glow-Effekt)
- [ ] **9.2** Stich-Stapel: Karten landen sichtbar auf Stapel beim Gewinner (nicht nur Zähler, sondern gestapelter Fächer)
- [x] **9.3** Letzter-Stich-Flip: Klick auf eigenen Stapel oder Taste deckt 4 Karten des letzten Stichs auf (implementiert — Bug #7, `letzterStichOverlay` in TischSzene.ts)
- [ ] **9.4** Stichmitte: Karten „leicht überlappend und minimal rotiert" gemäß Spec — aktuell lineare Positionierung ohne Rotation
- [ ] **9.5** Visuelles Review nach Umsetzung (Vision Loop)

---

## 10. Rundenauswertungs-Overlay (Frontend)

> **Status: Größtenteils implementiert** | **Spec:** `specs/frontend-rundenauswertung.md`

- [x] **10.1** Rundenauswertungs-Overlay implementiert: Kopfzeile (Spieltyp + Spielnummer), Ergebnis-Zeile (Gewinner-Partei + Punkte), Weiter-Button
- [x] **10.2** Backend-Felder ausreichend — keine Erweiterung von `LetztesSpielergebnisAnsicht` / `TischAnsichtModell` nötig
- [ ] **10.3** Partie-Ende-Overlay: Gesamtauswertung nach letztem Spiel (Tabelle mit Endstand, Gewinner, Neustart-Countdown)
- [x] **10.4** Keyboard: Enter schließt Overlay / Escape wird ignoriert
- [x] **10.5** `data-testid="rundenauswertung-overlay"` und `data-testid="btn-rundenauswertung-weiter"` gesetzt
- [ ] **10.6** Visuelles Review (Vision Loop)

---

## 11. data-testid-Attribute (Frontend)

> **Spec:** `specs/e2e-tests.md` Abschnitt "data-testid-Attribute"

Bereits gesetzt (11): `input-tischname`, `btn-tisch-erstellen`, `hud-stichzaehler`, `hud-spieltyp`, `btn-spiel-starten`, `hud-btn-einstellungen`, `tischszene`, `vorbehalt-overlay`, `floating-action-bar`, `rundenauswertung-overlay`, `btn-rundenauswertung-weiter`

Fehlend (6):
- [ ] **11.1** `startscreen` — Wurzel-Container der SpielverwaltungsSzene
- [ ] **11.2** `btn-neuer-tisch` — „+ Neuen Tisch erstellen"-Button
- [ ] **11.3** `btn-offene-tische` — „Offene Tische"-Button
- [ ] **11.4** `btn-session-recovery` — „Zurück zu [Tischname]"-Button (wenn vorhanden)
- [ ] **11.5** `tisch-config-modal` — Konfigurations-Modal-Container
- [ ] **11.6** `einstellungen-modal` — Einstellungs-Modal

---

## Architektur-Notizen

- **Phaser vs. HTML**: Spielaktions-UI (Vorbehalt, Armut, Kartenspiel) in Phaser. Meta-UI (Modals, Konfiguration, Einstellungen) als HTML-DOM über `#ui-root`.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
- **Tech-Migration**: Spring Data JDBC + Liquibase + Java 25 + Spring Boot 4.x bereits abgeschlossen (specs/tech-migration.md).

---

## Erledigte Aufgaben (Referenz)

<details>
<summary>Aufklappen für abgeschlossene Items</summary>

### Vollständig implementiert und getestet (Specs bestätigt)

- [x] Lobby/Tisch: Tischverwaltung, Matchmaking, KI-Auffüllung, WebSocket-Updates
- [x] Stichlogik: Bedienpflicht, Stichgewinner-Ermittlung, Augen-Zählung
- [x] Trumpfhierarchie: Normal + alle Solo-Varianten
- [x] Kartendeck: 48/40 Karten, Augen-Werte, Mischen/Verteilen
- [x] Punkteberechnung: Augen-Summe, Sieger, Ansage-Verdoppelung, Sonderpunkte
- [x] Ansagen: Re/Kontra, Verschärfungen, Mindestkartenanzahl
- [x] Sonderpunkte: Fuchs, Karlchen, Doppelkopf
- [x] Spieler-Session: HTTP-Session, Cookies, Timeout, Cleanup
- [x] WebSocket: STOMP/SockJS, Session-Validierung, Fehlerbehandlung
- [x] REST-API: Alle Endpoints implementiert
- [x] Verbindungsabbruch: Disconnect-Erkennung, KI-Übernahme, Reconnect
- [x] Hochzeit: Erkennung, Partnersuche, Stilles Solo
- [x] Armut: Erkennung, Kartentausch, Einwurf
- [x] Solo-Varianten: Alle 7 Typen (Trumpf, Dame, Bube, Fleischlos, Herz/Pik/Kreuz)
- [x] KI-Strategie: Standard/Leicht/Schwer, Solo-Bewertung, Ansage-Logik
- [x] Datenbankmodell: Spring Data JDBC + Liquibase
- [x] Frontend-Logging: Logger-Utility, globaler Error-Handler
- [x] Frontend-Tastatursteuerung: Alle Shortcuts (R/K/1-5/A/N/I/S + Arrow/Enter/Space/Escape)
- [x] Frontend-UI-Logik: Spielaktions-UI in Phaser, Meta-UI als HTML-DOM
- [x] Frontend-Animationen (Basis): Karte ausspielen, Stich einziehen, Austeilen, Ansage-Banner, Geschwindigkeit
- [x] Frontend-Startscreen: SpielverwaltungsSzene (Quick Game, Tisch-Erstellung, Tischliste, Session-Recovery)
- [x] Frontend-Tischansicht (Basis): HUD, Nameplates, vectorized-playing-cards, Floating Action Bar, Seitenlade, Einstellungs-Modal
- [x] Frontend-Visuelles Design: Neo-Brutalism, Farbpalette, Typografie, Tischhintergrund-Auswahl

</details>
