# Architektur Domain Events — Locodoko

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe                                              |
| Priorität      | Kritisch                                                    |
| Abhängigkeiten | architektur.md, architektur-spielkern.md                    |

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

## Invariante: partieStand trägt immer den Zustand NACH dem Event

**Gesetz:** Jedes WebSocket-Event, das einen `partieStand` enthält, repräsentiert den
Spielstand **nach** Anwendung des Events — niemals den Zustand davor.

Begründung: Das Frontend operiert während einer laufenden Animation auf dem bereits
korrekten Endzustand. Eine gespielte Karte liegt im `partieStand` nicht mehr in der Hand
des Spielers, auch wenn die Animations-Queue sie noch fliegen lässt. Damit ist
ausgeschlossen, dass ein User auf eine Karte klickt, die aus Sicht des Servers bereits
verbraucht ist.

Technisch sichergestellt: `tischRepository.save()` in `SpielAktionsService` und
`KiOrchestrierungService` wird **immer vor** `tischEchtzeitService.planeAnBenutzer()`
abgeschlossen.

---

## Zwei Event-Ebenen

### 1. Interne Domain Events (`partie.ereignisse.*`)

Werden von Spring Modulith innerhalb des Backends verarbeitet. Nie direkt an das Frontend gesendet.

| Event | Ausgelöst durch | Listener |
|-------|----------------|---------|
| `NaechsterSpielerErwartet` | `SpielAktionsService` nach Kartenzug | `KiTischOrchestrator` |
| `VorbehaltErwartet` | `SpielAktionsService` in VORBEHALT_ANSAGE-Phase | `KiTischOrchestrator` |
| `SchweinchenGemeldet` | `SpielAktionsService` bei erster Dullen-Trumpf-Karte | — (kein WS-Broadcast implementiert) |
| `FuchsGefangen` | `SpielAktionsService` nach Stich-Abschluss | — (Sonderpunkt in `neueSonderpunkte` des `STICH_ABGESCHLOSSEN`-Events) |
| `KarlchenGespielt` | `SpielAktionsService` nach letztem Stich | — (Sonderpunkt in `neueSonderpunkte` des `STICH_ABGESCHLOSSEN`-Events) |
| `DoppelkopfGestochen` | `SpielAktionsService` nach Stich-Abschluss | — (Sonderpunkt in `neueSonderpunkte` des `STICH_ABGESCHLOSSEN`-Events) |
| `HochzeitPartnerGefunden` | `Spiel.java` nach Stich-Abschluss | — (kein WS-Broadcast implementiert) |
| `SpielBeendet` | `PartieLifecycleService` | — (Seiten-Effekt: WS-Broadcast) |

### 2. WebSocket-Ereignisse (`PartieEreignisTyp`)

Werden über `/user/queue/partie/{partieId}` an verbundene Clients gesendet.
Der TypeScript-Typ `PartieEreignisTyp` in `SpielverwaltungDto.ts` ist **kanonisch** —
er muss jederzeit mit dem Java-Enum `PartieEreignisTyp` übereinstimmen.

| Typ | Gesendet von | Wann | Frontend-Aktion |
|-----|-------------|------|----------------|
| `SNAPSHOT` | `VerbindungsabbruchService` | Nach Reconnect | State sofort ersetzen |
| `SPIEL_GESTARTET` | `Partie`, `SpielAktionsService` | Runde beginnt / Einwurf | Karten-Austeilen Animation |
| `KARTE_GESPIELT` | `SpielAktionsService`, `KiOrchestrierungService` | Kartenzug | Karte animieren + State patchen |
| `STICH_ABGESCHLOSSEN` | `SpielAktionsService` | Stich vollständig | Stich-Animation + State patchen |
| `HOCHZEIT_PARTNER_GEFUNDEN` | `KiOrchestrierungService` (via `HochzeitPartnerGefunden`-Domain-Event) | Hochzeits-Partner ermittelt | Banner „Partner gefunden!" + Partei anzeigen |
| `AKTION_ABGELEHNT` | `SpielAktionsService` | Ungültige Aktion (z.B. falsche Karte) | Fehlermeldung anzeigen |
| `SPIEL_BEENDET` | `PartieLifecycleService` | Spiel ausgewertet | Auswertungs-Overlay anzeigen |

---

## Frontend Event-Verarbeitung (Sequential Processing)

Um Race-Conditions zwischen Animationen und Zustands-Updates zu vermeiden, nutzt das Frontend eine **serielle Queue**:

1. **Eingang:** Jedes WebSocket-Event landet in der `AppStore._eventQueue`.
2. **Verarbeitung:** Die Queue wird nacheinander abgearbeitet. Für jedes Event gilt:
   - **Trigger Animation:** Die `TischSzene` startet die visuelle Darstellung (z.B. Karte fliegt).
   - **Wait:** Der Queue-Processor wartet auf das Ende der Animation.
   - **Apply State:** Erst jetzt wird der im Event enthaltene `partieStand` in den Store übernommen und das statische UI-Rendering ausgelöst.
   - **AI-Delay:** Bei KI-Zügen wird nach der Animation zusätzlich 800ms gewartet, bevor das nächste Event aus der Queue geholt wird.

Dies garantiert, dass Karten nicht "springen" und das Backend-Timing entkoppelt von der UI-Darstellung bleibt.

`KiTischOrchestrator` (im `tisch/`-Modul) reagiert auf `NaechsterSpielerErwartet` und `VorbehaltErwartet`.
**Pflicht:** Alle Listener nutzen `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)`, damit die KI-Orchestrierung erst nach dem Commit des auslösenden Spielzugs startet.

`SpielAktionsService` enthält kein `if (isKi())` mehr — ob Mensch oder KI spielt,
entscheidet ausschließlich der `KiTischOrchestrator` anhand von `SpielerEntity.isKi()`.

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
      STICH_ABGESCHLOSSEN → patch(partieStand) + sonderpunkteListener feuern
      AKTION_ABGELEHNT  → Fehlermeldung anzeigen
  → AppStore-Listener benachrichtigen
  → TischSzene re-rendert via aktualisiereUi()
```

Daneben können Komponenten via `AppStore.abonniereEvents(listener)` **rohe Events**
abonnieren — für dedizierte UI-Reaktionen (Modals, Banner), ohne Polling auf Zustandsdiffs.

---

## Sequenznummerierung & Self-Healing (`PartieEreignisBatch`)

Implementiert. Um Race-Conditions bei verlorenen WebSocket-Frames zu erkennen, nutzt das System das `PartieEreignisBatch`-Protokoll:

```typescript
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

Verbindungsabbrüche werden zusätzlich durch den `VerbindungsabbruchService` behandelt (STOMP-Reconnect → SNAPSHOT).
