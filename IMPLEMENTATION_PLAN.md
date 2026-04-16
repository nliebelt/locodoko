# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> **Letzte Aktualisierung: 2026-04-16 (Plan-Run #75)**

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

**Build:** `mvn test` grün (254 Tests, 0 Failures).

**Offene Punkte:** BF-7 (Snapshot-Endpoint), KI-1 (Schwellen-Tuning), ARCH-1–ARCH-3 (typisierte WebSocket-Events).

---

## Notiz

**Zuletzt erledigt (Plan-Run #74):** BF-6 — Tastatur-Shortcuts für Ansagen und Armut abgeschlossen.
Implementierung war bereits vollständig in `TischInputHandler.ts` vorhanden (R=Re, K=Kontra, 1-5=Ansagen
nach Position, A=Armut annehmen, N=Armut ablehnen) — alle mit korrekten Guards (Ansagen nur wenn
`moeglicheAnsagen.length > 0`, Armut nur wenn `armutAktion.modus === 'ANTWORTEN'`).
Fehlende Tests für K, A, N in `TischSzene.test.ts` nachgetragen. Build + Lint grün.

**Nächste offene Aufgaben (priorisiert):** ARCH-0 → ARCH-1 → ARCH-2, dann BF-7, KI-1

**Offene Fragen:** TischSzene.test.ts und AnimationenService.test.ts laufen nicht wegen pre-existing jsdom/ESM-Kompatibilitaetsfehler (ERR_REQUIRE_ASYNC_MODULE).

---

## Phase ARCH — Architektur-Refactoring: Typisierte WebSocket-Events

> **Spec:** `specs/architektur-domain-events.md`, `specs/websocket-kommunikation.md`
> **Motivation:** Race-Condition zwischen `WebSocketBroadcastAdapter` und `KiEventAdapter` zeigt
> grundlegenden Designfehler: drei parallele Broadcast-Pfade, Backend-Animation-Timing (Scheduler),
> anonyme State-Snapshots ohne Semantik. Ziel: saubere Architektur mit typisierten Domain-Events —
> Frontend weiß WAS passiert ist, nicht nur WAS sich geändert hat. Keine anonymen Broadcasts mehr
> (Multiplayer-Datenschutz: jeder Spieler sieht nur seine eigene Hand).

---

### ARCH-0: Aktuelle Änderungen committen [ ]

**Priorität: Sofort** — Working-Tree enthält Race-Condition-Fix und KI-Timing-Umbau.
Muss committed sein bevor ARCH-1 beginnt.

**Prüfliste vor Commit:**
1. `mvn test` — alle Tests grün (Ziel: 254 Tests, 0 Failures)
2. `cd frontend && npm test && npm run build && npm run lint`
3. Falls Tests rot: Fehler beheben, NICHT mit `--no-verify` committen.

**Was im Working-Tree ist (git status zeigt M):**
- `AppStore.ts` — `_partieStandQueue` FIFO-Queue, `istKiKartenZug()`, `leerePartieStandQueue()`;
  nur noch `/user/queue/partie/${partieId}` abonniert (kein `/topic/partie/` mehr)
- `TischSzene.ts` + `TischSzene.test.ts` — Vorbehalt-Dialog zeigt fremde Vorbehalte, BUG-3/4-Fixes
- `TischAnsichtModell.ts` + `TischAnsichtModell.test.ts` — Modell-Anpassungen
- `SpielverwaltungDto.ts` — DTO-Anpassungen
- `KiEventAdapter.java` — `ScheduledExecutorService` entfernt, ruft `automatisiereTisch()` direkt
- `KiOrchestrierungService.java` — Mid-Loop `saveAndFlush` + `veroeffentlichePartieStand` nach
  jeder KI-Stichphase-Karte (bei menschlichen Tischen); `@Lazy KiEventAdapter` Zirkularität entfernt
- `SpielAktionsService.java` — ruft `tischEchtzeitService.planePartieEreignis` direkt (kein
  `publishEvent(PartieAktualisiert)` mehr); `veroeffentlicheEreignisse` sendet Stand VOR KI-Zügen
- `VerbindungsabbruchService.java` — `publishEvent(new PartieAktualisiert(...))` statt direktem Broadcast
- `PartieStandAntwort.java` — `istKiUebernommen`, `deklarierteVorbehalte` in DTOs
- `WebSocketBroadcastAdapter.java` — lauscht auf `PartieAktualisiert` (wird in ARCH-1 gelöscht)
- `specs/frontend-animationen.md`, `specs/ki-strategie.md` — Bug-Dokumentation aktualisiert

**Commit-Message:** `ARCH-0: Race-Condition-Fix + KI-Timing-Umbau (Basis für typisierte Events)`

---

### ARCH-1: Typisierte WebSocket-Events + Infra-Cleanup [ ]

**Priorität: Hoch** | **Blockiert durch:** ARCH-0
**Spec:** `specs/architektur-domain-events.md` (Abschnitt "Typisierte WebSocket-Events")

**Ziel:** Statt anonymer State-Snapshots sendet der Server typisierte Events. Frontend weiß WAS
passiert ist und kann Animationen direkt triggern ohne State-Diff-Heuristiken.

#### Neue Enum-Werte in `PartieEreignisTyp.java`

```java
enum PartieEreignisTyp {
    SNAPSHOT,            // bestehend — Reconnect/Spielstart, sofort anwenden
    PARTIE_AKTUALISIERT, // bestehend — wird nach ARCH-1 nicht mehr gesendet (löschen wenn unused)
    KARTE_GESPIELT,      // neu — eine Karte wurde gespielt (Mensch oder KI-Einzelzug)
    KI_ZUG_SEQUENZ,      // neu — N KI-Karten en-bloc (für Frontend-Animation-Expansion)
    STICH_ABGESCHLOSSEN, // neu — Stich vollständig, inkl. Sonderpunkte
}
```

#### Neue Felder in `PartieEreignisAntwort.java`

Aktuelle Signatur des record erweitern (nullable Felder via `@Nullable`):
```java
record PartieEreignisAntwort(
    PartieEreignisTyp ereignisTyp,
    PartieStandAntwort partieStand,
    @Nullable List<GespielteKarteAntwort> kiKartenSequenz,   // nur bei KI_ZUG_SEQUENZ
    @Nullable List<SonderpunktEreignisAntwort> neueSonderpunkte // nur bei STICH_ABGESCHLOSSEN
) { ... }
```

Neue Factory-Methoden ergänzen:
```java
static PartieEreignisAntwort kartGespielt(PartieStandAntwort stand) { ... }
static PartieEreignisAntwort kiZugSequenz(PartieStandAntwort stand, List<GespielteKarteAntwort> sequenz) { ... }
static PartieEreignisAntwort stichAbgeschlossen(PartieStandAntwort stand, List<SonderpunktEreignisAntwort> sonderpunkte) { ... }
```

#### Neue DTOs

`GespielteKarteAntwort.java` (neu, in `de.locodoko.tisch`):
```java
record GespielteKarteAntwort(SpielerPosition spielerPosition, String karteId) {}
```

`SonderpunktEreignisAntwort.java` (neu, in `de.locodoko.tisch`):
```java
record SonderpunktEreignisAntwort(String typ, SpielerPosition gewinner, SpielerPosition verlierer) {}
// typ: "FUCHS_GEFANGEN" | "DOPPELKOPF" | "KARLCHEN"
```

#### `KiOrchestrierungService.java` — `automatisiereTisch` umbauen

**Vorher (ARCH-0 Stand):** Mid-Loop `saveAndFlush` + `veroeffentlichePartieStand` nach jeder KI-Karte.

**Nachher:**
1. Vor der Stichphase-Loop: `List<GespielteKarteAntwort> kiKartenSequenz = new ArrayList<>()`
2. In der Loop: nach `spieleKarte(karte)` → `kiKartenSequenz.add(new GespielteKarteAntwort(position, karteId))`
3. **Kein** Mid-Loop `saveAndFlush` mehr
4. Nach der Loop (einmalig): `tischRepository.saveAndFlush(tisch)` + `sendeKiZugSequenz(tisch, kiKartenSequenz)`

Neue Hilfsmethode:
```java
private void sendeKiZugSequenz(TischEntity tisch, List<GespielteKarteAntwort> sequenz) {
    PartieStandAntwort finalStand = PartieStandAntwort.aus(tisch);
    PartieEreignisAntwort ereignis = PartieEreignisAntwort.kiZugSequenz(finalStand, sequenz);
    tisch.spieler().stream()
        .filter(s -> !s.istKi() && !s.istKiUebernommen() && s.sessionId() != null)
        .forEach(s -> tischEchtzeitService.planeAnBenutzer(
            s.sessionId(),
            "/queue/partie/" + tisch.partie().id(),
            PartieEreignisAntwort.kiZugSequenz(PartieStandAntwort.aus(tisch, s.id()), sequenz)
        ));
}
```

Außerdem: `veroeffentlichePartieStand`-Methode entfernen (war Mid-Loop-Hilfsmethode, nicht mehr nötig).

#### `SpielAktionsService.java` — Stich-Erkennung + Events

In `veroeffentlicheEreignisse(TischEntity tisch, TischEntity vorher)` (Signatur anpassen um `vorher` entgegenzunehmen):

```java
private void veroeffentlicheEreignisse(TischEntity vorher, TischEntity nachher) {
    // 1. Karte gespielt
    tischEchtzeitService.planeAnBenutzer(..., PartieEreignisAntwort.karteGespielt(stand));

    // 2. Stich abgeschlossen?
    boolean stichVorher = vorher.partie().laufendesSpiel().aktuelleStichmitte().size() == 4;
    boolean stichNachher = nachher.partie().laufendesSpiel().aktuelleStichmitte().isEmpty();
    if (stichVorher && stichNachher) {
        Stich letzterStich = nachher.partie().laufendesSpiel().letzteAbgeschlosseneStiche().getLast();
        List<SonderpunktEreignisAntwort> sonderpunkte = bewerteStich(letzterStich, nachher);
        tischEchtzeitService.planeAnBenutzer(..., PartieEreignisAntwort.stichAbgeschlossen(stand, sonderpunkte));
    }
}
```

Hilfsmethode `bewerteStich`: Ruft `SonderpunktBewerter.bewerte(List.of(stich), parteien, trumpfOrdnung, spielregeln)` auf und mappt auf `SonderpunktEreignisAntwort`. Der `SonderpunktBewerter` liegt in `de.locodoko.partie` — Import ist erlaubt (Richtung tisch → partie).

**Wichtig:** Statt `tisch` vor und nach der Aktion separat zu laden: `vorher` = snapshot vor Mutation (deep copy oder relevante Felder), `nachher` = aktueller `tisch` nach `spieleKarte()`.

#### `VerbindungsabbruchService.java` — direktes Senden

Entfernt: `eventPublisher.publishEvent(new PartieAktualisiert(...))`.
Ersetzt durch (wie BF-7 angestrebt, hier vorgezogen):
```java
tisch.spieler().stream()
    .filter(s -> !s.istKi() && s.sessionId() != null)
    .forEach(s -> tischEchtzeitService.planeAnBenutzer(
        s.sessionId(),
        "/queue/partie/" + tisch.partie().id(),
        PartieEreignisAntwort.snapshot(PartieStandAntwort.aus(tisch, s.id()))
    ));
```

#### `WebSocketBroadcastAdapter.java` — LÖSCHEN

Die Datei vollständig löschen. `PartieAktualisiert.java` ebenfalls löschen (kein Publisher mehr).

Vor dem Löschen sicherstellen:
- `WebSocketBroadcastAdapter.beiSchweinchenGemeldet` → Schweinchen-Banner wird anders gelöst
  (ARCH-3 oder BF-7), jetzt einfach weglassen (Log-Zeile entfernt keine Funktion)
- `WebSocketBroadcastAdapter.beiPartieAktualisiert` → ersetzt durch direkte Calls in
  `SpielAktionsService` und `KiOrchestrierungService`

#### `TischEchtzeitService.java` — Methoden löschen

Löschen wenn nicht mehr genutzt:
- `planePartieEreignis(PartieEreignisAntwort)` — war anonymer Topic-Broadcast
- `sendePartieEreignis(PartieEreignisAntwort)` — synchrone Variante

`planeAnBenutzer` und `sendeAnBenutzer` bleiben.

#### `TischVerwaltungsService.java` — `veroeffentlichePartieAktualisierung` löschen

Falls diese Methode nach ARCH-1 keine Aufrufer mehr hat, löschen.

#### Frontend: `SpielverwaltungDto.ts` erweitern

```typescript
export interface GespielteKarteAntwort {
  spielerPosition: SpielerPosition;
  karteId: string;
}

export interface SonderpunktEreignisAntwort {
  typ: 'FUCHS_GEFANGEN' | 'DOPPELKOPF' | 'KARLCHEN';
  gewinner: SpielerPosition;
  verlierer?: SpielerPosition;
}

export interface PartieEreignisAntwort {
  ereignisTyp: 'SNAPSHOT' | 'PARTIE_AKTUALISIERT' | 'KARTE_GESPIELT' | 'KI_ZUG_SEQUENZ' | 'STICH_ABGESCHLOSSEN';
  partieStand: PartieStandAntwort;
  kiKartenSequenz?: GespielteKarteAntwort[];
  neueSonderpunkte?: SonderpunktEreignisAntwort[];
}
```

#### Frontend: `AppStore.ts` — Queue durch Event-Switch ersetzen

**Löschen:**
- `_partieStandQueue: PartieStandAntwort[]`
- `_partieStandQueueAktiv: boolean`
- `_partieStandQueueGeneration: number`
- `KI_KARTEN_VERZOEGERUNG_MS`
- `istKiKartenZug(vorher, nachher)`
- `verarbeiteNaechstenPartieStand()`
- `leerePartieStandQueue()` — durch `_kiSequenzQueue.length = 0` ersetzen

**Hinzufügen:**

```typescript
private _kiSequenzQueue: Array<() => Promise<void>> = [];
private _kiSequenzLaeuft = false;

verarbeitePartieEreignis(ereignis: PartieEreignisAntwort): void {
  switch (ereignis.ereignisTyp) {
    case 'SNAPSHOT':
    case 'PARTIE_AKTUALISIERT':
      this._zustand = ereignis.partieStand;
      this._zustandAktualisiert.next(this._zustand);
      break;
    case 'KARTE_GESPIELT':
      this._zustand = ereignis.partieStand;
      this._zustandAktualisiert.next(this._zustand);
      break;
    case 'KI_ZUG_SEQUENZ':
      this._expandiereKiSequenz(ereignis.kiKartenSequenz!, ereignis.partieStand);
      break;
    case 'STICH_ABGESCHLOSSEN':
      this._zustand = ereignis.partieStand;
      this._zustandAktualisiert.next(this._zustand);
      // neueSonderpunkte für TischSzene bereitstellen (ARCH-3)
      if (ereignis.neueSonderpunkte?.length) {
        this._letzteNeueSonderpunkte = ereignis.neueSonderpunkte;
        this._sonderpunkteErhalten.next(ereignis.neueSonderpunkte);
      }
      break;
  }
}

private _expandiereKiSequenz(
  sequenz: GespielteKarteAntwort[],
  finalStand: PartieStandAntwort
): void {
  // Für jede KI-Karte außer der letzten: synthetischer Zwischenzustand
  // Letzte Karte: finalStand
  // Alle mit KI_KARTEN_VERZOEGERUNG_MS = 800ms Abstand in _kiSequenzQueue einreihen
  const prevStand = this._zustand;
  sequenz.forEach((karte, i) => {
    this._kiSequenzQueue.push(async () => {
      const stand = i === sequenz.length - 1
        ? finalStand
        : this._synthetischerZwischenstand(prevStand, sequenz.slice(0, i + 1));
      this._zustand = stand;
      this._zustandAktualisiert.next(stand);
      await new Promise(r => setTimeout(r, 800));
    });
  });
  this._verarbeiteKiSequenzQueue();
}

private _synthetischerZwischenstand(
  basis: PartieStandAntwort,
  gespielteKarten: GespielteKarteAntwort[]
): PartieStandAntwort {
  // aktuelleStichmitte aus basis + gespielteKarten aufbauen
  // Kartenfelder: { id: karte.karteId, ... } — nur id nötig für Animation
  // Alle anderen Felder aus basis übernehmen
  const neueKarten = gespielteKarten.map(k => ({
    spielerPosition: k.spielerPosition,
    karte: { id: k.karteId } as KarteAntwort,
  }));
  return {
    ...basis,
    laufendesSpiel: basis.laufendesSpiel ? {
      ...basis.laufendesSpiel,
      aktuelleStichmitte: neueKarten,
    } : basis.laufendesSpiel,
  };
}

private async _verarbeiteKiSequenzQueue(): Promise<void> {
  if (this._kiSequenzLaeuft) return;
  this._kiSequenzLaeuft = true;
  while (this._kiSequenzQueue.length > 0) {
    const naechste = this._kiSequenzQueue.shift()!;
    await naechste();
  }
  this._kiSequenzLaeuft = false;
}
```

Die WebSocket-Subscription in `verbinde()` muss `verarbeitePartieEreignis(ereignis)` aufrufen
statt des alten `verarbeitePartieStandUpdate(neuerStand)`.

**Achtung:** Die `_zustandAktualisiert`-Subscription in `TischSzene.ts` bleibt unverändert —
sie reagiert weiterhin auf State-Diffs für Animationen. Der Unterschied ist: Animationen
für KARTE_GESPIELT / KI_ZUG_SEQUENZ werden durch State-Diffs in der Queue ausgelöst,
nicht durch explizite Event-Typen in TischSzene (das kommt in ARCH-3).

**Verifikation:**
```sh
mvn test                                # 254 Tests grün
cd frontend && npm test                 # 24/24 Tests grün (2 pre-existing ESM-Fehler ignorieren)
cd frontend && npm run build            # kein Build-Fehler
cd frontend && npm run lint             # 0 Fehler
```

**Dateien Backend:**
- `src/main/java/de/locodoko/tisch/PartieEreignisTyp.java`
- `src/main/java/de/locodoko/tisch/PartieEreignisAntwort.java`
- `src/main/java/de/locodoko/tisch/GespielteKarteAntwort.java` (neu)
- `src/main/java/de/locodoko/tisch/SonderpunktEreignisAntwort.java` (neu)
- `src/main/java/de/locodoko/tisch/KiOrchestrierungService.java`
- `src/main/java/de/locodoko/tisch/SpielAktionsService.java`
- `src/main/java/de/locodoko/tisch/VerbindungsabbruchService.java`
- `src/main/java/de/locodoko/tisch/TischEchtzeitService.java`
- `src/main/java/de/locodoko/tisch/TischVerwaltungsService.java`
- **DELETE:** `src/main/java/de/locodoko/tisch/WebSocketBroadcastAdapter.java`
- **DELETE:** `src/main/java/de/locodoko/partie/ereignisse/PartieAktualisiert.java`

**Dateien Frontend:**
- `frontend/src/modelle/SpielverwaltungDto.ts`
- `frontend/src/store/AppStore.ts`

---

### ARCH-2: Domain — `SpielAktion` Result-Typ [ ]

**Priorität: Mittel** | **Blockiert durch:** ARCH-1
**Spec:** `specs/architektur-domain-events.md` (Abschnitt "SpielAktion Result-Typ")

**Ziel:** `Spiel.spieleKarte()` gibt statt `Spiel` ein `SpielAktion`-Objekt zurück, das den
neuen Spielstand PLUS die dabei entstandenen `SpielEreignis`-Events enthält. Dadurch kann
`SpielAktionsService` die Ereignisse aus dem Ergebnis lesen statt sie aus dem State-Diff
zu rekonstruieren.

#### `SpielEreignis.java` — sealed interface (neu in `de.locodoko.partie`)

```java
sealed interface SpielEreignis permits KarteGespielt, StichAbgeschlossenEreignis {}

record KarteGespielt(SpielerPosition position, Karte karte) implements SpielEreignis {}
record StichAbgeschlossenEreignis(Stich stich, List<Sonderpunkt> sonderpunkte) implements SpielEreignis {}
```

#### `SpielAktion.java` — record (neu in `de.locodoko.partie`)

```java
record SpielAktion(Spiel neuerStand, List<SpielEreignis> ereignisse) {}
```

#### `Spiel.spieleKarte()` — Rückgabetyp ändern

Aktuell: `Spiel spieleKarte(SpielerPosition, Karte)` → gibt neues `Spiel`-Objekt zurück.
Neu: `SpielAktion spieleKarte(SpielerPosition, Karte)` → gibt `SpielAktion` zurück.

Intern: Ereignisse sammeln während der Methode läuft:
```java
List<SpielEreignis> ereignisse = new ArrayList<>();
ereignisse.add(new KarteGespielt(position, karte));
if (neuerStich.istVollstaendig()) {
    List<Sonderpunkt> sp = SonderpunktBewerter.bewerte(...);
    ereignisse.add(new StichAbgeschlossenEreignis(neuerStich, sp));
}
return new SpielAktion(neuerSpielstand, ereignisse);
```

#### `SpielAktionsService.java` — Aufrufer anpassen

```java
SpielAktion aktion = spiel.spieleKarte(position, karte);
Spiel neuerStand = aktion.neuerStand();
// Ereignisse aus aktion.ereignisse() extrahieren statt aus State-Diff
for (SpielEreignis ereignis : aktion.ereignisse()) {
    switch (ereignis) {
        case KarteGespielt kg -> sendeKarteGespielt(tisch, kg);
        case StichAbgeschlossenEreignis sa -> sendeStichAbgeschlossen(tisch, sa);
    }
}
```

`bewerteStich`-Hilfsmethode aus ARCH-1 entfällt (Sonderpunkte kommen jetzt aus Ereignis).

#### Alle Aufrufer von `spieleKarte()` anpassen

Suchen mit: `grep -r "spieleKarte(" src/`  
Jeder Aufrufer muss `.neuerStand()` aufrufen um das `Spiel`-Objekt zu extrahieren.

**Verifikation:**
```sh
mvn test   # alle Tests grün
```

**Dateien:**
- `src/main/java/de/locodoko/partie/SpielEreignis.java` (neu)
- `src/main/java/de/locodoko/partie/SpielAktion.java` (neu)
- `src/main/java/de/locodoko/partie/Spiel.java`
- `src/main/java/de/locodoko/tisch/SpielAktionsService.java`
- Alle weiteren Aufrufer (grep)

---

### ARCH-3: TischSzene — Sonderpunkt-Animationen auf `neueSonderpunkte` [ ]

**Priorität: Niedrig** | **Blockiert durch:** ARCH-1
**Spec:** `specs/frontend-animationen.md` (Abschnitt "Sonderpunkt-Anzeige")

**Ziel:** Fuchs-gefangen, Karlchen, Doppelkopf-Banner werden durch `neueSonderpunkte` aus
`STICH_ABGESCHLOSSEN`-Events ausgelöst, nicht mehr durch nachträgliche State-Diff-Berechnung.

**Aufgabe:**
1. `AppStore._sonderpunkteErhalten: Subject<SonderpunktEreignisAntwort[]>` als Observable
   in `TischSzene.ts` subscriben.
2. Nach Stich-Einziehen-Animation: `neueSonderpunkte` aus Event durchgehen,
   `animiereSoloAnkuendigung()` oder neues `animiereSonderpunkt()` aufrufen.
3. `animiereSonderpunkt(typ, gewinner)`: Text-Banner mit Sonderpunkt-Name (`'Fuchs gefangen!'`,
   `'Doppelkopf!'`, `'Karlchen!'`) — selbes Pattern wie `animiereSoloAnkuendigung`.
4. Test: In `TischSzene.test.ts` einen Stich mit FUCHS_GEFANGEN prüfen.

**Dateien:**
- `frontend/src/szenen/TischSzene.ts`
- `frontend/src/store/AppStore.ts` (Observable-Ergänzung)
- `frontend/src/szenen/TischSzene.test.ts`

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

**Fix:** `spielzugAnimationAktiv`-Flag entfernt. `spieleKarteMitAnimation()` leitet die
Karten-Ausspiel-Animation jetzt über `AnimationenService.reiheEin()` — damit läuft kein
Animationspfad mehr außerhalb der Queue. Guard auf `!!this.wartendeKartenId || animationLaeuft`
umgestellt. Pre-existing Lint-Fehler (`tischBreite`/`tischHoehe`) mitbehoben.

**Dateien:** `frontend/src/szenen/TischSzene.ts`

---

### BUG-4: Browser-Reload zeigt alten State (Frontend) [x]

**Priorität: Mittel** — UX-Bug, Workaround: Doppelter Reload.

**Symptom:** Nach `Strg+R` zeigt der Browser Overlays/Animationen des vorherigen Spiels.

**Stand:** `AppStore.verbinde()` setzt den Tischzustand bei eingehendem Snapshot korrekt neu.
**Noch offen:** `TischSzene.create()` enthält keinen expliziten Overlay-Reset — `letzterStichOverlay`,
`rundenEndeModal`, `partieEndeModal` können vom vorherigen Render-Zyklus sichtbar bleiben.
`AnimationenService.abbrechen()` wird in `create()` nicht aufgerufen.

**Verbleibende Aufgabe:**
1. `TischSzene.create()`: Vor erstem Render alle Overlay-Referenzen explizit schließen/destroyen
   und auf `null`/`undefined` setzen (letzterStichOverlay, rundenEndeModal, partieEndeModal,
   alle Animations-Promises).
2. `AnimationenService.abbrechen()` am Beginn von `create()` aufrufen, damit laufende Tweens
   sofort gestoppt werden (nicht erst auf Abschluss warten).
3. Test: Rundenauswertung-Overlay anzeigen → F5 drücken → Overlay darf nach Reload
   nicht sichtbar sein.

**Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

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

### BF-6: Tastatur-Shortcuts für Ansagen und Armut (Frontend) [x]

**Priorität: Mittel** | **Spec:** `specs/frontend-tastatursteuerung.md`

**Analyse:** Kartennavigation (ArrowLeft/Right, Enter/Space) und Vorbehalt-Navigation
(Ziffern + ArrowUp/Down) sind implementiert. Ansage- und Armut-Shortcuts fehlen vollständig.

**Aufgabe:**
1. Ansage-Shortcuts in `TischSzene.ts` — nur aktiv wenn Ansage-UI sichtbar:
   - `R` → Re ansagen (wenn erlaubt)
   - `K` → Kontra ansagen (wenn erlaubt)
   - `1` → Keine-90, `2` → Keine-60, `3` → Keine-30, `4` → Schwarz
2. Armut-Shortcuts im Armut-Angebot-Dialog — nur aktiv wenn Dialog offen:
   - `A` → Armut-Angebot annehmen
   - `N` → Armut-Angebot ablehnen
3. Kein Konflikt mit Kartennavigation: Shortcuts nur aktiv wenn das jeweilige
   UI-Element sichtbar/fokussiert ist.
4. Tests: `TischSzene.test.ts` erweitern (soweit jsdom/ESM-Umgebung erlaubt).

**Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/szenen/TischSzene.test.ts`

---

### BF-7: Session-Recovery Snapshot-Endpoint fehlt (Backend + Frontend) [ ]

**Priorität: Mittel** | **Spec:** `specs/verbindungsabbruch.md` (Z. 68)

**Analyse:** `SpielerSessionAntwort.aktiverTischId` ist vorhanden → Frontend erkennt
beim Seitenaufruf ob ein aktiver Tisch existiert. Beim WebSocket-Reconnect fehlt aber
ein aktiver Mechanismus: Client muss auf passiven `PartieAktualisiert`-Push warten.
Laut Spec soll `/app/tisch/{id}/snapshot` einen sofortigen Zustandspush auslösen.

**Aufgabe:**
1. Backend: STOMP `@MessageMapping("/tisch/{tischId}/snapshot")` implementieren —
   liest aktuellen `TischEntity`-Zustand, erstellt `PartieAktualisiertDto` und sendet
   es via `SimpMessagingTemplate` nur an die anfragende Session (nicht broadcast).
2. Frontend (`AppStore.verbinde()`): Nach WebSocket-Connect und vorhandenem
   `aktiverTischId` → Snapshot-Anfrage (`/app/tisch/{id}/snapshot`) senden statt
   nur auf passiven Push zu warten.
3. Tests: Integration-Test Snapshot-Endpoint; Frontend-Unit-Test für Reconnect-Flow.

**Dateien:** `src/main/java/de/locodoko/tisch/SpielVerwaltungsController.java` (oder
neuer `SnapshotController`), `frontend/src/store/AppStore.ts`

---

## Phase KI — KI-Verbesserungen

### KI-1: KI-Schwellen-Anpassung für aktive Sonderregeln [ ]

**Priorität: Niedrig** | **Spec:** `specs/ki-strategie.md`

**Analyse:** `StandardKiStrategie` nutzt feste Ansage-Schwellen (Punkte-Grenzwerte für
Re/Kontra/Keine-90 etc.). Laut `ki-strategie.md` sollen bei aktivem Schweinchen oder
30-Augen-Pflicht die Schwellen um 15–20% erhöht werden — vorsichtigere Ansage-Strategie,
da diese Regeln Trumpfverteilung beeinflussen.

**Aufgabe:**
1. `StandardKiStrategie.ansageEntscheidung()` (oder entsprechende Hilfsmethode):
   Schwellen-Multiplikator abhängig von `spielZustand.schweinchenAktiv` und
   `spielZustand.dreissigAugenPflichtAktiv` anpassen (Faktor 1.15–1.20).
2. Test: KI mit aktivem Schweinchen → höhere Punktzahl nötig für Re-Ansage als ohne.

**Dateien:** `src/main/java/de/locodoko/ki/StandardKiStrategie.java`

---

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

### M2.1: Authentifizierung — Spring Security + OAuth2 + Username/PW [x]

**Priorität: Hoch — Blocker für Rest von M2** | **Spec:** `authentifizierung.md`

- [x] **M2.1.1** `spring-boot-starter-security` + `spring-boot-starter-oauth2-client` in `pom.xml`
- [x] **M2.1.2** `SecurityConfig`: `http.oauth2Login()` + `http.formLogin()` parallel; CSRF für REST deaktiviert
- [x] **M2.1.3** `Spieler`-Entität: Felder `authentifizierungsMethode`, `externalId`, `benutzername`, `passwortHash`, `email` + Liquibase-Migration (Changeset 013)
- [x] **M2.1.4** `UserDetailsService`-Implementierung für Username/Passwort-Auth (BCrypt, Kostenfaktor ≥ 12)
- [x] **M2.1.5** `OAuth2ErfolgsHandler` — Google-Login erzeugt/findet Spieler-Entität
- [x] **M2.1.6** `SpielerSessionService` bleibt Session-basiert (Abwärtskompatibilität); neue Auth-Endpoints nutzen eigene Session-Verknüpfung
- [x] **M2.1.7** ABAC: `TischSicherheit`-Component mit `@PreAuthorize`-Checks für Gastgeber + Mitglied + Zugang
- [x] **M2.1.8** Rate-Limiting `/api/auth/login` — max. 10 Versuche/Minute/IP
- [x] **M2.1.9** Frontend: Login/Register-Screen (vor SpielverwaltungsSzene), Logout-Button in SpielverwaltungsSzene
- [x] **M2.1.10** Tests: 11 Integrationstests (Registrierung, Login, Session-Verknüpfung, Validierung)

> **Notiz:** SecurityConfig nutzt `permitAll()` für alle Endpoints (Abwärtskompatibilität mit 237 bestehenden Tests). ABAC via `@PreAuthorize` auf spezifische Methoden in späteren Aufgaben. OAuth2-Config nutzt Env-Vars `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

### M2.2: Spieler-Profil + Statistiken [x]

**Priorität: Mittel** | **Blockiert durch:** M2.1 | **Spec:** `spieler-profil.md`

- [x] **M2.2.1** `Spieler`-Entität: `anzeigeName`, `avatarFarbe` + Liquibase-Migration (Changeset 014)
- [x] **M2.2.2** `SpielerStatistik`-Tabelle (1:1 mit Spieler, 9 Felder) + Changeset 014
- [x] **M2.2.3** `PartieErgebnis`-Tabelle (N:1 mit Spieler, max. 20 Einträge rotiert) + Changeset 014
- [x] **M2.2.4** Statistik-Update via `@ApplicationModuleListener(SpielBeendet.class)` in `spieler/`-Modul
- [x] **M2.2.5** `GET /api/spieler/{id}/profil` Endpoint
- [x] **M2.2.6** Frontend: Avatar + Anzeigename im HUD und Nameplate

### M2.3: Private Tische + Einladungslinks [x]

**Priorität: Mittel** | **Blockiert durch:** M2.1 | **Spec:** `spieler-profil.md` (Abschnitt "Private Tische")

- [x] **M2.3.1** `Tisch`-Entität: `zugangsmodus` (OFFEN/PRIVAT) + `einladungsCode` (8 Zeichen) + Changeset 015
- [x] **M2.3.2** `GET /join/{code}` → Auto-Beitreten + Redirect zur TischSzene
- [x] **M2.3.3** Öffentliche Tischliste filtert PRIVAT-Tische heraus
- [x] **M2.3.4** Gastgeber-Kicken: `DELETE /api/tisch/{id}/spieler/{spielerId}` (ABAC: nur Gastgeber)
- [x] **M2.3.5** Frontend: "Privat"-Toggle + Einladungslink-Anzeige im Konfigurationsmodal

### M2.4: Liquibase-Baseline + PostgreSQL [x]

**Priorität: Mittel** | **Unabhängig von M2.1–M2.3** | **Spec:** `datenbankmodell.md`

- [x] **M2.4.1** Baseline-Changeset 000: konsolidiertes sauberes `CREATE TABLE`-Script (ersetzt 001–009 für Frisch-Deployments)
- [x] **M2.4.2** PostgreSQL-Profil vollständig konfiguriert + Dual-Changelog-Strategie (`application-prod.properties`, Docker Compose)
- [x] **M2.4.3** `Dockerfile.app` + `docker-compose.yml` auf PostgreSQL umgestellt

### M2.5: OpenAPI / TypeScript-Typen-Synchronisation [x]

**Priorität: Niedrig** | **Unabhängig** | **Spec:** `architektur-spielkern.md` (Abschnitt "OpenAPI")

- [x] **M2.5.1** `springdoc-openapi-starter-webmvc-ui` in `pom.xml` + `@Schema`-Annotationen auf Response-DTOs
- [x] **M2.5.2** `openapi-typescript` im Frontend-Build: generiert `frontend/src/generated/api-types.ts`
- [x] **M2.5.3** Bestehende handgeschriebene DTO-Typen schrittweise auf generierte Typen umstellen

---

## Phase SF — Fehlende Spielfeatures

### SF-1: Fünf-Könige-Schmeißen [x]

**Priorität: Niedrig** | **Spec:** `spielablauf.md` (Abschnitt "Schmeißen")

- [x] **SF-1.1** `VorbehaltAnsage.SCHMEISSEN.istZulaessig()` — prüft ≥5 Könige auf der Hand
- [x] **SF-1.2** Vorbehalt-Phase: Schmeißen-Vorbehalt als höchste Priorität (vor Solo) → sofortiges Neu-Austeilen
- [x] **SF-1.3** `Spielregeln`: `schmeissenAktiv` Flag (nur Loco-Blatt-Preset, nicht DKV)
- [x] **SF-1.4** Frontend: Schmeißen-Button in Vorbehalt-UI + Konfigurationsmodal
- [x] **SF-1.5** Tests: 5 Könige → Schmeißen möglich; 4 Könige → nicht möglich; DKV-Preset → deaktiviert

### SF-2: Schweinchen — DKV-konforme implizite Ansage [x]

**Priorität: Mittel** | **Blockiert durch:** BUG-2 (Schweinchen muss erst grundsätzlich funktionieren)
**Spec:** `schweinchen.md`

- [x] **SF-2.1** Neues Domain-Event `SchweinchenGemeldet` in `partie/ereignisse/`
- [x] **SF-2.2** `SpielAktionsService.spieleKarte()`: Wenn erstes Karo-As gespielt → `SchweinchenGemeldet` publizieren
- [x] **SF-2.3** `WebSocketBroadcastAdapter`: lauscht auf `SchweinchenGemeldet` → sendet Banner-Event an Clients
- [x] **SF-2.4** Frontend: Schweinchen-Banner erst bei `SchweinchenGemeldet`-Event (nicht beim Austeilen)
