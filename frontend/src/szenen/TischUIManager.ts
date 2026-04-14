/**
 * Verwaltet den gesamten DOM-basierten UI-Aufbau und die reaktiven DOM-Updates der TischSzene.
 *
 * Verantwortlichkeiten:
 * - Erstellt und verwaltet alle HTML-Elemente (Top-Bar, Seitenlade, Modals, Toast-Stack)
 * - Reagiert auf Zustandsaenderungen mit gezielten DOM-Mutationen
 * - Kapselt Seitenlade- und Einstellungs-Toggle-Logik
 *
 * Abhaengigkeiten werden ueber TischUIKontext injiziert; TischUIManager hat keine direkte
 * Referenz auf TischSzene oder Phaser-Objekte.
 */
import { appStore } from '../anwendung';
import {
  type TischAnsichtModell,
} from '../model/TischAnsichtModell';
import type { KiSchwierigkeit, Tischhintergrund } from '../modelle/SpielverwaltungDto';
import type { AppZustand } from '../store/AppStore';
import {
  escapeHtml,
  formatiereAnsage,
  formatiereSonderpunkt,
  kiSchwierigkeitLabel,
  kuerzelFuerKarte,
} from './tischFormatierer';

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

/**
 * Schnittstelle zwischen TischUIManager und TischSzene.
 * Callbacks fuer Aktionen, die Phaser-Zugriff oder Szenen-State benoetigen.
 */
export interface TischUIKontext {
  /** Wechselt zur angegebenen Phaser-Szene. */
  szeneStarten(name: string): void;
  /** Passt den Phaser-AnimationenService an den neuen Geschwindigkeitsfaktor an. */
  onGeschwindigkeitGeaendert(faktor: AnimationsGeschwindigkeit): void;
  /** Wird aufgerufen wenn der "Letzte Stiche"-Toggle geklickt wird. */
  onLetzteSticheToggle(): void;
}

export class TischUIManager {
  // ── Top-Bar ──────────────────────────────────────────────────────────────────
  private hudStichzaehlerEl?: HTMLSpanElement;
  private hudSpieleInfo?: HTMLSpanElement;
  private hudDebugBtn?: HTMLButtonElement;

  // ── Seitenlade ────────────────────────────────────────────────────────────────
  private seitenladeEl?: HTMLDivElement;
  private seitenladeSpielerListe?: HTMLUListElement;
  private seitenladePunktestandListe?: HTMLUListElement;
  private seitenladeAnsageHistorie?: HTMLUListElement;
  private seitenladeLetzteSticheListe?: HTMLUListElement;
  private seitenladeLetzteStichButton?: HTMLButtonElement;
  private seitenladeOffen = false;

  // ── Einstellungs-Modal ────────────────────────────────────────────────────────
  private einstellungsModalEl?: HTMLDivElement;
  private tischhintergrundSelect?: HTMLSelectElement;
  private kiSchwierigkeitSelect?: HTMLSelectElement;

  // ── Sonstige Elemente ─────────────────────────────────────────────────────────
  private ergebnisInhalt?: HTMLDivElement;
  private toastStack?: HTMLDivElement;
  private rundenEndeModal?: HTMLDivElement;
  private partieEndeModal?: HTMLDivElement;

  // ── UI-State ──────────────────────────────────────────────────────────────────
  private letzteSticheOffen = false;
  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;

  constructor(private readonly kontext: TischUIKontext) {}

  // ── Getter fuer externe Zugriffe ──────────────────────────────────────────────

  getRundenEndeModal(): HTMLDivElement | undefined { return this.rundenEndeModal; }
  getPartieEndeModal(): HTMLDivElement | undefined { return this.partieEndeModal; }
  getEinstellungsModalEl(): HTMLDivElement | undefined { return this.einstellungsModalEl; }
  isSeitenladeOffen(): boolean { return this.seitenladeOffen; }
  getAnimationsGeschwindigkeit(): AnimationsGeschwindigkeit { return this.animationsGeschwindigkeit; }

