# Architektur Spielkern — Locodoko

## Ziel

Klare Verantwortungsverteilung im Backend-Kern. Keine God-Objects. Jede Klasse hat
eine Aufgabe, einen klar definierten Eingang und Ausgang. Der Code ist für Menschen
und LLMs gleichermaßen lesbar.

## Prinzipien

- **Domain Model = Persistence Model** bleibt bestehen. Keine separaten Entity-Klassen.
- **Immutable Domain Objects**: `Spiel`, `Partie` liefern bei jeder Mutation eine neue Instanz.
  Seiteneffektfreie Pure Functions für Business-Logik.
- **Tell, don't ask**: Phasen kennen ihre erlaubten Aktionen. Services fragen nicht ab,
  sie beauftragen.
- **Ubiquitous Language**: Alle Klassen, Methoden, Felder auf Deutsch.

---

## Typed IDs — Primitive Obsession eliminieren

### Problem
Alle Entitäten nutzen nackte `UUID` als Identität. Der Compiler verhindert nicht:
```java
tischRepository.findById(spielerId);   // falsche ID, kein Kompilier-Fehler
partieRepository.findById(tischId);    // unerkannt falsch
```

### Lösung

```java
record TischId(UUID wert) {
    static TischId neu() { return new TischId(UUID.randomUUID()); }
    static TischId von(UUID wert) { return new TischId(Objects.requireNonNull(wert)); }
    static TischId von(String wert) { return von(UUID.fromString(wert)); }
}
record SpielId(UUID wert) { ... }
record PartieId(UUID wert) { ... }
record SpielerId(UUID wert) { ... }
```

Alle Repository-Methoden, Service-Parameter und Controller-Pfad-Parameter werden umgestellt.
Spring Data JDBC kann Records als IDs nutzen wenn ein passender `Converter` registriert wird.

### Regeln
- `@Table`-Annotierte Klassen behalten ihre `UUID id`-Felder für Spring Data JDBC — die Typed IDs
  wrappen diese intern oder werden als Converter-Pair (UUID ↔ TischId) registriert.
- REST-Controller empfangen `UUID` in `@PathVariable` und konvertieren zu Typed ID.
- Keine Typed IDs in DTOs nach außen — API-Schnittstelle bleibt `UUID`-basiert.

---

## SpielBuilder (inner class in Spiel.java)

### Problem
`Spiel` hat 17 Konstruktor-Parameter. Jede Mutationsmethode (`spieleKarte`, `sageAn`,
`meldeVorbehalt`, usw.) wiederholt alle 17 Parameter, auch wenn sich nur 1–2 ändern.
Das ist eine massive DRY-Verletzung (~300 Zeilen Duplikation).

### Lösung: Interner Builder

```java
// Statt:
return new Spiel(spielregeln, kartendeck, trumpfOrdnung, spieltyp, geber,
    Spielphase.STICHPHASE,                // nur das ändert sich
    haende, vorbehalte, parteien, ansagen,
    abgeschlosseneStiche, aktuellerStich,
    null, hochzeitStatus, armutStatus,
    Set.of(), null);

// So:
return toBuilder()
    .phase(Spielphase.STICHPHASE)
    .pflichtansageAusstehend(Set.of())
    .build();
```

`toBuilder()` liefert einen `SpielBuilder` der mit allen aktuellen Feldern vorbelegt ist.
Methoden ändern nur die relevanten Felder. `SpielBuilder` ist eine **private static inner
class** — kein öffentliches API, kein Lombok, vollständig sichtbar im Quelltext.

### Regeln
- `SpielBuilder` hat für jedes Feld eine Setter-Methode (Fluent API, gibt `this` zurück).
- `build()` ruft den privaten `Spiel`-Konstruktor auf (mit `Objects.requireNonNull`).
- Der 17-Parameter-Konstruktor bleibt `private`.
- Bestehende `public static` Factory-Methoden (`neu()`, `neuMitSolistAufspieler()`,
  `ausPersistiertemStand()`) bleiben erhalten — sie nutzen intern `SpielBuilder`.

