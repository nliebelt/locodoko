import type { AppZustand } from '../store/AppStore';

/** Moegliche Animations-Geschwindigkeitsstufen: normal (1x), doppelt (2x), sofort (Infinity). */
export type AnimationsGeschwindigkeit = 1 | 2 | typeof Infinity;

const LS_GESCHWINDIGKEIT = 'locodoko.animationsgeschwindigkeit';

function ladeGeschwindigkeit(): AnimationsGeschwindigkeit {
  const wert = localStorage.getItem(LS_GESCHWINDIGKEIT);
  if (wert === '2') return 2;
  if (wert === 'sofort') return Infinity;
  return 1;
}

export function naechsteGeschwindigkeit(aktuelle: AnimationsGeschwindigkeit): AnimationsGeschwindigkeit {
  if (aktuelle === 1) return 2;
  if (aktuelle === 2) return Infinity;
  return 1;
}

export function geschwindigkeitsLabel(faktor: AnimationsGeschwindigkeit): string {
  if (faktor === Infinity) return 'Geschw.: sofort';
  return `Geschw.: ${faktor}x`;
}

export function speichereGeschwindigkeit(faktor: AnimationsGeschwindigkeit): string {
  if (faktor === Infinity) return 'sofort';
  return String(faktor);
}

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

export interface TischUIKontext {
  szeneStarten(name: string): void;
  onGeschwindigkeitGeaendert(faktor: AnimationsGeschwindigkeit): void;
  onLetzteSticheToggle(): void;
}

/**
 * Verwaltet die DOM-UI-Elemente (Topbar, Modals, Toasts).
 * Die Seitenlade wurde entfernt, Informationen werden nativ in Phaser gerendert.
 */
export class TischUIManager {
  private toastStack?: HTMLDivElement;
  private rundenEndeModal?: HTMLDivElement;
  private partieEndeModal?: HTMLDivElement;

  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;

  constructor(private readonly kontext: TischUIKontext) {}

  getRundenEndeModal(): HTMLDivElement | undefined { return this.rundenEndeModal; }
  getPartieEndeModal(): HTMLDivElement | undefined { return this.partieEndeModal; }
  getAnimationsGeschwindigkeit(): AnimationsGeschwindigkeit { return this.animationsGeschwindigkeit; }

  baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';
    uiRoot.dataset['testid'] = 'tischszene';

    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    const rundenEndeModal = document.createElement('div');
    rundenEndeModal.className = 'ui-modal-backdrop';
    rundenEndeModal.hidden = true;

    const partieEndeModal = document.createElement('div');
    partieEndeModal.className = 'ui-modal-backdrop';
    partieEndeModal.hidden = true;

    const vorbehaltMarker = document.createElement('div');
    vorbehaltMarker.dataset['testid'] = 'vorbehalt-overlay';
    vorbehaltMarker.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    const actionBarMarker = document.createElement('div');
    actionBarMarker.dataset['testid'] = 'floating-action-bar';
    actionBarMarker.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';

    uiRoot.append(toastStack, rundenEndeModal, partieEndeModal, vorbehaltMarker, actionBarMarker);

    this.toastStack = toastStack;
    this.rundenEndeModal = rundenEndeModal;
    this.partieEndeModal = partieEndeModal;

    const initialGeschw = ladeGeschwindigkeit();
    if (initialGeschw !== 1) {
      this.animationsGeschwindigkeit = initialGeschw;
      this.kontext.onGeschwindigkeitGeaendert(initialGeschw);
    }
  }

  zyklusGeschwindigkeit(): void {
    this.animationsGeschwindigkeit = naechsteGeschwindigkeit(this.animationsGeschwindigkeit);
    localStorage.setItem(LS_GESCHWINDIGKEIT, speichereGeschwindigkeit(this.animationsGeschwindigkeit));
    this.kontext.onGeschwindigkeitGeaendert(this.animationsGeschwindigkeit);
  }

  aktualisiereTopBar(): void {
    // Top-Bar wird jetzt in Phaser (TischSzene.renderTopBar) gerendert.
  }

  aktualisiereSeitenlade(): void {} // Entfernt
  aktualisiereErgebnis(): void {} // Entfernt
  aktualisiereLetzteStiche(): void {} // Entfernt

  aktualisiereEinstellungsModal(): void {
    // Einstellungen werden jetzt in Phaser (TischSzene.renderEinstellungsModal) gerendert.
  }

  aktualisiereToasts(zustand: AppZustand): void {
    if (!this.toastStack) return;
    this.toastStack.innerHTML = '';
    if (!zustand.meldung) return;
    const toast = document.createElement('div');
    toast.className = `ui-toast ${zustand.meldung.typ === 'fehler' ? 'ui-toast--error' : ''}`;
    toast.innerHTML = `<strong>${zustand.meldung.typ === 'fehler' ? 'Fehler' : 'Info'}</strong><div>${zustand.meldung.text}</div>`;
    this.toastStack.append(toast);
  }

  aufraeumen(): void {
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) uiRoot.innerHTML = '';
    this.toastStack = undefined;
    this.rundenEndeModal = undefined;
    this.partieEndeModal = undefined;
  }
}
