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

## WebSocket-Broadcasts als Event-Subscriber

Auch `TischEchtzeitService` wird zum Event-Subscriber, statt direkt aufgerufen zu werden:

```java
@Component
public class WebSocketBroadcastAdapter {

    @ApplicationModuleListener
    public void beiSpielAktualisiert(KarteGespielt event) {
        PartieStandAntwort antwort = partieStandAssembler.erstelle(event.tischId());
        tischEchtzeitService.sendePartieUpdate(event.tischId(), antwort);
    }

    @ApplicationModuleListener
    public void beiStichAbgeschlossen(StichAbgeschlossen event) {
        // Animationshinweis an Clients senden
    }
}
```

Dadurch hat `SpielAktionsService` keine direkte Abhängigkeit mehr auf `TischEchtzeitService`.

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

## Reihenfolge der Implementierung

Domain Events werden **nach** dem SpielBuilder und dem Service-Split eingeführt.
Voraussetzungen:

1. `SpielBuilder` existiert (R1) — Events brauchen saubere `Spiel`-Snapshots
2. `SpielAktionsService` existiert (R3) — zentraler Ort für `publishEvent()`
3. `KiOrchestrierungService` ist bereinigt (R4) — "Konkurrenzsituation" mit Events vermeiden

Danach:
- `NaechsterSpielerErwartet` einführen
- `KiEventAdapter` als einziger KI-Aufrufer
- `WebSocketBroadcastAdapter` als einziger Broadcast-Sender
- Alle `if (isKi())` entfernen

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
