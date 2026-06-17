// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true;
  constructor(public scene: any) {}
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setScale() { return this; }
  setOrigin() { return this; }
  setTint() { return this; }
  setMask() { return this; }
  // Phaser 4: enableFilters ist WebGL-only; in jsdom bleibt `filters` ungesetzt,
  // sodass setzeRechteckMaske headless ohne Maske zurueckkehrt.
  enableFilters() { return this; }
  filters: unknown = undefined;
  destroy() { this.active = false; }
  add() { return this; }
  on(event: string, fn: any) { (this as any)['on' + event] = fn; return this; }
  off() { return this; }
}

class FakeContainer extends FakeGameObject {
  list: any[] = [];
  constructor(scene: any) { super(scene); }
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
      GameObject: FakeGameObject
    }
  }
}));

const { PhaserList } = await import('./PhaserList');

describe('PhaserList', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      add: { existing: vi.fn() },
      input: {
        on: vi.fn(),
        off: vi.fn()
      }
    };
  });

  it('erstellt die Liste mit Items', () => {
    const renderElement = vi.fn((item: any, container: any) => {
      container.item = item;
    });

    const list = new PhaserList(mockScene, 100, 100, {
      breite: 200,
      hoehe: 300,
      items: [{ id: 1 }, { id: 2 }],
      elementHoehe: 50,
      renderElement
    });

    expect(mockScene.add.existing).toHaveBeenCalledWith(list);
    expect(renderElement).toHaveBeenCalledTimes(2);
    expect(list.getListContainer().list).toHaveLength(2);
  });

  it('reagiert auf Scrollen (wheel)', () => {
    const list = new PhaserList(mockScene, 100, 100, {
      breite: 200,
      hoehe: 100,
      items: [1, 2, 3, 4], // 4 * 50 = 200 total height
      elementHoehe: 50,
      renderElement: () => {}
    });

    // onWheel callback finden
    const onWheel = mockScene.input.on.mock.calls.find((call: any) => call[0] === 'wheel')[1];

    // Scrollen nach unten (deltaY > 0)
    onWheel({}, [], 0, 20); // scrollYOffset -= 10
    expect(list.getListContainer().y).toBe(-10);

    // Scrollen über das Ende hinaus
    onWheel({}, [], 0, 1000); 
    // totalHeight=200, listH=100 -> maxScroll = -100
    expect(list.getListContainer().y).toBe(-100);

    // Scrollen über den Anfang hinaus
    onWheel({}, [], 0, -1000);
    expect(list.getListContainer().y).toBe(0);
  });

  it('bereinigt Ressourcen beim Zerstoeren', () => {
    const list = new PhaserList(mockScene, 100, 100, {
      breite: 200,
      hoehe: 300
    });

    const onWheel = mockScene.input.on.mock.calls[0][1];
    
    // Zerstören triggern
    (list as any).ondestroy(); // Simulate 'destroy' event emitter call

    expect(mockScene.input.off).toHaveBeenCalledWith('wheel', onWheel);
  });
});
