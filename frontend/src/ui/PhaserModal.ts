import Phaser from 'phaser';
import { PANEL_BG, BORDER_PANEL, FONT_FAMILY } from './designTokens';

export interface PhaserModalOptionen {
  breite?: number;
  hoehe?: number;
  titel?: string;
  onClose?: () => void;
  zeigeSchliessenButton?: boolean;
}

export class PhaserModal extends Phaser.GameObjects.Container {
  protected contentContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number, optionen: PhaserModalOptionen = {}) {
    super(scene, x, y);

    const {
      breite = 400,
      hoehe = 300,
      titel = '',
      onClose,
      zeigeSchliessenButton = false
    } = optionen;

    // Backdrop: cover the whole screen, centered around x,y
    const { width: sw, height: sh } = scene.cameras.main;
    const backdrop = scene.add.rectangle(0, 0, sw * 2, sh * 2, 0x000000, 0.6)
      .setInteractive();
    
    if (onClose) {
      backdrop.on('pointerdown', onClose);
    }
    this.add(backdrop);

    // Schatten (Neo-Brutalism: harter Offset-Schatten 4px 4px)
    const schatten = scene.add.rectangle(4, 4, breite, hoehe, 0x000000, 1);
    this.add(schatten);

    // Panel
    const panel = scene.add.rectangle(0, 0, breite, hoehe, PANEL_BG)
      .setStrokeStyle(2, BORDER_PANEL);
    panel.setInteractive().on('pointerdown', () => { /* konsumiert Klicks, verhindert Schliessen */ });
    this.add(panel);

    // Titel
    if (titel) {
      const titleObj = scene.add.text(0, -hoehe / 2 + 20, titel, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ffd700'
      }).setOrigin(0.5, 0);
      this.add(titleObj);
    }

    // Schliessen Button (X)
    if (zeigeSchliessenButton && onClose) {
      const closeBtn = scene.add.text(breite / 2 - 20, -hoehe / 2 + 20, 'X', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ff4455'
      }).setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClose);
      this.add(closeBtn);
    }

    // Content Container - Subklassen koennen hier ihre UI-Elemente hinzufuegen
    this.contentContainer = scene.add.container(0, 0);
    this.add(this.contentContainer);

    // Setup Keyboard Focus Trap (Escape = close)
    if (onClose) {
      const escKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      if (escKey) {
        escKey.on('down', onClose);
        this.on('destroy', () => escKey.removeListener('down'));
      }
    }

    scene.add.existing(this);
  }

  public getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }
}
