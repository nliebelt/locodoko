// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { 
  karteZuDateiname, 
  texturSchluesselFuerKarte, 
  istBildHintergrund,
  ladeKartenBilderVorab,
  ladeHintergrundbilder,
  registriereBasisTexturen,
  registriereKartenSpriteTexturen
} from './AssetLoader';

describe('AssetLoader', () => {
  let mockScene: any;

  beforeEach(() => {
    // Canvas-Mock: jsdom implementiert getContext() nicht → gibt null zurueck.
    // Wir mocken createElement('canvas'), damit erzeugeKartenTextur() funktioniert.
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === 'canvas') {
        const mockCtx = {
          fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: '', textBaseline: '',
          fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
          fillText: vi.fn(), strokeText: vi.fn(),
          beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
          arc: vi.fn(), arcTo: vi.fn(), quadraticCurveTo: vi.fn(),
          fill: vi.fn(), stroke: vi.fn(),
          save: vi.fn(), restore: vi.fn(),
          translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(),
          drawImage: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
        };
        return { width: 0, height: 0, getContext: vi.fn(() => mockCtx) } as any;
      }
      return origCreateElement(tag, options);
    });

    mockScene = {
      textures: {
        exists: vi.fn(() => false),
        addCanvas: vi.fn(),
        generateTexture: vi.fn()
      },
      load: {
        image: vi.fn()
      },
      add: {
        graphics: vi.fn(() => ({
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          fillRoundedRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          strokeRoundedRect: vi.fn().mockReturnThis(),
          lineBetween: vi.fn().mockReturnThis(),
          fillCircle: vi.fn().mockReturnThis(),
          generateTexture: vi.fn(),
          destroy: vi.fn()
        }))
      }
    };
  });

  it('erzeugt korrekte Dateinamen für Karten', () => {
    expect(karteZuDateiname('KREUZ', 'AS')).toBe('ace_clubs.png');
    expect(karteZuDateiname('HERZ', '10')).toBe('10_hearts.png');
    expect(karteZuDateiname('KARO', 'DAME')).toBe('queen_diamonds.png');
    expect(karteZuDateiname('PIK', 'BUBE')).toBe('jack_spades.png');
  });

  it('erzeugt korrekte Textur-Schlüssel', () => {
    expect(texturSchluesselFuerKarte('PIK', 'KOENIG')).toBe('karte-offen-PIK-KOENIG');
  });

  it('erkennt Bild-Hintergründe', () => {
    expect(istBildHintergrund('OVAL_1')).toBe(true);
    expect(istBildHintergrund('RECHTECK_2')).toBe(true);
    expect(istBildHintergrund('FILZ_GRUEN')).toBe(false);
  });

  it('lädt Kartenbilder vorab wenn sie noch nicht existieren', () => {
    ladeKartenBilderVorab(mockScene);
    expect(mockScene.load.image).toHaveBeenCalled();
    // 24 Karten + 1 Rücken = 25 calls
    expect(mockScene.load.image).toHaveBeenCalledTimes(25);
  });

  it('lädt Hintergrundbilder vorab', () => {
    ladeHintergrundbilder(mockScene);
    expect(mockScene.load.image).toHaveBeenCalledTimes(5);
  });

  it('registriert Basis-Texturen (prozedural)', () => {
    registriereBasisTexturen(mockScene);
    // Sollte graphics.generateTexture für verschiedene BG-Typen aufrufen
    expect(mockScene.textures.exists).toHaveBeenCalled();
  });

  it('registriert Karten-Sprite-Texturen (Canvas)', () => {
    registriereKartenSpriteTexturen(mockScene);
    // 24 Karten
    expect(mockScene.textures.addCanvas).toHaveBeenCalledTimes(24);
  });
});
