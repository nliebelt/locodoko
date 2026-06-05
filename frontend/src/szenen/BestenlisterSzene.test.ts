// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockStore: any;
vi.mock('../anwendung', () => ({
  get appStore() { return mockStore; }
}));

vi.mock('../assets/AssetLoader', () => ({
  TEXTUR_FILZ: 'filz',
  registriereBasisTexturen: vi.fn(),
  ladeHintergrundbilder: vi.fn()
}));

vi.mock('phaser', () => ({
  default: {
    Scene: class { scale = { width: 1280, height: 720 };
      constructor(public name: string) {}
      add = {
        text: vi.fn(() => ({
          setAlpha: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setShadow: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        })),
        tileSprite: vi.fn(() => ({ setAlpha: vi.fn().mockReturnThis() })),
        container: vi.fn(() => ({ add: vi.fn(), removeAll: vi.fn(), destroy: vi.fn() })),
        rectangle: vi.fn(() => ({
          setOrigin: vi.fn().mockReturnThis(),
          destroy: vi.fn()
        }))
      };
      scene = { start: vi.fn() };
      events = { once: vi.fn() };
    }
  }
}));

vi.mock('./PhaserButton', () => ({
  PhaserButton: vi.fn(function(this: any, _scene: any, optionen: any) {
    this.optionen = optionen;
    this.destroy = vi.fn();
  })
}));

const { BestenlisterSzene } = await import('./BestenlisterSzene');
const { PhaserButton } = await import('./PhaserButton');

describe('BestenlisterSzene', () => {
  let szene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    szene = new BestenlisterSzene();
    mockStore = {
      ladeBestenliste: vi.fn(() => Promise.resolve({ regelvariante: 'TURNIER', eintraege: [] }))
    };
  });

  it('create baut Hintergrund, Titel und Zurück-Button', () => {
    szene.create();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    expect(szene.add.text).toHaveBeenCalledWith(640, 45, 'BESTENLISTE', expect.any(Object));
    const zurückCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    expect(zurückCall).toBeDefined();
  });

  it('create erstellt drei Varianten-Tabs', () => {
    szene.create();
    const tabTexte = (PhaserButton as any).mock.calls
      .map((c: any) => c[1].text)
      .filter((t: string) => ['TURNIER', 'SONDER', 'FREI'].includes(t));
    expect(tabTexte).toEqual(['TURNIER', 'SONDER', 'FREI']);
  });

  it('TURNIER-Tab ist initial als primary markiert', () => {
    szene.create();
    const turnierCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'TURNIER');
    expect(turnierCall[1].typ).toBe('primary');
    const sonderCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'SONDER');
    expect(sonderCall[1].typ).toBe('secondary');
  });

  it('create ruft ladeBestenliste mit TURNIER auf', () => {
    szene.create();
    expect(mockStore.ladeBestenliste).toHaveBeenCalledWith('TURNIER');
  });

  it('Zurück-Button navigiert zur SpielverwaltungsSzene', () => {
    szene.create();
    const zurückCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    zurückCall[1].callback();
    expect(szene.scene.start).toHaveBeenCalledWith('SpielverwaltungsSzene');
  });

  it('Tab-Klick auf SONDER lädt Bestenliste für SONDER', () => {
    szene.create();
    // Callback vor clearAllMocks sichern
    const sonderCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'SONDER');
    expect(sonderCall).toBeDefined();
    const sonderCallback = sonderCall[1].callback;
    mockStore.ladeBestenliste = vi.fn(() => Promise.resolve({ regelvariante: 'SONDER', eintraege: [] }));

    sonderCallback();
    expect(mockStore.ladeBestenliste).toHaveBeenCalledWith('SONDER');
  });

  it('zeigt leere Meldung wenn Einträge fehlen', async () => {
    mockStore.ladeBestenliste = vi.fn(() => Promise.resolve({ regelvariante: 'TURNIER', eintraege: [] }));
    szene.create();
    await Promise.resolve();
    const leertextCall = szene.add.text.mock.calls.find(
      (c: any) => typeof c[2] === 'string' && c[2].includes('keine')
    );
    expect(leertextCall).toBeDefined();
  });

  it('zeigt Fehlermeldung bei API-Fehler', async () => {
    mockStore.ladeBestenliste = vi.fn(() => Promise.reject(new Error('Netzwerkfehler')));
    szene.create();
    await Promise.resolve();
    await Promise.resolve();
    const fehlerCall = szene.add.text.mock.calls.find(
      (c: any) => typeof c[2] === 'string' && c[2].includes('Fehler')
    );
    expect(fehlerCall).toBeDefined();
  });

  it('zeigt Kopfzeile und Einträge bei gefüllter Bestenliste', async () => {
    mockStore.ladeBestenliste = vi.fn(() => Promise.resolve({
      regelvariante: 'TURNIER',
      eintraege: [
        { rang: 1, spielerName: 'Karlchen', konservativesRating: 18.5, ratingMu: 27.0, ratingSigma: 2.83, anzahlSpiele: 42, siegquote: 59.5 }
      ]
    }));
    szene.create();
    await Promise.resolve();
    const karlchenCall = szene.add.text.mock.calls.find(
      (c: any) => c[2] === 'Karlchen'
    );
    expect(karlchenCall).toBeDefined();
  });
});
