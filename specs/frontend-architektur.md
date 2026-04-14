# Frontend-Architektur und Dokumentationsstandard

| Feld           | Wert                                                      |
|----------------|-----------------------------------------------------------|
| Status         | Aktive Vorgabe |
| Priorität      | Mittel                                                    |
| Abhängigkeiten | frontend-logging.md, websocket-kommunikation.md, rest-api.md |

## Beschreibung

Dieses Dokument beschreibt die Architektur des Locodoko-Frontends und legt den Dokumentationsstandard für kritische Dateien fest. Alle kritischen Klassen und Methoden erhalten JSDoc-Kommentare auf Deutsch, analog zu den Javadoc-Kommentaren im Backend.

---

## Architekturüberblick

### Datenfluss

```
Backend (Spring Boot)
    │
    ├── REST-API ──────────────► SpielverwaltungApi.ts
    │                                    │
    │                                    ▼
    └── WebSocket (STOMP) ──────► SpielverwaltungEchtzeit.ts
                                         │
                                         ▼
                                    AppStore.ts  ◄──── TischAnsichtModell.ts
                                         │
                                         ▼
                                    TischSzene.ts ────► AnimationenService.ts
                                    LobbySzene.ts
                                    BootSzene.ts
```

### Bounded Context im Frontend

| Schicht          | Datei(en)                                    | Verantwortung                                             |
|------------------|----------------------------------------------|-----------------------------------------------------------|
| Kommunikation    | `SpielverwaltungApi.ts`                      | HTTP-Aufrufe (Session, Tisch, Partie)                     |
| Kommunikation    | `SpielverwaltungEchtzeit.ts`                 | WebSocket STOMP: Subscribe, Publish, Reconnect            |
| Zustand          | `AppStore.ts`                                | Zentraler Zustand: Session, Tisch, Partie, Aktionen       |
| Modell           | `TischAnsichtModell.ts`                      | Sitzordnung relativ zum eigenen Spieler, abgeleitete Sichten |
| Modell           | `SpielverwaltungDto.ts`                      | TypeScript-Typen für Backend-DTOs                         |
| Darstellung      | `TischSzene.ts`                              | Phaser-Scene: Tisch rendern, Karten, HUD, Dialoge         |
| Darstellung      | `LobbySzene.ts`                              | Phaser-Scene: Tischliste, Erstellen, Beitreten            |
| Darstellung      | `BootSzene.ts`                               | Initialisierung: Session laden, Asset-Preload             |
| Service          | `AnimationenService.ts`                      | Phaser-Tweens für Karten, Stiche, Banner                  |
| Infrastruktur    | `logger.ts`                                  | Dev-Mode-Logger (siehe frontend-logging.md)               |
| Infrastruktur    | `AssetLoader.ts`                             | Asset-Registrierung für Phaser                            |

---

## Dokumentationsstandard: JSDoc auf Deutsch

Alle kritischen Dateien erhalten JSDoc-Kommentare nach folgendem Muster:

```typescript
/**
 * [Klassenname] — [einzeiliger Zweck auf Deutsch]
 *
 * [Ausführlichere Beschreibung: Verantwortlichkeit, Lebenszyklus, Abhängigkeiten]
 *
 * @example
 * // Typische Verwendung
 * const store = new AppStore(api, echtzeit);
 * await store.initialisiereSession();
 */
export class AppStore { ... }

/**
 * [Methodenname] — [einzeiliger Zweck]
 *
 * [Was die Methode tut, welche Seiteneffekte sie hat, wann sie aufgerufen wird]
 *
 * @param tischId - [Beschreibung des Parameters]
 * @returns [Was zurückgegeben wird]
 * @throws [Unter welchen Bedingungen ein Fehler geworfen wird]
 */
public verarbeiteTischSnapshot(tischId: string): void { ... }
```

---

## Kritische Dateien: Dokumentationsvorgaben

### `AppStore.ts`

Der AppStore ist die einzige Wahrheitsquelle für den Frontend-Zustand. Er nimmt Snapshots vom Backend entgegen, leitet Aktionen weiter und benachrichtigt die Szenen.

**Zu dokumentieren:**
- Klasse: Verantwortlichkeit als zentraler Zustandsspeicher, Abhängigkeiten zu Api und Echtzeit
- `initialisiereSession()`: Ablauf Session-Check → Redirect zu Lobby oder Tisch
- `verarbeiteTischSnapshot()`: Welche Zustandsfelder gesetzt werden, wann Redirect zur Tischszene
- `verarbeitePartieSnapshot()`: Spielphasen-Mapping auf UI-Zustand
- `spieleKarte()`, `macheAnsage()`, `waehleVorbehalt()`, `antworteAufArmut()`: Welcher WebSocket-Kanal, welche Validierung
- Alle öffentlichen Zustandsfelder: `session`, `tisch`, `partie`, `aktuellerFehler`

