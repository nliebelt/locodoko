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

    // Konfiguration laden: Google-Button nur anzeigen wenn OAuth2 aktiv
    void fetch('/api/auth/konfiguration')
      .then(r => r.json() as Promise<{ googleOAuth2Aktiv: boolean }>)
      .then(konfig => this.baueLoginUi(konfig.googleOAuth2Aktiv))
      .catch(() => this.baueLoginUi(false));

    this.abmeldenStore?.();
    this.abmeldenStore = appStore.abonniere((zustand) => {
      if (zustand.bereich === 'TISCH') {
        this.abmeldenStore?.();
        this.scene.start('TischSzene');
      } else if (zustand.bereich === 'SPIELVERWALTUNG' && zustand.authentifiziert) {
        this.abmeldenStore?.();
        this.scene.start('SpielverwaltungsSzene');
      }
    });
  }

  private baueLoginUi(googleOAuth2Aktiv: boolean): void {
    new PhaserButton(this, {
      x: 640, y: 350,
      text: '👤 Als Gast spielen',
      typ: 'primary',
      callback: () => void appStore.alsGastStarten()
    });

    if (googleOAuth2Aktiv) {
      new PhaserButton(this, {
        x: 640, y: 430,
        text: '🔑 Mit Google anmelden',
        typ: 'secondary',
        callback: () => { window.location.href = '/oauth2/authorization/google'; }
      });
    }

    this.add.text(640, 280, 'Wähle deinen Zugang:', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#f8f9fa'
    }).setOrigin(0.5);
  }

  shutdown(): void {
    this.abmeldenStore?.();
  }
}
