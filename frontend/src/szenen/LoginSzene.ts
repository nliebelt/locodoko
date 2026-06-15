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
    this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(this.scale.width / 2, 100, 'LOCO DOKO', {
      fontFamily: FONT_FAMILY,
      fontSize: '60px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(this.scale.width / 2, 170, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    this.zeigeLoginFehlerHinweis();

    // Phaser-basierter Schnellstart (funktioniert immer)
    new PhaserButton(this, {
      x: this.scale.width / 2, y: 620,
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
      x: this.scale.width / 2, y: 350,
      text: '👤 Als Gast spielen',
      typ: 'primary',
      callback: () => { appStore.alsGastStarten().catch(() => {}); }
    });

    if (googleOAuth2Aktiv) {
      new PhaserButton(this, {
        x: this.scale.width / 2, y: 430,
        text: '🔑 Mit Google anmelden',
        typ: 'secondary',
        callback: () => { window.location.href = '/oauth2/authorization/google'; }
      });
    }

    this.add.text(this.scale.width / 2, 280, 'Wähle deinen Zugang:', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#f8f9fa'
    }).setOrigin(0.5);
  }

  /**
   * Zeigt einen Hinweis, falls der OAuth2-Login abgelehnt wurde (z.B. E-Mail-Konflikt
   * mit einem bestehenden, nicht verknuepfbaren Passwort-Konto). Der Query-Parameter wird
   * danach aus der URL entfernt, damit der Hinweis bei einem Reload nicht erneut erscheint.
   */
  private zeigeLoginFehlerHinweis(): void {
    const fehler = new URLSearchParams(window.location.search).get('fehler');
    if (fehler !== 'email_konflikt') {
      return;
    }

    this.add.text(this.scale.width / 2, 220,
      'Diese E-Mail ist bereits mit einem Konto registriert.\nBitte per Passwort anmelden oder die E-Mail-Adresse verifizieren.', {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#ff6b6b',
        align: 'center'
      }).setOrigin(0.5);

    window.history.replaceState({}, '', window.location.pathname);
  }

  shutdown(): void {
    this.abmeldenStore?.();
  }
}
