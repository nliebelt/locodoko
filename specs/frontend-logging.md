# Frontend-Logging und globaler Error-Handler

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                                        |
| Abhängigkeiten | frontend-architektur.md, websocket-kommunikation.md         |

## Beschreibung

Das Frontend erhält strukturiertes Logging und einen globalen Error-Handler, damit Probleme im Spielfluss (wie der "Blur"-Zustand nach Tisch-Erstellen) sichtbar und diagnostizierbar werden — ohne dass eine Exception bis zur Konsole durchbricht. Das Logging ist per Dev-Mode-Switch steuerbar und produziert im Produktionsbetrieb keinen Output.

Das Backend erhält gezieltes Logging in der KI-Orchestrierung, damit serverseitige Fehler im Spielfluss ebenfalls nachvollzogen werden können.

---

## Frontend

### Logger-Utility (`frontend/src/logger.ts`)

Eine zentrale Logger-Klasse kapselt alle `console`-Aufrufe und schaltet sich per `import.meta.env.DEV` ab:

```typescript
// Nur im Dev-Build aktiv (import.meta.env.DEV = true bei `npm run dev`, false bei `npm run build`)
export const Logger = {
  websocket: (msg: string, data?: unknown) => log('WS', msg, data),
  store:     (msg: string, data?: unknown) => log('STORE', msg, data),
  szene:     (msg: string, data?: unknown) => log('SZENE', msg, data),
  api:       (msg: string, data?: unknown) => log('API', msg, data),
  error:     (msg: string, data?: unknown) => logError('ERROR', msg, data),
};

function log(kategorie: string, msg: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  console.log(`[${kategorie}] ${msg}`, data ?? '');
}

function logError(kategorie: string, msg: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  console.error(`[${kategorie}] ${msg}`, data ?? '');
}
```

**Wichtig**: `Logger.error` ist für diagnostische Fehler — er schaltet sich im Prod-Build ab. Echte unbehandelte Fehler werden vom globalen Error-Handler abgefangen (siehe unten).

### Logging-Punkte

#### `SpielverwaltungEchtzeit.ts` (WebSocket)

- Verbindungsaufbau: `Logger.websocket('STOMP verbunden')`
- Verbindungsabbruch: `Logger.websocket('STOMP getrennt', { code, reason })`
- Jede eingehende Nachricht: `Logger.websocket('Nachricht empfangen', { topic, body })`
- Jede ausgehende Aktion: `Logger.websocket('Aktion gesendet', { destination, body })`
- Subscription erstellt: `Logger.websocket('Subscribed', { topic })`

#### `AppStore.ts` (Zustandsverwaltung)

- Session-Initialisierung: `Logger.store('Session initialisiert', { spielerId })`
- Tisch-Snapshot empfangen: `Logger.store('Tisch-Snapshot', { tischId, phase })`
- Partie-Snapshot empfangen: `Logger.store('Partie-Snapshot', { spielphase, aktuellerSpieler })`
- Aktion ausgelöst: `Logger.store('Aktion ausgelöst', { typ })`
- Zurück zur Lobby: `Logger.store('Zurück zur Lobby')`

#### `TischSzene.ts` (Phaser-Scene)

- Scene-Start: `Logger.szene('TischSzene create', { tischId })`
- Render-Aufruf: `Logger.szene('render', { phase })` — nur bei Phasenübergängen, nicht pro Frame
- Karte angeklickt: `Logger.szene('Karte angeklickt', { karte })`
- Spielphase gewechselt: `Logger.szene('Spielphase', { vorher, nachher })`

#### `SpielverwaltungApi.ts` (REST)

- Jeder API-Call: `Logger.api('GET /api/...', { status })`
- Fehler-Response: `Logger.api('Fehler', { url, status, body })`

### Globaler Error-Handler (`frontend/src/main.ts`)

Fängt alle unbehandelten JavaScript-Fehler und Promise-Rejections ab — auch wenn Phaser oder ein WebSocket-Callback abstürzt ohne einen Stack-Trace sichtbar zu machen. Dieser Handler ist **immer aktiv**, auch im Prod-Build.

```typescript
// In main.ts, vor Phaser-Initialisierung registrieren
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error });
  // Optional: UI-Feedback (Toast, Overlay) damit der Nutzer nicht vor einem stummen Blur steht
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED PROMISE]', event.reason);
});
```

