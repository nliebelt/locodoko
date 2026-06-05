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
          setText: vi.fn().mockReturnThis()
        })),
        tileSprite: vi.fn(() => ({ setAlpha: vi.fn().mockReturnThis() })),
        container: vi.fn(() => ({ add: vi.fn(), removeAll: vi.fn(), destroy: vi.fn() })),
        rectangle: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis() }))
      };
      input = { keyboard: { on: vi.fn(), off: vi.fn() } };
      scene = { start: vi.fn() };
      events = { once: vi.fn() };
    }
  }
}));

vi.mock('./PhaserButton', () => ({
  PhaserButton: vi.fn(() => ({ setName: vi.fn(), add: vi.fn(), setX: vi.fn(), breite: 200 }))
}));

vi.mock('../ui/PhaserModal', () => ({
  PhaserModal: vi.fn(function(this: any, _scene: any, _x: number, _y: number, optionen: any) {
    this.optionen = optionen;
    this.getContentContainer = () => ({ add: vi.fn() });
    this.destroy = vi.fn();
    return this;
  })
}));

vi.mock('../ui/PhaserList', () => ({
  PhaserList: vi.fn(() => ({ destroy: vi.fn() }))
}));

const { SpielverwaltungsSzene } = await import('./SpielverwaltungsSzene');
const { PhaserButton } = await import('./PhaserButton');
const { PhaserModal } = await import('../ui/PhaserModal');

describe('SpielverwaltungsSzene', () => {
  let szene: any;
  let storeCallback: (z: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    szene = new SpielverwaltungsSzene();
    mockStore = {
      abonniere: vi.fn((cb) => {
        storeCallback = cb;
        return vi.fn();
      }),
      ladePresets: vi.fn(() => Promise.resolve([{ name: 'p1', label: 'Preset 1' }])),
      snapshot: vi.fn(() => ({ tische: [], spieler: null })),
      erstelleQuickGame: vi.fn(),
      erstelleTisch: vi.fn(() => Promise.resolve({ id: 't1' })),
      erstelleTischMitPreset: vi.fn(() => Promise.resolve()),
      ausloggen: vi.fn(() => Promise.resolve()),
      betreteTischViaCode: vi.fn(() => Promise.resolve())
    };
  });

  it('create baut die UI und lädt Presets', async () => {
    szene.create();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    expect(mockStore.ladePresets).toHaveBeenCalled();
    expect(mockStore.abonniere).toHaveBeenCalled();
  });

  it('navigiert zur TischSzene wenn Bereich zu TISCH wechselt', () => {
    szene.create();
    storeCallback({ bereich: 'TISCH', aktuellerTisch: { id: 't1' }, tische: [] });
    expect(szene.scene.start).toHaveBeenCalledWith('TischSzene');
  });

  it('öffnet ErstelleTischModal bei Button-Klick', () => {
    szene.create();
    const createTischCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '+ Neuen Tisch');
    createTischCall[1].callback();
    expect(PhaserModal).toHaveBeenCalled();
  });

  it('erstellt Tisch über das Modal', async () => {
    await szene.create();
    const createTischCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === '+ Neuen Tisch');
    createTischCall[1].callback();
    
    // Modal-Instanz finden
    const modalInstance = (PhaserModal as any).mock.results[0].value;
    const erstellenAktion = modalInstance.optionen.aktionen.find((a: any) => a.text === 'Erstellen');
    expect(erstellenAktion, 'Erstellen Aktion nicht gefunden').toBeDefined();
    
    const apiSpy = vi.spyOn(mockStore, 'erstelleTischMitPreset');
    await erstellenAktion.callback();
    expect(apiSpy).toHaveBeenCalled();
  });

  it('behandelt Logout', async () => {
    szene.create();
    const logoutCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === 'Abmelden');
    await logoutCall[1].callback();
    expect(mockStore.ausloggen).toHaveBeenCalled();
    expect(szene.scene.start).toHaveBeenCalledWith('LoginSzene');
  });

  it('behandelt Session-Recovery Button', () => {
    mockStore.snapshot.mockReturnValue({ tische: [], spieler: { aktiverTischId: 't1' } });
    szene.create();
    const recoveryCall = (PhaserButton as any).mock.calls.find((call: any) => call[1].text === 'Zurück zum Spiel');
    expect(recoveryCall).toBeDefined();
  });

  it('zeigt offene Tische an', () => {
    const tische = [{ id: 't2', name: 'Offener Tisch', spielerAnzahl: 2, status: 'WARTEND', kurzKonfiguration: { ohneNeunen: false, anzahlSpiele: 8 } }];
    mockStore.snapshot.mockReturnValue({ tische, spieler: null });
    szene.create();
    // renderOffeneTische sollte gerufen worden sein
    expect(szene.add.container).toHaveBeenCalled();
  });
});
