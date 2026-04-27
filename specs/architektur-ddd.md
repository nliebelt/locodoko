# Architektur-Prinzipien (Domain-Driven Design)

| Feld           | Wert                                                                 |
|----------------|----------------------------------------------------------------------|
| Status         | Finalisierte Vorgabe |
| Priorität      | Kritisch                                                             |
| Abhängigkeiten | datenbankmodell.md                                                   |
| Letztes Update | 2026-04-13 — Spring Modulith, neue BC-Namen, Application Layer      |

## Beschreibung

Diese Spezifikation ist der architektonische Kompass für die Locodoko-Codebase. Sie stellt sicher, dass Komplexität durch klare Fachlichkeit beherrscht wird und Code für Menschen (und Agents) ohne Rätselraten lesbar bleibt. Wir bauen kein technisches Konstrukt, sondern bilden ein lebendiges Kartenspiel ab — mit echter Domänensprache und sauberen Modulgrenzen.

Strategie: Pragmatisches DDD — Domain Model = Persistence Model, Spring Modulith für Modulgrenzen-Durchsetzung.
Tech-Stack: Spring Boot 4, Spring Data JDBC, Liquibase, Spring Modulith.

## Ubiquitous Language (DKV-Begriffe)

Siehe `architektur-spielkern.md` — dort vollständige Begriffstabelle.

## Anforderungen

### 1. Bounded Contexts (Modulstruktur)

Die Organisation erfolgt nach fachlichen Modulen, nicht nach technischen Layern.
Jedes top-level Package unter `de.locodoko` ist ein eigenständiges **Spring-Modulith-Modul**.

```
de.locodoko.karten/    Shared Kernel — Value Objects. Keine Domain-Logik, keine Controller.
                       Darf von allen anderen Modulen importiert werden.

de.locodoko.partie/    Spielkern — Spiellogik, Stiche, Runden, Auswertung, Domain-Events.
                       Keine Controllers, kein direkter Import von tisch/ oder spieler/.

de.locodoko.ki/        KI-Modul — konsumiert Domain-Events aus partie/,
                       importiert karten/ und partie/ nur für Typen.

de.locodoko.tisch/     Tischverwaltung & Multiplayer-Infrastruktur — Controller, WebSocket,
                       Infrastruktur-Adapter.

de.locodoko.spieler/   Spieler-Identität & Session.

de.locodoko.system/    Querschnittlich.
```

**Abhängigkeitsrichtung (erlaubt):**
```
tisch → partie, karten, spieler
ki    → partie, karten          (nur Typen und Events, NICHT tisch)
partie → karten
spieler → partie.ereignisse     (Darf auf Domain-Events lauschen, aber keine interne Logik aufrufen)
```

**Cross-Modul-Kommunikation:**
- Domain Events über `@ApplicationModuleListener` (Spring Modulith) statt `@EventListener`.
- **Pragmatismus-Regel:** Module dürfen Klassen aus dem Package `de.locodoko.partie.ereignisse` importieren, um auf fachliche Vorkommnisse (z.B. `SpielBeendet`) zu reagieren, ohne dass ein aufwendiger Mapping-Layer gebaut werden muss.
- Kein direkter Aufruf von `ki.*` aus `tisch.*` — KI reagiert auf Events.

### 2. Persistenz-Regeln (Spring Data JDBC)

- Kein JPA/Hibernate: Keine Proxies, kein Lazy Loading.
- Aggregates: `@Table`-Annotation, eigene Repositories pro Aggregate Root.
- UUIDs: Primärschlüssel sind immer UUID.
- Foreign Keys: Beziehungen zwischen Aggregaten ausschließlich über ID (UUID).
- Domain Model = Persistence Model: Keine separaten Entity-Klassen.

### 3. Domain Design (Entities & Value Objects)

