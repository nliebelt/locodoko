import Phaser from 'phaser';
import { registriereBasisTexturen, TEXTUR_FILZ, ladeHintergrundbilder } from '../assets/AssetLoader';
import { appStore } from '../anwendung';

/**
 * Die erste Szene des Spiels, die für die Initialisierung der Assets,
 * den AppStore und die Wiederherstellung der Spieler-Session zuständig ist.
 */
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
    console.log('[BootSzene] preload: lade Hintergruende...');
    ladeHintergrundbilder(this);
  }

  /**
   * Initialisiert die grafischen Assets und startet die asynchrone Initialisierung der Spielkomponenten.
   */
  create(): void {
    try {
      registriereBasisTexturen(this);
    } catch (error) {
      console.error('[BootSzene TEXTURE ERROR]', error);
      this.statusText?.setText('Fehler bei der Textur-Initialisierung. Bitte pruefe Logs.');
      return; // Stop execution if texture loading fails
    }
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setTint(0x0d5f34);
    this.add.text(640, 280, 'Loco Doko', {
      color: '#f8f9fa',
      fontSize: '42px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.statusText = this.add.text(640, 360, 'Initialisiere Spieler-Session und Verbindung ...', {
      color: '#d8f3dc',
      fontSize: '22px',
      align: 'center'
    }).setOrigin(0.5);
    void this.initialisieren();
  }

  /**
   * Lädt die Spieler-Session und leitet je nach Status zur Lobby oder Tisch-Szene weiter.
   */
  private async initialisieren(): Promise<void> {
    try {
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
          // Einladungslink: #join/{code} → automatischer Beitritt
          const einladungsCode = this.leseEinladungsCodeAusUrl();
          if (einladungsCode) {
            window.location.hash = '';
            try {
              await appStore.betreteTischViaCode(einladungsCode);
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
