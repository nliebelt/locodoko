// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true; name='';
  constructor(public scene: any, x?: number, y?: number) {
    this.x = x || 0;
    this.y = y || 0;
  }
  setName(n: string) { this.name = n; return this; }
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
    focus = false;
    constructor() { super({}); }
    setFocus(f: boolean) { this.focus = f; }
    trigger() { if ((this as any).onpointerdown) (this as any).onpointerdown(); }
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
      aktionen: [{ text: 'OK', callback, testId: 'btn-ok' }]
    });

    const content = modal.getContentContainer();
    expect(content).toBeDefined();
    expect(modal.list.some(item => item.name === 'btn-ok')).toBe(true);
  });

  it('ruft onClose auf wenn Backdrop geklickt wird', () => {
    const onClose = vi.fn();
    const modal = new PhaserModal(mockScene, 640, 360, { onClose });
    
    // Backdrop ist das erste Kind im Modal Container (Rectangle)
    const backdrop = modal.list[0];
    if (backdrop.onpointerdown) backdrop.onpointerdown();
    
    expect(onClose).toHaveBeenCalled();
  });

  it('ruft onClose auf wenn Schliessen Button geklickt wird', () => {
    const onClose = vi.fn();
    const modal = new PhaserModal(mockScene, 640, 360, { onClose, zeigeSchliessenButton: true, titel: 'T' });
    
    // Schließen Button finden (ist ein Text-Objekt)
    const closeBtn = modal.list.find(item => item.onpointerdown !== undefined && item !== modal.list[0] && item !== modal.list[2]);
    expect(closeBtn).toBeDefined();
    if (closeBtn.onpointerdown) closeBtn.onpointerdown();
    
    expect(onClose).toHaveBeenCalled();
  });

  it('reagiert auf Escape-Taste', () => {
    const onClose = vi.fn();
    const modal = new PhaserModal(mockScene, 640, 360, { onClose });
    
    // Escape-Event simulieren
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    window.dispatchEvent(event);
    
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    
    modal.destroy(); // cleanup listener
  });

  it('kann durch Fokus-Elemente tabben und diese mit Enter triggern', () => {
    const action1 = vi.fn();
    const action2 = vi.fn();
    
    const mockFocusable1 = { setFocus: vi.fn(), trigger: action1 };
    const mockFocusable2 = { setFocus: vi.fn(), trigger: action2 };
    
    const modal = new PhaserModal(mockScene, 640, 360);
    modal.addFocusable(mockFocusable1);
    modal.addFocusable(mockFocusable2);
    
    expect(mockFocusable1.setFocus).toHaveBeenCalledWith(true);
    
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(tabEvent, 'preventDefault', { value: vi.fn() });
    window.dispatchEvent(tabEvent);
    
    expect(mockFocusable1.setFocus).toHaveBeenCalledWith(false);
    expect(mockFocusable2.setFocus).toHaveBeenCalledWith(true);
    
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(enterEvent, 'preventDefault', { value: vi.fn() });
    window.dispatchEvent(enterEvent);
    
    expect(action2).toHaveBeenCalled();
    
    // Shift+Tab zurück
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    Object.defineProperty(shiftTabEvent, 'preventDefault', { value: vi.fn() });
    window.dispatchEvent(shiftTabEvent);
    
    expect(mockFocusable2.setFocus).toHaveBeenCalledWith(false);
    expect(mockFocusable1.setFocus).toHaveBeenCalledWith(true);
    
    modal.destroy();
  });
});