**Keine separaten Entity-Klassen (Regel)**
- Aggregate Roots tragen `@Table`, `@Id`, `@MappedCollection` direkt — kein `*Entity`-Pendant.
- Persistenz-Infrastruktur-Klassen (Adapter, Mapping-Hilfsobjekte) gehören ins Modul `tisch/`, nicht in `partie/`.
- `partie/` enthält ausschließlich fachliche Domain-Objekte.

**Persistenz-Strategie für `Spiel` (Entscheidung 2026-04-15)**
- `Spiel` bleibt **immutable** — SpielBuilder bleibt, kein mutable POJO.
- Stiche und Hände als **JSON-Blob** in der `spiel`-Zeile (kein relationales `@MappedCollection` auf `stich`/`hand`-Tabellen). Laufender Spielzustand (aktuelle Hand, aktueller Stich, Phase) ist Byte-kompakt als JSON sinnvoller als normalisierte Relationen.
- Nach Auswertung werden Stiche verworfen — kein Spielverlauf in DB (V1-Kompromiss).
- `SpielEntity` und `PartieEntity` werden nach dem JSON-Blob-Umbau in `Spiel` und `Partie` gemergt (`@Table` direkt). `SpielPersistenzAdapter` fällt dann weg.
- Migrationsreihenfolge: **R12** (Entities nach `tisch/`) → **R13** (JSON-Blob) → **R14** (Entity-Merge).

**Aggregate Roots (mutable über Methoden)**
- Identität & Concurrency: Stabile ID; `@Version Long version` für Optimistic Locking.
- Kapselung: Interne Entities sind nach außen nur über das Root erreichbar.
- Immutable Spiel: `Spiel` gibt bei jeder Mutation eine neue Instanz zurück (`toBuilder()…build()`).

**Value Objects (immutable)**
- Keine Identität (z.B. `Karte`, `Augen`, `Spielpunkte`).
- Side-Effect-Free: Methoden geben immer neue Instanzen zurück.

**Typed IDs (Primitive Obsession vermeiden)**
- Keine nackten `UUID` in Service- und Repository-Signaturen.
- Jedes Aggregat hat eine eigene ID-Klasse: `TischId`, `SpielId`, `PartieId`, `SpielerId`.
- Details und Converter-Regeln: `architektur-spielkern.md`.

**Concurrency (Optimistic Locking)**
- Alle Zustandsänderungen laufen ausschließlich über die Datenbank — keine `SpielRegistry`, kein `ReentrantLock`.
- `@Version Long version` auf dem `Partie`-Aggregat serialisiert konkurrierende Schreibzugriffe: Spring Data JDBC wirft `OptimisticLockingFailureException` bei Konflikt (→ HTTP 409).
- Kein Spielzustand geht bei Server-Neustart verloren, da die Datenbank die einzige Source of Truth ist.

### 4. Spring Modulith

**Modulgrenzen-Durchsetzung**
- `spring-modulith-starter-core` in `pom.xml` — kein Modul darf direkt auf interne Klassen eines anderen zugreifen.
- `ApplicationModulesTest.verify()` läuft bei `mvn test` — schlägt fehl bei verbotenen Imports.

**Transactional Outbox** (`spring-modulith-starter-jdbc`)
- Domain Events werden in der `event_publication`-Tabelle persistiert (Liquibase Changeset).
- Garantiert: Event Delivery exactly-once, auch bei JVM-Crash nach DB-Commit.
- Adapter nutzen `@ApplicationModuleListener`.

### 5. Application Layer: Features vs. Domain

Das Domain Model bildet ausschließlich Spielkonzepte ab. Application Features sind dünne Use-Case-Methoden, die Domain-Methoden koordinieren — ohne das Domain Model zu ändern.

**Beispiel „Schnellstart" (Quick Play):**
`TischVerwaltungsService.schnellEinsteigen(SpielerId)`:
1. Suche offenen Tisch mit Status=WARTEND und freiem Platz
2. Falls vorhanden: `spielerBeitreten(tischId, spielerId)`
3. Sonst: `tischErstellen(...)` + `spielerBeitreten(...)` + `kiAuffuellen(...)`
4. Bei 4 Spielern: `spielStarten(tischId)`

