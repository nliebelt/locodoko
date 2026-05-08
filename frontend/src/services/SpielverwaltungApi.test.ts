// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpielverwaltungApi, SpielverwaltungFehler } from './SpielverwaltungApi';

describe('SpielverwaltungApi', () => {
  let api: SpielverwaltungApi;

  beforeEach(() => {
    api = new SpielverwaltungApi();
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  it('initialisiert Spieler-Session und speichert Name', async () => {
    const mockSpieler = { spielerId: '123', name: 'TestSpieler' };
    (fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockSpieler)
    });

    const result = await api.initialisiereSpielerSession();
    
    expect(fetch).toHaveBeenCalledWith('/api/spieler/session', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockSpieler);
    expect(localStorage.getItem('locodoko-spielername')).toBe('TestSpieler');
  });

  it('nutzt gespeicherten Namen für Session-Initialisierung', async () => {
    localStorage.setItem('locodoko-spielername', 'GespeicherterName');
    (fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ spielerId: '123', name: 'GespeicherterName' })
    });

    await api.initialisiereSpielerSession();
    
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.name).toBe('GespeicherterName');
  });

  it('behandelt API-Fehler korrekt', async () => {
    const mockFehler = { fehlerCode: 'NICHT_GEFUNDEN', nachricht: 'Tisch nicht da' };
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify(mockFehler)
    });

    await expect(api.ladeTisch('t1')).rejects.toThrow(SpielverwaltungFehler);
    try {
      await api.ladeTisch('t1');
    } catch (e: any) {
      expect(e.fehlerCode).toBe('NICHT_GEFUNDEN');
      expect(e.message).toBe('Tisch nicht da');
    }
  });

  it('behandelt unerwartete Serverfehler', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => ''
    });

    await expect(api.listeTische()).rejects.toThrow('Unerwartete Antwort 500');
  });

  it('erstellt einen Tisch', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 't1' })
    });

    const result = await api.erstelleTisch('Mein Tisch', { ohneNeunen: true }, true);
    
    expect(fetch).toHaveBeenCalledWith('/api/tische', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Mein Tisch', konfiguration: { ohneNeunen: true }, privat: true, presetName: undefined })
    }));
    expect(result.id).toBe('t1');
  });

  it('loggt sich ein', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true })
    });

    await api.einloggen('user', 'pass');
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ benutzername: 'user', passwort: 'pass' })
    }));
  });

  it('behandelt 204 No Content korrekt', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => ''
    });

    const result = await api.ausloggen();
    expect(result).toBeUndefined();
  });
});
