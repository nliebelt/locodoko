# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> **Letzte Aktualisierung: 2026-04-14 (Plan-Run #45)**

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen
- [BLOCKED: ...] Blockiert mit Begründung

Erledigte Features: siehe `IMPLEMENTATION_PLAN_ARCHIVE.md` (Plan-Run #35 und davor).

---

## Zusammenfassung Ist-Zustand

**Kern-Features komplett:** Stichlogik, Trumpfhierarchie, Kartendeck, Punkteberechnung, Ansagen,
Sonderpunkte, Bockrunden, Schweinchen, 30-Augen-Pflicht, Solo-Nachgeben, alle 7 Solo-Varianten,
Hochzeit, Armut, KI (3 Schwierigkeitsgrade), WebSocket, REST-API, Session, Verbindungsabbruch,
Frontend (Phaser 3, AppStore, Szenen-Aufteilung, Animationen, Overlays, Tastatursteuerung).

**Offene Architektur-Schulden:** Die Modulstruktur entspricht nicht der Ziel-Architektur laut
`specs/architektur-ddd.md`. Packages heißen noch `lobby/`, `session/`, `partie/ki/` statt
`tisch/`, `spieler/`, `ki/`. Spring Modulith ist nicht konfiguriert, `@ApplicationModuleListener`
wird nicht genutzt, `event_publication`-Tabelle fehlt. Cross-Modul-Verletzung in PartieEntity.

---

## Phase 1 — Modulstruktur & Modulgrenzen

> Voraussetzung für alle weiteren Architektur-Aufgaben.
> Referenz: `specs/architektur-ddd.md` (Definition of Done)

### 1.1 Package-Rename: lobby → tisch

- [x] Package `de.locodoko.lobby` umbenennen zu `de.locodoko.tisch`
- [x] Alle Imports in allen Java-Dateien aktualisieren (src/main + src/test)
- [x] Liquibase-Changesets prüfen (Tabellen- und Spaltennamen bleiben gleich — kein DB-Change nötig)
- [x] Frontend-API-Pfade prüfen (`/api/tische` etc. — sollten unverändert bleiben)

**Betroffene Klassen (aktuell in `lobby/`):** TischEntity, TischId, TischStatus,
TischkonfigurationEmbeddable, TischRepository, TischRepositoryImpl, TischController,
TischVerwaltungsService, SpielAktionsService, SpielPersistenzAdapter, SpielRegistry,
KiOrchestrierungService, PartieStandAntwort, PartieController, TischEchtzeitService,
SpielverwaltungWebSocketController, KiEventAdapter, WebSocketBroadcastAdapter,
SpielverwaltungKonfliktException, ZugriffVerweigertException, FehlerNachricht,
GlobalerFehlerHandler u.a.

### 1.2 Package-Rename: session → spieler

- [x] Package `de.locodoko.session` umbenennen zu `de.locodoko.spieler`
- [x] Alle Imports aktualisieren
- [x] Session-Cookie-Name und HTTP-Session-Logik bleiben unverändert

**Betroffene Klassen (aktuell in `session/`):** SpielerEntity, SpielerId, SpielerRepository,
SpielerSessionService, SpielerSessionController, VerbindungsabbruchService,
VerbindungsSessionEreignisListener, SessionCleanupService u.a.

### 1.3 Package-Rename: partie/ki → ki (top-level)

- [x] Package `de.locodoko.partie.ki` verschieben zu `de.locodoko.ki`
- [x] Alle Imports aktualisieren
- [x] KiEventAdapter verbleibt in `tisch/` (konsumiert Events, ruft SpielAktionsService auf)
  ODER wird nach `ki/` verschoben falls `ki/` direkt `SpielAktionsService` aufrufen darf
  → **Klärung:** Laut Spec darf `ki/` nur `partie/` und `karten/` importieren, NICHT `tisch/`.
    `KiEventAdapter` muss deshalb in `tisch/` bleiben (er ruft `SpielAktionsService` in `tisch/` auf).
    Alternativ: `KiEventAdapter` bleibt in `ki/` und ruft eine schmale Interface-Methode auf,
    die `tisch/` implementiert. Pragmatischer Ansatz für V1: `KiEventAdapter` bleibt in `tisch/`.

**Betroffene Klassen (aktuell in `partie/ki/`):** KiStrategie, StandardKiStrategie,
LeichteKiStrategie, SchwerKiStrategie, KiStrategieFactory, KiSpielzustand,
KiSchwierigkeit, KiArmutAntwort.

### 1.4 SpielerPosition, Stich, GespielteKarte von karten → partie verschieben

- [x] `SpielerPosition.java` von `de.locodoko.karten` nach `de.locodoko.partie` verschieben
- [x] `Stich.java` von `de.locodoko.karten` nach `de.locodoko.partie` verschieben
- [x] `GespielteKarte.java` von `de.locodoko.karten` nach `de.locodoko.partie` verschieben
- [x] Alle Imports aktualisieren (betrifft ~30+ Dateien in lobby/tisch, partie, session/spieler, ki)
- [x] JavaDoc in `TrumpfOrdnung` anpassen (referenziert `Stich` im Kommentar)
- [x] `Kartendeck.anVierSpielerAusteilen()` refaktoriert: gibt `List<Hand>` statt `Map<SpielerPosition, Hand>` zurück (vermeidet karten→partie-Abhängigkeit)
- [x] `StichTest` von `karten/` nach `partie/` verschoben (testet Stich, gehört dorthin)

**Begründung:** `SpielerPosition` gehört laut DoD in `partie/`, nicht in `karten/`.
`Stich` und `GespielteKarte` hängen von `SpielerPosition` ab und enthalten Domain-Logik
(Stichgewinner-Ermittlung). `karten/` soll reines Shared Kernel sein (nur Value Objects).
**Abhängigkeitsrichtung bleibt korrekt:** `partie → karten` (Stich nutzt TrumpfOrdnung).
Keine karten-interne Klasse importiert Stich/GespielteKarte/SpielerPosition.

### 1.5 Cross-Modul-Verletzung beheben: PartieEntity → TischEntity

- [x] `PartieEntity.java` Zeile 3: `import de.locodoko.lobby.TischEntity` entfernen
- [x] Beziehung nur noch über `TischId` (Foreign Key als UUID), kein direkter Typ-Import
- [x] Prüfen ob weitere Cross-Modul-Verletzungen existieren (partie → lobby/session Imports)

**Regel:** `partie/` darf nur `karten/` importieren (laut `architektur-ddd.md`).

### 1.6 PunkteRechner: public → package-private

- [x] `public final class PunkteRechner` → `final class PunkteRechner` (Zeile 20, PunkteRechner.java)
- [x] Sicherstellen dass kein Code außerhalb `de.locodoko.partie` auf PunkteRechner zugreift
- [x] Tests ggf. ins gleiche Package verschieben (Test-Package muss übereinstimmen)

**Referenz:** `specs/architektur-spielkern.md` — "package-private Utility, kein @Component"

### 1.7 Spring Modulith Dependencies hinzufügen

- [x] `spring-modulith-starter-core` in `pom.xml` (BOM via `spring-modulith-bom`)
- [x] `spring-modulith-starter-jdbc` in `pom.xml` (Transactional Outbox)
- [x] Version passend zu Spring Boot 4.0.x wählen (Spring Modulith 2.0.0)
- [x] `mvn compile` muss erfolgreich sein

### 1.8 Liquibase-Changeset: event_publication-Tabelle

- [x] Changeset `010-event-publication.yaml` erstellen
- [x] Tabelle `event_publication` mit Spalten laut Spring Modulith Dokumentation:
      `id UUID PK`, `listener_id TEXT`, `event_type TEXT`, `serialized_event TEXT`,
      `publication_date TIMESTAMP`, `completion_date TIMESTAMP`
      (plus `status`, `completion_attempts`, `last_resubmission_date` aus Modulith 2.0.0 Schema)
- [x] In `db.changelog-master.yaml` einbinden
- [x] `mvn test` muss grün sein (Liquibase-Migration läuft sauber durch)

### 1.9 @EventListener → @ApplicationModuleListener migrieren

- [x] `KiEventAdapter` (tisch/): `@EventListener` → `@ApplicationModuleListener`
      (beide Methoden: `beiNaechsterSpielerErwartet`, `beiVorbehaltErwartet`)
- [x] `WebSocketBroadcastAdapter` (tisch/): `@EventListener` → `@ApplicationModuleListener`
- [x] `VerbindungsSessionEreignisListener` (spieler/): geprüft — Intra-Modul (Spring WebSocket-Events) → `@EventListener` bleibt
- [x] Import-Statement von `org.springframework.context.event.EventListener` →
      `org.springframework.modulith.events.ApplicationModuleListener` aktualisieren
- [x] Sicherstellen dass Events nach DB-Commit gefeuert werden (Outbox-Semantik)
- [x] `spring-modulith-events-api` als compile-Dependency hinzugefügt (war nur runtime via starter-jdbc;
      ohne compile-scope werden `@ApplicationModuleListener`-Annotationen vom Compiler stumm verworfen)
- [x] `@EnableAsync` zu `LocodokoAnwendung` hinzugefügt (notwendig für `@Async`-Semantik der Listener)
- [x] `TischEchtzeitService.sendePartieEreignis()` Direkt-Methode ergänzt (kein `planeNachCommit`-Wrapper,
      da `@ApplicationModuleListener` bereits post-commit läuft)
- [x] `awaitility` Test-Dependency + WebSocket-Tests auf asynchrone Event-Zustellung angepasst
- [x] `mvn test` grün (221 Tests)

### 1.10 ApplicationModulesTest erstellen

- [x] Neue Testklasse `de.locodoko.ModulstrukturTest` (oder `ApplicationModulesTest`)
- [x] `ApplicationModules.of(LocodokoAnwendung.class).verify()` aufrufen
- [x] Test muss grün sein → bestätigt dass keine verbotenen Cross-Modul-Imports existieren
- [x] In `mvn test` Lauf enthalten
- [x] `spring-modulith-starter-test` Dependency in `pom.xml` ergänzt
- [x] `spieler ↔ tisch` Zyklus aufgelöst: 28 Klassen (WebSocket, Echtzeit, Verbindung, DTOs) von `spieler` nach `tisch` verschoben
- [x] `SpielerTischAbfrage`-Interface in `spieler` eingeführt (Dependency Inversion für `SpielerSessionService`)
- [x] `partie.ereignisse` als `@NamedInterface` exponiert (Events sind öffentliche Modul-API)
- [x] Leeres `session/`-Package entfernt
- [x] `mvn test` grün (222 Tests)

---

## Phase 2 — Application Layer Features

> Neue Features aus `architektur-ddd.md` Sektion 5.
> Diese sind im Architektur-Spec als Beispiele definiert, aber fachlich sinnvoll.

### 2.1 Schnellstart (Quick Play)

- [ ] `TischVerwaltungsService.schnellEinsteigen(SpielerId)` implementieren:
      1. Suche offenen Tisch (`TischStatus.WARTEND`, freier Platz)
      2. Falls vorhanden: `spielerBeitreten(tischId, spielerId)`
      3. Sonst: `tischErstellen(...)` + `spielerBeitreten(...)` + `kiAuffuellen(...)`
      4. Bei 4 Spielern: `spielStarten(tischId)`
- [ ] REST-Endpoint: `POST /api/tische/schnellstart` (oder als Aktion auf bestehenden Endpoint)
- [ ] Frontend: Button „Schnell Spielen" auf SpielverwaltungsSzene (neben „Neuer Tisch")
- [ ] Unit-Tests: Beitritt zu bestehendem Tisch, Neuerstellung, KI-Auffüllung
- [ ] E2E-Test: Schnellstart-Flow

