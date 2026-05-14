// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FlashTextManager } from './FlashTextManager';

function baueFlashSzene() {
  const objects: any[] = [];
  const timers: any[] = [];
  const tweens: any[] = [];

  const mockScale = {
    gameSize: { width: 1280, height: 720 }
  };

  const createFakeObj = (x: number, y: number, text?: string) => {
    const obj = { 
      x, y, text, active: true, alpha: 1, angle: 0,
      destroy: vi.fn(function(this: any) { this.active = false; }), 
      add: vi.fn(), 
      setDepth: vi.fn().mockReturnThis(), 
      setScale: vi.fn().mockReturnThis(), 
      setAlpha: vi.fn(function(this: any, a: number) { this.alpha = a; return this; }),
      setOrigin: vi.fn().mockReturnThis(),
      setShadow: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setStrokeStyle: vi.fn().mockReturnThis(),
      setY: vi.fn(function(this: any, y: number) { this.y = y; return this; }),
      setAngle: vi.fn(function(this: any, a: number) { this.angle = a; return this; }),
      setText: vi.fn(function(this: any, t: string) { this.text = t; return this; })
    };
    objects.push(obj);
    return obj;
  };

  const mockSzene = {
    add: {
      container: vi.fn((x: number, y: number) => createFakeObj(x, y)),
      text: vi.fn((x: number, y: number, text: string) => createFakeObj(x, y, text)),
      graphics: vi.fn(() => ({
        active: true,
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        destroy: vi.fn(function(this: any) { this.active = false; })
      })),
      particles: vi.fn(() => ({
        active: true,
        setDepth: vi.fn().mockReturnThis(),
        explode: vi.fn(),
        destroy: vi.fn(function(this: any) { this.active = false; })
      })),
      circle: vi.fn((x: number, y: number) => createFakeObj(x, y))
    },
    tweens: {
      add: vi.fn((config: any) => {
        tweens.push(config);
        if (config.onComplete) {
           // Wir rufen onComplete meist manuell auf in den Tests
        }
        return { stop: vi.fn() };
      }),
      killTweensOf: vi.fn(),
    },
    time: {
      delayedCall: vi.fn((ms: number, callback: () => void) => {
        const timer = { ms, callback, active: true, remove: vi.fn(function(this: any) { this.active = false; }) };
        timers.push(timer);
        // Wir triggern den callback oft manuell um Timeouts zu vermeiden
        return timer;
      }),
      addEvent: vi.fn((config: any) => {
        const timer = { ms: config.delay, callback: config.callback, active: true, remove: vi.fn(function(this: any) { this.active = false; }) };
        timers.push(timer);
        return timer;
      })
    },
    cameras: {
      main: {
        shake: vi.fn(),
        flash: vi.fn()
      }
    },
    textures: {
      exists: vi.fn(() => true)
    },
    scale: mockScale
  };

  return { mockSzene, objects, timers, tweens };
}

