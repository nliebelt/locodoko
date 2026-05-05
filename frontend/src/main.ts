import Phaser from 'phaser';
import './styles.css';
import { appStore } from './anwendung';
import { BootSzene } from './szenen/BootSzene';
import { LoginSzene } from './szenen/LoginSzene';
import { SpielverwaltungsSzene } from './szenen/SpielverwaltungsSzene';
import { TischSzene } from './szenen/TischSzene';

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
  scene: [BootSzene, LoginSzene, SpielverwaltungsSzene, TischSzene]
});

window.addEventListener('beforeunload', () => {
  appStore.trennen();
  spiel.destroy(true);
});

// Test-Hook: Bridge für E2E-Tests.
// Ermoeglicht zuverlässigen Zugriff auf Store und Szenen-Status.
(window as any)['__locodoko'] = {
  appStore,
  getAktuelleSzene: () => {
    const aktiveSzenen = spiel.scene.getScenes(true);
    return aktiveSzenen.length > 0 ? aktiveSzenen[0].scene.key : null;
  }
};