  // ── Toggle-Aktionen ───────────────────────────────────────────────────────────

  /** Oeffnet oder schliesst die Seitenlade (z.B. per Tastenkuerzel I). */
  togglSeitenlade(): void {
    this.seitenladeOffen = !this.seitenladeOffen;
    if (this.seitenladeEl) {
      if (this.seitenladeOffen) {
        this.seitenladeEl.classList.add('seitenlade--offen');
      } else {
        this.seitenladeEl.classList.remove('seitenlade--offen');
      }
    }
  }

  /** Oeffnet oder schliesst das Einstellungs-Modal (z.B. per Tastenkuerzel S). */
  togglEinstellungen(): void {
    if (!this.einstellungsModalEl) {
      return;
    }
    this.einstellungsModalEl.hidden = !this.einstellungsModalEl.hidden;
    if (!this.einstellungsModalEl.hidden) {
      // Fokus auf ersten Button setzen
      setTimeout(() => {
        const ersterButton = this.einstellungsModalEl?.querySelector<HTMLButtonElement>('button:not([disabled])');
        ersterButton?.focus();
      }, 0);
    }
  }

  // ── DOM-Aufbau ────────────────────────────────────────────────────────────────

  /** Erstellt alle DOM-Elemente des Tisch-UI und registriert Event-Handler. */
  baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';
    uiRoot.dataset['testid'] = 'tischszene';

    // ── Top-Bar (40px, oben) ─────────────────────────────────────────────────
    const topBar = document.createElement('div');
    topBar.className = 'hud-topbar';
    topBar.innerHTML = `
      <div class="hud-topbar__left">
        <button class="hud-icon-btn" type="button" title="Seitenlade öffnen/schließen" data-seitenlade-toggle>☰</button>
        <span class="hud-topbar__stichzaehler" data-stichzaehler data-testid="hud-stichzaehler"></span>
      </div>
      <div class="hud-topbar__center">
        <span data-spiele-info data-testid="hud-spieltyp"></span>
      </div>
      <div class="hud-topbar__right">
        <button class="ui-button ui-button--secondary" type="button" data-share-button data-testid="btn-link-teilen" title="Einladungslink kopieren">🔗 Link teilen</button>
        <button class="ui-button" type="button" data-start-button data-testid="btn-spiel-starten">Spiel starten</button>
        <button class="hud-icon-btn" type="button" title="Tisch verlassen" data-leave-top-button>&#x2190;</button>
        <button class="hud-icon-btn" type="button" title="Einstellungen" data-einstellungen-toggle data-testid="hud-btn-einstellungen">⚙</button>
        <button class="hud-icon-btn" type="button" title="Debug" data-debug-button>🐛</button>
      </div>
    `;

    // ── Seitenlade (von links, toggle) ───────────────────────────────────────
    const seitenlade = document.createElement('div');
    seitenlade.className = 'seitenlade';
    seitenlade.innerHTML = `
      <h3>Spieler am Tisch</h3>
      <ul class="ui-list" data-sl-spieler></ul>
      <h3>Punktestand</h3>
      <ul class="ui-list ui-list--dense" data-sl-punktestand></ul>
      <h3>Ansagehistorie</h3>
      <ul class="ui-list ui-list--dense" data-sl-ansagen></ul>
      <h3>Letzte Stiche</h3>
      <div class="ui-action-row">
        <button class="ui-button ui-button--secondary" type="button" data-sl-letzte-stiche-toggle>Letzte Stiche anzeigen</button>
      </div>
      <ul class="ui-list ui-list--dense" data-sl-letzte-stiche hidden></ul>
      <h3>Letzte Auswertung</h3>
      <div class="ui-action-stack" data-ergebnis></div>
      <div class="ui-action-row" style="margin-top:auto;padding-top:12px;border-top:1px solid rgba(216,243,220,0.2)">
        <button class="ui-button ui-button--secondary" type="button" data-lobby-button>Zur Lobby</button>
        <button class="ui-button ui-button--danger" type="button" data-leave-button>Tisch verlassen</button>
        <button class="ui-button ui-button--secondary" type="button" data-animationsgeschwindigkeit>Geschw.: 1x</button>
      </div>
    `;