describe('FlashTextManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('erzeugt bei SpielGestartet die korrekten UI-Komponenten', async () => {
    const { mockSzene, objects, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('SpielGestartet');
    
    expect(mockSzene.add.container).toHaveBeenCalled();
    expect(mockSzene.add.text).toHaveBeenCalledTimes(3);
    
    // Timer für Fade-Out triggern
    timers[0].callback();
    
    // Fade-Out Tween onComplete triggern
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
    expect(objects[0].destroy).toHaveBeenCalled();
  });

  it('respektiert den Geschwindigkeitsfaktor', async () => {
    const { mockSzene } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);
    manager.setzeGeschwindigkeitsfaktor(2);

    manager.zeigeSpielevent('SpielGestartet');
    expect(mockSzene.time.delayedCall).toHaveBeenCalledWith(1250, expect.any(Function));
  });

  it('zerstört Objekte sofort im Turbo-Modus (Infinity)', async () => {
    const { mockSzene, objects } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);
    manager.setzeGeschwindigkeitsfaktor(Infinity);

    await manager.zeigeSpielevent('SpielGestartet');
    
    expect(mockSzene.time.delayedCall).not.toHaveBeenCalled();
    expect(objects[0].destroy).toHaveBeenCalled();
  });

  it('erzeugt bei SchweinchenGemeldet die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('SchweinchenGemeldet', { spielerName: 'Test' });
    
    expect(mockSzene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '🐷', expect.any(Object));
    
    // VerwalteMitTimeout beenden
    timers[timers.length-1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
  });

  it('erzeugt bei FuchsGefangen die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('FuchsGefangen', { spielerName: 'Fuchsjäger' });
    
    // FUCHS Buchstaben-Timer triggern
    timers.forEach(t => { if (t.ms < 1000) t.callback(); });

    // VerwalteMitTimeout beenden
    timers[timers.length-1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
    expect(mockSzene.add.text).toHaveBeenCalledTimes(6); 
  });

  it('erzeugt bei DoppelkopfGestochen die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('DoppelkopfGestochen');
    
    // VerwalteMitTimeout beenden
    timers[timers.length-1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
    expect(mockSzene.cameras.main.flash).toHaveBeenCalled();
  });

  it('erzeugt bei HochzeitPartnerGefunden die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('HochzeitPartnerGefunden', { spielerName: 'Partner' });
    
    // VerwalteMitTimeout beenden
    timers[timers.length-1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
    expect(mockSzene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), '💍', expect.any(Object));
  });

  it('erzeugt bei SpielBeendet die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('SpielBeendet');
    
    // VerwalteMitTimeout beenden
    timers[timers.length-1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();
    
    await promise;
    expect(mockSzene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'GEWONNEN', expect.any(Object));
  });

  it('stoppt Vorbehalt-Animation korrekt', async () => {
    const { mockSzene, objects } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    await manager.zeigeSpielevent('VorbehaltErwartet');
    expect((manager as any).vorbehaltContainer).toBeDefined();

    manager.stoppeVorbehaltAnimation();
    expect((manager as any).vorbehaltContainer).toBeUndefined();
    expect(objects[0].destroy).toHaveBeenCalled();
  });

  it('erzeugt bei NaechsterSpielerErwartet die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('NaechsterSpielerErwartet', { spielerName: 'Anna' });

    expect(mockSzene.add.container).toHaveBeenCalled();
    expect(mockSzene.add.text).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 'ANNA', expect.any(Object)
    );

    timers[timers.length - 1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();

    await promise;
    expect(mockSzene.add.text).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 'AM ZUG', expect.any(Object)
    );
  });

  it('erzeugt bei StichAbgeschlossen die korrekten UI-Komponenten', async () => {
    const { mockSzene } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('StichAbgeschlossen', { punkte: 5 });

    expect(mockSzene.add.text).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), '+5', expect.any(Object)
    );

    // Score-Tween: erst einblenden, dann ausblenden
    const einblendTween = mockSzene.tweens.add.mock.calls[0][0];
    einblendTween.onComplete();

    // Fade-Out-Tween nach Delay
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();

    await promise;
  });

  it('erzeugt bei KarlchenGespielt die korrekten UI-Komponenten', async () => {
    const { mockSzene, timers } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);

    const promise = manager.zeigeSpielevent('KarlchenGespielt', { spielerName: 'Max' });

    expect(mockSzene.add.text).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 'KARLCHEN', expect.any(Object)
    );
    expect(mockSzene.cameras.main.shake).toHaveBeenCalled();

    timers[timers.length - 1].callback();
    const fadeOutTween = mockSzene.tweens.add.mock.calls.find((call: any) => call[0].alpha === 0)![0];
    fadeOutTween.onComplete();

    await promise;
  });

  it('skaliert Shockwave-Dauer und Verzoegerung', () => {
    const { mockSzene } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);
    manager.setzeGeschwindigkeitsfaktor(10);

    manager.shockwaveRing(100, 100, 0xffffff, 500);
    
    expect(mockSzene.time.delayedCall).toHaveBeenCalledWith(50, expect.any(Function));
    
    const timerCall = (mockSzene.time.delayedCall as any).mock.calls[0];
    const callback = timerCall[1];
    callback();

    expect(mockSzene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({ duration: 55 }));
  });
  
  it('schaltet ScreenShake im Turbo-Modus aus', () => {
    const { mockSzene } = baueFlashSzene();
    const manager = new FlashTextManager(mockSzene as any);
    
    manager.screenShake();
    expect(mockSzene.cameras.main.shake).toHaveBeenCalled();
    
    mockSzene.cameras.main.shake.mockClear();
    manager.setzeGeschwindigkeitsfaktor(11);
    manager.screenShake();
    expect(mockSzene.cameras.main.shake).not.toHaveBeenCalled();
  });
});
