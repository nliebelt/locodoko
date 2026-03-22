/**
 * Tests fuer den zentralen Frontend-Logger.
 *
 * Wichtig: Der Logger muss im Prod-Build komplett schweigen (kein Output), damit
 * Produktionslogs sauber bleiben. Im Dev-Build soll jede Kategorie auf console ausgeben.
 * Dieser Test sichert das Verhalten gegen Regressionen ab — ohne ihn koennte ein Refactoring
 * versehentlich den Dev-Switch entfernen und Prod-Logs mit Debug-Ausgaben fluten.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Logger-Modul wird fuer jeden Test frisch geladen, damit import.meta.env.DEV variiert werden kann.

describe('Logger im Dev-Modus', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Im Testkontext ist import.meta.env.DEV standardmaessig true (Vitest Dev-Modus)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('websocket-Log erscheint in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.websocket('Verbindung aufgebaut');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[WS]'), expect.anything());
  });

  it('store-Log erscheint in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.store('Session initialisiert', { id: '123' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[STORE]'), expect.anything());
  });

  it('szene-Log erscheint in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.szene('TischSzene create', { tischId: 'abc' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[SZENE]'), expect.anything());
  });

  it('api-Log erscheint in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.api('GET /api/tische', { status: 200 });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[API]'), expect.anything());
  });

  it('error-Log erscheint als console.error in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.error('Diagnosefehler', { detail: 'x' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'), expect.anything());
  });
});

describe('Logger im Prod-Modus', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Prod-Modus simulieren: import.meta.env.DEV auf false setzen
    (import.meta.env as Record<string, unknown>).DEV = false;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Dev-Modus wiederherstellen
    (import.meta.env as Record<string, unknown>).DEV = true;
    vi.restoreAllMocks();
  });

  it('websocket-Log erscheint NICHT in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.websocket('Verbindung aufgebaut');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('store-Log erscheint NICHT in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.store('Aktion');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('szene-Log erscheint NICHT in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.szene('Phasenwechsel');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('api-Log erscheint NICHT in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.api('POST /api/tische', { status: 201 });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('error-Log (diagnostisch) erscheint NICHT als console.error in der Konsole', async () => {
    const { Logger } = await import('./logger');
    Logger.error('Diagnosefehler');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
