# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-05 (Plan-Run #33)

## Notiz

**2026-04-06 (Plan-Run #36):** Task 6 (Regelkatalog-Presets) vollständig erledigt — `Spielregeln.locoBlatRegeln()` (alle Sonderregeln aktiv), `Spielregeln.dkvRegeln()` (ohne Bockrunden/Schweinchen/30AP), `Spielregeln.ohneNeunenLocoBlatRegeln()` (wie Loco Blatt + ohneNeunen + angepasste Mindestkarten), `SpielregelnTest.java` (4 neue Tests), `frontend/src/modelle/regelPresets.ts` (TypeScript-Konstanten + `standardMindestkarten()`), `SpielverwaltungsSzene.ts` Konfigurations-Modal um Preset-Dropdown erweitert (Loco Blatt / DKV-Turnier / Ohne Neunen / Benutzerdefiniert) mit dynamischer Regel-Checkbox-Grid (schreibgeschützt für Presets, editierbar für Benutzerdefiniert). 179 Backend-Tests grün, 62 Frontend-Tests grün, Build + Lint sauber.
Nächster logischer Schritt: Task 8 (Frontend-Animationen: Stich-Visualisierung) oder Task 9 (Rundenauswertungs-Overlay).
Offene Fragen: keine.

**2026-04-11 (R0 Typed IDs):** `TischId`, `PartieId`, `SpielId`, `SpielerId` Records in jeweiligen Bounded Contexts angelegt. `TischRepository` (custom) vollständig auf Typed IDs umgestellt; `PartieRepository`, `SpielRepository`, `SpielerRepository` mit typisierten Default-Overload-Methoden erweitert (JDBC-Schicht bleibt UUID-basiert). `TischService`, beide Controller, `WebSocketController`, `VerbindungsabbruchService`, `SpielerSessionCleanupService` und `SpielerSessionService` auf Typed IDs umgestellt. 179 Backend-Tests grün.
Nächster logischer Schritt: **T1** (Hochzeit Unit-Tests) — unabhängig, kritisch (0 Unit-Tests vorhanden). Danach **R1** (SpielBuilder) als nächster R-Task.
Offene Fragen: keine.

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
- [x] **8.2** `rundenauswertung.spec.ts`: Vorbehalt → alle Stiche spielen → Overlay prüfen → Enter schließen — Schleife stabilisiert: `timeout: 4_000, polling: 200` statt `timeout: 30_000`; Limit 60 statt 30
- [ ] **8.3** Beide Tests lokal grün gegen `mvn spring-boot:run` verifizieren

---

## 9. Frontend-Animationen: Stich-Visualisierung

> **Setzt voraus:** Task 8 (E2E grün) | **Spec:** `specs/frontend-animationen.md` DoD, `specs/frontend-tischansicht.md` Abschnitt "Stich-Stapel beim Gewinner"

- [x] **9.1** Gewinn-Flash: Nameplate des Stichgewinners leuchtet kurz auf (Phaser-Tween, ~300ms Glow-Effekt)
- [x] **9.2** Stich-Stapel: Karten landen sichtbar auf Stapel beim Gewinner (nicht nur Zähler, sondern gestapelter Fächer)
- [x] **9.3** Letzter-Stich-Flip: Klick auf eigenen Stapel oder Taste deckt 4 Karten des letzten Stichs auf (implementiert — Bug #7, `letzterStichOverlay` in TischSzene.ts)
- [x] **9.4** Stichmitte: Karten „leicht überlappend und minimal rotiert" gemäß Spec — aktuell lineare Positionierung ohne Rotation
- [ ] **9.5** Visuelles Review nach Umsetzung (Vision Loop)

---

## 10. Rundenauswertungs-Overlay (Frontend)

> **Status: Größtenteils implementiert** | **Spec:** `specs/frontend-rundenauswertung.md`

- [x] **10.1** Rundenauswertungs-Overlay implementiert: Kopfzeile (Spieltyp + Spielnummer), Ergebnis-Zeile (Gewinner-Partei + Punkte), Weiter-Button
- [x] **10.2** Backend-Felder ausreichend — keine Erweiterung von `LetztesSpielergebnisAnsicht` / `TischAnsichtModell` nötig
- [x] **10.3** Partie-Ende-Overlay: Gesamtauswertung nach letztem Spiel (Tabelle mit Endstand, Gewinner, Neustart-Countdown)
- [x] **10.4** Keyboard: Enter schließt Overlay / Escape wird ignoriert
- [x] **10.5** `data-testid="rundenauswertung-overlay"` und `data-testid="btn-rundenauswertung-weiter"` gesetzt
- [ ] **10.6** Visuelles Review (Vision Loop)

---

## 11. data-testid-Attribute (Frontend)

> **Spec:** `specs/e2e-tests.md` Abschnitt "data-testid-Attribute"

Bereits gesetzt (11): `input-tischname`, `btn-tisch-erstellen`, `hud-stichzaehler`, `hud-spieltyp`, `btn-spiel-starten`, `hud-btn-einstellungen`, `tischszene`, `vorbehalt-overlay`, `floating-action-bar`, `rundenauswertung-overlay`, `btn-rundenauswertung-weiter`

Alle gesetzt (17 gesamt):
- [x] **11.1** `startscreen` — Wurzel-Container der SpielverwaltungsSzene
- [x] **11.2** `btn-neuer-tisch` — „+ Neuen Tisch erstellen"-Button
- [x] **11.3** `btn-offene-tische` — „Offene Tische"-Button
- [x] **11.4** `btn-session-recovery` — „Zurück zu [Tischname]"-Button (wenn vorhanden)
- [x] **11.5** `tisch-config-modal` — Konfigurations-Modal-Container
- [x] **11.6** `einstellungen-modal` — Einstellungs-Modal

---

## Architektur-Notizen

- **Phaser vs. HTML**: Spielaktions-UI (Vorbehalt, Armut, Kartenspiel) in Phaser. Meta-UI (Modals, Konfiguration, Einstellungen) als HTML-DOM über `#ui-root`.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
- **Tech-Migration**: Spring Data JDBC + Liquibase + Java 25 + Spring Boot 4.x bereits abgeschlossen (specs/tech-migration.md).

---

## R — Refactoring: Saubere Multiplayer-Basis

> **Ziel:** Clean Code, keine God-Objects, Domain Events als Fundament für echten Multiplayer.
> **Specs:** `specs/architektur-spielkern.md`, `specs/architektur-domain-events.md`
> **Strategie:** Inkrementell — Tests müssen nach jeder Iteration grün bleiben. Kein Verhalten ändert sich.

### R0. Typed IDs — Primitive Obsession eliminieren

> **Blockiert:** alle anderen R-Tasks profitieren davon | **Spec:** `specs/architektur-spielkern.md` Abschnitt "Typed IDs"

- [x] **R0.1** Records `TischId`, `SpielId`, `PartieId`, `SpielerId` im jeweiligen Bounded Context anlegen — je mit `neu()`, `von(UUID)`, `von(String)` Factory-Methoden
- [x] **R0.2** Entities behalten `UUID id` für JDBC; CrudRepository-Repos erhalten typisierte Default-Overload-Methoden (`findById(PartieId)` etc.) statt Konverter — sauberer und wartbarer
- [x] **R0.3** TischRepository (custom) vollständig auf Typed IDs umgestellt; CrudRepository-Repos mit typisierten Overloads
- [x] **R0.4** TischService, TischController, PartieController, WebSocketController, VerbindungsabbruchService, SpielerSessionCleanupService, SpielerSessionService auf Typed IDs umgestellt
- [x] **R0.5** Alle Tests angepasst und grün (179 Tests)

---

### R1. SpielBuilder (inner class in Spiel.java)

> **Blockiert:** R2, R3, R4 profitieren davon | **Spec:** `specs/architektur-spielkern.md` Abschnitt "SpielBuilder"

- [ ] **R1.1** `SpielBuilder` als `private static inner class` in `Spiel.java` implementieren — Felder entsprechen allen 17 Konstruktor-Parametern, Fluent-API (gibt `this` zurück), `build()` ruft privaten Konstruktor auf
- [ ] **R1.2** `toBuilder()` Instanzmethode in `Spiel` — liefert `SpielBuilder` mit allen aktuellen Feldern vorbelegt
- [ ] **R1.3** Alle Mutationsmethoden (`spieleKarte`, `sageAn`, `meldeVorbehalt`, `teileKartenAus`, `loeseVorbehalteAuf`, `legeArmutTrumpfkarten`, `lehneArmutAb`, `nimmArmutAn`, `werteAus`) auf `toBuilder().…build()` umstellen
- [ ] **R1.4** Factory-Methoden (`neu()`, `neuMitSolistAufspieler()`, `ausPersistiertemStand()`) auf `SpielBuilder` umstellen
- [ ] **R1.5** Alle bestehenden Tests grün — kein Verhalten geändert

### R2. Pflichtansage-Logik DRY

> **Blockiert von:** nichts | **Spec:** `specs/architektur-spielkern.md` Abschnitt "Pflichtansage-Logik DRY"

- [ ] **R2.1** Private Hilfsmethode `effektiveKartenAnzahlFuer(SpielerPosition, Ansage)` in `Spiel.java` extrahieren
- [ ] **R2.2** `kannAnsagen()` und `sageAn()` nutzen die neue Methode — ~20 duplizierte Zeilen entfallen
- [ ] **R2.3** Tests grün

### R3. TischService aufteilen

> **Blockiert von:** nichts | **Spec:** `specs/architektur-spielkern.md` Abschnitt "TischService aufteilen"

- [ ] **R3.1** `TischVerwaltungsService` extrahieren: `tischErstellen()`, `tischLoeschen()`, `konfigurationAendern()`, `spielerBeitreten()`, `kiAuffuellen()`
- [ ] **R3.2** `SpielAktionsService` extrahieren: `karteSpielenFuer()`, `ansageTaetigenFuer()`, `vorbehaltMeldenFuer()`, `spielStarten()`
- [ ] **R3.3** `SpielAktionsService.karteSpielenFuer()` leitet `SpielerPosition` aus Server-Session ab (nicht aus Request-Body) — Übergangslösung: validiert dass gesendete Position mit Session übereinstimmt
- [ ] **R3.4** `TischController` und `PartieController` auf neue Services umstellen
- [ ] **R3.5** Alter `TischService` entfernen
- [ ] **R3.6** Alle Tests anpassen und grün

### R4. KiOrchestrierungService: Domain-Logik zurück in Partie

> **Blockiert von:** R3 | **Spec:** `specs/architektur-spielkern.md` Abschnitt "KiOrchestrierungService"

- [ ] **R4.1** `Partie.schliesseAktuellesSpielAbUndStarteNaechstes(PunkteRechner)` als zentrale Methode — enthält Bockrunden-Trigger, Solist-Geber-Logik, Gesamtpunktestand-Update
- [ ] **R4.2** `KiOrchestrierungService` ruft nur noch: Phase prüfen → `partie.schliesseAb…()` → persistieren → broadcast. Keine Spiellogik im Service.
- [ ] **R4.3** `SpielPersistenzAdapter` wird von `KiOrchestrierungService` entkoppelt — Persistenz läuft durch `SpielAktionsService`
- [ ] **R4.4** Tests für `Partie`-Methode, bestehende KI-Tests grün

### R5. SpielRegistry (In-Memory Spiel-Cache)

> **Blockiert von:** R3, R4 | **Spec:** `specs/architektur-spielkern.md` Abschnitte "SpielRegistry" und "Concurrency"

- [ ] **R5.1** `SpielRegistry` als `@Component` implementieren — `ConcurrentHashMap<UUID, Spiel>` + `ReentrantLock` pro TischId
- [ ] **R5.2** `mitSpielGesperrt(tischId, Function<Spiel, SpielUndErgebnis<T>>)` als zentrale Mutationsmethode
- [ ] **R5.3** `SpielAktionsService` nutzt `SpielRegistry` statt direkt zu lesen/schreiben
- [ ] **R5.4** Bei Server-Start: laufende Spiele aus DB in Registry laden (`SpielPersistenzAdapter.ladeAlleAktiven()`)
- [ ] **R5.5** Tests: Concurrency-Test (zwei simultane Karten-Plays lösen keine Race Condition aus)

### R6. Domain Events + KI als Subscriber

> **Blockiert von:** R3, R4, R5 | **Spec:** `specs/architektur-domain-events.md`

- [ ] **R6.1** Event-Records erstellen: `NaechsterSpielerErwartet`, `StichAbgeschlossen`, `SpielGestartet`, `SpielBeendet`, `VorbehaltErwartet` im Package `de.locodoko.partie.ereignisse`
- [ ] **R6.2** `SpielAktionsService` publisht nach jeder Mutation das passende Event via `ApplicationEventPublisher`
- [ ] **R6.3** `KiEventAdapter` als `@Component`: lauscht auf `NaechsterSpielerErwartet` + `VorbehaltErwartet`, führt KI-Zug aus — alle `if (isKi())`-Verzweigungen aus `SpielAktionsService` entfernen
- [ ] **R6.4** `WebSocketBroadcastAdapter` als `@Component`: lauscht auf Events, sendet Broadcasts — `TischEchtzeitService`-Aufrufe aus `SpielAktionsService` entfernen
- [ ] **R6.5** KI-Delay-Logik konsolidiert in `KiEventAdapter` (eine Stelle statt verstreut)
- [ ] **R6.6** Alle bestehenden Tests grün — Verhalten identisch, nur Verkabelung geändert

### R7. Frontend: TischSzene aufteilen

> **Blockiert von:** nichts (unabhängig vom Backend) | **Spec:** `specs/architektur-spielkern.md` Abschnitt "Dokumentation"

- [ ] **R7.1** `TischInputHandler.ts` extrahieren: alle `verarbeiteTaste*`-Methoden, Keyboard-Listener-Setup
- [ ] **R7.2** `TischUIManager.ts` extrahieren: alle DOM-Methoden (`baueUi`, `aktualisiereTopBar`, alle `renderXxxDom`-Methoden)
- [ ] **R7.3** `TischSzene.ts` delegiert an `TischInputHandler` und `TischUIManager` — Phaser-Lifecycle-Methoden (`create`, `update`, `preload`) bleiben in `TischSzene`
- [ ] **R7.4** TSDoc auf allen neuen Klassen (Klassenebene + öffentliche Methoden)
- [ ] **R7.5** Bestehende Frontend-Tests grün, `npm run build` und `npm run lint` clean

### R8. Frontend: AnimationenService DRY

> **Blockiert von:** nichts | **Spec:** `specs/architektur-spielkern.md` Abschnitt "Dokumentation"

- [ ] **R8.1** Private `animiereTween<T>(targets, properties, config)` Methode in `AnimationenService` — zentrale Promise-Logik für alle Tween-Typen
- [ ] **R8.2** `tweenAlpha`, `tweenZu`, `tweenScale` nutzen `animiereTween` intern — ~60 Zeilen Duplikation entfallen
- [ ] **R8.3** Tests und Lint grün

---

### R9. Augen + Spielpunkte als Value Objects

> **Blockiert von:** R1 (SpielBuilder macht Umbau wartbar) | **Spec:** `specs/architektur-spielkern.md` Abschnitt "Augen + Spielpunkte"

- [ ] **R9.1** `Augen` record in `de.locodoko.karten` — mit `plus()`, `ueberschreitet()`, `mindestens()`, Invariante `wert >= 0`
- [ ] **R9.2** `Spielpunkte` record in `de.locodoko.partie` — mit `mal()`, `plus()`
- [ ] **R9.3** `Stich.augen()` gibt `Augen` zurück statt `int`
- [ ] **R9.4** `Spielergebnis`, `PunkteRechner`, `SonderpunktBewerter` auf `Augen`/`Spielpunkte` umstellen
- [ ] **R9.5** DTOs und API-Antworten geben weiterhin `int` nach außen — Umwandlung im Assembler
- [ ] **R9.6** Alle Tests grün

---

### R10. PunkteRechner — Feature Envy beseitigen

> **Blockiert von:** R1, R9 | **Spec:** `specs/architektur-spielkern.md` Abschnitt "PunkteRechner"

- [ ] **R10.1** `Spiel.werteAus()` ohne Parameter — ruft intern `new PunkteRechner().berechne(...)` auf
- [ ] **R10.2** `PunkteRechner` wird `final class` mit package-private Konstruktor, kein `@Component`
- [ ] **R10.3** Alle `punkteRechner`-Parameter aus `KiOrchestrierungService` und Tests entfernen
- [ ] **R10.4** Tests grün

---

### R11. State Pattern für Spielphase

> **Blockiert von:** R0–R10 vollständig abgeschlossen | **Spec:** `specs/architektur-spielkern.md` Abschnitt "State Pattern"
> **Achtung:** Größte Einzeländerung im Refactoring — erst anpacken wenn alle vorherigen R-Tasks grün sind.

- [ ] **R11.1** `sealed interface SpielPhase` mit Implementierungen: `KartenAusteilen`, `VorbehaltAnsagen`, `VorbehaltAufloesung`, `ArmutTausch`, `Stichphase`, `Auswertung`, `GesamtstandAktualisieren`
- [ ] **R11.2** `Stichphase` record hält `aktuellerStich` und `pflichtansageAusstehend` — diese Felder raus aus `Spiel`
- [ ] **R11.3** `ArmutTausch` record hält `armutStatus` — raus aus `Spiel`
- [ ] **R11.4** `VorbehaltAnsagen`/`VorbehaltAufloesung` hält `hochzeitStatus` bis Partnersuche abgeschlossen
- [ ] **R11.5** `Spiel` hält `SpielPhase aktuellePhase` statt Enum + separate Felder — `pruefePhase()`-Aufrufe entfallen
- [ ] **R11.6** `SpielPersistenzAdapter` serialisiert/deserialisiert `SpielPhase`-Zustand korrekt
- [ ] **R11.7** Alle ~180 Tests grün, kein Verhalten geändert

---

## T — Test-Coverage: Lücken schließen

> **Strategie:** Tests werden parallel zu den R-Tasks geschrieben — jede neue Klasse bekommt sofort Tests.
> Bestehende Lücken werden in T1–T4 explizit geschlossen.

### T1. Hochzeit Unit-Tests

> **Blockiert von:** nichts | **Kritisch:** Hochzeit ist die komplexeste Sonderregel, aktuell 0 Unit-Tests

- [ ] **T1.1** `HochzeitTest` — Hochzeit erkannt wenn beide Kreuz-Damen auf einer Hand
- [ ] **T1.2** Partnersuche: erster Stich den ein anderer gewinnt → Partner gefunden, Parteien offenbart
- [ ] **T1.3** Kein Partner in 3 Stichen → Stilles Solo (Spieltyp wechselt zu SOLO_TRUMPF)
- [ ] **T1.4** Hochzeit-Spieler darf Ansagen erst nach Partnerfindung
- [ ] **T1.5** Hochzeit + Dreißig-Augen-Pflicht kombiniert

### T2. Armut Unit-Tests

> **Blockiert von:** nichts | **Kritisch:** 80+ Zeilen Kartentausch-Logik ohne direkten Unit-Test

- [ ] **T2.1** `ArmutTest` — Armut erkannt bei ≤3 Trumpfkarten
- [ ] **T2.2** Angebot: Spieler legt genau alle Trumpfkarten ab — Hand korrekt reduziert
- [ ] **T2.3** Annahme: Kartentausch bidirektional korrekt, Parteien korrekt gesetzt
- [ ] **T2.4** Ablehnung durch alle Spieler → Einwurf (neue Karten, neue Runde)
- [ ] **T2.5** Armut-Spieler hat 0 Trumpfkarten → trotzdem Armut

### T3. Solo-Varianten Spielfluss-Tests (Unit)

> **Blockiert von:** nichts | **Solo-Ordnungen sind getestet, Spielfluss (Aufspieler, Parteien, Geberrotation) nicht**

- [ ] **T3.1** `SoloSpieltypTest` — Solo-Spieler ist nach Vorbehalt allein Re, die drei anderen Kontra
- [ ] **T3.2** Geberrotation nach Solo: Geber bleibt (Solo-Nachgeben), Aufspieler = Solist beim Folge-Spiel
- [ ] **T3.3** Solo Dame: Damen als einzige Trümpfe, Buben Fehlfarbe — Stich verloren wenn nur Bube gespielt
- [ ] **T3.4** Solo Bube: Buben als einzige Trümpfe, Damen Fehlfarbe
- [ ] **T3.5** Fleischlos: kein Trumpf, höchste angefragte Fehlfarbe gewinnt
- [ ] **T3.6** Ansagen im Solo: Re-Ansage des Solisten ×2, Kontra der Gegner ×2, Grundwert ×3
- [ ] **T3.7** Punkte nach Solo-Sieg und Solo-Niederlage (Vorzeichen und Multiplikator korrekt)

### T4. Technische Schulden in Tests bereinigen

> **Blockiert von:** nichts | **Klein, aber sauber**

- [ ] **T4.1** `LocodokoAnwendungTests.kontextLaedt()` entfernen — leerer Test ohne Assertion
- [ ] **T4.2** Sonderpunkte einzeln testen: `SonderpunktTest` mit je einem Test für Fuchs, Karlchen, Doppelkopf isoliert (nicht nur im `PunkteRechnerTest` eingebettet)
- [ ] **T4.3** Grenzwert: Spiel mit 240 Augen gesamt — immer erfüllt, explizit assertiert

### T5. E2E: Fehlerszenarien und Sonderregeln

> **Blockiert von:** R3 (Spieler-Authentifizierung aus Session) | **Spec:** `specs/e2e-tests.md`

- [ ] **T5.1** E2E: Armut-Workflow — Trumpfkarten anbieten, Tausch annehmen, Spiel läuft weiter
- [ ] **T5.2** E2E: Ungültige Karte spielen → Fehler-Toast sichtbar, Spiel geht weiter
- [ ] **T5.3** E2E: **Solo-Spielfluss** — neue Datei `e2e/tests/solo-spielfluss.spec.ts` (Testfall 3 aus `specs/e2e-tests.md`):
  - Solo-Vorbehalt wählen (oder `test.skip` bei keiner Solo-Hand)
  - HUD zeigt Solo-Spieltyp durchgehend
  - Alle 12 Stiche bis Rundenauswertung
  - Overlay: Solo-Spieltyp + nur ein RE + Multiplikator ×3
  - Geber-Wiederholung im Folge-Spiel prüfen
  - Zwei neue `data-testid`: `rundenauswertung-spieltyp`, `rundenauswertung-punktemultiplikator`
- [ ] **T5.4** E2E: Reconnect — Tab schließen, neuen Tab öffnen, Session-Recovery-Button führt zurück ins Spiel

### T6. Concurrency-Tests (nach R5 SpielRegistry)

> **Blockiert von:** R5 | **Kritisch für Multiplayer**

- [ ] **T6.1** `SpielRegistryConcurrencyTest` — zwei gleichzeitige `karteSpielenFuer()`-Aufrufe auf demselben Tisch: einer gewinnt, einer bekommt Exception — kein korrupter Zustand
- [ ] **T6.2** Idempotenz: dasselbe Kommando zweimal gesendet → zweites Mal gecachtes Ergebnis, nicht doppelt ausgeführt
- [ ] **T6.3** `SpielRegistry` nach Server-Neustart: Spiele aus DB korrekt in Memory geladen

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
