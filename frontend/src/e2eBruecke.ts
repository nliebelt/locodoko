import type { AppStore } from './store/AppStore';

/**
 * Getypte Bridge zwischen Playwright-E2E-Tests und der laufenden Phaser-App.
 * Wird in main.ts initialisiert und von TischBrücke.ts um Szenen-Methoden ergänzt.
 *
 * Zugriff im Browser: window.__locodoko
 * Zugriff in Playwright: page.evaluate(() => window.__locodoko?.isIdle())
 */
export interface LocodokoBridge {
  appStore: AppStore;
  getAktuelleSzene: () => string | null;
  /** Löst den Callback eines benannten PhaserButtons in der aktiven Szene aus (für E2E-Tests). */
  drueckeSzenenButton?: (name: string) => boolean;
  isIdle?: (ignoreStore?: boolean) => boolean;
  isOverlaySichtbar?: () => boolean;
  setzeAnimationsGeschwindigkeit?: (f: number) => void;
  setzeKiVerzoegerung?: (ms: number) => void;
  getHudState?: () => {
    stichzaehler: string;
    spieltyp: string;
    startBtnSichtbar: boolean;
    rundenEndeSichtbar: boolean;
  };
  schliesseRundenEndeModal?: () => void;
  _rundenEndeModalGezeigt?: number;
  _rundenauswertungSpieltypLabel?: string;
  _rundenauswertungMultiplikator?: number;
  _letzterFehlerToast?: string;
  _idleDebug?: {
    storeIdle: boolean;
    animationenLaeuft: boolean;
    austeilenAktiv: boolean;
    wartendeKartenId: string | null | undefined;
    stichEinziehenAktiv: boolean;
  };
  _storeIdleDebug?: {
    queuePausiert: boolean;
    eventQueueLength: number;
    verarbeiteEventLaeuft: boolean;
  };
}

declare global {
  interface Window {
    __locodoko?: LocodokoBridge;
  }
}
