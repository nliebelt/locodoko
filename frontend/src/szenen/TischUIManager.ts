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
 * Verwaltet die DOM-UI-Elemente (Topbar, Modals).
 * Die Seitenlade wurde entfernt, Informationen werden nativ in Phaser gerendert.
 */
export class TischUIManager {
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

    // E2E-Marker fuer die Topbar (die jetzt in Phaser gerendert wird)
    const markerStyle = 'position:absolute;width:1px;height:1px;background:transparent;left:-9999px;top:-9999px;pointer-events:none';

    const stichzaehlerMarker = document.createElement('div');
    stichzaehlerMarker.dataset['testid'] = 'hud-stichzaehler';
    stichzaehlerMarker.style.cssText = markerStyle;
    const spieltypMarker = document.createElement('div');
    spieltypMarker.dataset['testid'] = 'hud-spieltyp';
    spieltypMarker.style.cssText = markerStyle;
    const einstellungenMarker = document.createElement('div');
    einstellungenMarker.dataset['testid'] = 'hud-btn-einstellungen';
    einstellungenMarker.style.cssText = markerStyle;
    const startBtnMarker = document.createElement('div');
    startBtnMarker.dataset['testid'] = 'btn-spiel-starten';
    startBtnMarker.style.cssText = markerStyle;

    uiRoot.append(rundenEndeModal, partieEndeModal, vorbehaltMarker, actionBarMarker,
      stichzaehlerMarker, spieltypMarker, einstellungenMarker, startBtnMarker);

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

  aktualisiereTopBar(stichZaehler: string, spieltyp: string, startBtnSichtbar: boolean): void {
    const uiRoot = holeUiRoot();
    const stich = uiRoot.querySelector('[data-testid="hud-stichzaehler"]');
    if (stich) stich.textContent = stichZaehler;
    const typ = uiRoot.querySelector('[data-testid="hud-spieltyp"]');
    if (typ) typ.textContent = spieltyp;
    const start = uiRoot.querySelector('[data-testid="btn-spiel-starten"]') as HTMLElement;
    if (start) start.hidden = !startBtnSichtbar;
  }

  aktualisiereSeitenlade(): void {} // Entfernt
  aktualisiereErgebnis(): void {} // Entfernt
  aktualisiereLetzteStiche(): void {} // Entfernt

  aktualisiereEinstellungsModal(): void {}

  aufraeumen(): void {
    this.rundenEndeModal = undefined;
    this.partieEndeModal = undefined;
  }
}
