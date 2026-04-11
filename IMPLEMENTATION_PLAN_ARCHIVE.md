# IMPLEMENTATION_PLAN — Archiv erledigter Aufgaben

> Aus `IMPLEMENTATION_PLAN.md` ausgelagert am 2026-04-11.
> Vollständig implementiert und getestet. Nur zur Referenz.

---

## Vollständig implementierte Features (Specs bestätigt)

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

---

## 1. Spielregeln-Felder erweitern

- [x] **1.1** `Spielregeln` record um 3 Felder erweitern: `bockrundenAktiv`, `schweinchenAktiv`, `dreissigAugenPflichtAktiv`
- [x] **1.2** `TischkonfigurationEmbeddable` um 3 korrespondierende Felder + `alsSpielregeln()` anpassen
- [x] **1.3** Liquibase-Migration: 3 neue `BOOLEAN NOT NULL DEFAULT FALSE`-Spalten in `tisch`-Tabelle (Changeset 005)
- [x] **1.4** Frontend `TischKonfigurationDto` in `SpielverwaltungDto.ts` um 3 neue Felder erweitert
- [x] **1.5** Bestehende Tests angepasst (`TischControllerTest`, `AppStore.test.ts`, `TischAnsichtModell.test.ts`, `TischSzene.test.ts`)

---

## 2. Bockrunden

- [x] **2.1** `Partie`: Feld `bockrundenZaehler: int` hinzufügen
- [x] **2.2** Liquibase-Migration: `bockrunden_zaehler INTEGER NOT NULL DEFAULT 0`
- [x] **2.3** Trigger: `Spiel.hatHerzDurchgegangenenStich()`
- [x] **2.4** Trigger: verlorenes Kontra
- [x] **2.5** `Partie.schliesseAktuellesSpielAb()`: Trigger → Zähler → Multiplikation
- [x] **2.6** Persistenz: `bockrundenZaehler` in `PartieEntity`
- [x] **2.7** Unit-Tests: Multiplikation, Trigger, Deaktivierung

---

## 3. Schweinchen

- [x] **3.1** `SchweinchenTrumpfOrdnung`: Karo-As bekommt höheren Rang
- [x] **3.2** Schweinchen-Erkennung in `Spiel.teileKartenAus()`
- [x] **3.3** Solo-Ausschluss
- [x] **3.4** Unit-Tests

---

## 4. Dreißig-Augen-Pflicht

- [x] **4.1** `Spiel`: Feld `pflichtansageAusstehend: Set<Partei>`
- [x] **4.2** Prüfung nach 1./2. Stich
- [x] **4.3** Blockierung in `spieleKarte()`
- [x] **4.4** `Ansagen.kannAnsagen()`: Pflichtansagen-Pfad
- [x] **4.5** Solo-Ausschluss
- [x] **4.6** Persistenz
- [x] **4.7** Unit-Tests

---

## 5. Solo-Nachgeben

- [x] **5.1** Geber bleibt nach Solo gleich
- [x] **5.2** Solist-Anspielrecht: `Spiel.neuMitSolistAufspieler()`
- [x] **5.3** `KiOrchestrierungService` angepasst
- [x] **5.4** Persistenz: `solist_des_letzten_spiels` (Changeset 009)
- [x] **5.5** Unit-Tests

---

## 6. Regelkatalog-Presets

- [x] **6.1** `Spielregeln.locoBlatRegeln()`
- [x] **6.2** `Spielregeln.dkvRegeln()`
- [x] **6.3** `Spielregeln.ohneNeunenLocoBlatRegeln()`
- [x] **6.4** Unit-Tests
- [x] **6.5** Frontend: `regelPresets.ts`
- [x] **6.6** Frontend: Preset-Dropdown im Konfigurations-Modal

---

## 7. Frontend-Bug: Szenen-Name

- [x] **7.1** `'LobbySzene'` → `'SpielverwaltungsSzene'` (2 Stellen)
- [x] **7.2** Kommentare aktualisiert

---

## 8. E2E-Tests (Teilweise)

- [~] **8.1** `partie-gegen-ki.spec.ts`: data-testid-Selektoren, Helper, KI-Timing — weitgehend umgestellt
- [x] **8.2** `rundenauswertung.spec.ts`: Schleife stabilisiert (`timeout: 4_000, polling: 200`)

---

## 9. Frontend-Animationen (erledigte Teilaufgaben)

- [x] **9.1** Gewinn-Flash: Nameplate des Stichgewinners leuchtet auf
- [x] **9.2** Stich-Stapel: gestapelter Fächer beim Gewinner
- [x] **9.3** Letzter-Stich-Flip: Klick/Taste deckt 4 Karten auf
- [x] **9.4** Stichmitte: Karten leicht überlappend und minimal rotiert

---

## 10. Rundenauswertungs-Overlay (erledigte Teilaufgaben)

- [x] **10.1** Overlay implementiert: Kopfzeile, Ergebnis, Weiter-Button
- [x] **10.2** Backend-Felder ausreichend
- [x] **10.3** Partie-Ende-Overlay mit Gesamtauswertung + Countdown
- [x] **10.4** Keyboard: Enter schließt, Escape ignoriert
- [x] **10.5** `data-testid="rundenauswertung-overlay"` und `data-testid="btn-rundenauswertung-weiter"` gesetzt

---

## 11. data-testid-Attribute

- [x] `startscreen`, `btn-neuer-tisch`, `btn-offene-tische`, `btn-session-recovery`
- [x] `tisch-config-modal`, `input-tischname`, `btn-tisch-erstellen`
- [x] `tischszene`, `hud-stichzaehler`, `hud-spieltyp`, `hud-btn-einstellungen`
- [x] `einstellungen-modal`, `btn-spiel-starten`
- [x] `vorbehalt-overlay`, `floating-action-bar`
- [x] `rundenauswertung-overlay`, `btn-rundenauswertung-weiter`
