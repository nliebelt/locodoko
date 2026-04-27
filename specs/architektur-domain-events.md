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

## Transaktions-Garantien

**Gesetz:** Domain-Events dürfen niemals vor dem erfolgreichen Datenbank-Commit verarbeitet werden. Alle Listener mit Seiteneffekten (KI-Orchestrierung, WebSocket-Broadcasts) verwenden ausschließlich `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`.

Dies verhindert:
- KI-Züge, die auf einem noch nicht persistierten Spielstand reagieren
- WebSocket-Nachrichten, die einen Zustand beschreiben, der bei einem Rollback nie existiert hat

---

## Zwei Event-Ebenen

### 1. Interne Domain Events (`partie.ereignisse.*`)

Werden von Spring Modulith innerhalb des Backends verarbeitet. Nie direkt an das Frontend gesendet.

| Event | Ausgelöst durch | Listener |
|-------|----------------|---------|
| `NaechsterSpielerErwartet` | `SpielAktionsService` nach Kartenzug | `KiEventAdapter` |
| `VorbehaltErwartet` | `SpielAktionsService` in VORBEHALT_ANSAGE-Phase | `KiEventAdapter` |
| `SchweinchenGemeldet` | `SpielAktionsService` bei erster Dullen-Trumpf-Karte | — (noch kein WS-Broadcast) |
| `SpielBeendet` | `KiOrchestrierungService.veroeffentlicheSpielBeendet()` | — (Seiten-Effekt: WS-Broadcast) |

> **TODO:** `SchweinchenGemeldet` wird als Domain Event gepublisht, aber noch nicht
> als `SCHWEINCHEN_GEMELDET` WebSocket-Ereignis ans Frontend weitergeleitet.
> Sobald die UI ein Schweinchen-Banner zeigt, muss `KiEventAdapter` (oder ein separater
> `SchweinchenBroadcaster`) dieses Event in `PartieEreignisAntwort.schweinchen()` umwandeln.

### 2. WebSocket-Ereignisse (`PartieEreignisTyp`)

Werden über `/user/queue/partie/{partieId}` an verbundene Clients gesendet.
Der TypeScript-Typ `PartieEreignisTyp` in `SpielverwaltungDto.ts` ist **kanonisch** —
er muss jederzeit mit dem Java-Enum `PartieEreignisTyp` übereinstimmen.

| Typ | Gesendet von | Wann | Frontend-Aktion |
|-----|-------------|------|----------------|
| `SNAPSHOT` | `VerbindungsabbruchService`, `TischVerwaltungsService`, `SpielverwaltungWebSocketController` | Beitritt, Reconnect, expliziter `/snapshot`-Request | `leereKiSequenzQueue()` + State ersetzen |
| `KARTE_GESPIELT` | `SpielAktionsService` | Nach jedem Kartenzug (Mensch oder KI-Einzelkarte) | State patchen |
| `KI_ZUG_SEQUENZ` | `KiOrchestrierungService` | KI spielt mehrere Karten in einem Stich | Karten mit 800 ms Abstand animieren |
| `STICH_ABGESCHLOSSEN` | `SpielAktionsService` | Stich vollständig, ggf. Sonderpunkte | State patchen + Sonderpunkt-Listener feuern |
| `SPIEL_BEENDET` | `KiOrchestrierungService` | Spiel ausgewertet, nächstes gestartet | State patchen (Auswertungs-UI) |

---

## KI als Event-Subscriber (Reactive AI)

`KiEventAdapter` reagiert auf `NaechsterSpielerErwartet` und `VorbehaltErwartet`.
**Pflicht:** Alle Listener nutzen `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`, damit die KI-Orchestrierung erst nach dem Commit des auslösenden Spielzugs startet.

```java
@Component
public class KiEventAdapter {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet event) {
        // Delegiert an KiOrchestrierungService.automatisiereTisch()
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void beiVorbehaltErwartet(VorbehaltErwartet event) {
        // Delegiert an KiOrchestrierungService.automatisiereTisch()
    }
}
```

`SpielAktionsService` enthält kein `if (isKi())` mehr — ob Mensch oder KI spielt,
entscheidet ausschließlich der `KiEventAdapter` anhand von `SpielerEntity.isKi()`.

---

## Frontend Event-Verarbeitung

Der `AppStore` puffert eingehende `PartieEreignisAntwort`-Nachrichten in einer Queue
und verarbeitet sie **seriell** (Lock via `_verarbeiteEventLaeuft`), um Reihenfolge-
Garantien bei schnell aufeinanderfolgenden KI-Zügen zu gewährleisten.

```
WebSocket-Nachricht
  → AppStore._eventQueue.push()
  → _verarbeiteEventQueue() [seriell, async]
      SNAPSHOT          → leereKiSequenzQueue() + patch(partieStand)
      KARTE_GESPIELT    → patch(partieStand)
      SPIEL_BEENDET     → patch(partieStand)
      KI_ZUG_SEQUENZ    → Karten mit 800 ms Delay animieren, dann patch()
      STICH_ABGESCHLOSSEN → patch(partieStand) + sonderpunkteListener feuern
  → AppStore-Listener benachrichtigen
  → TischSzene re-rendert via aktualisiereUi()
```

Daneben können Komponenten via `AppStore.abonniereEvents(listener)` **rohe Events**
abonnieren — für dedizierte UI-Reaktionen (Modals, Banner), ohne Polling auf Zustandsdiffs.

---

## Geplant (noch nicht implementiert)

### Sequenznummerierung & Self-Healing

Um Race-Conditions bei verlorenen WebSocket-Frames zu erkennen, ist ein
`PartieEreignisBatch`-Protokoll geplant:

```typescript
// Geplant — noch nicht implementiert
export interface PartieEreignisBatch {
  version: number;                       // @Version des Partie-Aggregats — einzige Sequenznummer
  ereignisse: PartieEreignisAntwort[];   // Atomare Liste
  snapshot?: PartieStandAntwort;         // Korrektur-Snapshot bei Lücken
}
```

**Mechanismus:**
1. Backend leitet `version` direkt aus dem `@Version`-Feld des Partie-Aggregats ab — kein separater In-Memory-Zähler.
2. Frontend erkennt Lücken (`N+2` nach `N` → Batch `N+1` verloren).
3. Frontend fordert automatisch `/snapshot` an (Self-Healing).
4. Stale Batches (`version ≤ letzteVersion`) werden verworfen.

Bis zur Implementierung: Verbindungsabbrüche werden durch den bestehenden
`VerbindungsabbruchService` behandelt (STOMP-Reconnect → SNAPSHOT).
