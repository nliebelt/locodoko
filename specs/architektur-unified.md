# Locodoko Unified Architecture

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe                                              |
| Priorität      | Kritisch                                                    |
| Bezug          | architektur-ddd.md, websocket-kommunikation.md              |

## Kernprinzipien

Die Locodoko Unified Architecture löst das Synchronisationsproblem zwischen verteilten Clients durch eine strikte Trennung von **Zustand (Snapshots)** und **Veränderung (Events)**.

### 1. Versionierung als Single Source of Truth
Jede Partie besitzt eine streng monotone, aufsteigende **Version** (Sequenznummer). Diese Version wird im Backend via `@Version` (Optimistic Locking) verwaltet.
- Jede API-Antwort (REST) enthält die aktuelle Version.
- Jedes WebSocket-Ereignis enthält die Version, die **nach** Anwendung des Ereignisses erreicht wurde.

### 2. HTTP für Zustand (Snapshots)
Der vollständige Spielzustand ("Was ist jetzt?") wird ausschließlich über die REST-API geliefert:
`GET /api/partien/{id}/stand`
- Wird beim ersten Laden der Tisch-Szene aufgerufen.
- Dient zur Heilung bei Sequenz-Lücken (Self-Healing).

### 3. WebSockets für Veränderung (Pure Events)
WebSockets werden ausschließlich für den Push von Ereignissen ("Was ist gerade passiert?") genutzt.
- Ein Ereignis enthält nur die minimal notwendigen Daten (z. B. `{ spieler: 'NORD', karte: 'HERZ-ZEHN' }`).
- Ereignisse enthalten **keinen** vollständigen Snapshot mehr.
- Das Frontend wendet Ereignisse inkrementell auf den lokalen State im `AppStore` an.

## Event-Verarbeitung & Self-Healing

Das Frontend trackt die `letzteVersion`.
1. **Event empfangen (Version E):**
   - `E == letzteVersion + 1`: Ereignis anwenden, `letzteVersion = E`.
   - `E <= letzteVersion`: Ereignis ignorieren (Duplicate/Stale).
   - `E > letzteVersion + 1`: Lücke erkannt! Das Frontend pausiert die Verarbeitung und fordert einen HTTP-Snapshot an.

## OpenAPI Integration

Alle Ereignisse sind als Discriminated Unions in der OpenAPI-Spec definiert. Das ermöglicht ein typsicheres Frontend ohne manuelles Casting.

```typescript
type PartieEreignis = 
  | KarteGespieltEreignis 
  | StichAbgeschlossenEreignis 
  | AnsageErfolgtEreignis
  | ...;
```

## Naming Conventions (Clean Code)

- Java: Striktes **camelCase** für alle Felder und Methoden.
- Database: **snake_case** für Spalten.
- Domain vs. Persistence: Innerhalb von Entities werden persistierte Felder (falls sie von Domain-Logik abweichen) mit dem Suffix `Db` markiert (z. B. `statusDb`), um die Domain-Getter (`status()`) sauber zu halten.
