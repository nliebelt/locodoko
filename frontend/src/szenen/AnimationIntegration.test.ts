// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mocks für Phaser und Services
vi.mock('../services/SpielverwaltungApi');
vi.mock('../services/SpielverwaltungEchtzeit');

class FakeGameObject {
  x=0; y=0; alpha=1; active=true; visible=true;
  texture = { key: '' };
  setDepth() { return this; }
  setAlpha(a: number) { this.alpha = a; return this; }
  setScale() { return this; }
  setDisplaySize() { return this; }
  setOrigin() { return this; }
  setTint() { return this; }
  setStrokeStyle() { return this; }
  setInteractive() { return this; }
  setVisible() { return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  clear() { return this; }
  fillStyle() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  lineStyle() { return this; }
  destroy() { this.active = false; }
  add() { return this; }
  on() { return this; }
  emit() { return this; }
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      add: any;
      scale: any;
      tweens: any;
      time: any;
      textures: any;
      cameras: any;
      make = {
        graphics: () => new FakeGameObject(),
        text: () => new FakeGameObject(),
        container: () => new FakeGameObject()
      };
    },
    GameObjects: { 
      Container: FakeGameObject,
      Image: FakeGameObject,
      TileSprite: FakeGameObject,
      Text: FakeGameObject,
      Graphics: FakeGameObject,
      Rectangle: FakeGameObject,
      Ellipse: FakeGameObject,
      GameObject: FakeGameObject
    },
    Scale: { Events: { RESIZE: 'resize' } }
  }
}));

let mockStore: any;
vi.mock('../anwendung', () => ({
  get appStore() { return mockStore; }
}));

// Erst importieren NACHDEM vi.mock phaser und anwendung gemockt hat
const { TischSzene } = await import('./TischSzene');
const { AppStore } = await import('../store/AppStore');
const { AnimationenService } = await import('../services/AnimationenService');

