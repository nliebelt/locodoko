# Architektur Spielkern — Locodoko

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

**`KiOrchestrierungService`** koordiniert nur: KI-Zug auswählen → Kommando ausführen → persistieren. Spiellogik (Wann ist ein Spiel beendet? Wann startet das nächste?) liegt in `Partie`.

---

## SpielRegistry (Concurrency)

Laufende `Spiel`-Objekte leben in-memory in der `SpielRegistry`. Jeder Tisch hat einen eigenen `ReentrantLock` — parallele Züge werden serialisiert, ohne sich gegenseitig zu blockieren.

`SpielRegistry` implementiert außerdem einen **Idempotenz-Cache**: Kommt dasselbe Kommando erneut (Netzwerk-Retry), wird das gecachte Ergebnis zurückgegeben statt die Aktion erneut auszuführen.

> **V1-Scope**: In-Memory. Bei Server-Neustart gehen laufende Spiele verloren (akzeptiert).

---

## Dokumentationsregeln

- Jede `public`-Klasse bekommt einen JavaDoc-Kommentar (1–3 Sätze, Deutsch).
- Jede `public`-Methode mit Vorbedingungen oder nicht-offensichtlicher Logik wird dokumentiert.
- Private Hilfsmethoden mit komplexer Logik bekommen `// Warum`-Kommentare, keine `// Was`-Kommentare.
- `TODO`-Kommentare sind verboten.

### Frontend TSDoc

- Alle `public`-Methoden in `AppStore`, Services und Modellen bleiben dokumentiert.
- Neue Klassen beim Aufteilen von `TischSzene` bekommen TSDoc auf Klassenebene.