---

## Pflichtansage-Logik DRY

### Problem
Die Berechnung `effektiveKartenAnzahl` (Pflichtansage ignoriert Mindestkartenanzahl)
ist identisch in `kannAnsagen()` und `sageAn()` — ~20 Zeilen Duplikation.

### Lösung

```java
private int effektiveKartenAnzahlFuer(SpielerPosition position, Ansage ansage) {
    Partei partei = parteien().parteiVon(position);
    boolean istPflicht = !pflichtansageAusstehend.isEmpty()
        && pflichtansageAusstehend.contains(partei)
        && ansage.istGrundansage();
    return istPflicht ? Integer.MAX_VALUE : handVon(position).karten().size();
}
```

Beide Methoden rufen diese Hilfsmethode auf.

---

## TischService aufteilen

### Problem
`TischService` (561 Zeilen) hat drei verschiedene Verantwortlichkeiten:
1. Tisch-CRUD (erstellen, löschen, Spieler beitreten)
2. Spiel-Aktionen (Karte spielen, Ansage, Vorbehalt)
3. Broadcasts (WebSocket-Versand nach jeder Aktion)

### Lösung: Zwei Services

**`TischVerwaltungsService`** — Bounded Context: Lobby
- Tisch erstellen, löschen, Konfiguration ändern
- Spieler beitreten, KI-Auffüllung
- Delegiert an `TischEchtzeitService` für Broadcasts

**`SpielAktionsService`** — Bounded Context: Partie
- `karteSpielenFuer(TischId, SpielerPosition, Karte)`
- `ansageTaetigenFuer(TischId, SpielerPosition, Ansage)`
- `vorbehaltMeldenFuer(TischId, SpielerPosition, VorbehaltAnsage)`
- Holt Spieler-Position aus Session statt aus Request-Body (Sicherheit)
- Ruft nach jeder Aktion `KiOrchestrierungService.fuehreKiFolgeZugAus()` auf

Die Controller bleiben unverändert — nur welcher Service injiziert wird ändert sich.

---

## KiOrchestrierungService: Domain-Logik zurück in Partie

### Problem
`KiOrchestrierungService` entscheidet wann ein Spiel abgeschlossen wird und startet
das nächste. Das ist Business-Logik die in `Partie` gehört.

### Lösung
`Partie.schliesseAktuellesSpielAbUndStarteNaechstes(PunkteRechner)` wird zur zentralen
Methode. Der `KiOrchestrierungService` ruft nur noch:
1. `spiel.phase() == AUSWERTUNG` prüfen
2. `partie.schliesseAktuellesSpielAbUndStarteNaechstes(punkteRechner)` aufrufen
3. Ergebnis persistieren
4. Broadcast senden

Der `KiOrchestrierungService` koordiniert nur noch: KI-Zug auswählen → Kommando ausführen → persistieren → broadcast. Keine Spiellogik.

---

## Spieler-Position-Authentifizierung

### Problem
Aktuell sendet der Client `spielerPosition: "SUED"` im Request-Body. Jeder Spieler
kann für jeden anderen spielen.

### Lösung
`SpielAktionsService` leitet die Position aus der Server-Session ab:

```java
public PartieStandAntwort karteSpielenFuer(UUID tischId, Karte karte, HttpSession session) {
    SpielerEntity spieler = spielerSessionService.ladeAktivenSpieler(session);
    Tisch tisch = ladeTisch(tischId);
    SpielerPosition position = tisch.positionVon(spieler.getId())
        .orElseThrow(() -> new SpielverwaltungKonfliktException("Spieler sitzt nicht an diesem Tisch"));
    // ab hier wie bisher
}
```

Der `spielerPosition`-Parameter in Request-DTOs entfällt mittelfristig.
Übergangsweise: Server validiert dass gesendete Position mit Session übereinstimmt.

