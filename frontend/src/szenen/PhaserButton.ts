import Phaser from 'phaser';
import { FONT_FAMILY, FARBE_GOLD_WARM } from '../ui/designTokens';

export interface ButtonOptionen {
  x: number;
  y: number;
  text: string;
  typ?: 'primary' | 'secondary';
  breite?: number;
  hoehe?: number;
  callback: () => void;
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

  constructor(scene: Phaser.Scene, optionen: ButtonOptionen) {
    const { x, y, text, typ = 'primary', breite = 300, hoehe = 50, callback } = optionen;
    super(scene, x, y);

    this.callback = callback;
    const bgFarbe = typ === 'primary' ? 0xd8f3dc : 0x2d5a3d;
    const textFarbe = typ === 'primary' ? '#14361f' : '#f8f9fa';

    // Kinder direkt ueber Konstruktoren erstellen (nicht scene.add.*),
    // damit sie nicht doppelt in der Scene DisplayList landen → verhindert Double-Destroy-Crash
    const schatten = new Phaser.GameObjects.Rectangle(scene, 4, 4, breite, hoehe, 0x000000, 0.5);

    this.hintergrund = new Phaser.GameObjects.Rectangle(scene, 0, 0, breite, hoehe, bgFarbe);
    this.hintergrund.setStrokeStyle(2, 0xf8f9fa);

    const textObj = new Phaser.GameObjects.Text(scene, 0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: textFarbe
    }).setOrigin(0.5);

    this.add([schatten, this.hintergrund, textObj]);

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