Das Domain Model (`Tisch`, `Spiel`) ändert sich nicht — nur die Application-Service-Methode ist neu.

**Beispiel „Einladungslink" (Link-Join):**
- Domain: `Tisch` erhält Feld `einladungsCode` (z.B. 8-stelliger alphanumerischer Code).
- Feature: `TischVerwaltungsService.beitretenViaCode(code, spielerId)` → lookup TischId → `beitreten()`.
- URL `/join/{code}` ist Application-Layer, nicht Domain.
- DB: Spalte `einladungs_code VARCHAR(8) UNIQUE NOT NULL` in `tisch`-Tabelle.

### 6. Ubiquitous Language & Dokumentation

- **Sprach-Synchronität:** Der Code nutzt exakt die DKV-Begriffe aus der obigen Tabelle.
- **Klassendokumentation:** Jede Klasse beginnt mit einem prägnanten fachlichen Satz.
- **Tell, Don't Ask:** Logik liegt im Aggregat. Business-Methoden (z.B. `spiel.spieleKarte()`) schlagen technische Setter.
- **Fail Fast:** Invarianten werden sofort im Aggregat durch Exceptions geschützt.

### 7. Spieler-Autorisierung (Security)

- Der Server leitet die `SpielerPosition` aus der HTTP-Session ab — Client-Angaben werden nicht vertraut.
- `SpielAktionsService` lädt den aktiven Spieler über `SpielerSessionService.ladeAktivenSpieler(session)` und ermittelt die Position aus dem `Tisch`-Aggregat.
- Übergangsweise: Server validiert, dass die gesendete Position mit der Session-Position übereinstimmt.

### 8. Fehlerbehandlungs-Vertrag

**HTTP-Fehlerantworten (RFC 9457 — Problem Detail)**

Alle Fehler liefern `application/problem+json`. Gemappte Exception-Hierarchie via `@ControllerAdvice`:

| Exception | HTTP | Wann |
|-----------|------|------|
| `UngueltigerSpielzugException` | 422 | Kartenzug verletzt Spielregeln |
| `SpielverwaltungKonfliktException` | 409 | Zustandskonflikt (z.B. Tisch voll, falscher Spielzustand) |
| `SpielerNichtGefundenException` | 404 | Session nicht vorhanden |
| `ZugriffVerweigertException` | 403 | Spieler gehört nicht zu diesem Tisch |

**WebSocket-Fehler**

Fehler bei Spiel-Kommandos werden als `FehlerNachricht { code, meldung }` auf `/topic/fehler/{tischId}` gesendet — kein Disconnect.

### 9. Full-Stack Konsistenz (Frontend)

Frontend-Typen und `AppStore` spiegeln die Fachmodelle des Backends (Details: `frontend-architektur.md`).

## Definition of Done

- [x] Klasse beginnt mit fachlichem Einleitungssatz (Ubiquitous Language).
- [x] Logik liegt im Aggregat (Business-Methoden statt Setter).
- [x] Invarianten durch Exceptions geschützt.
- [x] Kommunikation zwischen Modulen via Domain Events + `@ApplicationModuleListener`.
- [x] Kein verbotener Cross-Modul-Import (`ApplicationModulesTest` grün).
- [x] `SpielerPosition` liegt in `de.locodoko.partie` (nicht in `karten`).
- [x] Packages: `tisch/` (nicht `lobby/`), `spieler/` (nicht `session/`), `ki/` top-level.
- [x] `event_publication`-Tabelle via Liquibase angelegt.
- [ ] Keine `*Entity`-Klassen in `partie/` — alle in `tisch/` oder direkt gemergt (R12–R14).
- [x] Frontend-Modelle folgen der fachlichen Struktur des Backends.
- [x] Aggregate Roots mit `@Table` annotiert, Spring Data JDBC Repositories vorhanden.
- [x] Liquibase Changesets für alle Schemaänderungen.
- [x] Tests angepasst und grün, `ApplicationModulesTest.verify()` grün.
