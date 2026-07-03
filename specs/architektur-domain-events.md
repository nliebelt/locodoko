# Architektur Domain Events — Locodoko

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Detail-Spec (konsolidiert in architektur.md)                |
| Priorität      | Mittel                                                      |
| Abhängigkeiten | architektur.md, architektur-spielkern.md                    |

> **Hinweis:** Single Source of Truth ist `architektur.md`. Dieses Dokument vertieft den
> Event-Vertrag, die Event-Queue und Transaktionsgrenzen — bei Widersprüchen gilt `architektur.md`.

## Ziel

Entkopplung der KI-Orchestrierung von der Spiel-Engine durch Domain Events.
Die Engine weiß nicht ob der nächste Spieler ein Mensch oder eine KI ist.
Beide senden letztlich dasselbe Kommando zurück — für die Engine sind sie identisch.

Das ist die Grundlage für echten Multiplayer: jeder Spieler ist ein "Remote Agent"
der auf `NaechsterSpielerErwartet`-Events reagiert. Ob das Gehirn dahinter
Silikon oder Fleisch ist, spielt keine Rolle.

---

## Event-Publikations-Pattern (Pflicht-Regel)

**Einzig erlaubtes Pattern (Pattern A):** Aggregate-Methode gibt `List<SpielEreignis>` zurück → Service publiziert nach erfolgreichem `save()`:

```java
// Im Service — einzig erlaubtes Muster:
List<SpielEreignis> ereignisse = spiel.spieleKarte(pos, karte);
partieRepository.save(partie);                   // erst persistieren
ereignisse.forEach(publisher::publishEvent);     // dann publishen
```

**Verboten:**
- `@DomainEvents` / `@AfterDomainEventPublication` auf Aggregaten (Spring Data Event Buffer)
- In-Aggregate-Event-Buffer (kein `List<SpielEreignis> domainEvents` im Aggregat)
- `publisher.publishEvent(...)` vor `save()` (Zustand noch nicht persistiert)

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

Technisch sichergestellt: Die Persistenz (`save()` auf dem Partie-/Tisch-Aggregat) ist
**immer abgeschlossen, bevor** `TischEchtzeitService.planeAnBenutzer()` den Versand plant —
und der Versand selbst ist an `AFTER_COMMIT` gebunden.

---

## Zwei Event-Ebenen

### 1. Interne Domain Events (`partie.ereignisse.*`)

Werden von Spring Modulith innerhalb des Backends verarbeitet. Nie direkt an das Frontend gesendet.

**Naming-Konvention:** Jedes Event heißt `XyzGeschehen` oder `XyzErwartet` (Passiv-Partizip / Adjektiv). Der optionale Listener heißt `beiXyzGeschehen()` bzw. `beiXyzErwartet()`.

| Name | Produzent(en) | Konsument(en) | Trigger |
|------|---------------|---------------|---------|
| `NaechsterSpielerErwartet` | `SpielAktionsService` | `KiTischOrchestrator.beiNaechsterSpielerErwartet()` | Nach Kartenzug, Spiel läuft weiter |
| `VorbehaltErwartet` | `SpielAktionsService`, `KiTischOrchestrator` | `KiTischOrchestrator.beiVorbehaltErwartet()` | Vorbehalt-Phase: nächster Spieler gefragt |
| `SpielBeendet` | `PartieLifecycleService` | `SpielerProfilService.beiSpielBeendet()`, `SpielMetriken.beiSpielBeendet()` | Spiel ausgewertet |
| `FuchsGefangen` | `SpielAktionsService`, `KiTischOrchestrator` | — (aktuell kein Listener; WS via `neueSonderpunkte` in `STICH_ABGESCHLOSSEN`) | Stich enthält gegnerischen Fuchs |
| `KarlchenGespielt` | `SpielAktionsService`, `KiTischOrchestrator` | — (dito) | Letzter Stich mit Kreuz-Buben gewonnen |
| `DoppelkopfGestochen` | `SpielAktionsService`, `KiTischOrchestrator` | — (dito) | Stich ≥ 40 Augen |
| `SchweinchenGemeldet` | `KiTischOrchestrator` | — (WS-Event `SCHWEINCHEN_GEMELDET` läuft separat über `PartieEreignisAntwort`) | Erstes Karo-As einer Schweinchen-Hand gespielt |

Daneben existiert das **tisch-interne** `KiUebernahmeEreignis` (kein `partie.ereignisse`-Event) mit
Listener `KiTischOrchestrator.beiKiUebernahme()` — ausgelöst, wenn ein getrennter Spieler von der
KI übernommen wird.

**Abgrenzung — Aggregat-Ereignisse (`SpielEreignis`):** `Spiel`-Business-Methoden geben
`List<SpielEreignis>` zurück (`KarteGespielt`, `StichAbgeschlossenEreignis`, `SchweinchenGemeldet`,
`HochzeitPartnerGefunden`). Das sind **Rückgabewerte, keine Spring-Events** — der aufrufende Service
entscheidet, was daraus wird (WS-DTO, Domain-Event, Log).

### 2. WebSocket-Ereignisse (`PartieEreignisTyp`)

Werden über `/user/queue/partie/{partieId}` an verbundene Clients gesendet (Versand:
`TischEchtzeitService.planeAnBenutzer()`, DTOs: statische Factory-Methoden in
`PartieEreignisAntwort`). Der TypeScript-Typ `PartieEreignisTyp` in `SpielverwaltungDto.ts`
ist **kanonisch** — er muss jederzeit mit dem Java-Enum `PartieEreignisTyp` übereinstimmen.

