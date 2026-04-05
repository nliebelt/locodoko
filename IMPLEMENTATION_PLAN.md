# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-05 (Plan-Run #29)

## Notiz

**2026-04-05 (Plan-Run #30):** Task 7 (Szenen-Namensbug) erledigt — `'LobbySzene'` in TischSzene.ts und AppStore.ts durch `'SpielverwaltungsSzene'` ersetzt. Rückkehr zur Lobby funktioniert jetzt.
Nächster logischer Schritt: Task 1 (Spielregeln-Felder erweitern) — blockiert Tasks 2, 3, 4, 6.
Offene Fragen: keine.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## 1. Spielregeln-Felder erweitern (Backend-Blocker)

> **Blockiert:** 2, 3, 4, 5 — alle Sonderregeln benötigen diese Felder.

- [ ] **1.1** `Spielregeln` record um 3 Felder erweitern: `bockrundenAktiv`, `schweinchenAktiv`, `dreissigAugenPflichtAktiv`
  - Datei: `src/main/java/de/locodoko/karten/Spielregeln.java`
  - Bestehende `standardRegeln()` Factory-Methode anpassen (alle 3 auf `false` setzen für Abwärtskompatibilität)
  - Compact-Constructor-Validierung nicht nötig (booleans)
- [ ] **1.2** `TischkonfigurationEmbeddable` um 3 korrespondierende Felder erweitern + `alsSpielregeln()` anpassen
  - Datei: `src/main/java/de/locodoko/lobby/TischkonfigurationEmbeddable.java`
- [ ] **1.3** Liquibase-Migration: 3 neue `BOOLEAN NOT NULL DEFAULT FALSE`-Spalten in `tisch_konfiguration`
  - Neue Changeset-Datei unter `src/main/resources/db/changelog/`
- [ ] **1.4** Frontend `TischAnsichtModell` / API-DTOs anpassen falls nötig, damit die neuen Felder im Konfigurations-Modal sichtbar werden
- [ ] **1.5** Bestehende Tests anpassen (Spielregeln-Konstruktoraufrufe erweitern)

---

## 2. Bockrunden (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/bockrunden.md`

- [ ] **2.1** `Partie`: Feld `bockrundenZaehler: int` hinzufügen, in Konstruktor und `neu()` mitführen
  - Datei: `src/main/java/de/locodoko/partie/Partie.java`
- [ ] **2.2** Liquibase-Migration: `bockrunden_zaehler INTEGER NOT NULL DEFAULT 0` in `partie`-Tabelle
- [ ] **2.3** Trigger-Erkennung "Herz durchgegangen": Hilfsmethode auf `Spiel` — prüft ob ein Stich nur Fehlherz enthält (Herz-As/König, kein Trumpf per TrumpfOrdnung)
- [ ] **2.4** Trigger-Erkennung "verlorenes Kontra": `ergebnis.siegerPartei() == RE && ansagen.hatGrundansage(KONTRA)`
- [ ] **2.5** `Partie.schliesseAktuellesSpielAb()`: Nach Spielergebnis-Berechnung Trigger prüfen → Zähler erhöhen → wenn Zähler > 0: Spielpunkte × 2 anwenden (außerhalb des Spielergebnis-Objekts) → Zähler -1 → in neue Partie-Instanz übernehmen
- [ ] **2.6** Persistenz-Adapter: `bockrundenZaehler` lesen/schreiben in `SpielPersistenzAdapter`
- [ ] **2.7** Unit-Tests: Multiplikation+Dekrementierung, beide Trigger einzeln+kombiniert, Deaktivierung

---

## 3. Schweinchen (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/schweinchen.md`

- [ ] **3.1** `SchweinchenTrumpfOrdnung`: Decorator/Unterklasse von `NormaleTrumpfOrdnung` — Karo-As exemplarIndex 1 → Rang 14, exemplarIndex 2 → Rang 15, `spaetereGleicheKarteGewinnt(Karte)` = true für Karo-As
  - Neuer Typ in `src/main/java/de/locodoko/karten/`
- [ ] **3.2** Schweinchen-Erkennung in `Spiel.teileKartenAus()` oder `loeseVorbehalteAuf()`: prüfe ob ein Spieler beide Karo-Asse hält + Spieltyp NORMALSPIEL + Regel aktiv → ersetze `trumpfOrdnung` durch `SchweinchenTrumpfOrdnung`
- [ ] **3.3** Solo-Ausschluss: Schweinchen nur bei NORMALSPIEL (nicht bei SOLO_DAME, SOLO_BUBE, SOLO_FLEISCHLOS, Hochzeit, Armut)
  - **Spec-Korrektur nötig:** Spec Punkt 5 sagt "nur NORMALSPIEL", aber technischer Hinweis sagt "NORMALSPIEL oder SOLO_TRUMPF". Die Spec-Tabelle in `regelkatalog.md` Loco-Blatt hat `schweinchenAktiv: true` — für Trumpfsoli wäre Schweinchen sinnvoll. **Entscheidung: Spec-Text in schweinchen.md Punkt 5 folgen (nur NORMALSPIEL)**, da Punkt 5 die explizite Anforderung ist.
- [ ] **3.4** Unit-Tests: Trumpfrang mit/ohne Schweinchen, zweites Schweinchen schlägt erstes, Solo-Ausschluss, Deaktivierung

---

## 4. Dreißig-Augen-Pflicht (Backend)

> **Blockiert von:** 1 (Spielregeln-Felder) | **Spec:** `specs/dreissig-augen-pflicht.md` | **Priorität: Hoch**

- [ ] **4.1** `Spiel`: Feld `pflichtansageAusstehend: Set<Partei>` hinzufügen (leer = kein Block)
  - Datei: `src/main/java/de/locodoko/partie/Spiel.java`
- [ ] **4.2** Prüfung in `Spiel.spieleKarte()` nach vollständigem 1./2. Stich: wenn `stich.augen() > 30` und betroffene Partei noch kein Re/Kontra → Pflichtansage-Set füllen
- [ ] **4.3** Blockierung in `spieleKarte()`: wenn `pflichtansageAusstehend` nicht leer → Exception werfen
- [ ] **4.4** `Ansagen.kannAnsagen()`: separater Pfad für Pflichtansagen — Mindestkartenanzahl ignorieren
- [ ] **4.5** Solo-Ausschluss: Nur Normalspiel und Hochzeit
- [ ] **4.6** Persistenz: `pflichtansageAusstehend` im Spiel-Entity mitspeichern
- [ ] **4.7** Unit-Tests: Blockierung+Entsperrung, Solo-Ausschluss, Stich 3+ kein Trigger, Deaktivierung

---

## 5. Solo-Nachgeben (Backend)

> **Blockiert von:** nichts | **Spec:** `specs/spielablauf.md` Zeilen 90-91, 101 | **TODO im Code:** `Partie.java:115-119`

- [ ] **5.1** `Partie.schliesseAktuellesSpielAb()`: Wenn Spiel ein Solo war (`parteien.spielerVon(RE).size() == 1`), `naechsterGeber = spiel.geber()` statt `spiel.geber().naechsteImUhrzeigersinn()`
  - Datei: `src/main/java/de/locodoko/partie/Partie.java:120-123`
- [ ] **5.2** Solist-Anspielrecht: Partie muss den Solisten merken (neues Feld `solistDesLetztenSpiels: SpielerPosition`) und in `starteNaechstesSpiel()` an `Spiel.neu()` als Aufspieler übergeben → `Stich.neu(solistPosition)` statt `geber.naechsteImUhrzeigersinn()`
- [ ] **5.3** Gleiche Logik in `KiOrchestrierungService.java:171` anpassen
- [ ] **5.4** Persistenz: `solist_position` Spalte in `partie`-Tabelle (nullable VARCHAR)
- [ ] **5.5** Unit-Tests: Geber bleibt nach Solo gleich, Solist spielt auf, normales Spiel rotiert weiter

---

## 6. Regelkatalog-Presets (Backend + Frontend)

> **Blockiert von:** 1 (Spielregeln-Felder für Bockrunden/Schweinchen/30AP) | **Spec:** `specs/regelkatalog.md`

- [ ] **6.1** Backend: `Spielregeln.locoBlatRegeln()` — statische Factory-Methode mit allen Werten aus Spec
- [ ] **6.2** Backend: `Spielregeln.dkvRegeln()` — ohne Bockrunden/Schweinchen/30AP
- [ ] **6.3** Backend: `Spielregeln.ohneNeunenLocoBlatRegeln()` — wie Loco Blatt mit `ohneNeunen=true`
- [ ] **6.4** Backend: Unit-Tests für alle Factory-Methoden
- [ ] **6.5** Frontend: `regelPresets.ts` mit TypeScript-Konstanten für die 3 Presets
- [ ] **6.6** Frontend: Preset-Dropdown im Tisch-Konfigurations-Modal (SpielverwaltungsSzene.ts)
  - Bei Preset-Wechsel: alle Felder automatisch vorbelegen
  - "Benutzerdefiniert": alle Felder editierbar
  - Andere Presets: Felder schreibgeschützt sichtbar

---

## 7. Frontend-Bug: Szenen-Name (Quick Fix)

> **Blockiert von:** nichts | **Priorität: Hoch** (verhindert Rückkehr zur Lobby)

- [x] **7.1** `TischSzene.ts:396` und `TischSzene.ts:619`: `'LobbySzene'` → `'SpielverwaltungsSzene'`
- [x] **7.2** `TischSzene.ts:430` und `AppStore.ts:269`: Kommentare aktualisieren (LobbySzene → SpielverwaltungsSzene)

---

## 8. Frontend-Animationen: Stich-Visualisierung

> **Blockiert von:** nichts | **Spec:** `specs/frontend-animationen.md` DoD Zeilen 87-90, `specs/frontend-tischansicht.md` Abschnitt "Stich-Stapel beim Gewinner"

- [ ] **8.1** Gewinn-Flash: Nameplate des Stichgewinners leuchtet kurz auf (Phaser-Tween, ~300ms Glow-Effekt)
- [ ] **8.2** Stich-Stapel: Karten landen sichtbar auf Stapel beim Gewinner (nicht nur Zähler, sondern gestapelter Fächer)
- [ ] **8.3** Letzter-Stich-Flip: Klick auf eigenen Stapel oder Taste deckt 4 Karten des letzten Stichs auf (Flip-Animation bereits teilweise vorhanden als `letzterStichOverlay`)
- [ ] **8.4** Stichmitte: Karten "leicht überlappend und minimal rotiert" gemäß Spec — aktuell lineare Positionierung ohne Rotation
- [ ] **8.5** Visuelles Review nach Umsetzung (Vision Loop)

---

## 9. Rundenauswertungs-Overlay (Frontend)

> **Blockiert von:** nichts (Backend liefert bereits Spielergebnis) | **Spec:** `specs/frontend-rundenauswertung.md` | **Status: Neu**

- [ ] **9.1** Bestehendes `rundenEndeModal` in `TischSzene.ts` erweitern:
  - Kopfzeile: Spieltyp + Spielnummer
  - Ergebnis-Zeile: Gewinner-Partei in Akzentfarbe + Punkte
  - Parteien-Übersicht: RE links, KONTRA rechts, Spielernamen + Augenzahl
  - Punkte-Berechnung: Jede Regel einzeln aufgelistet (Grundwert, Ansagen, Solo-Multiplikator)
  - Sonderpunkte: Bedingt sichtbar (Fuchs, Karlchen, Doppelkopf)
  - Gesamtstand: Aktueller Partie-Punktestand
- [ ] **9.2** Backend: `LetztesSpielergebnisAnsicht` / `TischAnsichtModell` um fehlende Felder erweitern falls nötig (Einzelschritte der Punkteberechnung, Sonderpunkte-Details)
- [ ] **9.3** Partie-Ende-Overlay: Gesamtauswertung nach letztem Spiel (Tabelle mit Endstand, Gewinner, Neustart-Countdown)
- [ ] **9.4** Keyboard: Enter schließt Overlay / Escape wird ignoriert
- [ ] **9.5** `data-testid="rundenauswertung-overlay"` und `data-testid="btn-rundenauswertung-weiter"` setzen
- [ ] **9.6** Visuelles Review (Vision Loop)

---

## 10. data-testid-Attribute (Frontend)

> **Blockiert:** 11 (E2E-Tests) | **Spec:** `specs/e2e-tests.md` Abschnitt "data-testid-Attribute"

Bereits gesetzt (6): `input-tischname`, `btn-tisch-erstellen`, `hud-stichzaehler`, `hud-spieltyp`, `btn-spiel-starten`, `hud-btn-einstellungen`

Fehlend (10):
- [ ] **10.1** `startscreen` — Wurzel-Container der SpielverwaltungsSzene
- [ ] **10.2** `btn-neuer-tisch` — "+ Neuen Tisch erstellen"-Button
- [ ] **10.3** `btn-offene-tische` — "Offene Tische"-Button
- [ ] **10.4** `btn-session-recovery` — "Zurück zu [Tischname]"-Button
- [ ] **10.5** `tisch-config-modal` — Konfigurations-Modal-Container
- [ ] **10.6** `tischszene` — TischSzene Wurzel-Container
- [ ] **10.7** `einstellungen-modal` — Einstellungs-Modal
- [ ] **10.8** `vorbehalt-overlay` — Vorbehalt-Overlay
- [ ] **10.9** `floating-action-bar` — Floating Action Bar
- [ ] **10.10** `rundenauswertung-overlay` + `btn-rundenauswertung-weiter` — siehe Task 9.5

---

## 11. E2E-Tests aktualisieren

> **Blockiert von:** 10 (data-testid), 9 (Rundenauswertung) | **Spec:** `specs/e2e-tests.md`

- [ ] **11.1** `partie-gegen-ki.spec.ts`: Auf data-testid-Selektoren und Tastatursteuerung umstellen (alte Button-Text-Selektoren entfernen)
- [ ] **11.2** `rundenauswertung.spec.ts`: Komplett implementieren gemäß Spec Testfall 2 (alle Karten per Enter spielen, Rundenauswertungs-Overlay prüfen)
- [ ] **11.3** Beide Tests lokal grün gegen `mvn spring-boot:run` verifizieren

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
