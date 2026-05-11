// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

interface MockScene {
  add: {
    existing: Mock;
    container: (x?: number, y?: number) => FakeContainer;
    text: () => FakeGameObject;
    graphics: () => FakeGameObject;
    image: () => FakeGameObject;
  };
  textures: {
    exists: Mock;
  };
  tweens: {
    add: Mock;
    killTweensOf: Mock;
  };
}

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; width=100; height=150;
  tint=0;
  constructor(public scene: unknown, x?: number, y?: number) {
    this.x = x || 0;
    this.y = y || 0;
  }
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setScale() { return this; }
  setDisplaySize() { return this; }
  setOrigin() { return this; }
  setTint(t: number) { this.tint = t; return this; }
  setAngle() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setSize(w: number, h: number) { this.width = w; this.height = h; return this; }
  clear() { return this; }
  fillStyle() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  lineStyle() { return this; }
  lineBetween() { return this; }
  destroy() { this.active = false; }
  add() { return this; }
  on() { return this; }
}

class FakeContainer extends FakeGameObject {
  list: unknown[] = [];
  constructor(scene: unknown, x?: number, y?: number) { super(scene, x, y); }
  add(item?: unknown) { 
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
      Image: FakeGameObject,
      Text: FakeGameObject
    }
  }
}));

const { Kartenansicht } = await import('./Kartenansicht');

describe('Kartenansicht', () => {
  let mockScene: MockScene;

  beforeEach(() => {
    mockScene = {
      add: { 
        existing: vi.fn(),
        container: vi.fn((x, y) => new FakeContainer(mockScene, x, y)),
        text: vi.fn(() => new FakeGameObject(mockScene)),
        graphics: vi.fn(() => new FakeGameObject(mockScene)),
        image: vi.fn(() => new FakeGameObject(mockScene))
      },
      textures: {
        exists: vi.fn(() => true)
      },
      tweens: {
        add: vi.fn(),
        killTweensOf: vi.fn()
      }
    };
  });

  it('erstellt eine offene Karte', () => {
    // @ts-expect-error - MockScene ist kein echtes Phaser.Scene
    const k = Kartenansicht.offen(mockScene, 100, 100, 'HERZ', 'AS', 100, 150);
    expect(mockScene.add.existing).toHaveBeenCalledWith(k);
    expect(k.textur).toContain('HERZ-AS');
  });

  it('erstellt eine verdeckte Karte', () => {
    // @ts-expect-error - MockScene ist kein echtes Phaser.Scene
    const k = Kartenansicht.verdeckt(mockScene, 100, 100, 100, 150);
    expect(k.textur).toBe('card_back');
  });

  it('markiert die Karte bei Auswahl', () => {
    // @ts-expect-error - MockScene ist kein echtes Phaser.Scene
    const k = Kartenansicht.offen(mockScene, 100, 100, 'HERZ', 'AS', 100, 150);
    k.markiereAuswahl();
    expect(k.tint).toBe(0xffe082);
  });

  it('gleitet zu einer neuen Position', () => {
    // @ts-expect-error - MockScene ist kein echtes Phaser.Scene
    const k = Kartenansicht.offen(mockScene, 0, 0, 'HERZ', 'AS', 100, 150);
    k.gleiteZu(100, 200);
    expect(mockScene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({
      x: 100, y: 200
    }));
  });

  it('nutzt Fallback wenn Textur fehlt', () => {
    mockScene.textures.exists.mockReturnValue(false);
    // @ts-expect-error - MockScene ist kein echtes Phaser.Scene
    Kartenansicht.offen(mockScene, 100, 100, 'HERZ', 'AS', 100, 150);
    // Sollte fallback Texte hinzugefügt haben
    expect(mockScene.add.text).toHaveBeenCalled();
  });
});
