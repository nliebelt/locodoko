// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  berechneKartenGroesse,
  berechneKartenAbstand,
  berechneLayout,
  nameplatePositionFuer,
  stichSlotPositionen,
  stichStapelPositionFuer,
} from './layout';

describe('berechneKartenGroesse', () => {
  it('begrenzt Kartenbreite auf 110px bei sehr breitem Viewport', () => {
    const { w } = berechneKartenGroesse(2000);
    expect(w).toBe(110);
  });

  it('skaliert Karten kleiner bei schmalem Viewport', () => {
    const { w } = berechneKartenGroesse(400);
    expect(w).toBeLessThan(110);
    expect(w).toBeGreaterThan(0);
  });

  it('Portrait (breite < 800) nutzt groessere Fraktion als Landscape bei gleicher Breite', () => {
    // Gleiche Viewport-Breite, aber Portrait-Modus (0.14) vs Landscape-Modus (0.086)
    const portraitW = berechneKartenGroesse(600).w;   // portrait < 800 → fraction 0.14
    const landscapeW = berechneKartenGroesse(800).w;  // landscape ≥ 800 → fraction 0.086
    // 600 * 0.14 = 84, 800 * 0.086 ≈ 68.8 → Portrait ergibt groessere Karten
    expect(portraitW).toBeGreaterThan(landscapeW);
  });

  it('Hoehe behaelt Seitenverhaeltnis 165/110', () => {
    const { w, h } = berechneKartenGroesse(1280);
    expect(h / w).toBeCloseTo(165 / 110, 1);
  });
});

describe('berechneKartenAbstand', () => {
  it('Portrait hat groesseren horizontalen Abstand als Landscape', () => {
    const portrait = berechneKartenAbstand(393, 851);  // Pixel 5
    const landscape = berechneKartenAbstand(1280, 720);
    expect(portrait.horizontal).toBeGreaterThan(landscape.horizontal);
  });

  it('liefert Mindestwert von 22px horizontal im Landscape', () => {
    const { horizontal } = berechneKartenAbstand(100, 50);
    expect(horizontal).toBeGreaterThanOrEqual(22);
  });

  it('liefert Mindestwert von 44px horizontal im Portrait', () => {
    const { horizontal } = berechneKartenAbstand(100, 200);
    expect(horizontal).toBeGreaterThanOrEqual(44);
  });

  it('liefert Mindestwert von 12px vertikal im Landscape', () => {
    const { vertikal } = berechneKartenAbstand(1280, 720);
    expect(vertikal).toBeGreaterThanOrEqual(12);
  });

  it('liefert Mindestwert von 22px vertikal im Portrait', () => {
    const { vertikal } = berechneKartenAbstand(393, 851);
    expect(vertikal).toBeGreaterThanOrEqual(22);
  });
});

describe('berechneLayout', () => {
  const LANDSCAPE = { b: 1280, h: 720 };
  const PORTRAIT = { b: 393, h: 851 };

  it('Landscape: SUED liegt im unteren Drittel', () => {
    const layout = berechneLayout(LANDSCAPE.b, LANDSCAPE.h);
    expect(layout.SUED.y).toBeGreaterThan(LANDSCAPE.h * 0.6);
  });

  it('Landscape: NORD liegt im oberen Drittel', () => {
    const layout = berechneLayout(LANDSCAPE.b, LANDSCAPE.h);
    expect(layout.NORD.y).toBeLessThan(LANDSCAPE.h * 0.4);
  });

  it('Landscape: WEST liegt im linken Bereich', () => {
    const layout = berechneLayout(LANDSCAPE.b, LANDSCAPE.h);
    expect(layout.WEST.x).toBeLessThan(LANDSCAPE.b * 0.4);
  });

  it('Landscape: OST liegt im rechten Bereich', () => {
    const layout = berechneLayout(LANDSCAPE.b, LANDSCAPE.h);
    expect(layout.OST.x).toBeGreaterThan(LANDSCAPE.b * 0.6);
  });

  it('Portrait: SUED liegt weiter unten als Landscape relativ', () => {
    const layoutP = berechneLayout(PORTRAIT.b, PORTRAIT.h);
    expect(layoutP.SUED.y / PORTRAIT.h).toBeGreaterThan(0.7);
  });

  it('Portrait: NORD liegt weiter oben als Landscape relativ', () => {
    const layoutP = berechneLayout(PORTRAIT.b, PORTRAIT.h);
    expect(layoutP.NORD.y / PORTRAIT.h).toBeLessThan(0.3);
  });

  it('alle vier Positionen sind definiert', () => {
    const layout = berechneLayout(LANDSCAPE.b, LANDSCAPE.h);
    expect(layout.SUED).toBeDefined();
    expect(layout.NORD).toBeDefined();
    expect(layout.WEST).toBeDefined();
    expect(layout.OST).toBeDefined();
  });
});

