// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { SpielverwaltungEchtzeit } from './SpielverwaltungEchtzeit';
import { Client } from '@stomp/stompjs';

// Typ-Definition für die Mock-Instanz des STOMP-Clients
interface MockClient {
  activate: Mock;
  deactivate: Mock;
  subscribe: Mock;
  publish: Mock;
  onConnect: (() => void) | null;
  onStompError: ((frame: { body: string }) => void) | null;
  onWebSocketError: (() => void) | null;
  onWebSocketClose: (() => void) | null;
  connected: boolean;
}

vi.mock('@stomp/stompjs', () => {
  const mockClient: MockClient = {
    activate: vi.fn(),
    deactivate: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
    onConnect: null,
    onStompError: null,
    onWebSocketError: null,
    onWebSocketClose: null,
    connected: false
  };
  return {
    Client: vi.fn(() => mockClient)
  };
});

describe('SpielverwaltungEchtzeit', () => {
  let service: SpielverwaltungEchtzeit;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpielverwaltungEchtzeit();
  });

  it('verbindet sich und loest das Promise bei onConnect auf', async () => {
    const promise = service.verbinde();
    
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    expect(clientInstance.activate).toHaveBeenCalled();
    
    if (clientInstance.onConnect) clientInstance.onConnect();
    await promise;
  });

  it('behandelt Verbindungsfehler', async () => {
    const promise = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    
    if (clientInstance.onStompError) clientInstance.onStompError({ body: 'Fehler' });
    await expect(promise).rejects.toThrow('Fehler');
  });

  it('abonniert ein Ziel wenn verbunden', async () => {
    const verbindung = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    clientInstance.connected = true;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await verbindung;

    const handler = vi.fn();
    clientInstance.subscribe.mockReturnValue({ unsubscribe: vi.fn() });
    
    const abmelden = service.abonnieren('/topic/test', handler);
    expect(clientInstance.subscribe).toHaveBeenCalledWith('/topic/test', expect.any(Function));
    
    // Nachricht simulieren
    const callback = clientInstance.subscribe.mock.calls[0][1];
    callback({ body: JSON.stringify({ daten: 42 }) });
    expect(handler).toHaveBeenCalledWith({ daten: 42 });
    
    abmelden();
  });

  it('wirft Fehler beim Abonnieren ohne Verbindung', () => {
    expect(() => service.abonnieren('/topic/test', () => {})).toThrow('WebSocket-Verbindung ist für /topic/test noch nicht bereit');
  });

  it('sendet Nachricht wenn verbunden', async () => {
    const verbindung = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    clientInstance.connected = true;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await verbindung;

    service.senden('/app/aktion', { kartenId: 'K1' });
    expect(clientInstance.publish).toHaveBeenCalledWith({
      destination: '/app/aktion',
      body: JSON.stringify({ kartenId: 'K1' })
    });
  });

  it('trennen deaktiviert den Client', async () => {
    const promise = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await promise;

    service.trennen();
    expect(clientInstance.deactivate).toHaveBeenCalled();
  });

  it('reabonniert aktive Topics automatisch bei Reconnect', async () => {
    // Erstverbindung aufbauen
    const verbindung = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    clientInstance.connected = true;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await verbindung;

    // Topic abonnieren
    const handler = vi.fn();
    clientInstance.subscribe.mockReturnValue({ unsubscribe: vi.fn() });
    service.abonnieren('/topic/spiel', handler);
    expect(clientInstance.subscribe).toHaveBeenCalledTimes(1);

    // Reconnect simulieren: subscribe-Mock leeren, onConnect erneut aufrufen
    clientInstance.subscribe.mockClear();
    clientInstance.subscribe.mockReturnValue({ unsubscribe: vi.fn() });
    if (clientInstance.onConnect) clientInstance.onConnect();

    // Topic muss nach Reconnect erneut abonniert sein — Nachrichten fliessen wieder
    expect(clientInstance.subscribe).toHaveBeenCalledTimes(1);
    expect(clientInstance.subscribe).toHaveBeenCalledWith('/topic/spiel', expect.any(Function));
  });

  it('ruft reconnectCallback nach Reconnect auf, aber nicht beim Erstverbinden', async () => {
    const verbindung = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    clientInstance.connected = true;

    const callback = vi.fn();
    service.registriereReconnectCallback(callback);

    // Erstverbindung: kein Callback
    if (clientInstance.onConnect) clientInstance.onConnect();
    await verbindung;
    expect(callback).not.toHaveBeenCalled();

    // Reconnect: Callback wird aufgerufen
    if (clientInstance.onConnect) clientInstance.onConnect();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('entfernt Abonnement aus Reconnect-Tracking beim Abmelden', async () => {
    const verbindung = service.verbinde();
    const clientInstance = vi.mocked(Client).mock.results[0].value as MockClient;
    clientInstance.connected = true;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await verbindung;

    const unsubscribeFn = vi.fn();
    clientInstance.subscribe.mockReturnValue({ unsubscribe: unsubscribeFn });
    const abmelden = service.abonnieren('/topic/test', vi.fn());

    // Abonnement beenden
    abmelden();
    expect(unsubscribeFn).toHaveBeenCalled();

    // Nach Reconnect darf das entfernte Abonnement nicht wiederhergestellt werden
    clientInstance.subscribe.mockClear();
    if (clientInstance.onConnect) clientInstance.onConnect();
    expect(clientInstance.subscribe).not.toHaveBeenCalled();
  });
});

