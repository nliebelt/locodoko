// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockStore: any;
vi.mock('../anwendung', () => ({
  get appStore() { return mockStore; }
}));

vi.mock('../assets/AssetLoader', () => ({
  TEXTUR_FILZ: 'filz'
}));

vi.mock('phaser', () => ({
  default: {
    Scene: class { scale = { width: 1280, height: 720 };
      constructor(public name: string) {}
      add = {
        text: vi.fn(() => ({
          setAlpha: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setShadow: vi.fn().mockReturnThis()
        })),
        tileSprite: vi.fn(() => ({ setAlpha: vi.fn().mockReturnThis() }))
      };
      scene = { start: vi.fn() };
    }
  }
}));

// Mock PhaserButton
vi.mock('./PhaserButton', () => ({
  PhaserButton: vi.fn()
}));

const { LoginSzene } = await import('./LoginSzene');
const { PhaserButton } = await import('./PhaserButton');

function mockFetchKonfiguration(googleOAuth2Aktiv: boolean): void {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ googleOAuth2Aktiv })
  } as any);
}

// Wartet bis alle ausstehenden Promises abgearbeitet sind
const flushPromises = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('LoginSzene', () => {
  let szene: any;
  let storeCallback: (z: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    szene = new LoginSzene();
    mockStore = {
      abonniere: vi.fn((cb) => {
        storeCallback = cb;
        return vi.fn();
      }),
      erstelleQuickGame: vi.fn().mockResolvedValue(undefined),
      alsGastStarten: vi.fn().mockResolvedValue(undefined)
    };
    mockFetchKonfiguration(true);
  });

  it('create baut die UI und abonniert den Store (mit Google)', async () => {
    szene.create();
    await flushPromises();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    expect(szene.add.text).toHaveBeenCalled();
    expect(PhaserButton).toHaveBeenCalledTimes(3); // Schnellstart, Gast, Google
    expect(mockStore.abonniere).toHaveBeenCalled();
  });

  it('create baut die UI ohne Google-Button wenn OAuth2 inaktiv', async () => {
    mockFetchKonfiguration(false);
    szene.create();
    await flushPromises();
    expect(PhaserButton).toHaveBeenCalledTimes(2); // Schnellstart, Gast — kein Google
    const calls = (PhaserButton as any).mock.calls.map((c: any) => c[1].text as string);
    expect(calls).not.toContain('🔑 Mit Google anmelden');
  });

  it('navigiert zur TischSzene wenn Bereich zu TISCH wechselt', () => {
    szene.create();
    storeCallback({ bereich: 'TISCH' });
    expect(szene.scene.start).toHaveBeenCalledWith('TischSzene');
  });

  it('navigiert zur SpielverwaltungsSzene wenn authentifiziert', () => {
    szene.create();
    storeCallback({ bereich: 'SPIELVERWALTUNG', authentifiziert: true });
    expect(szene.scene.start).toHaveBeenCalledWith('SpielverwaltungsSzene');
  });

  it('startet Schnellstart bei Button-Klick', () => {
    szene.create();
    const quickStartCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '⚡ SCHNELLSTART (KI)');
    quickStartCall[1].callback();
    expect(mockStore.erstelleQuickGame).toHaveBeenCalled();
  });

  it('startet Gast-Anmeldung bei Button-Klick', async () => {
    szene.create();
    await flushPromises();
    const guestCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '👤 Als Gast spielen');
    guestCall[1].callback();
    expect(mockStore.alsGastStarten).toHaveBeenCalled();
  });
});