**Hinweis**: Der globale Error-Handler nutzt `console.error` direkt (kein `Logger`), damit er im Prod-Build greift. Er ist bewusst nicht durch den Dev-Mode-Switch abgeschaltet.

---

## Backend: KI-Orchestrierung

### `KiOrchestrierungService`

Jeder Schritt der KI-Orchestrierung wird mit `log.info` / `log.warn` / `log.error` geloggt, damit bei einem "Blur" (Frontend wartet, Backend liefert kein Event) der Ausgangspunkt sofort erkennbar ist.

#### Zu loggende Punkte

- Orchestrierung gestartet: `log.info("KI-Orchestrierung gestartet [tischId={}, spielphase={}]", ...)`
- KI-Spieler am Zug: `log.info("KI-Spielzug [spielerId={}, aktion={}]", ...)`
- Karte gespielt: `log.debug("KI spielt Karte [karte={}, spielerId={}]", ...)`
- Stich abgeschlossen: `log.info("Stich abgeschlossen [gewinner={}, augen={}]", ...)`
- Spiel beendet: `log.info("Spiel beendet [spielNr={}, ergebnis={}]", ...)`
- Neue Partie gestartet: `log.info("Neue Partie gestartet [tischId={}]", ...)`
- KI-Aktion fehlgeschlagen: `log.error("KI-Aktion fehlgeschlagen [spielerId={}, grund={}]", ...)` (bereits vorhanden, Kontext ergänzen)
- Broadcast gesendet: `log.debug("Broadcast gesendet [topic={}, ereignis={}]", ...)`

#### Logger-Konfiguration (`application-dev.properties`)

```properties
# KI-Orchestrierung auf DEBUG für Entwicklung
logging.level.de.locodoko.tisch.KiOrchestrierungService=DEBUG
logging.level.de.locodoko.tisch.TischEchtzeitService=DEBUG
```

---

## Akzeptanzkriterien

- Im Dev-Build (`npm run dev`) erscheinen alle Logger-Ausgaben in der Browser-Konsole
- Im Prod-Build (`npm run build`) erscheinen **keine** Logger-Ausgaben
- `window.onerror` und `unhandledrejection` fangen Fehler ab und schreiben `[GLOBAL ERROR]` / `[UNHANDLED PROMISE]` in die Konsole — auch im Prod-Build
- Bei einem "Blur" nach Tisch-Erstellen ist in der Konsole klar erkennbar: welche WebSocket-Nachrichten angekommen sind, in welchem Zustand der AppStore ist, ob eine Exception aufgetreten ist
- KI-Orchestrierung loggt jeden Schritt mit `tischId` und `spielphase` — ein fehlgeschlagener Orchestrierungsschritt ist in den Server-Logs identifizierbar

## Definition of Done

- [x] `frontend/src/logger.ts` angelegt mit Dev-Mode-Switch
- [x] `window.onerror` und `unhandledrejection` in `main.ts` registriert
- [x] Logging-Punkte in `SpielverwaltungEchtzeit.ts` eingezogen
- [x] Logging-Punkte in `AppStore.ts` eingezogen
- [x] Logging-Punkte in `TischSzene.ts` eingezogen (phasenbasiert, nicht pro Frame)
- [x] Logging-Punkte in `SpielverwaltungApi.ts` eingezogen
- [x] `KiOrchestrierungService` mit strukturiertem Logging auf allen relevanten Pfaden
- [x] `application-dev.properties` mit Log-Level-Konfiguration für KI-Orchestrierung
- [x] Frontend-Tests prüfen, dass Logger im Prod-Mode nicht aufgerufen wird
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- `import.meta.env.DEV` ist ein Vite-Compile-Time-Flag — der Logger-Code wird im Prod-Build von Vite vollständig entfernt (Tree-Shaking)
- Kein Logging pro Phaser-Frame (`update()`-Methode) — nur bei Zustandsübergängen
- Backend-Logging nutzt SLF4J/Logback (bereits im Projekt vorhanden)
- `log.debug` für häufige/feine Ereignisse, `log.info` für Phasenübergänge, `log.error` für Fehler
