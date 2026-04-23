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
- **Abgrenzung:** Die Version ist die absolute "Physik-Zeit" der Partie. Eine `stichNummer` reicht nicht zur Synchronisation aus, da zwischen zwei Stichen (oder innerhalb eines Stichs) viele Ereignisse (Ansagen, KI-Züge, Phasenwechsel) stattfinden, die den Zustand mutieren.

### 2. Quiescence Pattern (isIdle)
Um asynchrone Abläufe (Animationen, KI-Bedenkzeiten) für externe Beobachter (E2E-Tests, Debug-Tools) deterministisch zu machen, implementiert das Frontend das **Quiescence Pattern**:
- Der Zustand `isIdle()` ist nur dann `true`, wenn:
  1. Die **WebSocket-Event-Queue** leer ist.
  2. Die **Event-Verarbeitung** (async) abgeschlossen ist.
  3. Der **Animationen-Service** keine laufenden Tweens oder Timer hat.
- E2E-Tests nutzen diesen Zustand als Synchronisations-Barrier, um Race-Conditions mit noch laufenden Animationen zu verhindern.

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
