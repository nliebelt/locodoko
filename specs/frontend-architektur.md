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
                              AppStore.ts (Fassade)
                              ├── SessionStore.ts   (Login, Gast, Profil)
                              ├── TischStore.ts     (Tischliste, Beitritt, Konfiguration)
                              └── PartieStore.ts    (Event-Queue, Snapshots, isIdle)
                                         │              ◄──── TischAnsichtModell.ts
                                         ▼
                              Szenen: BootSzene → LoginSzene → SpielverwaltungsSzene
                                      → TischSzene (komponiert, s.u.) · HilfeSzene · BestenlisterSzene
                                         │
                                         ▼
                              AnimationenService.ts (+ Karten-/Spieleffekt-Animationen)
```

### Bounded Context im Frontend

| Schicht          | Datei(en)                                    | Verantwortung                                             |
|------------------|----------------------------------------------|-----------------------------------------------------------|
| Zustand          | `store/AppStore.ts`                          | **Fassade** über die Sub-Stores; Abo-Verwaltung, Snapshot-API |
| Zustand          | `store/SessionStore.ts`                      | Login/Logout, Gast, Registrierung, Spielerprofil          |
| Zustand          | `store/TischStore.ts`                        | Tischliste, Erstellen/Beitreten/Verlassen, Reconnect      |
| Zustand          | `store/PartieStore.ts`                       | Serielle Event-Queue, Snapshot-Anwendung, KI-Delay, `isIdle` |
| Zustand          | `store/StoreTypen.ts`                        | `AppZustand`, Listener-Typen, Anfangszustand              |
| Modell           | `modelle/TischAnsichtModell.ts` (+ `TischAnsichtMapper`, `SitzordnungModell`, `TischKartenSortierung`, `TischVorbehaltModell`) | Sitzordnung relativ zum eigenen Spieler, abgeleitete Sichten |
| Modell           | `modelle/SpielverwaltungDto.ts`              | TypeScript-Typen für Backend-DTOs (kanonisch: `PartieEreignisTyp`) |
| Modell           | `modelle/regelPresets.ts`                    | Vordefinierte Regelkonfigurationen (Presets)              |
| Szenen           | `BootSzene`, `LoginSzene`, `SpielverwaltungsSzene`, `TischSzene`, `HilfeSzene`, `BestenlisterSzene` | Phaser-Scenes (Routing via BootSzene)                     |
| TischSzene-Komposition | `TischEreignisHandler`, `TischHudRenderer`, `TischKartenRenderer`, `TischSpieleventRenderer`, `TischAnimationOrchestrator`, `TischRenderKontroller`, `TischZustandsKontroller`, `TischStoreAbonnements`, `TischInputHandler`, `TischRundenEndeController`, `TischBrücke` | Die TischSzene delegiert Rendering, Events, Input und Rundenende an fokussierte Komponenten (Prinzip 9, Komposition statt God Object) |
| UI-Bausteine     | `ui/`: `PhaserButton`, `PhaserModal`, `PhaserList`, `Nameplate`, `FlashTextManager` (+ Container/Primitiven), `SpielerProfilModal`, `SpielprotokollOverlay`, `ToastManager`, `designTokens`, `dialogHelper`, `rechteckMaske`; `szenen/`: `tischErstellenDialog`, `bugreportDialog`, `tischFormatierer`, `layout` | Wiederverwendbare UI-Komponenten und Dialoge              |
| Darstellung      | `assets/Kartenansicht.ts`                    | Phaser-Sprite-Verwaltung für einzelne Spielkarten         |
| Service          | `services/AnimationenService.ts` (+ `AnimationenPrimitiven`, `KartenAnimationen`, `SpieleffektAnimationen`) | Phaser-Tweens für Karten, Stiche, Banner                  |
| Service          | `services/SpielverwaltungApi.ts`             | HTTP-Aufrufe (Session, Tisch, Partie)                     |
| Service          | `services/SpielverwaltungEchtzeit.ts`        | WebSocket STOMP: Subscribe, Publish, Reconnect            |
| Infrastruktur    | `anwendung.ts` / `main.ts`                   | Phaser-Game-Konfiguration, Bootstrap, Sentry-Init         |
| Infrastruktur    | `logger.ts`                                  | Dev-Mode-Logger (siehe frontend-logging.md)               |
| Infrastruktur    | `assets/AssetLoader.ts`                      | Asset-Registrierung für Phaser                            |
| Infrastruktur    | `e2eBruecke.ts`                              | `window.__locodoko`-Bridge für E2E/Diagnose               |

---

## JavaScript-Bridge (`window.__locodoko`)

Für automatisierte Tests (E2E) und die Diagnose zur Laufzeit exponiert das Frontend ein globales Bridge-Objekt. Dies ermöglicht den Zugriff auf den internen Zustand der Phaser-Engine und des App-Stores, ohne die Kapselung im Produktivcode zu verletzen.

| Methode / Eigenschaft                    | Beschreibung                                                                             |
|------------------------------------------|------------------------------------------------------------------------------------------|
| `appStore`                               | Direkter Zugriff auf den `AppStore` (Snapshots, Aktionen)                               |
| `getAktuelleSzene()`                     | Aktive Phaser-Szene (`'SpielverwaltungsSzene'`, `'TischSzene'` etc.)                    |
| `isIdle()`                               | `true` wenn alle Animationen und Event-Queues verarbeitet sind                           |
| `isOverlaySichtbar()`                    | Rundenauswertung, Partie-Ende oder Einstellungen sichtbar                                |
| `getHudState()`                          | `{ stichzaehler, spieltyp, startBtnSichtbar, rundenEndeSichtbar }`                      |
| `setzeAnimationsGeschwindigkeit(f)`      | Globaler Animationsfaktor (`1`, `2`, `Infinity`)                                         |
| `schliesseRundenEndeModal()`             | Schließt das Rundenende-Modal (entspricht „Weiter →")                                   |
| `_rundenEndeModalGezeigt`                | Zähler für angezeigte Rundenende-Modals seit Szenen-Start                               |
| `_rundenauswertungSpieltypLabel`         | Spieltyp-Label des zuletzt angezeigten Rundenende-Modals                                |
| `_rundenauswertungMultiplikator`         | Solo-Multiplikator des letzten Rundenende-Modals                                        |

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

- [x] JSDoc für `AppStore.ts` (Klasse + alle öffentlichen Methoden)
- [x] JSDoc für `TischSzene.ts` (Klasse + kritische Methoden: create, render, Dialoge, Karten-Klick)
- [x] JSDoc für `SpielverwaltungEchtzeit.ts` (Klasse + alle öffentlichen Methoden)
- [x] JSDoc für `TischAnsichtModell.ts` (Klasse + alle öffentlichen Methoden)
- [x] JSDoc für `AnimationenService.ts` (Klasse + alle öffentlichen Methoden)
- [x] `TischInputHandler.ts` JSDoc (Klasse + kritische Methoden)
- [x] `specs/frontend-architektur.md` auf aktuellem Stand (Dateistruktur, Datenfluss)
- [x] Code-Review / Plausibilitätsprüfung
- [ ] **Refactoring-Prüfung:** Bei Änderungen an Klassen mit > 300 Zeilen (z. B. `TischSzene.ts`, `AppStore.ts`) wurde geprüft, ob Teile der Logik durch Komposition in kleinere Hilfsklassen oder Manager ausgelagert werden können (Vermeidung von God Objects).

## Technische Hinweise

- Sprache: Deutsch, analog zu den Javadoc-Kommentaren im Backend
- JSDoc-Tags: `@param`, `@returns`, `@throws`, `@example` wo sinnvoll
- Kein JSDoc für private Hilfsmethoden die selbsterklärend sind
- TypeScript-Typen ersetzen `@type`-Tags — JSDoc beschreibt Semantik, nicht Syntax