    // ── Einstellungs-Modal ────────────────────────────────────────────────────
    const einstellungsModal = document.createElement('div');
    einstellungsModal.className = 'einstellungen-backdrop';
    einstellungsModal.dataset['testid'] = 'einstellungen-modal';
    einstellungsModal.hidden = true;
    const einstellungsDialog = document.createElement('div');
    einstellungsDialog.className = 'ui-modal';
    einstellungsDialog.innerHTML = `
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
      <div class="ui-action-row">
        <button class="ui-button" type="button" data-einstellungen-schliessen>Schließen</button>
      </div>
    `;
    einstellungsModal.append(einstellungsDialog);

    // ── Toast-Stack (oben rechts) ─────────────────────────────────────────────
    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    // ── Rundenende-Modal: initial versteckt ────────────────────────────────
    const rundenEndeModal = document.createElement('div');
    rundenEndeModal.className = 'ui-modal-backdrop';
    rundenEndeModal.dataset['testid'] = 'rundenauswertung-overlay';
    rundenEndeModal.hidden = true;

    // ── Partie-Ende-Modal: initial versteckt ────────────────────────────────
    const partieEndeModal = document.createElement('div');
    partieEndeModal.className = 'ui-modal-backdrop';
    partieEndeModal.dataset['testid'] = 'partieende-overlay';
    partieEndeModal.hidden = true;

    // ── Marker-Elemente für Phaser-Canvas-Overlays (testid-Anker) ────────────
    const vorbehaltMarker = document.createElement('div');
    vorbehaltMarker.dataset['testid'] = 'vorbehalt-overlay';
    vorbehaltMarker.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    const actionBarMarker = document.createElement('div');
    actionBarMarker.dataset['testid'] = 'floating-action-bar';
    actionBarMarker.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';

    // ── Referenzen auf DOM-Elemente sichern ───────────────────────────────────
    const hudStichzaehlerEl = topBar.querySelector('[data-stichzaehler]');
    const hudSpieleInfo = topBar.querySelector('[data-spiele-info]');
    const hudDebugBtn = topBar.querySelector('[data-debug-button]');
    const seitenladeSpielerListe = seitenlade.querySelector('[data-sl-spieler]');
    const seitenladePunktestandListe = seitenlade.querySelector('[data-sl-punktestand]');
    const seitenladeAnsageHistorie = seitenlade.querySelector('[data-sl-ansagen]');
    const seitenladeLetzteSticheListe = seitenlade.querySelector('[data-sl-letzte-stiche]');
    const seitenladeLetzteStichButton = seitenlade.querySelector('[data-sl-letzte-stiche-toggle]');
    const tischhintergrundSelect = einstellungsDialog.querySelector('[data-tischhintergrund]');
    const kiSchwierigkeitSelect = einstellungsDialog.querySelector('[data-ki-schwierigkeit]');
    const geschwindigkeitsButton = seitenlade.querySelector('[data-animationsgeschwindigkeit]');
    const ergebnisInhalt = seitenlade.querySelector('[data-ergebnis]');
    const lobbyButton = seitenlade.querySelector('[data-lobby-button]');
    const leaveButton = seitenlade.querySelector('[data-leave-button]');
    const startButton = topBar.querySelector('[data-start-button]');
    const shareButton = topBar.querySelector('[data-share-button]');
    const leaveTopButton = topBar.querySelector('[data-leave-top-button]');
    const seitenladeToggleBtn = topBar.querySelector('[data-seitenlade-toggle]');
    const einstellungenToggleBtn = topBar.querySelector('[data-einstellungen-toggle]');
    const einstellungenSchliessenBtn = einstellungsDialog.querySelector('[data-einstellungen-schliessen]');

