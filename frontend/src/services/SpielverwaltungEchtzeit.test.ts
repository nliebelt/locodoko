// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpielverwaltungEchtzeit } from './SpielverwaltungEchtzeit';
import { Client } from '@stomp/stompjs';

vi.mock('@stomp/stompjs', () => {
  const mockClient = {
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
    
    const clientInstance = (Client as any).mock.results[0].value;
    expect(clientInstance.activate).toHaveBeenCalled();
    
    if (clientInstance.onConnect) clientInstance.onConnect();
    await promise;
  });

  it('behandelt Verbindungsfehler', async () => {
    const promise = service.verbinde();
    const clientInstance = (Client as any).mock.results[0].value;
    
    if (clientInstance.onStompError) clientInstance.onStompError({ body: 'Fehler' });
    await expect(promise).rejects.toThrow('Fehler');
  });

  it('abonniert ein Ziel wenn verbunden', async () => {
    const verbindung = service.verbinde();
    const clientInstance = (Client as any).mock.results[0].value;
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
    const clientInstance = (Client as any).mock.results[0].value;
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
    const clientInstance = (Client as any).mock.results[0].value;
    if (clientInstance.onConnect) clientInstance.onConnect();
    await promise;

    service.trennen();
    expect(clientInstance.deactivate).toHaveBeenCalled();
  });
});
