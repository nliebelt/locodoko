# Architektur Spielkern — Locodoko

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe                                              |
| Priorität      | Kritisch                                                    |
| Abhängigkeiten | architektur.md, kartendeck.md                               |

## Glossar

Die Fachbegriffe folgen den offiziellen DKV-Doppelkopf-Regeln. Code, Klassen und Methoden spiegeln diese Sprache exakt.

| Begriff         | Bedeutung                                                            |
|-----------------|----------------------------------------------------------------------|
| Tisch           | Virtueller Spieltisch — 4 Plätze, hat eine laufende Partie          |
| Partie          | Gesamte Spielsitzung am Tisch (mehrere Spiele)                       |
| Spiel           | Eine Runde: Karten austeilen → Stiche spielen → Auswertung          |
| Stich           | Die 4 Karten einer Runde (1 pro Spieler); Stichgewinner nimmt ein   |
| Hand / Blatt    | Die 12 Karten eines Spielers (beides DKV-korrekt, wir nutzen Hand)  |
| Trumpf          | Sticht immer Fehlfarbe; Rangfolge durch TrumpfOrdnung geregelt      |
| Fehlfarbe       | Nicht-Trumpf-Karte (Kreuz/Pik/Herz/Karo ohne Trumpfrang)           |
| Augen           | Punktwert der Karten (Ass=11, 10=10, König=4, Dame=3, Bube=2, 9=0) |
| Geber           | Der Spieler, der in dieser Runde austeilt                           |
| Aufspieler      | Spieler mit Anspielrecht (erster Stich)                             |
| Re / Kontra     | Die zwei Parteien; Re = Kreuz-Damen-Besitzer, Kontra = die anderen  |
| Vorbehalt       | Ankündigung einer Sonderregel vor Spielbeginn                        |
| Hochzeit        | Vorbehalt: Spieler hat beide Kreuz-Damen, sucht Partner             |
| Armut           | Vorbehalt: Spieler hat ≤3 Trumpfkarten, bietet Tausch an           |
| Dulle           | Herzzehn — höchste Trumpfkarte im Normalspiel                       |
| Fuchs           | Karo-Ass als Trumpf — Sonderpunkt wenn vom Gegner gefangen          |
| Karlchen        | Kreuz-Bube — Sonderpunkt wenn letzter Stich gewonnen                |
| SpielerPosition | Sitzposition am Tisch: NORD, OST, SÜD, WEST                        |

---

## Prinzipien

- **Domain Model = Persistence Model**: Keine separaten Entity-Klassen.
- **Immutable Spiel**: `Spiel` liefert bei jeder Mutation eine neue Instanz via `toBuilder()…build()`. Alle Mutations-Methoden sind seiteneffektfrei.
- **Tell, don't ask**: Phasen kennen ihre erlaubten Aktionen. Services fragen nicht ab, sie beauftragen.
- **Ubiquitous Language**: Alle Klassen, Methoden, Felder auf Deutsch.

---

## Typed IDs

Alle Aggregate-Roots haben eine eigene ID-Klasse — keine nackten `UUID`s in Service- und Repository-Signaturen:

```java
record TischId(UUID wert) { ... }
record SpielId(UUID wert) { ... }
record PartieId(UUID wert) { ... }
record SpielerId(UUID wert) { ... }
```

- REST-Controller empfangen `UUID` in `@PathVariable` und konvertieren intern zur Typed ID.
- API-Schnittstelle nach außen bleibt `UUID`-basiert (DTOs).
- Spring Data JDBC nutzt Converter-Pairs (UUID ↔ TypedId).

---

## `Spiel` — Immutable Aggregate Root

`Spiel` ist das zentrale Aggregate Root des Spielkerns. Jede Zustandsänderung liefert eine neue `Spiel`-Instanz. Intern nutzt `Spiel` einen **privaten `SpielBuilder`** (inner class, kein Lombok), damit Mutationsmethoden nur die relevanten Felder angeben müssen:

```java
return toBuilder()
    .phase(Spielphase.STICHPHASE)
    .pflichtansageAusstehend(Set.of())
    .build();
```

Die `public static` Factory-Methoden (`neu()`, `neuMitSolistAufspieler()`, `ausPersistiertemStand()`) nutzen den Builder intern.

---

## Spielphase als sealed interface

`Spielphase` ist kein datentotes Enum, sondern ein `sealed interface`. Phasen-spezifische Felder (aktueller Stich, ausstehende Pflichtansagen, Hochzeit- und Armut-Status) gehören zur Phase, nicht zum `Spiel`:

```java
sealed interface SpielPhase permits KartenAusteilen, VorbehaltAnsagen,
    VorbehaltAufloesung, ArmutTausch, Stichphase, Auswertung, GesamtstandAktualisieren {}

record Stichphase(Stich aktuellerStich, Set<Partei> pflichtansageAusstehend)
    implements SpielPhase {}
```

Ungültige Zustandsübergänge werden zur Compile-Zeit verhindert statt zur Laufzeit.

---

## Value Objects

`Augen` und `Spielpunkte` sind typisierte Value Objects statt nackter `int`-Werte:

- `Augen` lebt in `de.locodoko.karten` (Invariante: ≥ 0, Gesamtsumme = 240).
- `Spielpunkte` lebt in `de.locodoko.partie`.

---

## Service-Verantwortlichkeiten