### 2.2 Einladungslink

- [ ] `TischEntity`: neues Feld `einladungsCode` (8-stellig alphanumerisch, auto-generiert)
- [ ] Liquibase-Changeset: `einladungs_code VARCHAR(8) UNIQUE NOT NULL` in `tisch`-Tabelle
- [ ] `TischVerwaltungsService.beitretenViaCode(code, spielerId)`:
      Lookup TischId via einladungsCode → `spielerBeitreten(tischId, spielerId)`
- [ ] REST-Endpoint: `POST /api/tische/beitreten/{code}`
- [ ] Frontend: „Link teilen"-Button in TischSzene, Copy-to-Clipboard
- [ ] Frontend: URL-Route `/join/{code}` → automatischer Beitritt bei SpielverwaltungsSzene-Load
- [ ] Unit-Tests: Code-Generierung, Lookup, Duplikat-Schutz
- [ ] E2E-Test: Link-Beitritt-Flow

---

## Phase 3 — Frontend-Verfeinerung

### 3.1 JSDoc vervollständigen

- [ ] `AppStore.ts`: Klasse + alle öffentlichen Methoden (teilweise vorhanden, ergänzen)
- [ ] `TischSzene.ts`: Klasse + kritische Methoden (create, render, Dialoge, Karten-Klick)
- [ ] `SpielverwaltungEchtzeit.ts`: Klasse + alle öffentlichen Methoden
- [ ] `TischAnsichtModell.ts`: Klasse + alle öffentlichen Methoden (teilweise vorhanden)
- [ ] `AnimationenService.ts`: Klasse + alle öffentlichen Methoden (teilweise vorhanden)
- [ ] `TischInputHandler.ts`: TSDoc auf Klassenebene
- [ ] `TischUIManager.ts`: TSDoc auf Klassenebene

