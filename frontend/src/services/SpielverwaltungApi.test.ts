// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SpielverwaltungApi, SpielverwaltungFehler } from './SpielverwaltungApi';
import type { SpielerSessionAntwort, TischAntwort } from '../modelle/SpielverwaltungDto';

describe('SpielverwaltungApi', () => {
  let api: SpielverwaltungApi;

  beforeEach(() => {
    api = new SpielverwaltungApi();
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  it('initialisiert Spieler-Session und speichert Name', async () => {
    const mockSpieler: SpielerSessionAntwort = { spielerId: '123', name: 'TestSpieler', istKi: false };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockSpieler)
    } as Response);

    const result = await api.initialisiereSpielerSession();
    
    expect(fetch).toHaveBeenCalledWith('/api/spieler/session', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockSpieler);
    expect(localStorage.getItem('locodoko-spielername')).toBe('TestSpieler');
  });

  it('nutzt gespeicherten Namen für Session-Initialisierung', async () => {
    localStorage.setItem('locodoko-spielername', 'GespeicherterName');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ spielerId: '123', name: 'GespeicherterName' })
    } as Response);

    await api.initialisiereSpielerSession();
    
    const fetchMock = vi.mocked(fetch);
    const lastCall = fetchMock.mock.calls[0];
    const requestInit = lastCall[1] as RequestInit;
    const body = JSON.parse(requestInit.body as string);
    expect(body.name).toBe('GespeicherterName');
  });

  it('behandelt API-Fehler korrekt', async () => {
    const mockFehler = { fehlerCode: 'NICHT_GEFUNDEN', nachricht: 'Tisch nicht da' };
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify(mockFehler)
    } as Response);

    await expect(api.ladeTisch('t1')).rejects.toThrow(SpielverwaltungFehler);
    try {
      await api.ladeTisch('t1');
    } catch (e: unknown) {
      if (e instanceof SpielverwaltungFehler) {
        expect(e.fehlerCode).toBe('NICHT_GEFUNDEN');
        expect(e.message).toBe('Tisch nicht da');
      } else {
        throw e;
      }
    }
  });

  it('behandelt unerwartete Serverfehler', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => ''
    } as Response);

    await expect(api.listeTische()).rejects.toThrow('Unerwartete Antwort 500');
  });

  it('erstellt einen Tisch', async () => {
    const mockTisch: Partial<TischAntwort> = { id: 't1' };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockTisch)
    } as Response);

    const result = await api.erstelleTisch('Mein Tisch', { ohneNeunen: true }, true);
    
    expect(fetch).toHaveBeenCalledWith('/api/tische', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'Mein Tisch', konfiguration: { ohneNeunen: true }, privat: true, presetName: undefined })
    }));
    expect(result.id).toBe('t1');
  });

  it('loggt sich ein', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ success: true })
    } as Response);

    await api.einloggen('user', 'pass');
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ benutzername: 'user', passwort: 'pass' })
    }));
  });

  it('behandelt 204 No Content korrekt', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => ''
    } as Response);

    const result = await api.ausloggen();
    expect(result).toBeUndefined();
  });

  it('zeigt fachlichen Toast bei HTTP 422 (UngueltigerSpielzug)', async () => {
    // Spieler muss Regelverstoß-Grund lesen können, nicht nur einen generischen Fehler
    const toastTexte: string[] = [];
    api.setzeMeldungCallback((text) => toastTexte.push(text));
    const mockFehler = { fehlerCode: 'SPIELZUG_UNGUELTIG', nachricht: 'Du musst Trumpf bedienen' };
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify(mockFehler)
    } as Response);

    await expect(api.ladeTisch('t1')).rejects.toThrow(SpielverwaltungFehler);
    expect(toastTexte).toContain('Du musst Trumpf bedienen');
  });

  it('zeigt Reload-Hinweis bei HTTP 409 (Spielzustand-Konflikt)', async () => {
    // Spieler muss bei Konflikt auf Neulade-Möglichkeit hingewiesen werden
    const toastTexte: string[] = [];
    api.setzeMeldungCallback((text) => toastTexte.push(text));
    const mockFehler = { fehlerCode: 'PARTIE_LAEUFT_BEREITS', nachricht: 'Partie läuft bereits' };
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => JSON.stringify(mockFehler)
    } as Response);

    await expect(api.listeTische()).rejects.toThrow(SpielverwaltungFehler);
    expect(toastTexte[0]).toContain('veraltet');
  });

  it('sendet Feedback an Backend', async () => {
    // Feedback-Endpoint muss POST /api/feedback mit korrektem Body aufrufen
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ''
    } as Response);

    await api.gibFeedback('Tolles Spiel!');

    expect(fetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'Tolles Spiel!' })
    }));
  });
});

