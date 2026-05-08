// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FARBE_GOLD_WARM } from '../ui/designTokens';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; name='';
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
  setName(n: string) { this.name = n; return this; }
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
      Rectangle: class extends FakeGameObject {
        lineWidth: number = 0;
        strokeColor: number = 0;
        setStrokeStyle(w: number, c: number) {
            this.lineWidth = w;
            this.strokeColor = c;
            return this;
        }
      },
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
      x: 10, y: 20, text: 'Click me', callback, typ: 'secondary', testId: 'btn-1'
    });

    expect(btn.x).toBe(10);
    expect(btn.y).toBe(20);
    expect(btn.name).toBe('btn-1');
    expect(mockScene.add.existing).toHaveBeenCalledWith(btn);
  });

  it('führt Callback aus beim Klick und setzt y-Position zurück', () => {
    const callback = vi.fn();
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback
    });

    const schatten = (btn as any).list[0];
    const hintergrund = (btn as any).list[1];
    const textObj = (btn as any).list[2];

    // Pointer down
    hintergrund.onpointerdown();
    expect(hintergrund.y).toBe(2);
    expect(schatten.alpha).toBe(0);
    expect(textObj.y).toBe(2);

    // Pointer up
    hintergrund.onpointerup();
    expect(hintergrund.y).toBe(0);
    expect(schatten.alpha).toBe(0.5);
    expect(textObj.y).toBe(0);
    expect(callback).toHaveBeenCalled();
  });

  it('setzt Styles bei pointerout zurück', () => {
    const callback = vi.fn();
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback
    });

    const schatten = (btn as any).list[0];
    const hintergrund = (btn as any).list[1];
    const textObj = (btn as any).list[2];

    hintergrund.onpointerdown();
    hintergrund.onpointerout();
    expect(hintergrund.y).toBe(0);
    expect(schatten.alpha).toBe(0.5);
    expect(textObj.y).toBe(0);
  });

  it('ist ausgegraut wenn deaktiviert', () => {
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback: () => {}, deaktiviert: true
    });
    
    const hintergrund = (btn as any).list[1];
    const textObj = (btn as any).list[2];
    expect(hintergrund.alpha).toBe(0.5);
    expect(textObj.alpha).toBe(0.5);
  });

  it('setzt Focus Rahmen', () => {
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback: () => {}
    });

    const hintergrund = (btn as any).list[1];

    btn.setFocus(true);
    expect(hintergrund.strokeColor).toBe(FARBE_GOLD_WARM);

    btn.setFocus(false);
    expect(hintergrund.strokeColor).toBe(0xf8f9fa);
  });

  it('löst Trigger-Methode aus', () => {
    const callback = vi.fn();
    const btn = new PhaserButton(mockScene, {
      x: 0, y: 0, text: 'Test', callback
    });

    btn.trigger();
    expect(callback).toHaveBeenCalled();
  });
});
