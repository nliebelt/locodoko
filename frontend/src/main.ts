import Phaser from 'phaser';
import './styles.css';
import { appStore } from './anwendung';
import './e2eBruecke';
import { BootSzene } from './szenen/BootSzene';
import { LoginSzene } from './szenen/LoginSzene';
import { SpielverwaltungsSzene } from './szenen/SpielverwaltungsSzene';
import { TischSzene } from './szenen/TischSzene';
import { BestenlisterSzene } from './szenen/BestenlisterSzene';

// Globaler Error-Handler — auch im Prod-Build aktiv, damit stumme Fehler sichtbar werden.
// Nutzt console.error direkt (kein Logger-Dev-Switch), damit Exceptions nie unbemerkt bleiben.
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error });
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED PROMISE]', event.reason);
});

const spiel = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'spiel-root',
  backgroundColor: '#0f5132',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  scene: [BootSzene, LoginSzene, SpielverwaltungsSzene, TischSzene, BestenlisterSzene]
});

window.addEventListener('beforeunload', () => {
  appStore.trennen();
  spiel.destroy(true);
});

// Test-Hook: Bridge für E2E-Tests.
// Ermoeglicht zuverlässigen Zugriff auf Store und Szenen-Status.
window.__locodoko = {
  appStore,
  getAktuelleSzene: () => {
    const aktiveSzenen = spiel.scene.getScenes(true);
    return aktiveSzenen.length > 0 ? aktiveSzenen[0].scene.key : null;
  },
  drueckeSzenenButton: (name: string) => {
    function sucheBtnRekursiv(items: Phaser.GameObjects.GameObject[]): boolean {
      for (const item of items) {
        if (item.name === name) {
          const btn = item as unknown as { trigger?: () => void };
          if (btn.trigger) { btn.trigger(); return true; }
        }
        const kinder = (item as unknown as { list?: Phaser.GameObjects.GameObject[] }).list;
        if (kinder && kinder.length > 0 && sucheBtnRekursiv(kinder)) return true;
      }
      return false;
    }
    const aktiveSzenen = spiel.scene.getScenes(true);
    for (const szene of aktiveSzenen) {
      const items = (szene.children as unknown as { list: Phaser.GameObjects.GameObject[] }).list;
      if (sucheBtnRekursiv(items)) return true;
    }
    return false;
  },
};