**Referenz:** `specs/frontend-architektur.md` (DoD), `specs/architektur-spielkern.md` (Frontend TSDoc)

### 3.2 Logging-Punkte erweitern

- [ ] `SpielverwaltungEchtzeit.ts`: Logging bei WebSocket-Verbindung, Reconnect, Nachrichtenempfang
- [ ] `AppStore.ts`: Logging bei Zustandsänderungen (phasenbasiert, nicht pro Frame)
- [ ] `TischSzene.ts`: Logging bei Szenen-Lifecycle (create, destroy) und Fehlern
- [ ] `SpielverwaltungApi.ts`: Logging bei API-Aufrufen (Request/Response/Error)
- [ ] Backend `KiOrchestrierungService`: strukturiertes Logging auf allen Pfaden
- [ ] `application-dev.properties`: Log-Level-Konfiguration für KI-Orchestrierung
- [ ] Test: Logger wird im Prod-Mode nicht aufgerufen

**Referenz:** `specs/frontend-logging.md`

### 3.3 data-testid-Attribute ergänzen

- [ ] Prüfen welche data-testids laut `specs/e2e-tests.md` und `specs/frontend-tischansicht.md`
      noch fehlen (aktuell 7 gefunden, Archiv listet ~17 als erledigt — ggf. dynamisch generiert)