| Typ | Ausgelöst von | Wann | Frontend-Aktion |
|-----|---------------|------|----------------|
| `SNAPSHOT` | `VerbindungsabbruchService`, Snapshot-Requests | Nach Reconnect / explizitem Request | State sofort ersetzen |
| `SPIEL_GESTARTET` | `SpielAktionsService`, `KiTischOrchestrator`, `PartieLifecycleService` | Runde beginnt / Einwurf | Karten-Austeilen-Animation |
| `KARTE_GESPIELT` | `SpielAktionsService`, `KiTischOrchestrator` | Kartenzug (Mensch oder KI) | Karte animieren + State patchen |
| `STICH_ABGESCHLOSSEN` | `SpielAktionsService`, `KiTischOrchestrator` | Stich vollständig (+ `neueSonderpunkte`) | Stich-Animation + Sonderpunkt-Banner + State patchen |
| `SPIEL_BEENDET` | `PartieLifecycleService` | Spiel ausgewertet | Auswertungs-Overlay anzeigen |
| `ANSAGE_ERFOLGT` | `SpielAktionsService`, `KiTischOrchestrator` | Re/Kontra/Absage getätigt | Ansage-Banner |
| `SCHWEINCHEN_GEMELDET` | `SpielAktionsService`, `KiTischOrchestrator` | Erstes Karo-As einer Schweinchen-Hand | Schweinchen-Banner |
| `HOCHZEIT_PARTNER_GEFUNDEN` | `SpielAktionsService`, `KiTischOrchestrator` (aus `SpielEreignis.HochzeitPartnerGefunden`) | Hochzeits-Partner ermittelt | Banner „Partner gefunden!" + Partei anzeigen |
| `AKTION_ABGELEHNT` | `SpielAktionsService` | Ungültige Aktion (z.B. falsche Karte) | Fehlermeldung anzeigen |

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
  ereignisse: PartieEreignisAntwort[];   // Atomare Liste (jedes Ereignis trägt seinen partieStand)
}
```

**Mechanismus:**
1. Backend leitet `version` direkt aus dem `@Version`-Feld des Partie-Aggregats ab — kein separater In-Memory-Zähler.
2. Frontend erkennt Lücken (`N+2` nach `N` → Batch `N+1` verloren).
3. Frontend fordert automatisch `/snapshot` an (Self-Healing).
4. Stale Batches (`version ≤ letzteVersion`) werden verworfen.

Verbindungsabbrüche werden zusätzlich durch den `VerbindungsabbruchService` behandelt (STOMP-Reconnect → SNAPSHOT).

---

## Sequenzdiagramme

### KarteGespielt

```
Client (HTTP POST /api/tisch/{id}/karte)
  │
  ▼
SpielAktionsService.spieleKarte(tischId, spielerId, karteId)
  │  lädt Partie via partieRepository.findById()
  │  ruft spiel.spieleKarte(pos, karte) → List<SpielEreignis>
  │  partieRepository.save(partie)         ← Commit
  │  publisher.publishEvent(KarteGespielt) ← nach save()
  │
  ├──▶ KiTischOrchestrator.beiNaechsterSpielerErwartet()  [AFTER_COMMIT, REQUIRES_NEW]
  │      └─▶ automatisiereTisch(): synchrone Schleife — spielt alle fälligen KI-Züge,
  │          bis ein Mensch am Zug oder das Spiel beendet ist (max. MAXIMALE_KI_AKTIONEN)
  │
  └──▶ TischEchtzeitService → WS-Broadcast KARTE_GESPIELT  [AFTER_COMMIT]
         payload: { hint: {pos, karteId}, partieStand: {...} }
           ▼
         AppStore._eventQueue → Animation → State-Patch
```

### StichAbgeschlossen

```
SpielAktionsService (nach 4. Karte im Stich)
  │  spiel.spieleKarte(...) → List<SpielEreignis>
  │    enthält SpielEreignis.StichAbgeschlossenEreignis(stich, sonderpunkte)
  │  partieRepository.save(partie)                    ← Commit
  │  publisher.publishEvent(FuchsGefangen/            ← nach save(), je Sonderpunkt
  │                         KarlchenGespielt/DoppelkopfGestochen)
  │
  └──▶ TischEchtzeitService → WS-Broadcast STICH_ABGESCHLOSSEN  [AFTER_COMMIT]
         payload: { stichGewinner, neueSonderpunkte: [...], partieStand: {...} }
           ▼
         AppStore: Stich-Animation → sonderpunkteListener → State-Patch
```

### SpielBeendet

```
PartieLifecycleService.beendeSpiel(tischId)
  │  spiel.werteAus() → Spielergebnis
  │  spielergebnisArchivRepository.save(archiv)   ← eigenes Aggregate
  │  partieRepository.save(partie)                ← Commit
  │  publisher.publishEvent(SpielBeendet)         ← nach save()
  │
  ├──▶ SpielerProfilService.beiSpielBeendet()      [@ApplicationModuleListener]
  │      └─▶ spielerStatistikRepository.save(...)  ← Statistik-Update
  ├──▶ SpielMetriken.beiSpielBeendet()             [@ApplicationModuleListener]
  │
  └──▶ TischEchtzeitService → WS-Broadcast SPIEL_BEENDET  [AFTER_COMMIT]
         payload: { ergebnis: {...}, partieStand: {...} }
           ▼
         AppStore → RundenEnde-Modal anzeigen
```
