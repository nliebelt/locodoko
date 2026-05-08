// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; text?: string;
  constructor(public scene: any) {}
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
  on(event: string, fn: any) { (this as any)['on' + event] = fn; return this; }
  off() { return this; }
}

class FakeContainer extends FakeGameObject {
  list: any[] = [];
  constructor(scene: any) { super(scene); }
  add(item: any) { 
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
      Rectangle: FakeGameObject,
      Text: FakeGameObject
    }
  }
}));

const { SpielprotokollOverlay } = await import('./SpielprotokollOverlay');

describe('SpielprotokollOverlay', () => {
  let mockScene: any;
  let mockModell: any;

  beforeEach(() => {
    mockScene = {
      add: { 
        existing: vi.fn(),
        rectangle: vi.fn(() => new FakeGameObject(mockScene)),
        text: vi.fn((x, y, text) => {
          const t = new FakeGameObject(mockScene);
          t.text = text;
          return t;
        }),
        line: vi.fn(() => new FakeGameObject(mockScene)),
        container: vi.fn(() => new FakeContainer(mockScene))
      },
      make: {
        graphics: vi.fn(() => ({
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          createGeometryMask: vi.fn(() => ({})),
          destroy: vi.fn()
        }))
      },
      input: {
        on: vi.fn(),
        off: vi.fn()
      }
    };

    mockModell = {
      spieler: [
        { position: 'SUED', name: 'Spieler 1' },
        { position: 'WEST', name: 'Spieler 2' },
        { position: 'NORD', name: 'Spieler 3' },
        { position: 'OST', name: 'Spieler 4' }
      ]
    };
  });

  it('erstellt das Overlay mit Einträgen', () => {
    const eintraege = [
      {
        nr: 1, geber: 'SUED', spieltyp: 'NORMALSPIEL', istBockrunde: false,
        punkteProSpieler: {
          SUED: { pkt: 10, stand: 10 },
          WEST: { pkt: -10, stand: -10 },
          NORD: { pkt: 10, stand: 10 },
          OST: { pkt: -10, stand: -10 }
        }
      }
    ];

    const onClose = vi.fn();
    const overlay = new SpielprotokollOverlay(mockScene, 640, 360, 1280, 720, eintraege as any, mockModell, onClose);

    expect(mockScene.add.existing).toHaveBeenCalledWith(overlay);
    expect(mockScene.add.text).toHaveBeenCalled();
  });

  it('zeigt Meldung wenn keine Einträge vorhanden', () => {
    const overlay = new SpielprotokollOverlay(mockScene, 640, 360, 1280, 720, [], mockModell, () => {});
    const list = (overlay as any).listContainer.list;
    const emptyText = list.find((t: any) => t.text === 'Noch keine Spiele absolviert.');
    expect(emptyText).toBeDefined();
  });

  it('ruft onClose auf beim Klick auf Backdrop oder X', () => {
    const onClose = vi.fn();
    const overlay = new SpielprotokollOverlay(mockScene, 640, 360, 1280, 720, [], mockModell, onClose);

    // Elemente in overlay.list suchen
    const backdrop = overlay.list[0];
    (backdrop as any).onpointerdown();
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = overlay.list.find((t: any) => t.text === 'X');
    expect(closeBtn).toBeDefined();
    (closeBtn as any).onpointerdown();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
