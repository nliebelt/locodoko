import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { PhaserButton } from './PhaserButton';
import { FONT_FAMILY } from '../ui/designTokens';

/**
 * Login-Screen in Phaser.
 * Nutzt Phaser's DOM-Integration für Formularfelder, um Layout-Probleme zu vermeiden.
 */
export class LoginSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  constructor() {
    super('LoginSzene');
  }

  create(): void {
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(640, 100, 'LOCO DOKO', {
      fontFamily: FONT_FAMILY,
      fontSize: '60px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(640, 170, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    // Phaser-basierter Schnellstart (funktioniert immer)
    new PhaserButton(this, {
      x: 640, y: 620,
      text: '⚡ SCHNELLSTART (KI)',
      callback: () => void appStore.erstelleQuickGame()
    });

    this.baueLoginUi();

    // E2E-Marker fuer Playwright
    const marker = document.createElement('div');
    marker.dataset['testid'] = 'startscreen';
    marker.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none';
    document.getElementById('ui-root')?.appendChild(marker);

    this.abmeldenStore = appStore.abonnieren((zustand) => {
      if (zustand.bereich === 'TISCH') {
        this.scene.start('TischSzene');
      } else if (zustand.bereich === 'SPIELVERWALTUNG' && zustand.authentifiziert) {
        this.scene.start('SpielverwaltungsSzene');
      }
    });
  }

  private baueLoginUi(): void {
    // Einfache Gast-Anmeldung (Phaser-Button)
    new PhaserButton(this, {
      x: 640, y: 350,
      text: '👤 Als Gast spielen',
      typ: 'primary',
      callback: () => void appStore.alsGastStarten()
    });

    new PhaserButton(this, {
      x: 640, y: 430,
      text: '🔑 Mit Google anmelden',
      typ: 'secondary',
      callback: () => { window.location.href = '/oauth2/authorization/google'; }
    });

    this.add.text(640, 280, 'Wähle deinen Zugang:', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#f8f9fa'
    }).setOrigin(0.5);
  }

  shutdown(): void {
    this.abmeldenStore?.();
    const marker = document.querySelector('[data-testid="startscreen"]');
    if (marker) marker.remove();
  }
}
