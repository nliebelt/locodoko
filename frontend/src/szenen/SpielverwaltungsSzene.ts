import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import { PhaserButton } from './PhaserButton';

/**
 * Spielverwaltungs-Szene (Start-Screen).
 * Rein Phaser-basiert für maximale Stabilität und "Phaser, Phaser, Phaser" Strategie.
 */
export class SpielverwaltungsSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private uiElemente: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('SpielverwaltungsSzene');
  }

  create(): void {
    // Hintergrund
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    // Logo
    this.add.text(640, 120, 'LOCO DOKO', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '80px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(640, 190, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '24px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    this.abmeldenStore = appStore.abonnieren((zustand) => {
      this.renderUi(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.scene.start('TischSzene');
      }
    });

    // E2E-Marker fuer Playwright
    this.erstelleE2EMarker('startscreen');
    this.erstelleE2EMarker('btn-neuer-tisch');

    this.renderUi(appStore.snapshot());
  }

  private erstelleE2EMarker(testId: string): void {
    const root = document.getElementById('ui-root');
    if (!root) return;
    let marker = document.querySelector(`[data-testid="${testId}"]`);
    if (!marker) {
      marker = document.createElement('div');
      (marker as HTMLElement).dataset['testid'] = testId;
      (marker as HTMLElement).style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none';
      root.appendChild(marker);
    }
  }

  private renderUi(zustand: AppZustand): void {
    // Alte Elemente entfernen
    this.uiElemente.forEach(el => el.destroy());
    this.uiElemente = [];

    let currentY = 300;
    const spacing = 70;

    // 1. Session-Recovery
    const aktiverTischId = zustand.spieler?.aktiverTischId;
    if (aktiverTischId) {
      const btn = new PhaserButton(this, {
        x: 640, y: currentY,
        text: 'Zurück zum Spiel',
        typ: 'primary',
        callback: () => appStore.reconnecteTisch(aktiverTischId)
      });
      this.uiElemente.push(btn);
      currentY += spacing;

      void appStore.ladeTischName(aktiverTischId).then(() => {
          // Da wir neu rendern, wird der Name beim nächsten Store-Update (oder manuell) gesetzt
          // Für jetzt reicht der generische Text oder wir triggern ein Re-Render
      });
    }

    // 2. Quick Game
    const quickGameBtn = new PhaserButton(this, {
      x: 640, y: currentY,
      text: '▶  Quick Game',
      typ: 'primary',
      callback: () => void appStore.erstelleQuickGame()
    });
    this.uiElemente.push(quickGameBtn);
    currentY += spacing;

    // 3. Neuen Tisch (Platzhalter für echtes Modal)
    const erstelleTischBtn = new PhaserButton(this, {
      x: 640, y: currentY,
      text: '+ Neuen Tisch erstellen',
      typ: 'secondary',
      callback: () => {
         // TODO: Phaser Modal
         console.log('Tisch erstellen geklickt');
      }
    });
    this.uiElemente.push(erstelleTischBtn);
    currentY += spacing;

    // 4. Abmelden
    const logoutBtn = new PhaserButton(this, {
      x: 640, y: currentY + 50,
      text: 'Abmelden',
      typ: 'secondary',
      breite: 200,
      callback: () => {
        void appStore.ausloggen().then(() => this.scene.start('LoginSzene'));
      }
    });
    this.uiElemente.push(logoutBtn);
  }

  shutdown(): void {
    this.abmeldenStore?.();
    this.uiElemente.forEach(el => el.destroy());
    const marker = document.querySelector('[data-testid="startscreen"]');
    if (marker) marker.remove();
  }
}
