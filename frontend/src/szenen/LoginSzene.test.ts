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
    Scene: class {
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
      erstelleQuickGame: vi.fn(),
      alsGastStarten: vi.fn()
    };
  });

  it('create baut die UI und abonniert den Store', () => {
    szene.create();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    expect(szene.add.text).toHaveBeenCalled();
    expect(PhaserButton).toHaveBeenCalledTimes(3); // Schnellstart, Gast, Google
    expect(mockStore.abonniere).toHaveBeenCalled();
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
    // Den ersten Aufruf von PhaserButton finden (Schnellstart)
    const quickStartCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '⚡ SCHNELLSTART (KI)');
    quickStartCall[1].callback();
    expect(mockStore.erstelleQuickGame).toHaveBeenCalled();
  });

  it('startet Gast-Anmeldung bei Button-Klick', () => {
    szene.create();
    const guestCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '👤 Als Gast spielen');
    guestCall[1].callback();
    expect(mockStore.alsGastStarten).toHaveBeenCalled();
  });
});
