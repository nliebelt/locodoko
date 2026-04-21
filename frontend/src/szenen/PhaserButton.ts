import Phaser from 'phaser';

export interface ButtonOptionen {
  x: number;
  y: number;
  text: string;
  typ?: 'primary' | 'secondary';
  breite?: number;
  hoehe?: number;
  callback: () => void;
}

/**
 * Ein einheitlicher Button fuer das Locodoko-Designsystem in Phaser.
 * Nutzt das Neo-Brutalism Design: Fette Rahmen, Schlagschatten.
 */
export class PhaserButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, optionen: ButtonOptionen) {
    const { x, y, text, typ = 'primary', breite = 300, hoehe = 50, callback } = optionen;
    super(scene, x, y);

    const bgFarbe = typ === 'primary' ? 0xd8f3dc : 0x2d5a3d;
    const textFarbe = typ === 'primary' ? '#14361f' : '#f8f9fa';

    // Schlagschatten
    const schatten = scene.add.rectangle(4, 4, breite, hoehe, 0x000000, 0.5);
    
    // Hintergrund
    const hintergrund = scene.add.rectangle(0, 0, breite, hoehe, bgFarbe);
    hintergrund.setStrokeStyle(2, 0xf8f9fa);

    const textObj = scene.add.text(0, 0, text, {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: textFarbe
    }).setOrigin(0.5);

    this.add([schatten, hintergrund, textObj]);

    // Interaktion
    hintergrund.setInteractive({ useHandCursor: true });
    hintergrund.on('pointerdown', () => {
      hintergrund.y = 2;
      schatten.alpha = 0;
      textObj.y = 2;
    });
    
    hintergrund.on('pointerup', () => {
      hintergrund.y = 0;
      schatten.alpha = 0.5;
      textObj.y = 0;
      callback();
    });

    hintergrund.on('pointerout', () => {
      hintergrund.y = 0;
      schatten.alpha = 0.5;
      textObj.y = 0;
    });

    scene.add.existing(this);
  }
}