**`TischVerwaltungsService`** (Modul `tisch`) — Tisch-Lebenszyklus
- Tisch erstellen, löschen, Konfiguration ändern, Spieler beitreten, KI-Auffüllung.

**`SpielAktionsService`** (Modul `tisch`) — Spielzüge
- `karteSpielenFuer`, `ansageTaetigenFuer`, `vorbehaltMeldenFuer`.
- Leitet `SpielerPosition` aus Server-Session ab — Client-Angaben werden nicht vertraut.
- Publiziert Domain Events nach jeder Aktion (Details: `architektur-domain-events.md`).

**`PunkteRechner`** (Modul `partie`) — package-private Utility, kein `@Component`.
- `Spiel` ruft `new PunkteRechner().berechne(...)` intern auf — Feature Envy vermieden.

**`KiOrchestrierungService`** koordiniert nur: KI-Zug auswählen → Kommando ausführen → persistieren. Die KI fungiert als reiner Spieler-Ersatz.

**`Partie-Lebenszyklus`** (Modul `partie` / `tisch`) — Die Logik, wann ein Spiel endet und das nächste beginnt (einschließlich Geber-Rotation), liegt zwingend im Partie-Aggregat oder einem zentralen Service. Diese Logik darf **nicht** von der Anwesenheit von KI-Spielern abhängen, um echten Multiplayer (nur Menschen) zu ermöglichen.

---

## Data Privacy & DTO-Maskierung

Um Spiel-Integrität im Multiplayer zu garantieren, müssen DTOs (insb. `PartieStandAntwort`) serverseitig gefiltert werden:
- Ein Spieler darf in der Liste `sichtbareHandkarten` der anderen Spieler **nur die Anzahl** der Karten sehen, niemals die `karteId` oder den Kartenwert (außer im expliziten Debug-Modus).
- Das Backend maskiert diese Daten, bevor sie das `tisch`-Modul verlassen.

---

## Concurrency & Optimistic Locking

Alle Zustandsänderungen laufen ausschließlich über die Datenbank. Eine `SpielRegistry`, ein `ReentrantLock` oder andere In-Memory-Synchronisationsmechanismen existieren nicht.

**Optimistic Locking via `@Version`**: Das `Partie`-Aggregat trägt ein `@Version Long version`-Feld. Spring Data JDBC inkrementiert diesen Zähler bei jedem `save()` automatisch — kein manueller Eingriff ist erlaubt. Bei konkurrierenden Schreibzugriffen wirft das Framework eine `OptimisticLockingFailureException`, die als HTTP 409 propagiert wird.

- Jede Zustandsänderung (Kartenzug, Ansage, Phasenwechsel, Sonderspiel-Übergang) erhöht die Version atomisch in der DB um 1.
- Domain Events und WebSocket-Broadcasts werden erst **nach** erfolgreichem DB-Commit ausgelöst (`@TransactionalEventListener(phase = AFTER_COMMIT)`).
- Kein Spielzustand geht bei Server-Neustart verloren — die Datenbank ist die einzige Source of Truth.
- Idempotenz im Frontend: Events mit `version ≤ letzteVersion` werden verworfen; bei Versionslücken fordert das Frontend automatisch einen HTTP-Snapshot an.

---

## Dokumentationsregeln

- Jede `public`-Klasse bekommt einen JavaDoc-Kommentar (1–3 Sätze, Deutsch).
- Jede `public`-Methode mit Vorbedingungen oder nicht-offensichtlicher Logik wird dokumentiert.
- Private Hilfsmethoden mit komplexer Logik bekommen `// Warum`-Kommentare, keine `// Was`-Kommentare.
- `TODO`-Kommentare sind verboten.

### Frontend TSDoc

- Alle `public`-Methoden in `AppStore`, Services und Modellen bleiben dokumentiert.
- Neue Klassen beim Aufteilen von `TischSzene` bekommen TSDoc auf Klassenebene.

---

## OpenAPI / TypeScript-Typen-Synchronisation

Das Backend generiert eine `openapi.json` aus den Response-DTOs. Das Frontend nutzt
diese als **einzige Source of Truth** für alle API-Typen — kein manuelles Nachpflegen.

### Vorgaben

- `springdoc-openapi-starter-webmvc-ui` in `pom.xml` — generiert `/v3/api-docs` und Swagger-UI.
- Alle Response-DTOs (Klassen in `tisch/` mit `*Antwort` oder `*Dto` im Namen) erhalten
  `@Schema`-Annotationen (Beschreibung, Beispielwerte).
- `openapi.json` wird im Build-Schritt nach `frontend/src/generated/` exportiert
  (`mvn generate-sources` oder separater `npx openapi-typescript` Schritt).
- Generierte TypeScript-Typen liegen in `frontend/src/generated/api-types.ts` und werden
  **nicht manuell bearbeitet** (`.gitattributes` oder Kommentar-Header).
- Bestehende handgeschriebene Typen in `AppStore` und Services werden schrittweise
  auf generierte Typen umgestellt. Kein Refactoring-Pflicht auf einmal — Typen koexistieren
  bis alle umgestellt sind.

### Scope

- Nur **DTOs/Response-Objekte** werden generiert — keine Domain-Objekte (`Spiel`, `Stich`, `Karte`).
- Keine Code-Generierung für API-Calls (nur Typen) — `SpielverwaltungApi.ts` bleibt handgeschrieben.

