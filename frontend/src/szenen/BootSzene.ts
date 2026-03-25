import Phaser from 'phaser';
import { registriereBasisTexturen, TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';

export class BootSzene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super('BootSzene');
  }

  create(): void {
    registriereBasisTexturen(this);
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

  private async initialisieren(): Promise<void> {
    try {
      await appStore.initialisieren();
      // Session-Recovery: Falls der Spieler bereits an einem Tisch sitzt (z.B. nach Tab-Reload),
      // direkt zur Tischansicht weiterleiten statt zur Lobby.
      const aktiverTischId = appStore.snapshot().spieler?.aktiverTischId ?? null;
      if (aktiverTischId) {
        appStore.reconnecteTisch(aktiverTischId);
        this.scene.start('TischSzene');
      } else {
        this.scene.start('SpielverwaltungsSzene');
      }
    } catch {
      this.statusText?.setText('Initialisierung fehlgeschlagen. Bitte pruefe Backend/Verbindung und lade neu.');
    }
  }
}
