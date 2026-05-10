// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; text?: string; width=100;
  constructor(public scene: any, x?: number, y?: number, text?: string) {
    this.x = x || 0;
    this.y = y || 0;
    this.text = text;
  }
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setScale() { return this; }
  setOrigin() { return this; }
  setTint() { return this; }
  setMask() { return this; }
  setInteractive() { return this; }
  setStrokeStyle() { return this; }
  destroy() { this.active = false; }
  add() { return this; }
  on() { return this; }
  clear() { return this; }
  fillStyle() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  lineStyle() { return this; }
}

class FakeContainer extends FakeGameObject {
  list: any[] = [];
  constructor(scene: any, x?: number, y?: number) { super(scene, x, y); }
  add(item?: any) { 
    if (Array.isArray(item)) this.list.push(...item);
    else this.list.push(item);
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    GameObjects: {
      Container: FakeContainer,
      GameObject: FakeGameObject,
      Graphics: FakeGameObject,
      Text: FakeGameObject
    }
  }
}));

const { Nameplate } = await import('./Nameplate');

describe('Nameplate', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      add: { 
        existing: vi.fn(),
        container: vi.fn((x, y) => new FakeContainer(mockScene, x, y)),
        text: vi.fn((x, y, t) => new FakeGameObject(mockScene, x, y, t)),
        graphics: vi.fn(() => new FakeGameObject(mockScene))
      },
      make: {
        graphics: vi.fn(() => new FakeGameObject(mockScene)),
        text: vi.fn((config: any) => { 
          return new FakeGameObject(mockScene, config.x, config.y, config.text); 
        })
      },
      tweens: {
        add: vi.fn(() => ({ stop: vi.fn() }))
      }
    };
  });

  it('erstellt Nameplate für Spieler', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'Player 1', istKI: false, position: 'SUED' });
    expect(mockScene.add.existing).toHaveBeenCalledWith(plate);
    const nameText = plate.list.find((o: any) => o.text === 'Player 1');
    expect(nameText).toBeDefined();
  });

  it('erstellt Nameplate für KI mit Badge', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'Bot', istKI: true, position: 'WEST' });
    const kiBadge = plate.list.find(o => o instanceof FakeContainer);
    expect(kiBadge).toBeDefined();
  });

  it('setzt Zustand amZug mit Glow-Animation', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'P1', istKI: false, position: 'SUED' });
    plate.setZustand('amZug');
    expect(mockScene.tweens.add).toHaveBeenCalled();
  });

  it('zeigt Hochzeit-Partner Icon', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'P1', istKI: false, position: 'SUED' });
    plate.setHochzeitPartner(true);
    const heart = plate.list.find((o: any) => o.text === '♥');
    expect(heart).toBeDefined();
    
    plate.setHochzeitPartner(false);
    expect(heart!.active).toBe(false);
  });

  it('zeigt Ansage-Badge', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'P1', istKI: false, position: 'SUED' });
    plate.showAnsage('re');
    expect(plate.hatAnsageBadge()).toBe(true);
  });

  it('zeigt Vorbehalt-Label', () => {
    const plate = new Nameplate(mockScene, 100, 100, { name: 'P1', istKI: false, position: 'SUED' });
    plate.showVorbehalt();
    const label = plate.list.find((o: any) => o.text === 'VORBEHALT?');
    expect(label).toBeDefined();
    
    plate.clearVorbehalt();
    expect(label!.active).toBe(false);
    });
    });


