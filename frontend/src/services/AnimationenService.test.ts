// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { AnimationenService } from './AnimationenService';

interface AnimierbaresZiel {
  x: number;
  y: number;
}

function baueTweenSzene() {
  const aufrufe: Array<Record<string, unknown>> = [];
  return {
    aufrufe,
    szene: {
      tweens: {
        add: vi.fn((konfiguration: Record<string, unknown>) => {
          aufrufe.push(konfiguration);
          const ziele = Array.isArray(konfiguration.targets)
            ? konfiguration.targets as AnimierbaresZiel[]
            : [konfiguration.targets as AnimierbaresZiel];
          const zielX = konfiguration.x as number | undefined;
          const zielY = konfiguration.y as number | undefined;
          if (zielX !== undefined) {
            ziele.forEach((ziel) => {
              ziel.x = zielX;
            });
          }
          if (zielY !== undefined) {
            ziele.forEach((ziel) => {
              ziel.y = zielY;
            });
          }
          const onComplete = konfiguration.onComplete;
          if (typeof onComplete === 'function') {
            onComplete();
          }
          return {
            stop: vi.fn()
          };
        })
      }
    }
  };
}

describe('AnimationenService', () => {
  it('animiert das Ausspielen einer Karte zur Zielposition', async () => {
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never);
    const bild = { x: 10, y: 20 } as never;
    const beschriftung = { x: 10, y: 20 } as never;

    await service.animiereKarteAusspielen({ bild, beschriftung }, { x: 100, y: 200 });

    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].duration).toBe(400);
    expect(bild).toMatchObject({ x: 100, y: 200 });
    expect(beschriftung).toMatchObject({ x: 100, y: 200 });
  });

  it('wartet vor dem Stich-Einziehen und nutzt die konfigurierte Dauer', async () => {
    vi.useFakeTimers();
    const { szene, aufrufe } = baueTweenSzene();
    const service = new AnimationenService(szene as never);
    const bild = { x: 0, y: 0 } as never;

    const animation = service.animiereStichEinziehen([{ bild }], { x: 50, y: 75 });
    expect(aufrufe).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(999);
    expect(aufrufe).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    await animation;

    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0].duration).toBe(600);
    expect(bild).toMatchObject({ x: 50, y: 75 });
    vi.useRealTimers();
  });
});
