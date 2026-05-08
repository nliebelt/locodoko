// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true;
  constructor(public scene: any, x?: number, y?: number) {
    this.x = x || 0;
    this.y = y || 0;
  }
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setScale() { return this; }
  setOrigin() { return this; }
  setTint() { return this; }
  setStrokeStyle() { return this; }
  destroy() { this.active = false; }
  add() { return this; }
  on(event: string, fn: any) { (this as any)['on' + event] = fn; return this; }
  setInteractive() { return this; }
  setName() { return this; }
}

vi.mock('phaser', () => ({
  default: {
    GameObjects: {
      Container: class extends FakeGameObject {
        list: any[] = [];
        add(k: any) { 
          if (Array.isArray(k)) this.list.push(...k);
          else this.list.push(k);
          return this;
        }
      },
      Rectangle: class extends FakeGameObject {},
      Text: class extends FakeGameObject {},
      GameObject: FakeGameObject
    }
  }
}));

const { PhaserButton } = await import('./PhaserButton');

describe('PhaserButton', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      add: { existing: vi.fn() }
    };
  });

  it('erstellt einen Button', () => {
    const callback = vi.fn();
    const btn = new PhaserButton(mockScene, {
      x: 10, y: 20, text: 'Click me', callback
    });

    expect(btn.x).toBe(10);
    expect(btn.y).toBe(20);
    expect(mockScene.add.existing).toHaveBeenCalledWith(btn);
  });

  it('führt Callback aus beim Klick', () => {
    const callback = vi.fn();
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback
    });

    // Hintergrund ist das zweite Element im Mock (index 1: schatten, hintergrund, text)
    const hintergrund = (btn as any).list[1];
    hintergrund.onpointerup();
    expect(callback).toHaveBeenCalled();
  });

  it('ist ausgegraut wenn deaktiviert', () => {
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback: () => {}, deaktiviert: true
    });
    
    const hintergrund = (btn as any).list[1];
    expect(hintergrund.alpha).toBe(0.5);
  });
});