    if (!(hudStichzaehlerEl instanceof HTMLSpanElement)
      || !(hudSpieleInfo instanceof HTMLSpanElement)
      || !(hudDebugBtn instanceof HTMLButtonElement)
      || !(seitenladeSpielerListe instanceof HTMLUListElement)
      || !(seitenladePunktestandListe instanceof HTMLUListElement)
      || !(seitenladeAnsageHistorie instanceof HTMLUListElement)
      || !(seitenladeLetzteSticheListe instanceof HTMLUListElement)
      || !(seitenladeLetzteStichButton instanceof HTMLButtonElement)
      || !(tischhintergrundSelect instanceof HTMLSelectElement)
      || !(kiSchwierigkeitSelect instanceof HTMLSelectElement)
      || !(geschwindigkeitsButton instanceof HTMLButtonElement)
      || !(ergebnisInhalt instanceof HTMLDivElement)
      || !(lobbyButton instanceof HTMLButtonElement)
      || !(leaveButton instanceof HTMLButtonElement)
      || !(leaveTopButton instanceof HTMLButtonElement)
      || !(startButton instanceof HTMLButtonElement)
      || !(seitenladeToggleBtn instanceof HTMLButtonElement)
      || !(einstellungenToggleBtn instanceof HTMLButtonElement)
      || !(einstellungenSchliessenBtn instanceof HTMLButtonElement)) {
      throw new Error('Tisch-UI konnte nicht aufgebaut werden.');
    }

    // ── Event-Handler ─────────────────────────────────────────────────────────

    // Seitenlade togglen
    seitenladeToggleBtn.addEventListener('click', () => {
      this.togglSeitenlade();
    });

    // Einstellungs-Modal oeffnen/schliessen
    einstellungenToggleBtn.addEventListener('click', () => {
      if (this.einstellungsModalEl) {
        this.einstellungsModalEl.hidden = !this.einstellungsModalEl.hidden;
      }
    });
    einstellungenSchliessenBtn.addEventListener('click', () => {
      if (this.einstellungsModalEl) {
        this.einstellungsModalEl.hidden = true;
      }
    });
    einstellungsModal.addEventListener('click', (event) => {
      if (event.target === einstellungsModal && this.einstellungsModalEl) {
        this.einstellungsModalEl.hidden = true;
      }
    });

    // Zur Lobby
    lobbyButton.addEventListener('click', () => {
      this.kontext.szeneStarten('SpielverwaltungsSzene');
    });

