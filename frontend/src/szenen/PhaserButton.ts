import Phaser from 'phaser';
import { FONT_FAMILY, FARBE_GOLD_WARM } from '../ui/designTokens';

export interface ButtonOptionen {
  x: number;
  y: number;
  text: string;
  typ?: 'primary' | 'secondary' | 'tertiary';
  breite?: number;
  hoehe?: number;
  callback: () => void;
  deaktiviert?: boolean;
  hervorheben?: boolean;
  testId?: string;
  /** Optionale Schriftgröße in px (Default 20). Für kompaktere Elemente wie Tab-Leisten. */
  schriftgroesse?: number;
  /**
   * Farbpalette: 'tisch' (Default, grün — Menü-/Tisch-Szenen) oder 'overlay' (Balatro-purpur —
   * Buttons in Modals/Overlays, gold-primär). Siehe specs/frontend-visuelles-design.md.
   */
  palette?: 'tisch' | 'overlay';
}

export interface FocusableElement {
  setFocus: (focused: boolean) => void;
  trigger: () => void;
}

/**
 * Ein einheitlicher Button fuer das Locodoko-Designsystem in Phaser.
 * Nutzt das Neo-Brutalism Design: Fette Rahmen, Schlagschatten.
 */
export class PhaserButton extends Phaser.GameObjects.Container implements FocusableElement {
  private hintergrund: Phaser.GameObjects.Rectangle;
  private callback: () => void;
  /** Tatsaechliche Renderbreite (inkl. Text-Autosize) — fuer praezises Layout durch die Szene. */
  public readonly breite: number;

  constructor(scene: Phaser.Scene, optionen: ButtonOptionen) {
    const istTertiary = optionen.typ === 'tertiary';
    const { x, y, text, typ = 'primary', hoehe = istTertiary ? 36 : 50, callback, testId, deaktiviert = false, schriftgroesse = istTertiary ? 14 : 20, palette = 'tisch' } = optionen;
    super(scene, x, y);
    if (testId) this.setName(testId);

    this.callback = callback;
    const istOverlay = palette === 'overlay';
    const bgFarbe = typ === 'primary'
      ? (istOverlay ? 0xffd700 : 0xd8f3dc)
      : typ === 'tertiary'
        ? 0x1a3328
        : (istOverlay ? 0x2d1d40 : 0x2d5a3d);
    const textFarbe = typ === 'primary'
      ? (istOverlay ? '#1a1020' : '#14361f')
      : typ === 'tertiary'
        ? '#a3c4a8'
        : (istOverlay ? '#f0e6ff' : '#f8f9fa');

    // Kinder direkt ueber Konstruktoren erstellen (nicht scene.add.*),
    // damit sie nicht doppelt in der Scene DisplayList landen → verhindert Double-Destroy-Crash
    const textObj = new Phaser.GameObjects.Text(scene, 0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${schriftgroesse}px`,
      color: textFarbe
    }).setOrigin(0.5);

    // Mindestbreite: explizit oder Text-Breite + 40px Padding (je 20px Seite).
    // textObj.width ist in Phaser nach Erstellung verfügbar; in jsdom-Tests liefert
    // canvas.measureText 0 → Fallback auf explizite oder Default-Breite 300px.
    const breite = Math.max(optionen.breite ?? 300, textObj.width > 0 ? textObj.width + 40 : 0);
    this.breite = breite;

    const schatten = new Phaser.GameObjects.Rectangle(scene, 4, 4, breite, hoehe, 0x000000, 0.5);

    this.hintergrund = new Phaser.GameObjects.Rectangle(scene, 0, 0, breite, hoehe, bgFarbe);
    this.hintergrund.setStrokeStyle(2, 0xf8f9fa);

    this.add([schatten, this.hintergrund, textObj]);

    if (deaktiviert) {
      this.hintergrund.setAlpha(0.5);
      textObj.setAlpha(0.5);
    } else {
      // Interaktion
      this.hintergrund.setInteractive({ useHandCursor: true });
      this.hintergrund.on('pointerdown', () => {
        this.hintergrund.y = 2;
        schatten.alpha = 0;
        textObj.y = 2;
      });

      this.hintergrund.on('pointerup', () => {
        this.hintergrund.y = 0;
        schatten.alpha = 0.5;
        textObj.y = 0;
        callback();
      });

      this.hintergrund.on('pointerout', () => {
        this.hintergrund.y = 0;
        schatten.alpha = 0.5;
        textObj.y = 0;
      });
    }

    scene.add.existing(this);
  }

  public setFocus(focused: boolean): void {
    if (focused) {
      this.hintergrund.setStrokeStyle(2, FARBE_GOLD_WARM);
    } else {
      this.hintergrund.setStrokeStyle(2, 0xf8f9fa);
    }
  }

  public trigger(): void {
    this.callback();
  }
}
