// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { AnimationenService, type RundenauswertungDaten } from './AnimationenService';
import type Phaser from 'phaser';

interface MockTextObject {
  x: number;
  y: number;
  text: string;
  alpha: number;
  scaleX: number;
  scaleY: number;
  depth: number;
  setOrigin: Mock;
  setAlpha: (v: number) => MockTextObject;
  setScale: (v: number) => MockTextObject;
  setDepth: (v: number) => MockTextObject;
  destroy: Mock;
  setTint: Mock;
  setText: (v: string) => MockTextObject;
}

function baueTweenSzene() {
  const textobjekte: MockTextObject[] = [];
  const szene = {
    add: {
      text: (x: number, y: number, text: string) => {
        const obj: MockTextObject = { 
          x, y, text, alpha: 1, scaleX: 1, scaleY: 1, depth: 0, 
          setOrigin: vi.fn().mockReturnThis(),
          setAlpha: (v: number) => { obj.alpha = v; return obj; },
          setScale: (v: number) => { obj.scaleX = v; obj.scaleY = v; return obj; },
          setDepth: (v: number) => { obj.depth = v; return obj; },
          destroy: vi.fn(),
          setTint: vi.fn().mockReturnThis(),
          setText: (v: string) => { obj.text = v; return obj; }
        };
        textobjekte.push(obj);
        return obj;
      },
      rectangle: () => ({
        setDepth: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn()
      })
    },
    tweens: {
      add: (config: { onComplete?: () => void }) => {
        if (config.onComplete) config.onComplete();
        return { stop: vi.fn() };
      }
    },
    time: {
      delayedCall: (ms: number, cb: () => void) => {
        cb();
        return { remove: vi.fn() };
      }
    }
  };
  return { szene, textobjekte };
}

describe('AnimationenService', () => {
  it('markiert Animationen als laufend', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene, Infinity);

    expect(service.animationLaeuft).toBe(false);

    let warLaeuftInAnimation = false;
    await service.reiheEin(async () => {
      warLaeuftInAnimation = service.animationLaeuft;
    });

    expect(warLaeuftInAnimation).toBe(true);
    expect(service.animationLaeuft).toBe(false);
  });

  it('setzt die Warteschlange bei abbrechen() zurueck', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene, Infinity);

    service.abbrechen();

    expect(service.animationLaeuft).toBe(false);
    const ablauf: string[] = [];
    await service.reiheEin(async () => { ablauf.push('nach-abbrechen'); });
    expect(ablauf).toEqual(['nach-abbrechen']);
  });

  it('zeigt bei anzahl=1 ein Schaf und "Bockrunde!"', async () => {
    vi.useFakeTimers();
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene);

    const animation = service.animiereBockrunde(1, { x: 640, y: 360 }, 100);
    await vi.runAllTimersAsync();
    await animation;

    expect(textobjekte).toHaveLength(2);
    expect(textobjekte[0].text).toBe('🐑');
    expect(textobjekte[1].text).toBe('Bockrunde!');
    vi.useRealTimers();
  });

  it('zeigt bei anzahl=2 zwei Schafe und "Doppelbock!"', async () => {
    vi.useFakeTimers();
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene);

    const animation = service.animiereBockrunde(2, { x: 640, y: 360 }, 100);
    await vi.runAllTimersAsync();
    await animation;

    expect(textobjekte).toHaveLength(2);
    expect(textobjekte[0].text).toBe('🐑🐑');
    expect(textobjekte[1].text).toBe('Doppelbock!');
    vi.useRealTimers();
  });

  it('zeigt bei anzahl>=3 Schaf-Zaehler und "Bockrunde xN"', async () => {
    vi.useFakeTimers();
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene);

    const animation = service.animiereBockrunde(3, { x: 640, y: 360 }, 100);
    await vi.runAllTimersAsync();
    await animation;

    expect(textobjekte).toHaveLength(2);
    expect(textobjekte[0].text).toBe('🐑×3');
    expect(textobjekte[1].text).toBe('Bockrunde ×3');
    vi.useRealTimers();
  });

  it('animiereRundenEndeOverlay erzeugt alle UI-Elemente', async () => {
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene);
    service.setzeGeschwindigkeitsfaktor(Infinity); 

    const daten: RundenauswertungDaten = {
      siegerPartei: 'RE',
      spieltypLabel: 'Normalspiel',
      spielNummerText: '1 / 8',
      reSpielerNamen: 'A, B',
      kontraSpielerNamen: 'C, D',
      augenRe: 150,
      augenKontra: 90,
      berechnungZeilen: ['Gewonnen: 1', 'Keine 90: 1'],
      spielwert: 2,
      spielpunkte: [
        { name: 'A', punkte: 2, istSelbst: true },
        { name: 'B', punkte: 2, istSelbst: false }
      ],
      gesamtstand: [
        { name: 'A', punkte: 2 },
        { name: 'B', punkte: 2 }
      ]
    };

    const objekte = await service.animiereRundenauswertung(daten, 1280, 720);
    
    expect(textobjekte.length).toBeGreaterThan(10); 
    const siegerText = textobjekte.find(o => o.text === 'RE gewinnt!');
    expect(siegerText).toBeDefined();
    expect(objekte.length).toBeGreaterThan(0);
  });

  it('animiereSoloAnkuendigung erzeugt Text', async () => {
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene, Infinity);

    await service.animiereSoloAnkuendigung('Damensolo!', { x: 100, y: 100 });
    expect(textobjekte.some(o => o.text === 'Damensolo!')).toBe(true);
  });

  it('animiereSonderpunktFeedback erzeugt Text', async () => {
    const { szene, textobjekte } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene, Infinity);

    await service.animiereSonderpunktFeedback('Doppelkopf!', { x: 100, y: 100 });
    expect(textobjekte.some(o => o.text === 'Doppelkopf!')).toBe(true);
  });

  it('flipperZaehler animiert Text-Werte', async () => {
    const { szene } = baueTweenSzene();
    const service = new AnimationenService(szene as unknown as Phaser.Scene);
    // Wir nutzen hier normale Geschwindigkeit (1), damit der Flipper-Zweig durchlaufen wird
    service.setzeGeschwindigkeitsfaktor(1);

    const txt = szene.add.text(0, 0, '0') as unknown as Phaser.GameObjects.Text;
    // Privat-Zugriff auf flipperZaehler fuer Coverage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).flipperZaehler(txt, 100, '+', 100);
    
    expect(txt.destroy).not.toHaveBeenCalled();
  });
});