- [ ] Fehlende Attribute nachziehen falls nötig

### 3.4 „Offene Tische"-Modal vervollständigen

- [ ] Liste aller offenen Tische mit Name, Spieleranzahl, Status, Regelkonfiguration
- [ ] Echtzeit-Updates via WebSocket (Tische erscheinen/verschwinden)
- [ ] Beitritt-Button pro Tisch

**Referenz:** `specs/lobby.md` Anforderung 1–2, 4, 8

---

## Phase 4 — Spec-Pflege & Qualitätssicherung

### 4.1 DoD-Checkboxen in Specs aktualisieren

- [ ] `specs/spielablauf.md`: Solo-Nachgeben als `[x]` markieren (ist implementiert)
- [ ] `specs/bockrunden.md`: alle DoD-Items als `[x]` markieren (lt. Archiv erledigt)
- [ ] `specs/dreissig-augen-pflicht.md`: alle DoD-Items als `[x]` markieren (lt. Archiv erledigt)
- [ ] `specs/schweinchen.md`: alle DoD-Items als `[x]` markieren (lt. Archiv erledigt)
- [ ] `specs/frontend-animationen.md`: erledigte Items als `[x]` markieren
- [ ] `specs/frontend-rundenauswertung.md`: erledigte Items als `[x]` markieren
- [ ] `specs/frontend-logging.md`: bereits implementierte Items als `[x]` markieren
      (logger.ts vorhanden, window.onerror registriert)
- [ ] `specs/e2e-tests.md`: implementierte Tests als `[x]` markieren
- [ ] `specs/architektur-ddd.md`: DoD-Items abhaken sobald Phase 1 abgeschlossen

