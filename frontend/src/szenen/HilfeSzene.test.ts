// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../assets/AssetLoader', () => ({
  TEXTUR_FILZ: 'filz',
  registriereBasisTexturen: vi.fn(),
  ladeHintergrundbilder: vi.fn(),
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
          destroy: vi.fn(),
        })),
        tileSprite: vi.fn(() => ({ setAlpha: vi.fn().mockReturnThis() })),
        rectangle: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis(), destroy: vi.fn() })),
      };
      scene = { start: vi.fn(), stop: vi.fn() };
      input = { keyboard: { on: vi.fn() } };
      events = { once: vi.fn() };
    },
  },
}));

vi.mock('./PhaserButton', () => ({
  PhaserButton: vi.fn(function(this: any, _scene: any, optionen: any) {
    this.optionen = optionen;
    // Reale PhaserButton setzt `breite` (Text-Autosize); HilfeSzene ordnet Tabs danach an.
    this.breite = optionen.breite ?? 140;
    this.x = optionen.x;
    this.destroy = vi.fn();
  }),
}));

const { HilfeSzene } = await import('./HilfeSzene');
const { PhaserButton } = await import('./PhaserButton');

describe('HilfeSzene', () => {
  let szene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    szene = new HilfeSzene();
  });

  it('create baut Hintergrund, Titel und Zurück-Button', () => {
    szene.create();
    expect(szene.add.tileSprite).toHaveBeenCalled();
    expect(szene.add.text).toHaveBeenCalledWith(640, 45, 'SPIELREGELN', expect.any(Object));
    const zurueck = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    expect(zurueck).toBeDefined();
  });

  it('create erstellt alle sechs Tabs', () => {
    szene.create();
    const tabTexte = (PhaserButton as any).mock.calls.map((c: any) => c[1].text);
    expect(tabTexte).toContain('Trumpf');
    expect(tabTexte).toContain('Parteien');
    expect(tabTexte).toContain('Sonderp.');
    expect(tabTexte).toContain('Ansagen');
    expect(tabTexte).toContain('Sonderspiele');
    expect(tabTexte).toContain('Punkte');
  });

  it('Trumpf-Tab ist initial als primary markiert', () => {
    szene.create();
    const trumpfCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'Trumpf');
    expect(trumpfCall[1].typ).toBe('primary');
    const ansagenCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'Ansagen');
    expect(ansagenCall[1].typ).toBe('secondary');
  });

  it('Tab-Klick wechselt aktiven Tab', () => {
    szene.create();
    const ersteBatch = (PhaserButton as any).mock.calls.length;
    const ansagenCall = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === 'Ansagen');
    ansagenCall[1].callback();
    // Nach Tab-Klick werden Tabs neu gebaut
    expect((PhaserButton as any).mock.calls.length).toBeGreaterThan(ersteBatch);
  });

  it('Zurück-Button navigiert zur SpielverwaltungsSzene im Vollbild-Modus', () => {
    szene.init({});
    szene.create();
    const zurueck = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    zurueck[1].callback();
    expect(szene.scene.start).toHaveBeenCalledWith('SpielverwaltungsSzene');
    expect(szene.scene.stop).not.toHaveBeenCalled();
  });

  it('Zurück-Button stoppt Szene im Overlay-Modus', () => {
    szene.init({ modus: 'overlay' });
    szene.create();
    const zurueck = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    zurueck[1].callback();
    expect(szene.scene.stop).toHaveBeenCalled();
    expect(szene.scene.start).not.toHaveBeenCalled();
  });

  it('herkunft-Parameter steuert Rücknavigation', () => {
    szene.init({ herkunft: 'TischSzene' });
    szene.create();
    const zurueck = (PhaserButton as any).mock.calls.find((c: any) => c[1].text === '← Zurück');
    zurueck[1].callback();
    expect(szene.scene.start).toHaveBeenCalledWith('TischSzene');
  });
});
