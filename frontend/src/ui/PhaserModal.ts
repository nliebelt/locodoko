import Phaser from 'phaser';
import { PANEL_BG, BORDER_PANEL, FONT_FAMILY } from './designTokens';
import { PhaserButton } from '../szenen/PhaserButton';
import type { FocusableElement, ButtonOptionen } from '../szenen/PhaserButton';

export interface PhaserModalOptionen {
  breite?: number;
  hoehe?: number;
  titel?: string;
  onClose?: () => void;
  zeigeSchliessenButton?: boolean;
  aktionen?: (Omit<ButtonOptionen, 'x' | 'y'> & { testId?: string })[];
}

export class PhaserModal extends Phaser.GameObjects.Container {
  protected contentContainer: Phaser.GameObjects.Container;
  private focusableElements: FocusableElement[] = [];
  private focusIndex: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, optionen: PhaserModalOptionen = {}) {
    super(scene, x, y);

    const {
      breite = 400,
      hoehe = 300,
      titel = '',
      onClose,
      zeigeSchliessenButton = false,
      aktionen = []
    } = optionen;

    // Kinder direkt ueber Konstruktoren erstellen (nicht scene.add.*),
    // damit sie nicht doppelt in der Scene DisplayList landen → verhindert Double-Destroy-Crash

    // Backdrop: cover the whole screen, centered around x,y
    const { width: sw, height: sh } = scene.cameras.main;
    const backdrop = new Phaser.GameObjects.Rectangle(scene, 0, 0, sw * 2, sh * 2, 0x000000, 0.6)
      .setInteractive();

    if (onClose) {
      backdrop.on('pointerdown', onClose);
    }
    this.add(backdrop);

    // Schatten (Neo-Brutalism: harter Offset-Schatten 4px 4px)
    const schatten = new Phaser.GameObjects.Rectangle(scene, 4, 4, breite, hoehe, 0x000000, 1);
    this.add(schatten);

    // Panel
    const panel = new Phaser.GameObjects.Rectangle(scene, 0, 0, breite, hoehe, PANEL_BG)
      .setStrokeStyle(2, BORDER_PANEL);
    panel.setInteractive().on('pointerdown', () => { /* konsumiert Klicks, verhindert Schliessen */ });
    this.add(panel);

    // Titel
    if (titel) {
      const titleObj = new Phaser.GameObjects.Text(scene, 0, -hoehe / 2 + 20, titel, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ffd700'
      }).setOrigin(0.5, 0);
      this.add(titleObj);
    }

    // Schliessen Button (X)
    if (zeigeSchliessenButton && onClose) {
      const closeBtn = new Phaser.GameObjects.Text(scene, breite / 2 - 20, -hoehe / 2 + 20, 'X', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ff4455'
      }).setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClose);
      this.add(closeBtn);
    }

    // Content Container
    this.contentContainer = new Phaser.GameObjects.Container(scene, 0, 0);
    this.add(this.contentContainer);

    // Aktionen (Buttons am unteren Rand)
    if (aktionen.length > 0) {
      const startX = -((aktionen.length - 1) * 160) / 2;
      aktionen.forEach((akt, index) => {
        const btnOpt = { ...akt, x: startX + index * 160, y: hoehe / 2 - 40, breite: akt.breite || 140, hoehe: akt.hoehe || 40 };
        const btn = new PhaserButton(scene, btnOpt);
        if (akt.testId) btn.setName(akt.testId);
        this.add(btn);
        this.addFocusable(btn);
      });
    }

    // Setup Keyboard Focus Trap
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.cycleFocus(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.triggerFocus();
      } else if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    this.on('destroy', () => {
      window.removeEventListener('keydown', handleKeyDown);
    });

    scene.add.existing(this);

    if (this.focusableElements.length > 0) {
      this.setFocusIndex(0);
    }
  }

  public addFocusable(elem: FocusableElement): void {
    this.focusableElements.push(elem);
    if (this.focusIndex === -1) {
      this.setFocusIndex(0);
    }
  }

  private cycleFocus(direction: number): void {
    if (this.focusableElements.length === 0) return;
    let nextIndex = (this.focusIndex + direction) % this.focusableElements.length;
    if (nextIndex < 0) nextIndex = this.focusableElements.length - 1;
    this.setFocusIndex(nextIndex);
  }

  private setFocusIndex(index: number): void {
    if (this.focusIndex >= 0 && this.focusIndex < this.focusableElements.length) {
      this.focusableElements[this.focusIndex].setFocus(false);
    }
    this.focusIndex = index;
    if (this.focusIndex >= 0 && this.focusIndex < this.focusableElements.length) {
      this.focusableElements[this.focusIndex].setFocus(true);
    }
  }

  private triggerFocus(): void {
    if (this.focusIndex >= 0 && this.focusIndex < this.focusableElements.length) {
      this.focusableElements[this.focusIndex].trigger();
    }
  }

  public getContentContainer(): Phaser.GameObjects.Container {
    return this.contentContainer;
  }
}
