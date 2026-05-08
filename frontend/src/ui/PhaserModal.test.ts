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
  setVisible(v: boolean) { this.visible = v; return this; }
}

class FakeContainer extends FakeGameObject {
  list: any[] = [];
  add(k: any) { 
    if (Array.isArray(k)) this.list.push(...k);
    else this.list.push(k);
    return this;
  }
}

vi.mock('phaser', () => ({
  default: {
    GameObjects: {
      Container: FakeContainer,
      Rectangle: class extends FakeGameObject {},
      Text: class extends FakeGameObject {},
      GameObject: FakeGameObject
    }
  }
}));

// PhaserButton mocken damit Modal es nutzen kann
vi.mock('../szenen/PhaserButton', () => ({
  PhaserButton: class extends FakeContainer {
    constructor() { super({}); }
    setFocus() {}
  }
}));

const { PhaserModal } = await import('./PhaserModal');

describe('PhaserModal', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = {
      add: { existing: vi.fn(), container: () => new FakeContainer(mockScene) },
      input: { keyboard: { on: vi.fn(), off: vi.fn() } },
      cameras: { main: { width: 1280, height: 720 } }
    };
  });

  it('erstellt ein Modal', () => {
    const modal = new PhaserModal(mockScene, 640, 360, {
      titel: 'Test-Modal'
    });

    expect(mockScene.add.existing).toHaveBeenCalledWith(modal);
  });

  it('fügt Aktionen hinzu', () => {
    const callback = vi.fn();
    const modal = new PhaserModal(mockScene, 640, 360, {
      titel: 'Modal',
      aktionen: [{ text: 'OK', callback }]
    });

    const content = modal.getContentContainer();
    expect(content).toBeDefined();
  });
});