### 4.2 E2E-Tests stabilisieren

- [~] `partie-gegen-ki.spec.ts`: data-testid-Selektoren, KI-Timing (lt. Archiv weitgehend umgestellt)
- [ ] E2E-Testfall 1 läuft grün gegen `mvn spring-boot:run` (DoD aus `specs/e2e-tests.md`)
- [ ] E2E-Testfall 2 läuft grün gegen `mvn spring-boot:run`

### 4.3 frontend-architektur.md aktualisieren

- [ ] Dateistruktur-Sektion auf aktuellen Stand bringen (neue Dateien: TischInputHandler,
      TischUIManager, AnimationenService etc.)
- [ ] Datenfluss-Diagramm überprüfen
- [ ] Code-Review / Plausibilitätsprüfung

---

## Inkonsistenzen: Entscheidungen Spec vs. Code

| # | Inkonsistenz | Entscheidung | Aufgabe |
|---|-------------|-------------|---------|
| I1 | Package `lobby/` statt `tisch/` | **Spec ist Wahrheit** | → 1.1 |
| I2 | Package `session/` statt `spieler/` | **Spec ist Wahrheit** | → 1.2 |
| I3 | `partie/ki/` statt top-level `ki/` | **Spec ist Wahrheit** | → 1.3 |
| I4 | `SpielerPosition` in `karten/` statt `partie/` | **Spec ist Wahrheit** | → 1.4 |
| I5 | PartieEntity importiert TischEntity | **Code ist falsch** (DoD-Verletzung) | → 1.5 |
| I6 | PunkteRechner ist `public` statt package-private | **Spec ist Wahrheit** | → 1.6 |
| I7 | `@EventListener` statt `@ApplicationModuleListener` | **Spec ist Wahrheit** | → 1.9 |
| I8 | Farbsolo als 3 Enum-Werte vs. 1 parametrisiert | **Code ist Wahrheit** (Spec-DoD bestätigt 3 Typen) | Keine |
| I9 | spielablauf.md zeigt Solo-Nachgeben als `[ ]` | **Code ist Wahrheit** (implementiert) | → 4.1 |
| I10 | Diverse Spec-DoDs unchecked obwohl implementiert | **Code ist Wahrheit** | → 4.1 |

---

## Priorität & Abhängigkeiten

```
Phase 1 (Blocking):
  1.1 ──┐
  1.2 ──┤
  1.3 ──┼── 1.7 ── 1.8 ── 1.9 ── 1.10
  1.4 ──┤
  1.5 ──┤
  1.6 ──┘

Phase 2 (nach Phase 1):
  2.1 (unabhängig)
  2.2 (unabhängig)

Phase 3 (parallel zu Phase 2):
  3.1, 3.2, 3.3, 3.4 (alle unabhängig)

Phase 4 (parallel, niedrige Priorität):
  4.1, 4.2, 4.3 (alle unabhängig)
```

---

## Notiz

**Zuletzt erledigt (Plan-Run #45):** Task 1.10 — `ModulstrukturTest` erstellt, `ApplicationModules.verify()` grün.
Hauptarbeit war das Auflösen des `spieler ↔ tisch` Abhängigkeitszyklus: 28 Klassen (WebSocket-Controller,
TischEchtzeitService, VerbindungsabbruchService, KiSpielerFabrik, DTOs, Exceptions, WebSocket-Konfiguration)
von `spieler` nach `tisch` verschoben. `SpielerTischAbfrage`-Interface eingeführt (Dependency Inversion),
damit `SpielerSessionService` nicht mehr direkt `TischRepository` importiert. `partie.ereignisse` als
`@NamedInterface` exponiert. `spring-modulith-starter-test` als Test-Dependency ergänzt. 222 Tests grün.

**Phase 1 ist komplett.** Alle Modulstruktur-Aufgaben (1.1–1.10) sind erledigt.

**Nächster logischer Schritt:** Phase 2, 3 oder 4 — alle sind unabhängig voneinander.
Empfehlung: 2.1 (Schnellstart) als nächstes Feature oder 4.1 (DoD-Checkboxen) als Quick-Win.

**Offene Fragen:** Keine.

