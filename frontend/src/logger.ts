/**
 * Zentraler Logger fuer das Locodoko-Frontend.
 *
 * Alle Log-Ausgaben sind per {@code import.meta.env.DEV} auf den Dev-Build beschraenkt
 * (Vite entfernt den Code im Prod-Build vollstaendig durch Tree-Shaking).
 * Nur {@code Logger.error} ist ein diagnostischer Dev-Helfer — echte unbehandelte Fehler
 * werden vom globalen Error-Handler in {@code main.ts} abgefangen, der auch im Prod-Build greift.
 *
 * Kategorien: WS (WebSocket), STORE (Zustandsverwaltung), SZENE (Phaser), API (REST), ERROR (Diagnose).
 */

function log(kategorie: string, msg: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  console.log(`[${kategorie}] ${msg}`, data ?? '');
}

function logError(kategorie: string, msg: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;
  console.error(`[${kategorie}] ${msg}`, data ?? '');
}

export const Logger = {
  /** WebSocket-Verbindung, Subscriptions, ein- und ausgehende Nachrichten. */
  websocket: (msg: string, data?: unknown) => log('WS', msg, data),
  /** AppStore: Session, Snapshots, Aktionen, Zustandsuebergaenge. */
  store: (msg: string, data?: unknown) => log('STORE', msg, data),
  /** Phaser-Scene: Scene-Start, Phasenuebergaenge, Kartenklicks. Nicht pro Frame aufrufen. */
  szene: (msg: string, data?: unknown) => log('SZENE', msg, data),
  /** REST-API: Jeder Call und jede Fehlerantwort. */
  api: (msg: string, data?: unknown) => log('API', msg, data),
  /** Diagnostische Fehler im Dev-Build (kein Prod-Output). */
  error: (msg: string, data?: unknown) => logError('ERROR', msg, data),
};