describe('nameplatePositionFuer', () => {
  const LANDSCAPE = { b: 1280, h: 720 };
  const PORTRAIT = { b: 393, h: 851 };

  it.each(['SUED', 'NORD', 'WEST', 'OST'] as const)(
    '%s Nameplate liegt im validen Viewport-Bereich (Landscape)',
    (pos) => {
      const { x, y } = nameplatePositionFuer(pos, LANDSCAPE.b, LANDSCAPE.h);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(LANDSCAPE.b);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(LANDSCAPE.h);
    }
  );

  it.each(['SUED', 'NORD', 'WEST', 'OST'] as const)(
    '%s Nameplate liegt im validen Viewport-Bereich (Portrait)',
    (pos) => {
      const { x, y } = nameplatePositionFuer(pos, PORTRAIT.b, PORTRAIT.h);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(PORTRAIT.b);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(PORTRAIT.h);
    }
  );

  it('NORD und SUED liegen vertikal nah beieinander in ihren Sektoren', () => {
    const nord = nameplatePositionFuer('NORD', LANDSCAPE.b, LANDSCAPE.h);
    const sued = nameplatePositionFuer('SUED', LANDSCAPE.b, LANDSCAPE.h);
    expect(nord.y).toBeLessThan(sued.y);
  });

  it('WEST liegt links von MITTE, OST rechts', () => {
    const west = nameplatePositionFuer('WEST', LANDSCAPE.b, LANDSCAPE.h);
    const ost = nameplatePositionFuer('OST', LANDSCAPE.b, LANDSCAPE.h);
    expect(west.x).toBeLessThan(LANDSCAPE.b / 2);
    expect(ost.x).toBeGreaterThan(LANDSCAPE.b / 2);
  });
});

describe('stichSlotPositionen', () => {
  it('liefert vier Positionen', () => {
    const slots = stichSlotPositionen(640, 360, 1280, 720);
    expect(slots.SUED).toBeDefined();
    expect(slots.NORD).toBeDefined();
    expect(slots.WEST).toBeDefined();
    expect(slots.OST).toBeDefined();
  });

  it('SUED liegt unterhalb der Mitte, NORD oberhalb', () => {
    const slots = stichSlotPositionen(640, 360, 1280, 720);
    expect(slots.SUED.y).toBeGreaterThan(360);
    expect(slots.NORD.y).toBeLessThan(360);
  });

  it('WEST liegt links der Mitte, OST rechts', () => {
    const slots = stichSlotPositionen(640, 360, 1280, 720);
    expect(slots.WEST.x).toBeLessThan(640);
    expect(slots.OST.x).toBeGreaterThan(640);
  });

  it('Winkel von WEST und OST sind nahe an 90 Grad', () => {
    const slots = stichSlotPositionen(640, 360, 1280, 720);
    expect(Math.abs(slots.WEST.winkel)).toBeCloseTo(87, 0);
    expect(Math.abs(slots.OST.winkel)).toBeCloseTo(92, 0);
  });
});

describe('stichStapelPositionFuer', () => {
  const B = 1280, H = 720;

  it.each(['SUED', 'NORD', 'WEST', 'OST'] as const)(
    '%s Stapel liegt im Viewport',
    (pos) => {
      const { x, y } = stichStapelPositionFuer(pos, B, H, 5);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(B);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(H);
    }
  );

  it('SUED Stapel bei 0 Karten: x liegt links der Viewport-Mitte (Offset = halbe Kartenbreite + Abstand)', () => {
    // fHalbe = 0, also x = B/2 - kGroesse.w/2 - 12
    const { x } = stichStapelPositionFuer('SUED', B, H, 0);
    expect(x).toBeLessThan(B / 2);
    expect(x).toBeGreaterThan(B / 2 - 200);
  });

  it('SUED Stapel verschiebt sich nach links mit mehr Karten', () => {
    const mit1 = stichStapelPositionFuer('SUED', B, H, 1);
    const mit10 = stichStapelPositionFuer('SUED', B, H, 10);
    expect(mit10.x).toBeLessThan(mit1.x);
  });

  it('NORD Stapel verschiebt sich nach rechts mit mehr Karten', () => {
    const mit1 = stichStapelPositionFuer('NORD', B, H, 1);
    const mit10 = stichStapelPositionFuer('NORD', B, H, 10);
    expect(mit10.x).toBeGreaterThan(mit1.x);
  });
});
