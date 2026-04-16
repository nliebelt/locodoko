# Architektur Domain Events — Locodoko

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe                                              |
| Priorität      | Kritisch                                                    |
| Abhängigkeiten | architektur-ddd.md, architektur-spielkern.md                |

## Ziel

Entkopplung der KI-Orchestrierung von der Spiel-Engine durch Domain Events.
Die Engine weiß nicht ob der nächste Spieler ein Mensch oder eine KI ist.
Beide senden letztlich dasselbe Kommando zurück — für die Engine sind sie identisch.

Das ist die Grundlage für echten Multiplayer: jeder Spieler ist ein "Remote Agent"
der auf `NaechsterSpielerErwartet`-Events reagiert. Ob das Gehirn dahinter
Silikon oder Fleisch ist, spielt keine Rolle.

---

## Domain Events

Domain Events beschreiben etwas das **passiert ist** (Vergangenheitsform, Deutsch).

### Definierte Events

| Event | Ausgelöst wann | Enthält |
|-------|---------------|---------|
| `KarteGespielt` | Nach `Spiel.spieleKarte()` | `tischId`, `spielerPosition`, `karte`, `neuesSpiel` |
| `StichAbgeschlossen` | Wenn `aktuellerStich.istVollständig()` | `tischId`, `stich`, `gewinner` |
| `SpielGestartet` | Nach `Partie.starteNaechstesSpiel()` | `tischId`, `spielNummer` |
| `SpielBeendet` | Nach `Partie.schliesseAktuellesSpielAb()` | `tischId`, `ergebnis` |
| `PartieBeendet` | Nach letztem Spiel | `tischId`, `gesamtpunktestand` |
| `NaechsterSpielerErwartet` | Nach jedem vollständigen Spielzug | `tischId`, `spielerPosition`, `erlaubteAktionen` |
| `VorbehaltErwartet` | In VORBEHALT_ANSAGE-Phase | `tischId`, `spielerPosition` |
| `ArmutAntwortErwartet` | In ARMUT_TAUSCH-Phase | `tischId`, `spielerPosition` |

### Implementierung

Spring's `ApplicationEventPublisher` — kein externes Framework, keine neue Dependency.

```java
// Im SpielAktionsService nach jeder Mutation:
eventPublisher.publishEvent(new NaechsterSpielerErwartet(tischId, position, erlaubteAktionen));
```

Events sind `record`s im Package `de.locodoko.partie.ereignisse`.

---

## KI als Event-Subscriber (Reactive AI)

`KiEventAdapter` reagiert auf `NaechsterSpielerErwartet` — `SpielAktionsService` enthält kein `if (isKi())` mehr:

```java
@Component
public class KiEventAdapter {

    @ApplicationModuleListener
    public void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet event) {
        SpielerEntity spieler = spielerRepository.findeAnTisch(event.tischId(), event.position());
        if (!spieler.isKi()) return;  // Menschen reagieren selbst via WebSocket

        // KI-Delay nur wenn Mensch am Tisch sitzt
        boolean menschAmTisch = tischRepository.hatMenschlichenSpieler(event.tischId());
        if (menschAmTisch) {
            Thread.sleep(KI_DELAY_MS);  // oder Scheduler
        }

        KiStrategie ki = kiStrategieFactory.erstelle(spieler.kiSchwierigkeit());
        Karte karte = ki.waehleKarte(erstelleKiSpielzustand(event));
        spielAktionsService.karteSpielenFuer(event.tischId(), karte, event.position());
    }
}
```

Für echten Multiplayer: `KiEventAdapter` und `WebSocketBroadcastAdapter` laufen parallel — der Spielkern bemerkt keinen Unterschied.

---

## Typisierte WebSocket-Events (ARCH-1 / ARCH-2)

Statt anonymer State-Snapshots sendet der Server typisierte Events über `PartieEreignisTyp`:

| Event-Typ | Wann gesendet | Zusatzdaten |
|-----------|--------------|-------------|
| `SNAPSHOT` | Reconnect, Spielstart | — (kompletter Stand) |
| `KARTE_GESPIELT` | Nach menschlichem Zug (vor KI-Folgezügen) | — |
| `KI_ZUG_SEQUENZ` | Nach Abschluss aller KI-Folgezüge | `kiKartenSequenz: GespielteKarteAntwort[]` |
| `STICH_ABGESCHLOSSEN` | Wenn Stich vollständig (4 Karten) | `neueSonderpunkte: SonderpunktEreignisAntwort[]` |