---

## Concurrency-Sicherheit (SpielRegistry)

### Problem
Bei echtem Multiplayer können zwei Spieler gleichzeitig eine Karte senden.
Beide lesen dasselbe `Spiel`-Objekt, beide mutieren, einer überschreibt den anderen.

### Lösung: SpielRegistry mit per-Tisch-Lock

```java
@Component
public class SpielRegistry {
    private final Map<UUID, Spiel> laufendeSpiele = new ConcurrentHashMap<>();
    private final Map<UUID, ReentrantLock> locks = new ConcurrentHashMap<>();

    public <T> T mitSpielGesperrt(UUID tischId, Function<Spiel, SpielUndErgebnis<T>> aktion) {
        ReentrantLock lock = locks.computeIfAbsent(tischId, id -> new ReentrantLock());
        lock.lock();
        try {
            Spiel aktuell = laufendeSpiele.get(tischId);
            SpielUndErgebnis<T> ergebnis = aktion.apply(aktuell);
            laufendeSpiele.put(tischId, ergebnis.neuesSpiel());
            return ergebnis.wert();
        } finally {
            lock.unlock();
        }
    }
}
```

Alle Spiel-Mutationen laufen durch `mitSpielGesperrt()`. Ein Tisch blockiert nie einen anderen.

> **V1-Scope**: `SpielRegistry` ist In-Memory. Bei Server-Neustart gehen laufende Spiele
> verloren — akzeptiert für V1. Snapshot-Persistenz (bei Phasenwechsel) kommt in V2.

---

## Idempotenz für Spielzüge

### Problem
Netzwerk-Retry sendet dieselbe Karte zweimal. Derzeit würde das zu
`UngültigerSpielzugException` führen (Karte nicht mehr auf Hand).

### Lösung: Letzte-Aktion-Cache pro Spieler

`SpielRegistry` speichert für jede Position das letzte Command-Ergebnis.
Kommt dasselbe Kommando erneut, wird das gecachte Ergebnis zurückgegeben statt
die Aktion erneut auszuführen.

```java
record KommandoSchluessel(UUID tischId, SpielerPosition position, String kommandoHash) {}
```

Der Hash ist eine Kombination aus `Karte` + `Phase` — kein extra Feld im Request nötig.

---

## Augen + Spielpunkte als Value Objects

### Problem
`int augen`, `int spielpunkte`, `int spielwert` sind überall nackte Integers.
Der Compiler verhindert nicht `spielpunkte = augen` — beide sind `int`, beide falsch.
Außerdem: Augen haben Domänen-Invarianten (immer ≥ 0, Gesamtsumme immer 240) die
nirgendwo durchgesetzt werden.

### Lösung

```java
record Augen(int wert) {
    Augen {
        if (wert < 0) throw new IllegalArgumentException("Augen dürfen nicht negativ sein: " + wert);
    }
    static Augen null_() { return new Augen(0); }
    Augen plus(Augen andere) { return new Augen(this.wert + andere.wert); }
    boolean ueberschreitet(int grenze) { return wert > grenze; }
    boolean mindestens(int grenze) { return wert >= grenze; }
}

record Spielpunkte(int wert) {
    Spielpunkte mal(int faktor) { return new Spielpunkte(wert * faktor); }
    Spielpunkte plus(Spielpunkte andere) { return new Spielpunkte(wert + andere.wert); }
}
```

`Augen` lebt in `de.locodoko.karten` (gehört zum Kartensystem).
`Spielpunkte` lebt in `de.locodoko.partie` (gehört zur Spielbewertung).

---

## PunkteRechner — Feature Envy beseitigen

### Problem
`PunkteRechner` ist ein Service der auf den Daten von `Spiel` operiert, aber außerhalb
von `Spiel` lebt. Das ist ein klassisches Feature Envy: die Logik wohnt am falschen Ort.

