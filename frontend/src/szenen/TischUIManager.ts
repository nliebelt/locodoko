import { appStore } from '../anwendung';
import {
  type TischAnsichtModell,
} from '../modelle/TischAnsichtModell';
import type { KiSchwierigkeit, Tischhintergrund } from '../modelle/SpielverwaltungDto';
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
  private hudStichzaehlerEl?: HTMLSpanElement;
  private hudSpieleInfo?: HTMLSpanElement;
  private hudDebugBtn?: HTMLButtonElement;

  private einstellungsModalEl?: HTMLDivElement;
  private tischhintergrundSelect?: HTMLSelectElement;
  private kiSchwierigkeitSelect?: HTMLSelectElement;

  private toastStack?: HTMLDivElement;
  private rundenEndeModal?: HTMLDivElement;
  private partieEndeModal?: HTMLDivElement;

  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;

  constructor(private readonly kontext: TischUIKontext) {}

  getRundenEndeModal(): HTMLDivElement | undefined { return this.rundenEndeModal; }
  getPartieEndeModal(): HTMLDivElement | undefined { return this.partieEndeModal; }
  getEinstellungsModalEl(): HTMLDivElement | undefined { return this.einstellungsModalEl; }
  getAnimationsGeschwindigkeit(): AnimationsGeschwindigkeit { return this.animationsGeschwindigkeit; }

  togglEinstellungen(): void {
    if (!this.einstellungsModalEl) return;
    this.einstellungsModalEl.hidden = !this.einstellungsModalEl.hidden;
    if (!this.einstellungsModalEl.hidden) {
      setTimeout(() => {
        this.einstellungsModalEl?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
      }, 0);
    }
  }

  baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';
    uiRoot.dataset['testid'] = 'tischszene';

    // Top-Bar
    const topBar = document.createElement('div');
    topBar.className = 'hud-topbar';
    topBar.innerHTML = `
      <div class="hud-topbar__left">
        <span class="hud-topbar__stichzaehler" data-stichzaehler data-testid="hud-stichzaehler"></span>
      </div>
      <div class="hud-topbar__center">
        <span data-spiele-info data-testid="hud-spieltyp"></span>
      </div>
      <div class="hud-topbar__right">
        <button class="ui-button ui-button--secondary" type="button" data-share-button data-testid="btn-link-teilen">🔗 Link teilen</button>
        <button class="ui-button" type="button" data-start-button data-testid="btn-spiel-starten">Spiel starten</button>
        <button class="hud-icon-btn" type="button" data-leave-top-button title="Tisch verlassen">&#x2190;</button>
        <button class="hud-icon-btn" type="button" data-einstellungen-toggle data-testid="hud-btn-einstellungen" title="Einstellungen">⚙</button>
        <button class="hud-icon-btn" type="button" data-debug-button title="Debug">🐛</button>
      </div>
    `;

    // Einstellungs-Modal
    const einstellungsModal = document.createElement('div');
    einstellungsModal.className = 'einstellungen-backdrop';
    einstellungsModal.hidden = true;
    einstellungsModal.innerHTML = `
      <div class="ui-modal">
        <h2>Einstellungen</h2>
        <div class="ui-section">
          <span class="ui-hint">Tischhintergrund</span>
          <select class="ui-input ui-input--select" data-tischhintergrund>
            <option value="FILZ_GRUEN">Gruener Filz</option>
            <option value="HOLZ_DUNKEL">Dunkles Holz</option>
            <option value="BLAU_GRAFIK">Blaue Grafik</option>
            <option value="RECHTECK_1">Rechteck 1</option>
            <option value="RECHTECK_2">Rechteck 2</option>
            <option value="OVAL_1">Oval 1</option>
            <option value="OVAL_2">Oval 2</option>
            <option value="RUND_1">Rund 1</option>
          </select>
        </div>
        <div class="ui-section">
          <span class="ui-hint">KI-Schwierigkeit</span>
          <select class="ui-input ui-input--select" data-ki-schwierigkeit>
            <option value="LEICHT">Leicht</option>
            <option value="STANDARD">Standard</option>
            <option value="SCHWER">Schwer</option>
          </select>
        </div>
        <div class="ui-section">
          <span class="ui-hint">Animationen</span>
          <button class="ui-button ui-button--secondary" type="button" data-animationsgeschwindigkeit>Geschw.: 1x</button>
        </div>
        <div class="ui-action-row">
          <button class="ui-button ui-button--secondary" type="button" data-lobby-button>Zur Lobby</button>
          <button class="ui-button" type="button" data-einstellungen-schliessen>Schließen</button>
        </div>
      </div>
    `;

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

    uiRoot.append(topBar, einstellungsModal, toastStack, rundenEndeModal, partieEndeModal, vorbehaltMarker, actionBarMarker);

    // Referenzen und Listener
    this.hudStichzaehlerEl = topBar.querySelector('[data-stichzaehler]') as HTMLSpanElement;
    this.hudSpieleInfo = topBar.querySelector('[data-spiele-info]') as HTMLSpanElement;
    this.hudDebugBtn = topBar.querySelector('[data-debug-button]') as HTMLButtonElement;
    this.einstellungsModalEl = einstellungsModal;
    this.tischhintergrundSelect = einstellungsModal.querySelector('[data-tischhintergrund]') as HTMLSelectElement;
    this.kiSchwierigkeitSelect = einstellungsModal.querySelector('[data-ki-schwierigkeit]') as HTMLSelectElement;
    const geschwindigkeitsButton = einstellungsModal.querySelector('[data-animationsgeschwindigkeit]') as HTMLButtonElement;
    const lobbyButton = einstellungsModal.querySelector('[data-lobby-button]') as HTMLButtonElement;
    const startButton = topBar.querySelector('[data-start-button]') as HTMLButtonElement;
    const shareButton = topBar.querySelector('[data-share-button]') as HTMLButtonElement;
    const leaveTopButton = topBar.querySelector('[data-leave-top-button]') as HTMLButtonElement;
    const einstellungenToggleBtn = topBar.querySelector('[data-einstellungen-toggle]') as HTMLButtonElement;
    const einstellungenSchliessenBtn = einstellungsModal.querySelector('[data-einstellungen-schliessen]') as HTMLButtonElement;
    this.toastStack = toastStack;
    this.rundenEndeModal = rundenEndeModal;
    this.partieEndeModal = partieEndeModal;

    einstellungenToggleBtn.addEventListener('click', () => this.togglEinstellungen());
    einstellungenSchliessenBtn.addEventListener('click', () => this.togglEinstellungen());
    lobbyButton.addEventListener('click', () => this.kontext.szeneStarten('SpielverwaltungsSzene'));
    startButton.addEventListener('click', () => void appStore.starteAktuellenTisch());

    const verlasseTisch = (): void => {
      const istImSpiel = appStore.snapshot().aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel && !window.confirm('Partie abbrechen und Tisch verlassen?')) return;
      void appStore.verlasseAktuellenTisch();
    };
    leaveTopButton.addEventListener('click', verlasseTisch);

    if (shareButton) {
      shareButton.addEventListener('click', () => {
        const code = appStore.snapshot().aktuellerTisch?.einladungsCode;
        if (!code) return;
        const url = `${window.location.origin}#join/${code}`;
        void navigator.clipboard.writeText(url).then(() => {
          shareButton.textContent = '✓ Kopiert!';
          setTimeout(() => { shareButton.textContent = '🔗 Link teilen'; }, 2000);
        });
      });
    }

    this.hudDebugBtn.addEventListener('click', () => appStore.toggleDebugModus());
    this.tischhintergrundSelect.addEventListener('change', () => void appStore.aktualisiereAktuellenTischhintergrund(this.tischhintergrundSelect!.value as Tischhintergrund));
    this.kiSchwierigkeitSelect.addEventListener('change', () => void appStore.aktualisiereAktuelleKiSchwierigkeit(this.kiSchwierigkeitSelect!.value as KiSchwierigkeit));

    geschwindigkeitsButton.addEventListener('click', () => {
      this.animationsGeschwindigkeit = naechsteGeschwindigkeit(this.animationsGeschwindigkeit);
      geschwindigkeitsButton.textContent = geschwindigkeitsLabel(this.animationsGeschwindigkeit);
      localStorage.setItem(LS_GESCHWINDIGKEIT, speichereGeschwindigkeit(this.animationsGeschwindigkeit));
      this.kontext.onGeschwindigkeitGeaendert(this.animationsGeschwindigkeit);
    });

    const initialGeschw = ladeGeschwindigkeit();
    if (initialGeschw !== 1) {
      this.animationsGeschwindigkeit = initialGeschw;
      geschwindigkeitsButton.textContent = geschwindigkeitsLabel(initialGeschw);
      this.kontext.onGeschwindigkeitGeaendert(initialGeschw);
    }
  }

  aktualisiereTopBar(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch || !this.hudStichzaehlerEl || !this.hudSpieleInfo) return;

    const spiel = zustand.partieStand?.laufendesSpiel;
    if (spiel) {
      const stiche = modell.spieler.reduce((sum, s) => sum + s.stiche, 0);
      this.hudStichzaehlerEl.textContent = `Stich ${stiche}/12`;
      this.hudSpieleInfo.textContent = `${tisch.name} · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'} · ${modell.spieltyp ?? spiel.spieltyp}`;
    } else {
      this.hudStichzaehlerEl.textContent = '';
      this.hudSpieleInfo.textContent = `${tisch.name} · ${tisch.status}`;
    }

    const startBtn = document.querySelector<HTMLButtonElement>('[data-start-button]');
    if (startBtn) {
      const darfStarten = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      startBtn.disabled = zustand.wirdGeladen || !darfStarten;
      startBtn.hidden = tisch.status !== 'WARTEND';
    }
  }

  aktualisiereSeitenlade(): void {} // Entfernt
  aktualisiereErgebnis(): void {} // Entfernt
  aktualisiereLetzteStiche(): void {} // Entfernt

  aktualisiereEinstellungsModal(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch || !this.tischhintergrundSelect || !this.kiSchwierigkeitSelect) return;
    const darfKonf = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
    this.tischhintergrundSelect.value = modell.tischhintergrund;
    this.tischhintergrundSelect.disabled = zustand.wirdGeladen || !darfKonf;
    this.kiSchwierigkeitSelect.value = tisch.konfiguration.kiSchwierigkeit ?? 'STANDARD';
    this.kiSchwierigkeitSelect.disabled = zustand.wirdGeladen || !darfKonf;
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
    this.hudStichzaehlerEl = undefined;
    this.hudSpieleInfo = undefined;
    this.hudDebugBtn = undefined;
    this.einstellungsModalEl = undefined;
    this.toastStack = undefined;
    this.rundenEndeModal = undefined;
    this.partieEndeModal = undefined;
  }
}