describe('Animation Integration & Guards', () => {
  let szene: any;
  let verarbeiteSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStore = new AppStore(vi.fn() as any, vi.fn() as any);
    
    // Wir spyen auf dem Prototyp, damit wir alle Aufrufe sicher fangen
    verarbeiteSpy = vi.spyOn(TischSzene.prototype as any, 'verarbeitePartieEreignis');

    szene = new (TischSzene as any)();
    Object.assign(szene, {
      add: { 
        container: () => new FakeGameObject(),
        text: () => new FakeGameObject(),
        graphics: () => new FakeGameObject(),
        circle: () => new FakeGameObject(),
        particles: () => new FakeGameObject(),
        image: () => new FakeGameObject(),
        tileSprite: () => new FakeGameObject(),
        rectangle: () => new FakeGameObject(),
        ellipse: () => new FakeGameObject(),
        existing: (o: any) => o
      },
      tweens: { 
        add: vi.fn((c) => { if (c.onComplete) c.onComplete(); return { stop: vi.fn() }; }),
        killTweensOf: vi.fn(),
        killAll: vi.fn()
      },
      time: { 
        delayedCall: vi.fn((ms, cb) => setTimeout(cb, ms)),
        addEvent: vi.fn(() => ({ remove: vi.fn() }))
      },
      scale: { gameSize: { width: 1280, height: 720 }, on: vi.fn(), off: vi.fn() },
      cameras: { main: { shake: vi.fn(), flash: vi.fn() } },
      textures: { exists: () => true },
      input: { keyboard: { on: vi.fn(), off: vi.fn() } }
    });

    (mockStore as any)._initialisiert = true;
    (mockStore as any).zustand.bereich = 'TISCH';
    (mockStore as any).zustand.aktuellerTisch = { 
      id: 't1', 
      konfiguration: { ohneNeunen: false },
      spieler: [{ spielerId: 's1', istKi: false, position: 'SUED' }] 
    };
    (mockStore as any).zustand.partieStand = { 
      partieId: 'p1', 
      version: 10, 
      laufendesSpiel: { 
        spielNummer: 1, 
        spieler: [{ position: 'SUED', istKi: false, spielerId: 's1' }],
        spielbareKarten: [],
        aktuelleStichmitte: [],
        ansageHistorie: [],
        moeglicheAnsagen: [],
        moeglicheVorbehalte: [],
        deklarierteVorbehalte: []
      } 
    };
    
    szene.create();
    
    // AnimationenService Mocken um reale Tweens zu vermeiden
    szene['animationen'] = new AnimationenService(szene);
    vi.spyOn(szene['animationen'], 'reiheEin').mockImplementation(async (fn) => { await fn(); });
  });

  afterEach(() => {
    verarbeiteSpy.mockRestore();
    vi.useRealTimers();
  });

  it('meldet isIdle=false während eine Animation in der Warteschlange läuft', async () => {
    // Hier brauchen wir wieder eine reale Warteschlange für das Timing
    const realService = new AnimationenService(szene);
    szene['animationen'] = realService;
    
    let animationAbgeschlossen = false;
    const animPromise = realService.reiheEin(async () => {
      await new Promise(r => setTimeout(r, 1000));
      animationAbgeschlossen = true;
    });

    // Während die Animation läuft: isIdle muss false sein
    expect(szene.isIdle()).toBe(false);

    // Zeit vorspulen
    await vi.advanceTimersByTimeAsync(1000);
    await animPromise;

    // Danach: isIdle muss true sein
    expect(animationAbgeschlossen).toBe(true);
    expect(szene.isIdle()).toBe(true);
  });

  it('Sequential Processing: Verarbeitet Events nacheinander auch bei Snapshot-Ueberholung', async () => {
    // Wir senden zwei Events in einem Batch
    const batch = {
      version: 12,
      ereignisse: [
        { ereignisTyp: 'KARTE_GESPIELT', version: 11, partieStand: { version: 11, partieId: 'p1' }, spielerPosition: 'SUED', karte: { id: 'K1' } },
        { ereignisTyp: 'STICH_ABGESCHLOSSEN', version: 12, partieStand: { version: 12, partieId: 'p1' }, neueSonderpunkte: [] }
      ]
    };

    // Store verarbeitet Batch (ist nicht async!)
    mockStore.verarbeitePartieBatch(batch);
    
    // Warten bis Queue leer ist (isIdle() nutzt setTimeout Internals)
    await vi.waitUntil(() => mockStore.isIdle());
    
    // Beide Events müssen an die Szene gereicht worden sein (Sequential Processing Pattern)
    expect(verarbeiteSpy).toHaveBeenCalledTimes(2);
    expect(verarbeiteSpy.mock.calls[0][0].ereignisTyp).toBe('KARTE_GESPIELT');
    expect(verarbeiteSpy.mock.calls[1][0].ereignisTyp).toBe('STICH_ABGESCHLOSSEN');
  });

  it('Deadlock-Fix: isIdle() ist true wenn die Queue pausiert ist (z.B. Modal offen)', () => {
    // Simulation: Ein Ereignis hat die Queue pausiert (z.B. Rundenauswertung)
    mockStore.pausiereQueue();
    
    // isIdle() muss true sein, damit E2E-Tests den Zustand lesen können,
    // auch wenn theoretisch noch Events in der Pipeline warten könnten.
    expect(mockStore.isIdle()).toBe(true);
    expect(szene.isIdle()).toBe(true);
  });

  it('Animation Guard: triggerRender wird während laufender Animation unterdrückt', () => {
    const renderSpy = vi.spyOn(szene as any, 'renderTisch');
    
    // Animation läuft
    vi.spyOn(szene['animationen'], 'animationLaeuft', 'get').mockReturnValue(true);
    
    szene.triggerRender();
    expect(renderSpy).not.toHaveBeenCalled();
    
    // Animation fertig
    vi.spyOn(szene['animationen'], 'animationLaeuft', 'get').mockReturnValue(false);
    szene.triggerRender();
    expect(renderSpy).toHaveBeenCalled();
  });
});