```java
// aktuell — PunkteRechner braucht alles aus Spiel:
Spielergebnis e = punkteRechner.berechneNormalspielErgebnis(
    spiel.abgeschlosseneStiche(),
    spiel.parteien(),
    spiel.trumpfOrdnung(),
    spiel.ansagen(),
    spiel.spielregeln()
);
```

### Lösung

```java
// Spiel hat alle Daten — es berechnet selbst:
Spielergebnis ergebnis = spiel.berechneErgebnis();

// Intern delegiert Spiel an PunkteRechner (bleibt als package-private Utility):
public Spiel werteAus() {
    pruefePhase(Spielphase.AUSWERTUNG, "Spiel auswerten");
    Spielergebnis ergebnis = new PunkteRechner().berechne(
        abgeschlosseneStiche, parteien(), trumpfOrdnung, ansagen, spielregeln
    );
    return toBuilder().ergebnis(ergebnis).phase(Spielphase.GESAMTSTAND_AKTUALISIEREN).build();
}
```

`PunkteRechner` wird `final class` mit package-private Konstruktor — kein `@Component`,
kein Service, nur ein Hilfsberechner den `Spiel` intern nutzt.

---

## State Pattern für Spielphase

### Problem
`Spielphase` ist ein datentotes Enum. `Spiel.java` prüft überall:
```java
pruefePhase(Spielphase.STICHPHASE, "Karte spielen");
```
Phasen-spezifische Logik (Pflichtansagen nur in STICHPHASE, Armut-Tausch nur in
ARMUT_TAUSCH) ist über ganz `Spiel.java` verteilt. Ungültige Zustandsübergänge
werden erst zur Laufzeit erkannt.

### Zielzustand

```java
sealed interface SpielPhase permits KartenAusteilen, VorbehaltAnsagen,
    VorbehaltAufloesung, ArmutTausch, Stichphase, Auswertung, GesamtstandAktualisieren {

    /** Karte darf nur in der Stichphase gespielt werden. */
    default Spiel karteSpielenErlaubt(Karte k, SpielerPosition p, Spiel spiel) {
        throw new UngueltigerSpielzugException("Karte spielen in Phase " + this.getClass().getSimpleName() + " nicht erlaubt");
    }
}

record Stichphase(Stich aktuellerStich, Set<Partei> pflichtansageAusstehend)
    implements SpielPhase {

    @Override
    public Spiel karteSpielenErlaubt(Karte k, SpielerPosition p, Spiel spiel) {
        // Validierung und Übergang hier — nie in Spiel.java
    }
}
```

`Spiel` hält eine `SpielPhase`-Instanz statt ein `Spielphase`-Enum + separate Felder
(`aktuellerStich`, `pflichtansageAusstehend`, `hochzeitStatus`, `armutStatus`). Diese Felder
gehören zur Phase, nicht zum Spiel.

### Reihenfolge
**Letzter Schritt** — erst nach R0–R10 und SpielBuilder. Das ist die größte Änderung
im gesamten Refactoring und baut auf allem anderen auf. Tests müssen zu 100% grün sein
bevor dieser Schritt beginnt.

---

## Dokumentation

### Regeln für neuen Code

- Jede `public`-Klasse bekommt einen Klassen-JavaDoc-Kommentar (1–3 Sätze, Deutsch).
- Jede `public`-Methode mit nicht-offensichtlicher Logik oder Vorbedingungen wird dokumentiert.
- Private Hilfsmethoden mit komplexer Logik bekommen `// Warum`-Kommentare, keine `// Was`-Kommentare.
- `TODO`-Kommentare sind verboten — entweder direkt erledigen oder als Task in den Plan.

### Frontend TSDoc

- Alle `public`-Methoden in `AppStore`, Services und Modellen bleiben dokumentiert.
- Neue Klassen beim Aufteilen von `TischSzene` bekommen TSDoc auf Klassenebene.
- Private Phaser-Objekte in `TischSzene` brauchen keinen JSDoc — ihre Bedeutung ergibt sich
  aus dem Kontext.