**Kein anonymer Broadcast** — alle Events gehen ausschließlich an `/user/queue/partie/{id}`.
Das garantiert Multiplayer-Datenschutz: jeder Spieler sieht nur seinen eigenen Partiestand.

**`WebSocketBroadcastAdapter` wird gelöscht** (ARCH-1). Broadcasts erfolgen direkt in
`SpielAktionsService` und `KiOrchestrierungService` via `TischEchtzeitService.planeAnBenutzer()`.

**`PartieAktualisiert`-Domain-Event wird gelöscht** (ARCH-1). Kein Publisher mehr.

## WebSocket-Broadcasts als Event-Subscriber

> **Veraltet (vor ARCH-1):** Der `WebSocketBroadcastAdapter` wurde als Event-Subscriber
> auf `PartieAktualisiert` implementiert. Ab ARCH-1 entfällt dieses Muster — direkte Calls
> in `SpielAktionsService` und `KiOrchestrierungService` ersetzen ihn.

~~Auch `TischEchtzeitService` wird zum Event-Subscriber, statt direkt aufgerufen zu werden:~~

---

## Transaktionsgrenzen

`@ApplicationModuleListener` ist der Standard — er entspricht `@TransactionalEventListener(phase = AFTER_COMMIT)` und ist zusätzlich asynchron. Broadcasts und KI-Züge laufen damit immer nach erfolgreichem DB-Commit in eigenen Transaktionen:

```java
@ApplicationModuleListener
public void beiKarteGespielt(KarteGespielt event) {
    tischEchtzeitService.sendePartieUpdate(...);
}
```

Für intra-modul-synchrone Events (innerhalb desselben Moduls, selbe Transaktion) kann `@EventListener` genutzt werden — im Cross-Modul-Kontext ist es verboten.

---

## SpielAktion Result-Typ (ARCH-2)

`Spiel.spieleKarte()` gibt ein `SpielAktion`-Objekt zurück statt `Spiel` direkt:

```java
// de.locodoko.partie
sealed interface SpielEreignis permits KarteGespielt, StichAbgeschlossenEreignis {}
record KarteGespielt(SpielerPosition position, Karte karte) implements SpielEreignis {}
record StichAbgeschlossenEreignis(Stich stich, List<Sonderpunkt> sonderpunkte) implements SpielEreignis {}

record SpielAktion(Spiel neuerStand, List<SpielEreignis> ereignisse) {}
```

`SpielAktionsService` liest Ereignisse aus dem Ergebnis statt State-Diffs zu berechnen:

```java
SpielAktion aktion = spiel.spieleKarte(position, karte);
for (SpielEreignis ereignis : aktion.ereignisse()) {
    switch (ereignis) {
        case KarteGespielt kg -> sendeKarteGespielt(tisch, kg);
        case StichAbgeschlossenEreignis sa -> sendeStichAbgeschlossen(tisch, sa.sonderpunkte());
    }
}
```

## Reihenfolge der Implementierung

Domain Events wurden in folgender Reihenfolge eingeführt:

1. `NaechsterSpielerErwartet` — zentrales Event (erledigt)
2. `KiEventAdapter` als einziger KI-Aufrufer (erledigt)
3. `WebSocketBroadcastAdapter` als Event-Subscriber auf `PartieAktualisiert` (erledigt, wird in ARCH-1 gelöscht)

**ARCH-1** (nächster Schritt): Typisierte WebSocket-Events, `WebSocketBroadcastAdapter` löschen
**ARCH-2**: `SpielAktion` Result-Typ in `Spiel.spieleKarte()`

---

## Ubiquitous Language in Events

Events spiegeln die Domänensprache wider:

```java
// Richtig (Domänensprache):
record NaechsterSpielerErwartet(UUID tischId, SpielerPosition position, ...) {}
record StichAbgeschlossen(UUID tischId, Stich stich, SpielerPosition gewinner) {}

// Falsch (technische Sprache):
record PlayerTurnEvent(String tableId, String position) {}
record TrickCompleted(int trickNumber) {}
```
