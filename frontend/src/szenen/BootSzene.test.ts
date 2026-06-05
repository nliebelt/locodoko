// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockStore: any;
vi.mock('../anwendung', () => ({
  get appStore() { return mockStore; }
}));

vi.mock('../assets/AssetLoader', () => ({
  registriereBasisTexturen: vi.fn(),
  TEXTUR_FILZ: 'filz',
  ladeHintergrundbilder: vi.fn(),
  ladeBitmapFont: vi.fn()
}));

vi.mock('phaser', () => ({
  default: {
    Scene: class { scale = { width: 1280, height: 720 };
      constructor(public name: string) {}
      add = {
        text: vi.fn(() => ({ setAlpha: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setText: vi.fn() })),
        tileSprite: vi.fn(() => ({ setTint: vi.fn().mockReturnThis() }))
      };
      scene = { start: vi.fn() };
      time = { delayedCall: vi.fn() };
    }
  }
}));

// Mock document.fonts.ready
Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve() },
  configurable: true
});

const { BootSzene } = await import('./BootSzene');

describe('BootSzene', () => {
  let szene: any;

  beforeEach(() => {
    szene = new BootSzene();
    mockStore = {
      initialisieren: vi.fn(),
      snapshot: vi.fn(() => ({ spieler: null })),
      reconnecteTisch: vi.fn(),
      betreteTischViaCode: vi.fn()
    };
  });

  it('preload lädt Assets', () => {
    szene.preload();
    expect(szene.add.text).toHaveBeenCalled();
  });

  it('create initialisiert UI und startet Initialisierung', async () => {
    szene.create();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    
    // Warten bis async initialisieren fertig ist
    await vi.waitFor(() => expect(mockStore.initialisieren).toHaveBeenCalled());
  });

  it('leitet zur LoginSzene weiter wenn Initialisierung fehlschlägt', async () => {
    mockStore.initialisieren.mockRejectedValue(new Error('Auth failed'));
    szene.create();
    
    await vi.waitFor(() => expect(szene.scene.start).toHaveBeenCalledWith('LoginSzene'));
  });

  it('leitet zur SpielverwaltungsSzene weiter wenn Session ok aber kein Tisch', async () => {
    mockStore.initialisieren.mockResolvedValue({});
    szene.create();
    
    await vi.waitFor(() => expect(szene.scene.start).toHaveBeenCalledWith('SpielverwaltungsSzene'));
  });

  it('reconnectet Tisch wenn aktiverTischId vorhanden', async () => {
    mockStore.initialisieren.mockResolvedValue({});
    mockStore.snapshot.mockReturnValue({ spieler: { aktiverTischId: 't1' } });
    szene.create();
    
    await vi.waitFor(() => expect(mockStore.reconnecteTisch).toHaveBeenCalledWith('t1'));
    expect(szene.scene.start).toHaveBeenCalledWith('TischSzene');
  });

  it('behandelt Einladungs-Link aus URL', async () => {
    window.location.hash = '#join/ABCDEF12';
    mockStore.initialisieren.mockResolvedValue({});
    mockStore.betreteTischViaCode.mockResolvedValue({});
    
    szene.create();
    
    await vi.waitFor(() => expect(mockStore.betreteTischViaCode).toHaveBeenCalledWith('ABCDEF12'));
    expect(szene.scene.start).toHaveBeenCalledWith('TischSzene');
  });
});
