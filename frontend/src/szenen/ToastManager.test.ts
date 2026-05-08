// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ToastManager } from './ToastManager';

describe('ToastManager', () => {
  let manager: ToastManager;
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScene = {
      scale: { gameSize: { width: 1280, height: 720 } },
      add: {
        container: vi.fn(() => ({ 
          setDepth: vi.fn().mockReturnThis(), 
          add: vi.fn(), 
          destroy: vi.fn(),
          x: 0, y: 0
        })),
        rectangle: vi.fn(() => ({ setStrokeStyle: vi.fn().mockReturnThis() })),
        text: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis() }))
      },
      time: { 
        delayedCall: vi.fn((ms, cb) => {
          cb(); // Sofort aufrufen für den Test
        }) 
      },
      tweens: { 
        add: vi.fn((config) => {
          if (config.onComplete) config.onComplete();
        }) 
      }
    };
    manager = new ToastManager(mockScene as any);
  });

  it('zeigt einen Toast an', () => {
    manager.zeige({ text: 'Test-Info', typ: 'info' });
    
    expect(mockScene.add.container).toHaveBeenCalled();
    expect(mockScene.add.rectangle).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), 0x444444, 0.9);
    expect(mockScene.add.text).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'Test-Info', expect.any(Object));
  });

  it('zeigt einen Fehler-Toast an', () => {
    manager.zeige({ text: 'Test-Fehler', typ: 'fehler' });
    expect(mockScene.add.rectangle).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number), 0xff4444, 0.9);
  });

  it('ordnet mehrere Toasts untereinander an', () => {
    manager.zeige({ text: 'Toast 1', typ: 'info' });
    manager.zeige({ text: 'Toast 2', typ: 'info' });
    
    // tweens.add sollte für die Anordnung gerufen worden sein
    expect(mockScene.tweens.add).toHaveBeenCalled();
  });
});
