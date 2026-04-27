# Locodoko Unified Architecture

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe                                              |
| Priorität      | Kritisch                                                    |
| Bezug          | architektur-ddd.md, websocket-kommunikation.md              |

## Kernprinzipien

Die Locodoko Unified Architecture löst das Synchronisationsproblem zwischen verteilten Clients durch eine strikte Trennung von **Zustand (Snapshots)** und **Veränderung (Events)**.

### 1. Datenbank als einzige Source of Truth

Die Datenbank ist der einzige persistente Zustandsspeicher. In-Memory-State-Management ist verboten.

**Verbotene Muster (nie implementieren):**
- `SpielRegistry` oder vergleichbare In-Memory-Caches für Aggregat-Instanzen
- `ReentrantLock` oder manuelle In-Memory-Locks zur Synchronisation
- Manuelles `isNew`-Setzen oder andere Lifecycle-Hacks im Persistence-Layer

Das Framework (Spring Data JDBC) entscheidet über Insert vs. Update anhand des `@Version`-Feldes — jeder manuelle Eingriff in diesen Mechanismus ist verboten.

### 2. Optimistic Locking via @Version

Jede Partie besitzt eine streng monotone, aufsteigende **Version** (Sequenznummer), die via `@Version` vom Framework verwaltet wird.
- Jede API-Antwort (REST) enthält die aktuelle Version.
- Jedes WebSocket-Ereignis enthält die Version, die **nach** Anwendung des Ereignisses erreicht wurde.
- Bei einem konkurrierenden Schreibzugriff wirft Spring eine `OptimisticLockingFailureException` — diese muss propagiert werden, nicht geschluckt.
- **Abgrenzung:** Die Version ist die absolute "Physik-Zeit" der Partie. Eine `stichNummer` reicht nicht zur Synchronisation aus, da zwischen zwei Stichen (oder innerhalb eines Stichs) viele Ereignisse (Ansagen, KI-Züge, Phasenwechsel) stattfinden, die den Zustand mutieren.

### 3. Transaktions-Garantien

Domain-Events und WebSocket-Nachrichten dürfen **niemals** vor dem erfolgreichen Datenbank-Commit versendet werden.

**Gesetz:** Alle Event-Listener, die Seiteneffekte auslösen (KI-Orchestrierung, WebSocket-Broadcasts), müssen `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` verwenden.

```java
// Richtig — Seiteneffekt erst nach erfolgreichem Commit
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet event) { ... }

// Falsch — Event wird ggf. vor Commit oder bei Rollback verarbeitet
@EventListener
public void beiNaechsterSpielerErwartet(NaechsterSpielerErwartet event) { ... }
```

### 4. Quiescence Pattern (isIdle)

Um asynchrone Abläufe (Animationen, frontend-seitige KI-Animationspausen) für externe Beobachter (E2E-Tests, Debug-Tools) deterministisch zu machen, implementiert das Frontend das **Quiescence Pattern**:
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
   - `E > letzteVersion + 1`: Lücke erkannt — Frontend pausiert Verarbeitung und fordert HTTP-Snapshot an.

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