### `TischSzene.ts`

Die TischSzene ist die komplexeste Phaser-Scene. Sie rendert Tischansicht, Hand, Stichmitte, HUD und alle Dialoge.

**Zu dokumentieren:**
- Klasse: Phaser-Lebenszyklus (`create` → `update`), Abhängigkeit zu AppStore
- `create()`: Initialisierungsreihenfolge (Hintergrund → Spielerpositionen → Hand → HUD → Dialoge)
- `render()` / `aktualisiereAnzeige()`: Wann aufgerufen, welche Teile neu gezeichnet werden
- `zeigeVorbehaltDialog()`, `zeigeArmutDialog()`, `zeigeAnsageBereich()`: Bedingungen für Anzeige
- `karteAnklicken()`: Validierung gegen `moeglicheKarten`, Animation, Aktion an AppStore
- `ermittleNeueAnsagen()`, `ermittleNeueSonderpunkte()`: Diffing-Logik für Animationsentscheidungen
- Positionsberechnung für Spieler, Hand und Stichmitte (relative Koordinaten)

### `SpielverwaltungEchtzeit.ts`

Die Echtzeit-Klasse kapselt die gesamte STOMP-WebSocket-Kommunikation.

**Zu dokumentieren:**
- Klasse: STOMP-Verbindungsaufbau, Reconnect-Verhalten, Subscription-Verwaltung
- `verbinde()`: Verbindungsaufbau, Fehlerbehandlung, Callback-Registrierung
- `abonniereTisch()`, `abonnierePartie()`, `abonniereBenutzer()`: Welche Topics, welche Callback-Typen
- `sendeAktion()`: Destination-Mapping, Serialisierung
- `trenne()`: Sauberes Aufräumen von Subscriptions

### `TischAnsichtModell.ts`

Das Ansichtsmodell transformiert den Backend-Snapshot in eine relative Sitzordnung aus Sicht des eigenen Spielers.

**Zu dokumentieren:**
- Klasse: Transformationsverantwortung, Immutabilität
- `berechneSitzordnung()`: Rotationslogik (eigener Spieler immer unten)
- `ermittleSpielbareKarten()`: Ableitung aus `moeglicheKarten` im Snapshot
- `istEigenerZug()`: Bedingung und Seiteneffekte

### `AnimationenService.ts`

Kapselt alle Phaser-Tweens und stellt sicher, dass Animationen sequenziell und nicht überlappend ablaufen.

**Zu dokumentieren:**
- Klasse: Abhängigkeit zur Phaser-Scene, Tween-Verwaltung
- `animiereKarteAusspielen()`: Start-/Zielposition, Dauer, Callback
- `animiereStichEinziehen()`: Sammelbewegung zum Gewinner, Wartefenster
- `animiereKartenAusteilen()`: Gestaffeltes Austeilen, Offset pro Karte
- `animiereAnsageBanner()`: Fade-In/Out, Sichtbarkeitsdauer
- `warte()`: Promise-basiertes Delay-Utility

---

## Akzeptanzkriterien

- Alle fünf kritischen Klassen haben JSDoc auf Klassenebene
- Alle öffentlichen Methoden der fünf kritischen Klassen haben JSDoc
- Die JSDoc-Kommentare erklären das **Warum** und den **Lebenszyklus**, nicht nur das **Was**
- `specs/frontend-architektur.md` (diese Datei) ist als Referenz für neue Entwickler nutzbar

## Definition of Done

- [ ] JSDoc für `AppStore.ts` (Klasse + alle öffentlichen Methoden)
- [ ] JSDoc für `TischSzene.ts` (Klasse + kritische Methoden: create, render, Dialoge, Karten-Klick)
- [ ] JSDoc für `SpielverwaltungEchtzeit.ts` (Klasse + alle öffentlichen Methoden)
- [ ] JSDoc für `TischAnsichtModell.ts` (Klasse + alle öffentlichen Methoden)
- [ ] JSDoc für `AnimationenService.ts` (Klasse + alle öffentlichen Methoden)
- [ ] `specs/frontend-architektur.md` auf aktuellem Stand (Dateistruktur, Datenfluss)
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- Sprache: Deutsch, analog zu den Javadoc-Kommentaren im Backend
- JSDoc-Tags: `@param`, `@returns`, `@throws`, `@example` wo sinnvoll
- Kein JSDoc für private Hilfsmethoden die selbsterklärend sind
- TypeScript-Typen ersetzen `@type`-Tags — JSDoc beschreibt Semantik, nicht Syntax
