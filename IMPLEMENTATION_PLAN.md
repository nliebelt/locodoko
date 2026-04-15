# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> **Letzte Aktualisierung: 2026-04-15 (Plan-Run #63)**

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen
- [BLOCKED: ...] Blockiert mit Begründung

Erledigte Features: siehe `IMPLEMENTATION_PLAN_ARCHIVE.md` (Plan-Run #56 und davor).

---

## Zusammenfassung Ist-Zustand

**Kern-Features komplett:** Stichlogik, Trumpfhierarchie, Kartendeck, Punkteberechnung, Ansagen,
Sonderpunkte, Bockrunden, Schweinchen, 30-Augen-Pflicht, Solo-Nachgeben, alle 7 Solo-Varianten,
Hochzeit, Armut, KI (3 Schwierigkeitsgrade), WebSocket, REST-API, Session, Verbindungsabbruch,
Frontend (Phaser 3, AppStore, Szenen-Aufteilung, Animationen, Overlays, Tastatursteuerung),
Schnellstart, Einladungslink, Spring Modulith Modulstruktur.

**Build:** `mvn test` grün (234 Tests, 0 Failures).

**Offene Punkte:** 3 Bugs im Spielbetrieb (BUG-1/BUG-2 behoben), 2 Architektur-Refactorings (R12–R13 erledigt, R14 erledigt).

---

## Notiz

**Zuletzt erledigt (Plan-Run #64):** R13 — Stiche und Hände werden jetzt als JSON-Blob in der `spiel`-Tabelle gespeichert statt über relationale `@MappedCollection`-Tabellen. Neue Typen: `HandJsonEintrag`, `StichJsonEintrag` (in `partie/`). `SpielEntity` nutzt `haende_json`- und `stiche_json`-Spalten. Liquibase-Changeset `012-spielzustand-json.yaml` fügt Spalten hinzu und droppt `hand`, `stich`, `gespielte_karte`-Tabellen. Gelöschte Klassen: `HandEntity`, `StichEntity`, `GespielteKarteEntity`, `HandRepository`, `StichRepository`, `GespielteKarteRepository`. `SpielPersistenzAdapter`, `PartieStandAntwort`, `TischVerwaltungsService` und 4 Tests angepasst. `mvn test` grün (237 Tests).

**Nächster Schritt:** Alle Architektur-Refactorings (R12–R14) erledigt. Verbleibend: BUG-3 (Animations-Queue), BUG-4 (Browser-Reload), BUG-5 (DKV-Turnier).

**Offene Fragen:** TischSzene.test.ts und AnimationenService.test.ts laufen nicht wegen pre-existing jsdom/ESM-Kompatibilitätsfehler (ERR_REQUIRE_ASYNC_MODULE).

---

## Phase BF — Bug-Fixes Spielbetrieb

### BUG-1: KI hängt nach Fuchs gefangen / Hochzeit-Partner gefunden [x]

**Priorität: Kritisch** — blockiert regulären Spielfluss bei Sonderpunkten und Hochzeit.

**Symptom:** Nach Einziehen eines Stichs, der einen Fuchs fängt oder den Hochzeit-Partner
bestimmt, spielt die KI nicht weiter. Das Spiel hängt.

**Analyse:** `SpielAktionsService.veroeffentlicheEreignisse()` (Zeile 185) publiziert
`NaechsterSpielerErwartet` nur wenn ein laufendes Spiel existiert (`ergebnis() == null`).
Der Event-Flow sieht korrekt aus. Wahrscheinlicher Fehlerort ist
`KiOrchestrierungService.automatisiereTisch()` — dort gibt es mehrere Early-Exit-Pfade
(Zeilen 84–120), die still zurückkehren wenn `findeLaufendesSpiel()` null liefert,
`spielerEntity` null ist, oder die `istKi`-Prüfung fehlschlägt.

**Aufgabe:**
1. Reproduzieren: Unit-Test schreiben der ein Spiel mit Fuchs-Fang-Sonderpunkt durchspielt
   und verifiziert dass `NaechsterSpielerErwartet` publiziert wird UND `KiEventAdapter`
   darauf reagiert.
2. Debug-Logging in alle Early-Exit-Pfade von `KiOrchestrierungService.automatisiereTisch()`.
3. Prüfen ob `SpielAktionsService.spieleKarte()` nach dem Stich-Einziehen den aktualisierten
   `TischEntity`-Zustand korrekt an `veroeffentlicheEreignisse()` weitergibt (insbesondere
   ob der neue Stich mit Sonderpunkt-Auswertung korrekt persistiert ist).
4. Prüfen ob nach Hochzeit-Partner-Bestimmung in `fortschrittNachVollstaendigemStich()`
   die Parteien korrekt aktualisiert werden und das Spiel in einer gültigen Stichphase
   (nicht AUSWERTUNG) landet.

**Dateien:** `SpielAktionsService.java`, `KiOrchestrierungService.java`, `KiEventAdapter.java`,
`Spiel.java` (fortschrittNachVollstaendigemStich, Zeile 754)

---

### BUG-2: Schweinchen zeigt keine Wirkung [x]

**Priorität: Hoch** — Spielregel wird nicht korrekt angewendet.

**Symptom:** Karo-Asse werden trotz aktivem Schweinchen nicht als höchste Trümpfe behandelt.

**Analyse:** Die Schweinchen-Erkennung in `Spiel.hatSchweinchen()` (Zeile 822) prüft korrekt
ob ein Spieler beide Karo-Asse hat. `SchweinchenTrumpfOrdnung` wird in `teileKartenAus()`
aktiviert und ordnet Karo-As auf Rang 14/15 ein. Die `trumpfOrdnung` wird am Spiel-Objekt
gespeichert. Zu prüfen: Wird `stich.gewinner(trumpfOrdnung)` in `spieleKarte()` mit der
korrekten (Schweinchen-) TrumpfOrdnung aufgerufen? Oder gibt es einen Code-Pfad wo die
Standard-TrumpfOrdnung stattdessen genutzt wird?

**Aufgabe:**
1. Unit-Test: Spiel mit Schweinchen starten, Karo-As als Trumpf spielen, verifizieren dass
   es Kreuz-Dame (normalerweise höchster Trumpf) schlägt.
2. `Stich.gewinner()` prüfen — wird die übergebene `trumpfOrdnung` durchgängig verwendet?
3. `spieleKarte()` Zeile 401: Prüfen ob `trumpfOrdnung` das Schweinchen-Objekt ist.
4. Persistenz prüfen: Wird `schweinchenAktiv` beim Laden aus DB korrekt gesetzt?
   (`trumpfOrdnungFuerPersistiertenStand`, Zeile 835)
5. Edge-Case: Wird Schweinchen nach Armut-Kartentausch korrekt neu bewertet?

**Dateien:** `Spiel.java`, `SchweinchenTrumpfOrdnung.java`, `Stich.java`, `SpielEntity.java`

---

### BUG-3: Animations-Queue-Aufstauung (Frontend) [x]

**Priorität: Mittel** — visueller Bug, keine Spiellogik betroffen.

**Symptom:** Bei schnellen KI-Zügen werden zwei Stiche gleichzeitig animiert.

**Analyse:** `TischSzene.ts` hat drei unabhängige Animations-Mechanismen:
- `animationsKette` (Zeile 199): Promise-Chain, wird aber **nur für Banner** genutzt
  (via `reiheAnimationEin`, Zeile 1202).
- `spielzugAnimationAktiv` (Zeile 183): Boolean-Flag für Karten-Ausspielen.
- `stichEinziehenLaeuft` (Zeile 192): Promise für Stich-Einzieh-Animation, wird am
  Anfang von `spieleKarteAusUndZieheStichEin()` abgewartet (Zeile 920), aber neue
  KI-Karten-Spielzüge können parallel starten bevor die alte Animation fertig ist.

**Aufgabe:**
1. Alle Karten-Spiel-Animationen (`spieleKarteAusspielen` + `animiereStichEinziehen`)
   durch `animationsKette` serialisieren — gleicher Mechanismus wie Banner.
2. `spielzugAnimationAktiv` und `stichEinziehenLaeuft` durch die zentrale
   `animationsKette` ersetzen.
3. `AnimationenService` um eine `warteschlange()` / FIFO-Queue-Methode erweitern, die
   Animationen serialisiert und bei Szenen-Wechsel abbricht.
4. Test: KI spielt 3 Karten schnell hintereinander → nur 1 Animation gleichzeitig sichtbar.

**Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

---

### BUG-4: Browser-Reload zeigt alten State (Frontend) [x]

**Priorität: Mittel** — UX-Bug, Workaround: Doppelter Reload.

**Symptom:** Nach `Strg+R` zeigt der Browser Overlays/Animationen des vorherigen Spiels.

**Analyse:** Bei Seiten-Reload wird die Phaser-Szene neu initialisiert, ein WebSocket-
Snapshot kommt an. Aber `TischSzene.create()` baut die UI aus dem Snapshot auf, ohne zu
prüfen ob Overlays (Rundenauswertung, Vorbehalt, Letzter-Stich) aus dem vorherigen
Render-Zyklus noch sichtbar sind. Das `aufraeumen()` (Zeile 1776) räumt zwar auf, wird
aber nur bei `shutdown()` gerufen — nicht beim Neuaufbau nach Snapshot.

**Aufgabe:**
1. `TischSzene.create()`: Vor erstem Render explizit alle Overlay-Flags und
   Animations-Promises zurücksetzen.
2. `AppStore`: Prüfen ob `verbinde()` / WebSocket-Reconnect einen sauberen Initialzustand
   setzt. Bei neuem Snapshot den gesamten `aktuellerTisch`-Zustand ersetzen, nicht mergen.
3. `AnimationenService`: `abbrechen()`-Methode prüfen — bricht sie laufende Tweens ab
   oder wartet sie auf Abschluss? Bei Reload müssen laufende Animationen sofort gestoppt werden.
4. Test: Spiel starten, Rundenauswertung-Overlay anzeigen, F5 drücken → Overlay darf
   nicht sichtbar sein (nur regulärer Tisch-Zustand).

**Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/store/AppStore.ts`,
`frontend/src/services/AnimationenService.ts`

---

### BUG-5: DKV-Turnier-Preset: Spiel schließt nicht ab [x]

**Priorität: Hoch** — Spiel unbenutzbar mit DKV-Preset.

**Symptom:** Mit DKV-Preset (alle Sonderregeln deaktiviert: `bockrundenAktiv=false`,
`schweinchenAktiv=false`, `dreissigAugenPflichtAktiv=false`, mit Neunen) schließt
das Spiel nicht ab.

**Analyse:** `dkvRegeln()` erzeugt Spielregeln mit `mitNeunen=false` (12 Karten pro Hand,
12 Stiche). Zu prüfen:
- `Spiel.kartenProSpieler()` — liefert das bei DKV-Regeln den korrekten Wert (12)?
- `spieleKarte()` Zeile 418: `neueAbgeschlosseneStiche.size() == kartenProSpieler()` —
  wird die AUSWERTUNG-Phase korrekt erreicht?
- `werteAus()` Zeile 533: Wird `PunkteRechner.berechneNormalspielErgebnis()` korrekt
  aufgerufen? Parteien-Zuweisung bei Normalspiel ohne Sonderregeln?
- `Partie.schliesseAktuellesSpielAb()`: Wird der Übergang zum nächsten Spiel korrekt
  durchgeführt wenn `bockrundenAktiv=false`?
- `veroeffentlicheEreignisse()`: Wird nach `werteAus()` ein
  `PartieAktualisiert`-Event publiziert? Die Methode prüft
  `tisch.partie().status() != PartieStatus.BEENDET` — ist die Partie nach dem Spiel
  vielleicht fälschlich als BEENDET markiert?

**Aufgabe:**
1. Reproduzieren: Integration-Test mit `Spielregeln.dkvRegeln()`, vollständiges Spiel
   (12 Stiche) durchspielen, verifizieren dass `werteAus()` ein Ergebnis liefert und
   die Partie korrekt zum nächsten Spiel übergeht.
2. Prüfen ob `dkvRegeln()` `mitNeunen=false` korrekt setzt (Zeile 71:
   `new Spielregeln(false, true, 11, 10, 9, 8, 7, ...)`). Der zweite Parameter `true`
   ist `mitNeunen` — also DKV-Regeln haben Neunen (12er-Deck → 12 Karten pro Spieler).
   Ist `kartenProSpieler()` dafür korrekt? Bei 48 Karten / 4 Spieler = 12.
3. Edge-Case: Was passiert wenn `PunkteRechner` eine Exception wirft? Wird die abgefangen
   oder bleibt das Spiel in AUSWERTUNG hängen?
4. Prüfen ob `Partie.schliesseAktuellesSpielAb()` bei fehlenden Bockrunden (Zähler=0)
   korrekt rechnet (Multiplikation mit 1, nicht Division durch 0).

**Dateien:** `Spiel.java`, `PunkteRechner.java`, `Partie.java`, `Spielregeln.java`,
`SpielAktionsService.java`

---

## Phase R — Architektur-Refactoring (DoD architektur-ddd.md)

### R12: Entity-Klassen von partie/ nach tisch/ verschieben [x]

**Priorität: Mittel** — DoD-Verletzung (Zeile 173 in architektur-ddd.md), kein Runtime-Effekt.

**Beschreibung:** Folgende Persistenz-Klassen liegen noch in `de.locodoko.partie/`, gehören
aber laut DoD und Architektur-Spec nach `de.locodoko.tisch/`:
- `PartieEntity.java`
- `SpielEntity.java`
- `StichEntity.java`
- `HandEntity.java`
- `GespielteKarteEntity.java`
- `SpielSonderpunktEntity.java`
- `AbstraktePersistenzEntity.java`

**Aufgabe:**
1. Alle 7 Klassen nach `de.locodoko.tisch/` verschieben (ggf. Sub-Package `tisch/persistenz/`).
2. Imports in allen referenzierenden Klassen aktualisieren (SpielAktionsService,
   TischVerwaltungsService, SpielPersistenzAdapter, Repositories, Tests).
3. `ApplicationModulesTest.verify()` muss grün bleiben — die verschobenen Klassen
   dürfen weiterhin `partie/`-Domain-Typen importieren (erlaubte Richtung: tisch → partie).
4. `mvn test` grün.

**Dateien:** Alle 7 Entity-Klassen + alle Klassen die sie importieren.

---

### R13: JSON-Blob für Stiche/Hände [x]

**Priorität: Niedrig** — Architektur-Verbesserung, kein funktionaler Effekt.

**Beschreibung:** Laufender Spielzustand (aktuelle Hand, aktueller Stich, Phase) soll als
JSON-Blob in der `spiel`-Zeile persistiert werden statt über relationale
`@MappedCollection`-Tabellen (`stich`, `hand`, `gespielte_karte`).

**Blocker:** R12 muss zuerst abgeschlossen sein, damit die Entity-Klassen in `tisch/` liegen.

**Aufgabe:**
1. Neues Liquibase-Changeset: `spielzustand JSONB`-Spalte in `spiel`-Tabelle.
2. Jackson-3-Serializer für `Stich`, `Hand`, `GespielteKarte` implementieren.
3. `SpielEntity`/`SpielPersistenzAdapter` umbauen: Lese/Schreibe JSON statt Relationen.
4. Alte Tabellen (`stich`, `hand`, `gespielte_karte`) per Changeset droppen.
5. `mvn test` grün, Integrationstests für Serialisierungs-Roundtrip.

---

### R14: Entity-Merge (SpielEntity → Spiel, PartieEntity → Partie) [x]

**Priorität: Niedrig** — Architektur-Vereinfachung, kein funktionaler Effekt.

**Beschreibung:** `SpielEntity` und `PartieEntity` in die Domain-Klassen `Spiel` und `Partie`
gemergt. `@Table`/`@Column`/`@Id` direkt auf den Domain-Klassen. Dual-Field-Ansatz:
DB-Spaltenfelder neben @Transient-Domain-Feldern, synchronisiert via `hydriere()`/`syncZuPersistenz()`.
`SpielPersistenzAdapter` entfernt. 237 Tests grün.

**Gelöscht:** `SpielEntity.java`, `PartieEntity.java`, `SpielPersistenzAdapter.java`,
`persistenz/SpielSonderpunktEntity.java` (verschoben nach `partie/`).

---

## Spec-Code-Abgleich (Ergebnis der 5-Agenten-Analyse)

**Kein Handlungsbedarf — Spec und Code konsistent in folgenden Bereichen:**
- Stichlogik, Trumpfhierarchie, Kartendeck, Ansagen, Sonderpunkte
- Alle 7 Solo-Varianten (Dame, Bube, Trumpf, Herz/Pik/Kreuz-Farbsolo, Fleischlos)
- Hochzeit (Erkennung, Partnersuche, Stilles Solo), Armut (Erkennung, Kartentausch)
- KI (3 Schwierigkeitsgrade, Event-basiert, @ApplicationModuleListener)
- WebSocket (STOMP/SockJS, Session-Validierung), REST-API (alle Endpoints)
- Spring Modulith (ApplicationModulesTest, Transactional Outbox)
- Frontend (AppStore, Szenen, Tastatursteuerung, Logging, data-testid)

**Spec ist Wahrheit (Code muss angepasst werden):**
- DoD Zeile 173: "Keine *Entity-Klassen in partie/" → R12 erledigt.

**Code ist Wahrheit (kein Spec-Update nötig):**
- `Tisch.java` liegt in `partie/` als Domain-Fassade. Das ist korrekt: `Tisch` verbindet
  `TischId` mit `Partie` und delegiert Spielaktionen. Importiert nicht aus `tisch/` oder
  `spieler/`. Die Infrastruktur-Klasse `TischEntity` liegt korrekt in `tisch/`.
- Alle Specs mit Status "Zu prüfen" (35 Stück) reflektieren den implementierten Stand.
  Kein Code-Spec-Drift gefunden außer R12–R14.

---

## Phase M2 — Milestone 2: Echter Multiplayer

> **Specs:** `authentifizierung.md`, `spieler-profil.md`, `datenbankmodell.md`, `architektur-spielkern.md`
> **Blockiert:** M2.2+ blockiert durch M2.1 (Auth ist Fundament für persistente Spieler-ID).

### M2.1: Authentifizierung — Spring Security + OAuth2 + Username/PW [ ]

**Priorität: Hoch — Blocker für Rest von M2** | **Spec:** `authentifizierung.md`

- [ ] **M2.1.1** `spring-boot-starter-security` + `spring-boot-starter-oauth2-client` in `pom.xml`
- [ ] **M2.1.2** `SecurityConfig`: `http.oauth2Login()` + `http.formLogin()` parallel; CSRF für REST deaktiviert
- [ ] **M2.1.3** `Spieler`-Entität: Felder `authentifizierungsMethode`, `externalId`, `benutzername`, `passwortHash`, `email` + Liquibase-Migration (Changeset 011)
- [ ] **M2.1.4** `UserDetailsService`-Implementierung für Username/Passwort-Auth (BCrypt, Kostenfaktor ≥ 12)
- [ ] **M2.1.5** `Spieler.findOrCreateByOauth2(sub, email, name)` — Google-Login erzeugt/findet Spieler-Entität
- [ ] **M2.1.6** `SpielerSessionService` nutzt authentifizierten Principal statt manueller Session-Eigenschaft
- [ ] **M2.1.7** ABAC: `TischSicherheit`-Component mit `@PreAuthorize`-Checks für Gastgeber + Mitglied + Zugang
- [ ] **M2.1.8** Rate-Limiting `/api/auth/login` — max. 10 Versuche/Minute/IP
- [ ] **M2.1.9** Frontend: Login/Register-Screen (vor SpielverwaltungsSzene), Logout-Button in Seitenlade
- [ ] **M2.1.10** Tests: erfolgreicher Login, fehlerhafter Login, OAuth2-Flow (Mock), Rate-Limiting

### M2.2: Spieler-Profil + Statistiken [ ]

**Priorität: Mittel** | **Blockiert durch:** M2.1 | **Spec:** `spieler-profil.md`

- [ ] **M2.2.1** `Spieler`-Entität: `anzeigeName`, `avatarFarbe` + Liquibase-Migration (Changeset 012)
- [ ] **M2.2.2** `SpielerStatistik`-Tabelle (1:1 mit Spieler, 9 Felder) + Changeset 012
- [ ] **M2.2.3** `PartieErgebnis`-Tabelle (N:1 mit Spieler, max. 20 Einträge rotiert) + Changeset 012
- [ ] **M2.2.4** Statistik-Update via `@ApplicationModuleListener(SpielBeendet.class)` in `spieler/`-Modul
- [ ] **M2.2.5** `GET /api/spieler/{id}/profil` Endpoint
- [ ] **M2.2.6** Frontend: Avatar + Anzeigename im HUD und Nameplate

### M2.3: Private Tische + Einladungslinks [ ]

**Priorität: Mittel** | **Blockiert durch:** M2.1 | **Spec:** `spieler-profil.md` (Abschnitt "Private Tische")

- [ ] **M2.3.1** `Tisch`-Entität: `zugangsmodus` (OFFEN/PRIVAT) + `einladungsCode` (8 Zeichen) + Changeset 013
- [ ] **M2.3.2** `GET /join/{code}` → Auto-Beitreten + Redirect zur TischSzene
- [ ] **M2.3.3** Öffentliche Tischliste filtert PRIVAT-Tische heraus
- [ ] **M2.3.4** Gastgeber-Kicken: `DELETE /api/tisch/{id}/spieler/{spielerId}` (ABAC: nur Gastgeber)
- [ ] **M2.3.5** Frontend: "Privat"-Toggle + Einladungslink-Anzeige im Konfigurationsmodal

### M2.4: Liquibase-Baseline + PostgreSQL [ ]

**Priorität: Mittel** | **Unabhängig von M2.1–M2.3** | **Spec:** `datenbankmodell.md`

- [ ] **M2.4.1** Baseline-Changeset 010: konsolidiertes sauberes `CREATE TABLE`-Script (ersetzt 001–009 für Frisch-Deployments)
- [ ] **M2.4.2** PostgreSQL-Profil vollständig konfiguriert + gegen echte PostgreSQL-Instanz getestet (`application-prod.properties`, Docker Compose)
- [ ] **M2.4.3** `Dockerfile` + `docker-compose.yml` auf PostgreSQL umstellen (aktuell H2)

### M2.5: OpenAPI / TypeScript-Typen-Synchronisation [ ]

**Priorität: Niedrig** | **Unabhängig** | **Spec:** `architektur-spielkern.md` (Abschnitt "OpenAPI")

- [ ] **M2.5.1** `springdoc-openapi-starter-webmvc-ui` in `pom.xml` + `@Schema`-Annotationen auf Response-DTOs
- [ ] **M2.5.2** `openapi-typescript` im Frontend-Build: generiert `frontend/src/generated/api-types.ts`
- [ ] **M2.5.3** Bestehende handgeschriebene DTO-Typen schrittweise auf generierte Typen umstellen

---

## Phase SF — Fehlende Spielfeatures

### SF-1: Fünf-Könige-Schmeißen [ ]

**Priorität: Niedrig** | **Spec:** `spielablauf.md` (Abschnitt "Schmeißen")

- [ ] **SF-1.1** `Spiel.kannSchmeissen(SpielerPosition)` — prüft ≥5 Könige auf der Hand
- [ ] **SF-1.2** Vorbehalt-Phase: Schmeißen-Vorbehalt als höchste Priorität (vor Solo) → sofortiges Neu-Austeilen
- [ ] **SF-1.3** `Spielregeln`: `schmeissenAktiv` Flag (nur Loco-Blatt-Preset, nicht DKV)
- [ ] **SF-1.4** Frontend: Schmeißen-Button in Vorbehalt-UI
- [ ] **SF-1.5** Tests: 5 Könige → Schmeißen möglich; 4 Könige → nicht möglich; DKV-Preset → deaktiviert

### SF-2: Schweinchen — DKV-konforme implizite Ansage [ ]

**Priorität: Mittel** | **Blockiert durch:** BUG-2 (Schweinchen muss erst grundsätzlich funktionieren)
**Spec:** `schweinchen.md`

- [ ] **SF-2.1** Neues Domain-Event `SchweinchenGemeldet` in `partie/ereignisse/`
- [ ] **SF-2.2** `SpielAktionsService.spieleKarte()`: Wenn erstes Karo-As gespielt → `SchweinchenGemeldet` publizieren
- [ ] **SF-2.3** `WebSocketBroadcastAdapter`: lauscht auf `SchweinchenGemeldet` → sendet Banner-Event an Clients
- [ ] **SF-2.4** Frontend: Schweinchen-Banner erst bei `SchweinchenGemeldet`-Event (nicht beim Austeilen)
