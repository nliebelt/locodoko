import Phaser from 'phaser';
import * as Sentry from '@sentry/browser';
import './styles.css';
import { appStore } from './anwendung';
import './e2eBruecke';
import { BootSzene } from './szenen/BootSzene';
import { LoginSzene } from './szenen/LoginSzene';
import { SpielverwaltungsSzene } from './szenen/SpielverwaltungsSzene';
import { TischSzene } from './szenen/TischSzene';
import { BestenlisterSzene } from './szenen/BestenlisterSzene';
import { HilfeSzene } from './szenen/HilfeSzene';
import { zeigeBugreportDialog } from './szenen/bugreportDialog';

// Sentry-Fehlererfassung. Ohne VITE_SENTRY_DSN deaktiviert (No-Op).
// Bewusst OHNE Session-Replay (Datenschutz) und ohne Performance-Tracing.
// Die letzte bekannte X-Correlation-Id wird als Tag angehaengt, um Frontend-Fehler
// mit Backend-Logs (Loki) und In-App-Bugreports zu verknuepfen.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? 'lokal',
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      const ids = appStore.snapshot().correlationIds;
      if (ids.length > 0) {
        event.tags = { ...event.tags, correlationId: ids[ids.length - 1] };
      }
      return event;
    }
  });
}

// Globaler Error-Handler — auch im Prod-Build aktiv, damit stumme Fehler sichtbar werden.
// Nutzt console.error direkt (kein Logger-Dev-Switch), damit Exceptions nie unbemerkt bleiben.
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error });
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED PROMISE]', event.reason);
});

// Hinweis (DISCO-Entscheidung S126): Mobile/Touch-Geräte im Hochformat sehen das
// CSS-Dreh-Overlay (#orientierung-hinweis, layout.css) und erreichen das Spiel nie im
// Portrait — auf Touch zählt praktisch nur der Landscape-Zweig. Der Portrait-Zweig bleibt
// bewusst erhalten als Fallback für NICHT-Touch-Fenster im Hochformat (z.B. ein schmal
// gezogenes Desktop-Browserfenster), für die das Overlay (pointer: coarse) nicht greift.
const isPortrait = window.innerHeight > window.innerWidth;
const startWidth = isPortrait ? 720 : 1280;
const startHeight = isPortrait ? Math.round(720 * (window.innerHeight / window.innerWidth)) : 720;

const spiel = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'spiel-root',
  backgroundColor: '#0f5132',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: startWidth,
    height: startHeight
  },
  scene: [BootSzene, LoginSzene, SpielverwaltungsSzene, TischSzene, BestenlisterSzene, HilfeSzene]
});

window.addEventListener('resize', () => {
  const isPortraitNow = window.innerHeight > window.innerWidth;
  const targetW = isPortraitNow ? 720 : 1280;
  const targetH = isPortraitNow ? Math.round(720 * (window.innerHeight / window.innerWidth)) : 720;
  if (spiel.scale.width !== targetW || spiel.scale.height !== targetH) {
    spiel.scale.setGameSize(targetW, targetH);
  }
});

// Globaler Shift+F1 Hotkey für den Bugreport-Dialog (von überall aus erreichbar)
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && e.key === 'F1') {
    e.preventDefault();
    zeigeBugreportDialog(appStore.snapshot());
  }
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
