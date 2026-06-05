import Phaser from 'phaser';
import { registriereBasisTexturen, TEXTUR_FILZ, ladeHintergrundbilder, ladeBitmapFont } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { FONT_FAMILY } from '../ui/designTokens';
import { Logger } from '../logger';

/**
 * BootSzene ist der Einstiegspunkt des Phaser-Spiels.
 * Sie lädt initiale Assets wie Schriften und Texturen und initialisiert die globale Konfiguration,
 * bevor sie zur LoginSzene weiterleitet.
 */
export class BootSzene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super('BootSzene');
  }

  preload(): void {
    Logger.szene('preload: lade Hintergruende...');
    ladeHintergrundbilder(this);
    ladeBitmapFont(this);
    
    // Wir lassen Phaser wissen, dass wir eine externe Schriftart verwenden wollen.
    // Da sie in CSS definiert ist, muessen wir sicherstellen, dass sie geladen ist,
    // bevor Phaser Texte rendert, um "Flickering" oder falsche Fonts zu vermeiden.
    this.add.text(-100, -100, 'preload', { fontFamily: FONT_FAMILY }).setAlpha(0);
  }

  /**
   * Initialisiert die grafischen Assets und startet die asynchrone Initialisierung der Spielkomponenten.
   */
  create(): void {
    try {
      registriereBasisTexturen(this);
    } catch (error) {
      Logger.error('Textur-Initialisierung fehlgeschlagen', error);
      this.statusText?.setText('Fehler bei der Textur-Initialisierung. Bitte pruefe Logs.');
      return; 
    }
    this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ).setTint(0x0d5f34);
    
    this.add.text(this.scale.width / 2, 280, 'Loco Doko', {
      fontFamily: FONT_FAMILY,
      color: '#f8f9fa',
      fontSize: '42px'
    }).setOrigin(0.5);

    this.statusText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'Initialisiere Spieler-Session...', {
      fontFamily: FONT_FAMILY,
      color: '#d8f3dc',
      fontSize: '18px',
      align: 'center'
    }).setOrigin(0.5);

    // Warte darauf, dass der Browser die Schriften fertig geladen hat
    document.fonts.ready.then(() => {
      void this.initialisieren();
    }).catch(() => {
      void this.initialisieren(); // Fallback falls API fehlschlaegt
    });
  }

  /**
   * Lädt die Spieler-Session und leitet je nach Status zur Lobby oder Tisch-Szene weiter.
   */
  private async initialisieren(): Promise<void> {
    try {
      // Einladungslink: #join/{code} → automatischer Beitritt vormerken
      const einladungsCode = this.leseEinladungsCodeAusUrl();
      if (einladungsCode) {
        sessionStorage.setItem('pendingJoinCode', einladungsCode);
        window.location.hash = '';
      }

      // Versuche bestehende Session wiederherzustellen (z.B. nach Tab-Reload)
      try {
        await appStore.initialisieren();
        // Session-Recovery: Falls der Spieler bereits an einem Tisch sitzt (z.B. nach Tab-Reload),
        // direkt zur Tischansicht weiterleiten statt zur Lobby.
        const aktiverTischId = appStore.snapshot().spieler?.aktiverTischId ?? null;
        if (aktiverTischId) {
          appStore.reconnecteTisch(aktiverTischId);
          this.scene.start('TischSzene');
        } else {
          // Pruefen ob ein vorgemerkter Einladungscode existiert
          const pendingCode = sessionStorage.getItem('pendingJoinCode');
          if (pendingCode) {
            sessionStorage.removeItem('pendingJoinCode');
            try {
              await appStore.betreteTischViaCode(pendingCode);
              this.scene.start('TischSzene');
              return;
            } catch {
              // Fehlgeschlagen (Code ungueltig, Tisch voll etc.) → weiter zur Lobby
            }
          }
          this.scene.start('SpielverwaltungsSzene');
          void this.time.delayedCall(1000, () => {});
        }
      } catch {
        // Keine gueltige Session → Login-Screen anzeigen
        this.scene.start('LoginSzene');
      }
    } catch {
      this.statusText?.setText('Initialisierung fehlgeschlagen. Bitte pruefe Backend/Verbindung und lade neu.');
    }
  }

  /** Liest einen Einladungscode aus dem URL-Hash (Format: #join/{code}). */
  private leseEinladungsCodeAusUrl(): string | null {
    const hash = window.location.hash;
    const treffer = hash.match(/^#join\/([A-Za-z0-9]{8})$/);
    return treffer ? treffer[1] : null;
  }
}