    // Tisch verlassen (mit Bestätigungsdialog bei laufendem Spiel)
    const verlasseTisch = (): void => {
      const zustand = appStore.snapshot();
      const istImSpiel = zustand.aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel) {
        const bestaetigt = window.confirm('Tisch wirklich verlassen? Die laufende Partie wird fuer alle Spieler abgebrochen.');
        if (!bestaetigt) return;
      }
      void appStore.verlasseAktuellenTisch();
    };
    leaveButton.addEventListener('click', verlasseTisch);
    leaveTopButton.addEventListener('click', verlasseTisch);

    // Spiel starten
    startButton.addEventListener('click', () => {
      void appStore.starteAktuellenTisch();
    });

    // Einladungslink teilen
    if (shareButton instanceof HTMLButtonElement) {
      shareButton.addEventListener('click', () => {
        const tisch = appStore.snapshot().aktuellerTisch;
        if (!tisch?.einladungsCode) return;
        const url = `${window.location.origin}#join/${tisch.einladungsCode}`;
        void navigator.clipboard.writeText(url).then(() => {
          shareButton.textContent = '✓ Kopiert!';
          setTimeout(() => { shareButton.textContent = '🔗 Link teilen'; }, 2000);
        }).catch(() => {
          window.prompt('Einladungslink kopieren:', url);
        });
      });
    }

    // Debug-Toggle
    hudDebugBtn.addEventListener('click', () => {
      appStore.toggleDebugModus();
    });

    // Tischhintergrund aendern
    tischhintergrundSelect.addEventListener('change', () => {
      void appStore.aktualisiereAktuellenTischhintergrund(tischhintergrundSelect.value as Tischhintergrund);
    });

    // KI-Schwierigkeit aendern
    kiSchwierigkeitSelect.addEventListener('change', () => {
      void appStore.aktualisiereAktuelleKiSchwierigkeit(kiSchwierigkeitSelect.value as KiSchwierigkeit);
    });

    // Letzte Stiche in der Seitenlade togglen
    seitenladeLetzteStichButton.addEventListener('click', () => {
      this.letzteSticheOffen = !this.letzteSticheOffen;
      this.kontext.onLetzteSticheToggle();
    });

    // Animationsgeschwindigkeit wechseln
    geschwindigkeitsButton.addEventListener('click', () => {
      this.animationsGeschwindigkeit = naechsteGeschwindigkeit(this.animationsGeschwindigkeit);
      geschwindigkeitsButton.textContent = geschwindigkeitsLabel(this.animationsGeschwindigkeit);
      localStorage.setItem(LS_GESCHWINDIGKEIT, speichereGeschwindigkeit(this.animationsGeschwindigkeit));
      this.kontext.onGeschwindigkeitGeaendert(this.animationsGeschwindigkeit);
    });

    // ── Felder setzen ─────────────────────────────────────────────────────────
    this.hudStichzaehlerEl = hudStichzaehlerEl;
    this.hudSpieleInfo = hudSpieleInfo;
    this.hudDebugBtn = hudDebugBtn;
    this.seitenladeEl = seitenlade;
    this.seitenladeSpielerListe = seitenladeSpielerListe;
    this.seitenladePunktestandListe = seitenladePunktestandListe;
    this.seitenladeAnsageHistorie = seitenladeAnsageHistorie;
    this.seitenladeLetzteSticheListe = seitenladeLetzteSticheListe;
    this.seitenladeLetzteStichButton = seitenladeLetzteStichButton;
    this.einstellungsModalEl = einstellungsModal;
    this.tischhintergrundSelect = tischhintergrundSelect;
    this.kiSchwierigkeitSelect = kiSchwierigkeitSelect;
    this.toastStack = toastStack;
    this.rundenEndeModal = rundenEndeModal;
    this.partieEndeModal = partieEndeModal;
    this.ergebnisInhalt = ergebnisInhalt;

    uiRoot.append(topBar, seitenlade, einstellungsModal, toastStack, rundenEndeModal, partieEndeModal, vorbehaltMarker, actionBarMarker);

    // Gespeicherte Animationsgeschwindigkeit laden und anwenden
    const initialGeschwindigkeit = ladeGeschwindigkeit();
    if (initialGeschwindigkeit !== 1) {
      this.animationsGeschwindigkeit = initialGeschwindigkeit;
      geschwindigkeitsButton.textContent = geschwindigkeitsLabel(initialGeschwindigkeit);
      this.kontext.onGeschwindigkeitGeaendert(initialGeschwindigkeit);
    }
  }

  // ── Reaktive DOM-Updates ──────────────────────────────────────────────────────

  /** Aktualisiert die Top-Bar (Stichzaehler, Spieltyp/Nummer, Buttons). */
  aktualisiereTopBar(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    // Stichzaehler links
    if (this.hudStichzaehlerEl) {
      const spiel = zustand.partieStand?.laufendesSpiel;
      if (spiel) {
        const gesamtStiche = modell.spieler.reduce((summe, s) => summe + s.stiche, 0);
        this.hudStichzaehlerEl.textContent = `Stich ${gesamtStiche}/12`;
      } else {
        this.hudStichzaehlerEl.textContent = '';
      }
    }
    // Spieltyp + Spielnummer in der Mitte
    if (this.hudSpieleInfo) {
      const spiel = zustand.partieStand?.laufendesSpiel;
      if (spiel) {
        this.hudSpieleInfo.textContent = `${tisch.name} · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'} · ${modell.spieltyp ?? spiel.spieltyp}`;
      } else {
        this.hudSpieleInfo.textContent = `${tisch.name} · ${tisch.status}`;
      }
    }
    // Start-Button
    const startButtonEl = document.querySelector<HTMLButtonElement>('[data-start-button]');
    if (startButtonEl) {
      const darfStarten = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      startButtonEl.disabled = zustand.wirdGeladen || !darfStarten;
      startButtonEl.hidden = tisch.status !== 'WARTEND';
    }
    // Link-teilen-Button (nur im Wartezimmer sichtbar)
    const shareButtonEl = document.querySelector<HTMLButtonElement>('[data-share-button]');
    if (shareButtonEl) {
      shareButtonEl.hidden = tisch.status !== 'WARTEND';
    }
    // Debug-Button
    if (this.hudDebugBtn) {
      this.hudDebugBtn.textContent = zustand.debugModus ? '🐛 AN' : '🐛';
      this.hudDebugBtn.disabled = zustand.wirdGeladen || !zustand.partieStand;
      if (zustand.debugModus) {
        this.hudDebugBtn.classList.add('hud-icon-btn--aktiv');
      } else {
        this.hudDebugBtn.classList.remove('hud-icon-btn--aktiv');
      }
    }
  }

  /** Aktualisiert die Seitenlade: Spielerliste, Punktestand, Ansagehistorie. */
  aktualisiereSeitenlade(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    const kiLabel = kiSchwierigkeitLabel(tisch.konfiguration.kiSchwierigkeit ?? 'STANDARD');

    // Spielerliste
    if (this.seitenladeSpielerListe) {
      this.seitenladeSpielerListe.innerHTML = '';
      modell.spieler.forEach((spieler) => {
        const eintrag = document.createElement('li');
        eintrag.className = 'ui-list-item';
        const badge = spieler.istSelbst ? 'Du' : spieler.istMensch ? 'Mensch' : `KI (${kiLabel})`;
        const parteiBadge = spieler.partei ? `<span class="ui-badge ui-badge--partei">${spieler.partei}</span>` : '';
        eintrag.innerHTML = `
          <div class="ui-list-item__headline">
            <strong>${escapeHtml(spieler.name)}</strong>
            <span class="ui-badge ${spieler.istSelbst ? 'ui-badge--highlight' : ''}">${badge}</span>
          </div>
          <div class="ui-list-item__meta">
            <span>${spieler.istErsteller ? 'Ersteller' : spieler.statusText}</span>
            <span>${spieler.istGeber ? 'Geber' : `${spieler.stiche} Stiche`}</span>
            ${parteiBadge}
          </div>
        `;
        this.seitenladeSpielerListe?.append(eintrag);
      });
    }

    // Punktestand
    this.aktualisierePunktestand(modell);

    // Ansagehistorie
    this.aktualisiereAnsageHistorie(modell);

    // Leave-Button: auch im IM_SPIEL klickbar (mit Bestätigung)
    const leaveButtonEl = document.querySelector<HTMLButtonElement>('[data-leave-button]');
    if (leaveButtonEl) {
      leaveButtonEl.disabled = zustand.wirdGeladen;
    }
  }

  /** Aktualisiert die Einstellungs-Selects (Tischhintergrund, KI-Schwierigkeit). */
  aktualisiereEinstellungsModal(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    const darfKonfigurieren = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
    if (this.tischhintergrundSelect) {
      this.tischhintergrundSelect.value = modell.tischhintergrund;
      this.tischhintergrundSelect.disabled = zustand.wirdGeladen || !darfKonfigurieren;
    }
    if (this.kiSchwierigkeitSelect) {
      this.kiSchwierigkeitSelect.value = tisch.konfiguration.kiSchwierigkeit ?? 'STANDARD';
      this.kiSchwierigkeitSelect.disabled = zustand.wirdGeladen || !darfKonfigurieren;
    }
  }

  private aktualisiereAnsageHistorie(modell: TischAnsichtModell): void {
    if (!this.seitenladeAnsageHistorie) {
      return;
    }
    this.seitenladeAnsageHistorie.innerHTML = '';
    const eintraege = modell.ansageHistorie.slice(-6).reverse();
    if (eintraege.length === 0) {
      this.seitenladeAnsageHistorie.append(this.erstelleListenHinweis('Noch keine oeffentliche Ansage.'));
      return;
    }
    eintraege.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${escapeHtml(eintrag.name)}</strong>
          <span class="ui-badge">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${formatiereAnsage(eintrag.ansage)}</span>
        </div>
      `;
      this.seitenladeAnsageHistorie?.append(li);
    });
  }

  private aktualisierePunktestand(modell: TischAnsichtModell): void {
    if (!this.seitenladePunktestandListe) {
      return;
    }
    this.seitenladePunktestandListe.innerHTML = '';
    if (modell.gesamtpunktestand.length === 0) {
      this.seitenladePunktestandListe.append(this.erstelleListenHinweis('Sobald ein Spiel gewertet wurde, erscheint hier der Stand.'));
      return;
    }
    modell.gesamtpunktestand.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${escapeHtml(eintrag.name)}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte} Punkte</span>
        </div>
      `;
      this.seitenladePunktestandListe?.append(li);
    });
  }

  aktualisiereErgebnis(modell: TischAnsichtModell): void {
    if (!this.ergebnisInhalt) {
      return;
    }
    this.ergebnisInhalt.innerHTML = '';
    const ergebnis = modell.letztesSpielergebnis;
    if (!ergebnis) {
      this.ergebnisInhalt.append(this.erstelleInfoSektion(
        'Sobald ein Spiel abgeschlossen ist, erscheint hier die Auswertung mit Augen, Spielwert und Sonderpunkten.'
      ));
      return;
    }

    const sektion = this.erstelleSektion(
      `Spiel ${ergebnis.spielNummer} · ${ergebnis.spieltyp}`,
      `Sieger: ${ergebnis.siegerPartei} · Spielwert ${ergebnis.spielwert}`
    );
    const augen = document.createElement('div');
    augen.className = 'ui-grid ui-grid--two';
    augen.innerHTML = `
      <div class="ui-stat-card"><span class="ui-hint">Re</span><strong>${ergebnis.augenRe} Augen</strong></div>
      <div class="ui-stat-card"><span class="ui-hint">Kontra</span><strong>${ergebnis.augenKontra} Augen</strong></div>
    `;
    const sonderpunkte = document.createElement('div');
    sonderpunkte.className = 'ui-list-item ui-list-item--dense';
    sonderpunkte.innerHTML = `
      <div class="ui-list-item__headline">
        <strong>Sonderpunkte</strong>
        <span class="ui-badge">${ergebnis.siegerPartei}</span>
      </div>
      <div class="ui-list-item__meta">
        <span>Re: ${ergebnis.sonderpunkteRe.length > 0 ? ergebnis.sonderpunkteRe.map((sp) => formatiereSonderpunkt(sp)).join(', ') : 'Keine'}</span>
        <span>Kontra: ${ergebnis.sonderpunkteKontra.length > 0 ? ergebnis.sonderpunkteKontra.map((sp) => formatiereSonderpunkt(sp)).join(', ') : 'Keine'}</span>
      </div>
    `;
    const punkteListe = document.createElement('ul');
    punkteListe.className = 'ui-list ui-list--dense';
    ergebnis.spielpunkte.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${escapeHtml(eintrag.name)}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte} Spielpunkte</span>
        </div>
      `;
      punkteListe.append(li);
    });
    sektion.append(augen, sonderpunkte, punkteListe);
    this.ergebnisInhalt.append(sektion);
  }

  aktualisiereLetzteStiche(modell: TischAnsichtModell): void {
    if (!this.seitenladeLetzteSticheListe || !this.seitenladeLetzteStichButton) {
      return;
    }
    const stiche = modell.letzteAbgeschlosseneStiche.slice(-3).reverse();
    if (stiche.length === 0) {
      this.letzteSticheOffen = false;
      this.seitenladeLetzteStichButton.disabled = true;
      this.seitenladeLetzteStichButton.textContent = 'Keine letzten Stiche';
      this.seitenladeLetzteSticheListe.hidden = true;
      this.seitenladeLetzteSticheListe.innerHTML = '';
      return;
    }

    this.seitenladeLetzteStichButton.disabled = false;
    this.seitenladeLetzteStichButton.textContent = this.letzteSticheOffen
      ? 'Letzte Stiche ausblenden'
      : 'Letzte Stiche anzeigen';
    this.seitenladeLetzteSticheListe.hidden = !this.letzteSticheOffen;
    this.seitenladeLetzteSticheListe.innerHTML = '';
    stiche.forEach((stich) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>Stich ${stich.stichNummer} · Spiel ${stich.spielNummer}</strong>
          <span class="ui-badge">${stich.augen} Augen</span>
        </div>
        <div class="ui-list-item__meta">
          <span>Gewinner: ${stich.gewinnerName}</span>
          <span>${stich.gespielteKarten.map((karte) => `${karte.name}: ${kuerzelFuerKarte(karte.karte)}`).join(' · ')}</span>
        </div>
      `;
      this.seitenladeLetzteSticheListe?.append(li);
    });
  }

  aktualisiereToasts(zustand: AppZustand): void {
    if (!this.toastStack) {
      return;
    }
    this.toastStack.innerHTML = '';
    if (!zustand.meldung) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `ui-toast ${zustand.meldung.typ === 'fehler' ? 'ui-toast--error' : ''}`;
    toast.dataset['testid'] = zustand.meldung.typ === 'fehler' ? 'fehler-toast' : 'info-toast';
    toast.innerHTML = `
      <strong>${zustand.meldung.typ === 'fehler' ? 'Fehler' : 'Info'}</strong>
      <div>${zustand.meldung.text}</div>
    `;
    this.toastStack.append(toast);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  /** Leert den UI-Root und setzt alle DOM-Referenzen zurueck. */
  aufraeumen(): void {
    this.seitenladeOffen = false;
    this.letzteSticheOffen = false;
    this.animationsGeschwindigkeit = 1;
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) {
      uiRoot.innerHTML = '';
    }
    this.hudStichzaehlerEl = undefined;
    this.hudSpieleInfo = undefined;
    this.hudDebugBtn = undefined;
    this.seitenladeEl = undefined;
    this.seitenladeSpielerListe = undefined;
    this.seitenladePunktestandListe = undefined;
    this.seitenladeAnsageHistorie = undefined;
    this.seitenladeLetzteSticheListe = undefined;
    this.seitenladeLetzteStichButton = undefined;
    this.einstellungsModalEl = undefined;
    this.ergebnisInhalt = undefined;
    this.tischhintergrundSelect = undefined;
    this.kiSchwierigkeitSelect = undefined;
    this.toastStack = undefined;
    this.rundenEndeModal = undefined;
    this.partieEndeModal = undefined;
  }

  // ── DOM-Hilfsmethoden ─────────────────────────────────────────────────────────

  private erstelleSektion(titel: string, beschreibung: string): HTMLDivElement {
    const sektion = document.createElement('div');
    sektion.className = 'ui-section';
    const headline = document.createElement('strong');
    headline.textContent = titel;
    const text = document.createElement('span');
    text.className = 'ui-hint';
    text.textContent = beschreibung;
    sektion.append(headline, text);
    return sektion;
  }

  private erstelleInfoSektion(text: string): HTMLDivElement {
    const sektion = document.createElement('div');
    sektion.className = 'ui-section';
    const hinweis = document.createElement('span');
    hinweis.className = 'ui-hint';
    hinweis.textContent = text;
    sektion.append(hinweis);
    return sektion;
  }

  private erstelleListenHinweis(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'ui-list-item ui-list-item--dense';
    li.innerHTML = `<span class="ui-hint">${text}</span>`;
    return li;
  }
}
