import Phaser from 'phaser';
import {
  TEXTUR_BLAU_GRAFIK,
  TEXTUR_FILZ,
  TEXTUR_HOLZ_DUNKEL,
  TEXTUR_KARTE_OFFEN,
  TEXTUR_KARTE_VERDECKT,
  texturSchluesselFuerKarte,
  registriereKartenSpriteTexturen,
  ladeKartenBilderVorab
} from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import {
  erstelleTischAnsichtAusStatus,
  istTrumpfFuerSpieltyp,
  type AnsageAnsicht,
  type LetztesSpielergebnisAnsicht,
  type TischAnsichtModell,
  type SpielerPosition
} from '../model/TischAnsichtModell';
import type { Ansage, KarteAntwort, KiSchwierigkeit, Sonderpunkt, Tischhintergrund, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';

interface TischLayoutEintrag {
  x: number;
  y: number;
  kartenX: number;
  kartenY: number;
  kartenWinkel: number;
}

type TischLayout = Record<SpielerPosition, TischLayoutEintrag>;

// Stich-Slot-Positionen relativ zur Spielgrösse (früher hardcodiert 108/132px)
function stichSlotPositionen(
  mitteX: number, mitteY: number, breite: number, hoehe: number
): Record<SpielerPosition, { x: number; y: number }> {
  const versatzY = Math.round(hoehe * 0.15);   // ≈ 108 bei 720px
  const versatzX = Math.round(breite * 0.103);  // ≈ 132 bei 1280px
  return {
    SUED: { x: mitteX, y: mitteY + versatzY },
    WEST: { x: mitteX - versatzX, y: mitteY },
    NORD: { x: mitteX, y: mitteY - versatzY },
    OST: { x: mitteX + versatzX, y: mitteY }
  };
}

// Kartengrösse skaliert mit der Spielbreite; 110x165px Zielgrösse; Seitenverhältnis 110:165
function berechneKartenGroesse(breite: number): { w: number; h: number } {
  // 110x165px Zielgrösse; skaliert proportional mit der Spielbreite
  const w = Math.round(Math.min(110, breite * 0.086));
  return { w, h: Math.round(w * (165 / 110)) };
}

// Kartenabstand im Fächer skaliert mit der Spielgrösse
function berechneKartenAbstand(breite: number, hoehe: number): { horizontal: number; vertikal: number } {
  return {
    horizontal: Math.max(22, Math.round(breite * 0.022)),  // ≈ 28 bei 1280px
    vertikal: Math.max(12, Math.round(hoehe * 0.022))      // ≈ 16 bei 720px
  };
}

function kuerzelFuerKarte(karte: KarteAntwort): string {
  const wert = ({
    AS: 'A',
    ZEHN: '10',
    KOENIG: 'K',
    DAME: 'D',
    BUBE: 'B',
    NEUN: '9'
  } as Record<string, string>)[karte.wert] ?? karte.wert.slice(0, 2);
  const farbe = ({
    KREUZ: 'K',
    PIK: 'P',
    HERZ: 'H',
    KARO: 'D'
  } as Record<string, string>)[karte.farbe] ?? karte.farbe.slice(0, 1);
  return `${farbe}${wert}`;
}

function formatiereAnsage(ansage: Ansage): string {
  return ({
    RE: 'Re',
    KONTRA: 'Kontra',
    KEINE_90: 'Keine 90',
    KEINE_60: 'Keine 60',
    KEINE_30: 'Keine 30',
    SCHWARZ: 'Schwarz'
  } as Record<Ansage, string>)[ansage];
}

function formatiereVorbehalt(vorbehalt: VorbehaltAnsage): string {
  return ({
    GESUND: 'Gesund',
    SOLO_DAME: 'Damensolo',
    SOLO_BUBE: 'Bubensolo',
    SOLO_TRUMPF: 'Trumpfsolo',
    SOLO_FLEISCHLOS: 'Fleischlos',
    HOCHZEIT: 'Hochzeit',
    ARMUT: 'Armut'
  } as Record<VorbehaltAnsage, string>)[vorbehalt];
}

function formatiereSonderpunkt(sonderpunkt: Sonderpunkt): string {
  return ({
    FUCHS_GEFANGEN: 'Fuchs gefangen',
    KARLCHEN: 'Karlchen',
    DOPPELKOPF: 'Doppelkopf'
  } as Record<Sonderpunkt, string>)[sonderpunkt];
}

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

function berechneLayout(breite: number, hoehe: number): TischLayout {
  return {
    SUED: { x: breite * 0.5, y: hoehe * 0.82, kartenX: breite * 0.28, kartenY: hoehe * 0.87, kartenWinkel: 0 },
    WEST: { x: breite * 0.12, y: hoehe * 0.5, kartenX: breite * 0.06, kartenY: hoehe * 0.37, kartenWinkel: 90 },
    NORD: { x: breite * 0.5, y: hoehe * 0.18, kartenX: breite * 0.28, kartenY: hoehe * 0.08, kartenWinkel: 0 },
    OST: { x: breite * 0.88, y: hoehe * 0.5, kartenX: breite * 0.94, kartenY: hoehe * 0.37, kartenWinkel: 90 }
  };
}

function texturFuerTischhintergrund(tischhintergrund: Tischhintergrund): string {
  return ({
    FILZ_GRUEN: TEXTUR_FILZ,
    HOLZ_DUNKEL: TEXTUR_HOLZ_DUNKEL,
    BLAU_GRAFIK: TEXTUR_BLAU_GRAFIK
  } as Record<Tischhintergrund, string>)[tischhintergrund];
}

/** Lesbares Label fuer die KI-Schwierigkeitsstufe (fuer Badges und Anzeige). */
function kiSchwierigkeitLabel(schwierigkeit: KiSchwierigkeit): string {
  return ({ LEICHT: 'Leicht', STANDARD: 'Standard', SCHWER: 'Schwer' } as Record<KiSchwierigkeit, string>)[schwierigkeit] ?? 'Standard';
}

// Moegliche Animations-Geschwindigkeitsstufen: normal (1x), doppelt (2x), sofort (Infinity)
type AnimationsGeschwindigkeit = 1 | 2 | typeof Infinity;

function naechsteGeschwindigkeit(aktuelle: AnimationsGeschwindigkeit): AnimationsGeschwindigkeit {
  if (aktuelle === 1) return 2;
  if (aktuelle === 2) return Infinity;
  return 1;
}

function geschwindigkeitsLabel(faktor: AnimationsGeschwindigkeit): string {
  if (faktor === Infinity) return 'Geschw.: sofort';
  return `Geschw.: ${faktor}x`;
}

const LS_GESCHWINDIGKEIT = 'locodoko.animationsgeschwindigkeit';

function ladeGeschwindigkeit(): AnimationsGeschwindigkeit {
  const wert = localStorage.getItem(LS_GESCHWINDIGKEIT);
  if (wert === '2') return 2;
  if (wert === 'sofort') return Infinity;
  return 1;
}

function speichereGeschwindigkeit(faktor: AnimationsGeschwindigkeit): string {
  if (faktor === Infinity) return 'sofort';
  return String(faktor);
}

/**
 * Hauptspielszene — rendert den Doppelkopf-Tisch und verwaltet alle Spielinteraktionen.
 *
 * Lebenszyklus: `create()` → AppStore-Subscription → reaktives `aktualisiereUi()` + `renderTisch()`
 * bei jedem State-Update → `shutdown()`/`destroy()` beim Szenenwechsel.
 *
 * Verantwortlichkeiten:
 * - Top-Down-Tisch-Rendering mit Phaser (Karten, Spieler, Stichmitte, Hintergrund)
 * - HTML-UI-Panels (Tischsteuerung links, Spielaktionen rechts)
 * - Kartenklick-Handling mit Validierung gegen spielbareKarten
 * - Modale Dialoge fuer Vorbehalt, Armut, Rundenende und Partie-Ende
 * - Animationen ueber AnimationenService (Ausspielen, Austeilen, Stich-Einziehen, Banner)
 *
 * Abhaengigkeiten: AppStore (reaktiver Zustand), TischAnsichtModell (Transformation),
 * AnimationenService (Tweens), SpielverwaltungApi/EchtzeitPort (via AppStore).
 */
export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  private letzterZustand?: AppZustand;

  private hintergrund?: Phaser.GameObjects.TileSprite;

  private tischEbene?: Phaser.GameObjects.Container;

  // Top-Bar
  private hudStichzaehlerEl?: HTMLSpanElement;

  private hudSpieleInfo?: HTMLSpanElement;

  private hudDebugBtn?: HTMLButtonElement;

  // Seitenlade (von links, toggle)
  private seitenladeEl?: HTMLDivElement;

  private seitenladeSpielerListe?: HTMLUListElement;

  private seitenladePunktestandListe?: HTMLUListElement;

  private seitenladeAnsageHistorie?: HTMLUListElement;

  private seitenladeLetzteSticheListe?: HTMLUListElement;

  private seitenladeLetzteStichButton?: HTMLButtonElement;

  private seitenladeOffen = false;

  // Einstellungs-Modal
  private einstellungsModalEl?: HTMLDivElement;

  // Spielaktionen-Overlay (unten Mitte)
  private aktionsHinweis?: HTMLParagraphElement;

  private aktionsInhalt?: HTMLDivElement;

  private ergebnisInhalt?: HTMLDivElement;

  private tischhintergrundSelect?: HTMLSelectElement;

  private kiSchwierigkeitSelect?: HTMLSelectElement;

  private toastStack?: HTMLDivElement;

  // Modaler Dialog am Rundenende (bleibt bis Spieler ihn schliesst)
  private rundenEndeModal?: HTMLDivElement;

  // Modaler Dialog am Partie-Ende mit Gesamtpunktestand + Countdown fuer Neustart
  private partieEndeModal?: HTMLDivElement;

  // Countdown-Intervall fuer den Partie-Ende-Neustart (Referenz fuer Cleanup)
  private countdownTimerId?: ReturnType<typeof setInterval>;

  private ausgewaehlteArmutKarten = new Set<string>();

  private armutAnnahmeAktiv = false;

  private letzteSticheOffen = false;

  private animationen?: AnimationenService;

  private letztesModell: TischAnsichtModell | null = null;

  private readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();

  private spielzugAnimationAktiv = false;

  private wartendeKartenId: string | null = null;

  // Wird waehrend der Austeilen-Animation auf true gesetzt; Karten werden dann unsichtbar gerendert
  private austeilenAktiv = false;

  // Handler fuer Escape-Taste am Rundenende-Modal (wird bei Schliessen entfernt)
  private escapeHandler?: (e: KeyboardEvent) => void;

  // Handler fuer Backdrop-Klick am Rundenende-Modal (wird bei Schliessen entfernt)
  private backdropClickHandler?: (e: MouseEvent) => void;

  // Aktuell gewaehlte Animations-Geschwindigkeit (wird in localStorage persistiert)
  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;

  // Referenz auf den Geschwindigkeits-Toggle-Button fuer Label-Aktualisierungen
  private geschwindigkeitsButton?: HTMLButtonElement;

  constructor() {
    super('TischSzene');
  }

  /**
   * Phaser-Lifecycle: Laedt Karten-PNG-Assets vorab.
   *
   * Wird von Phaser vor create() aufgerufen. Queued alle 24 Karten-PNGs
   * aus /assets/cards/ in den Phaser-Loader. Falls eine PNG-Datei fehlt,
   * faellt registriereKartenSpriteTexturen() in create() automatisch auf
   * prozedurale Canvas-Generierung zurueck.
   */
  preload(): void {
    ladeKartenBilderVorab(this);
  }

  /**
   * Phaser-Lifecycle: Initialisiert die TischSzene.
   *
   * Erstellt Hintergrund, AnimationenService und HTML-UI, laedt die gespeicherte
   * Animationsgeschwindigkeit, registriert Kartentexturen und abonniert den AppStore.
   * Der AppStore-Listener reagiert auf jeden State-Update mit Animations- und UI-Aktualisierungen.
   */
  create(): void {
    const snapshot = appStore.snapshot();
    Logger.szene('TischSzene create', { tischId: snapshot.aktuellerTisch?.id });
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const anfangsModell = erstelleTischAnsichtAusStatus(
      snapshot.spieler?.spielerId ?? null,
      snapshot.aktuellerTisch,
      snapshot.partieStand,
      snapshot.debugModus
    );
    this.hintergrund = this.add.tileSprite(
      breite / 2,
      hoehe / 2,
      breite,
      hoehe,
      texturFuerTischhintergrund(anfangsModell.tischhintergrund)
    );
    this.animationen = new AnimationenService(this);
    this.baueUi();
    // Gespeicherte Animations-Geschwindigkeit wiederherstellen
    const initialGeschwindigkeit = ladeGeschwindigkeit();
    if (initialGeschwindigkeit !== 1) {
      this.animationsGeschwindigkeit = initialGeschwindigkeit;
      this.animationen.setzeGeschwindigkeitsfaktor(initialGeschwindigkeit);
      if (this.geschwindigkeitsButton) {
        this.geschwindigkeitsButton.textContent = geschwindigkeitsLabel(initialGeschwindigkeit);
      }
    }
    // Individuelle Kartentexturen fuer das franzoesische Blatt laden (idempotent)
    registriereKartenSpriteTexturen(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      const modell = this.erstelleModell(zustand);
      const vorherigesModell = this.letztesModell;
      const vorherigerZustand = this.letzterZustand;
      // Phasenübergang loggen (nicht pro Frame, nur bei Änderung)
      const vorherigePhase = vorherigerZustand?.partieStand?.laufendesSpiel?.phase;
      const aktuellePhase = zustand.partieStand?.laufendesSpiel?.phase;
      if (aktuellePhase && aktuellePhase !== vorherigePhase) {
        Logger.szene('Spielphase', { vorher: vorherigePhase ?? null, nachher: aktuellePhase });
      }
      this.synchronisiereAnimationszustand(modell, zustand);
      this.letzterZustand = zustand;
      this.aktualisiereUi(zustand, modell);
      if (zustand.bereich === 'LOBBY') {
        this.scene.start('LobbySzene');
        return;
      }
      // Neues Spiel erkannt: Karten werden unsichtbar gerendert und dann animiert ausgeteilt
      // Partie-Ende-Modal schliessen, da neue Partie gestartet wurde
      if (this.ermittleNeuesSpiel(vorherigerZustand, zustand)) {
        this.schliessePartieEndeModal();
        this.austeilenAktiv = true;
        void this.starteAusteilen(modell, zustand);
      }
      this.renderTisch(zustand, modell);
      void this.starteFolgeanimationen(vorherigesModell, modell);
      void this.starteAnsageBannerAnimationen(this.ermittleNeueAnsagen(vorherigesModell, modell));
      void this.starteSonderpunktFeedbackAnimationen(this.ermittleNeueSonderpunkte(vorherigesModell, modell));
      // Neues Spielergebnis → Rundenende- oder Partie-Ende-Modal einblenden
      if (this.erkennteNeuesSpielErgebnis(vorherigesModell, modell) && modell.letztesSpielergebnis) {
        if (modell.partieBeendet) {
          this.zeigePartieEndeModal(modell);
        } else {
          this.zeigeRundenEndeModal(modell.letztesSpielergebnis);
        }
      }
      this.letztesModell = modell;
    });
  }

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene gestoppt wird (z.B. Wechsel zur LobbySzene). */
  shutdown(): void {
    this.aufraeumen();
  }

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene zerstoert wird. */
  destroy(): void {
    this.aufraeumen();
  }

  private baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';

    // ── Top-Bar (40px, oben) ─────────────────────────────────────────────────
    const topBar = document.createElement('div');
    topBar.className = 'hud-topbar';
    topBar.innerHTML = `
      <div class="hud-topbar__left">
        <button class="hud-icon-btn" type="button" title="Seitenlade öffnen/schließen" data-seitenlade-toggle>☰</button>
        <span class="hud-topbar__stichzaehler" data-stichzaehler></span>
      </div>
      <div class="hud-topbar__center">
        <span data-spiele-info></span>
      </div>
      <div class="hud-topbar__right">
        <button class="ui-button" type="button" data-start-button>Spiel starten</button>
        <button class="hud-icon-btn" type="button" title="Einstellungen" data-einstellungen-toggle>⚙</button>
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

    // ── Spielaktionen-Overlay (unten Mitte, über den Karten) ─────────────────
    const spielaktioneOverlay = document.createElement('div');
    spielaktioneOverlay.className = 'spielaktionen-overlay';
    spielaktioneOverlay.innerHTML = `
      <p class="ui-panel__muted" data-aktions-hinweis></p>
      <div class="ui-action-stack" data-aktions-inhalt></div>
    `;

    // ── Toast-Stack (oben rechts) ─────────────────────────────────────────────
    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    // ── Rundenende-Modal: initial versteckt ────────────────────────────────
    const rundenEndeModal = document.createElement('div');
    rundenEndeModal.className = 'ui-modal-backdrop';
    rundenEndeModal.hidden = true;

    // ── Partie-Ende-Modal: initial versteckt ────────────────────────────────
    const partieEndeModal = document.createElement('div');
    partieEndeModal.className = 'ui-modal-backdrop';
    partieEndeModal.hidden = true;

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
    const aktionsHinweis = spielaktioneOverlay.querySelector('[data-aktions-hinweis]');
    const aktionsInhalt = spielaktioneOverlay.querySelector('[data-aktions-inhalt]');
    const ergebnisInhalt = seitenlade.querySelector('[data-ergebnis]');
    const lobbyButton = seitenlade.querySelector('[data-lobby-button]');
    const leaveButton = seitenlade.querySelector('[data-leave-button]');
    const startButton = topBar.querySelector('[data-start-button]');
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
      || !(aktionsHinweis instanceof HTMLParagraphElement)
      || !(aktionsInhalt instanceof HTMLDivElement)
      || !(ergebnisInhalt instanceof HTMLDivElement)
      || !(lobbyButton instanceof HTMLButtonElement)
      || !(leaveButton instanceof HTMLButtonElement)
      || !(startButton instanceof HTMLButtonElement)
      || !(seitenladeToggleBtn instanceof HTMLButtonElement)
      || !(einstellungenToggleBtn instanceof HTMLButtonElement)
      || !(einstellungenSchliessenBtn instanceof HTMLButtonElement)) {
      throw new Error('Tisch-UI konnte nicht aufgebaut werden.');
    }

    // ── Event-Handler ─────────────────────────────────────────────────────────

    // Seitenlade togglen — verwendet this.seitenladeEl fuer saubere Closure-Unabhaengigkeit
    seitenladeToggleBtn.addEventListener('click', () => {
      this.seitenladeOffen = !this.seitenladeOffen;
      if (this.seitenladeEl) {
        if (this.seitenladeOffen) {
          this.seitenladeEl.classList.add('seitenlade--offen');
        } else {
          this.seitenladeEl.classList.remove('seitenlade--offen');
        }
      }
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
      this.scene.start('LobbySzene');
    });

    // Tisch verlassen (mit Bestätigungsdialog bei laufendem Spiel)
    leaveButton.addEventListener('click', () => {
      const zustand = appStore.snapshot();
      const istImSpiel = zustand.aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel) {
        // Bestaetigungsdialog: Verlassen wuerde die laufende Partie abbrechen
        const bestaetigt = window.confirm('Tisch wirklich verlassen? Die laufende Partie wird fuer alle Spieler abgebrochen.');
        if (!bestaetigt) return;
      }
      void appStore.verlasseAktuellenTisch();
    });

    // Spiel starten
    startButton.addEventListener('click', () => {
      void appStore.starteAktuellenTisch();
    });

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
      if (this.letzterZustand) {
        this.aktualisiereUi(this.letzterZustand);
      }
    });

    // Animationsgeschwindigkeit wechseln
    geschwindigkeitsButton.addEventListener('click', () => {
      this.animationsGeschwindigkeit = naechsteGeschwindigkeit(this.animationsGeschwindigkeit);
      geschwindigkeitsButton.textContent = geschwindigkeitsLabel(this.animationsGeschwindigkeit);
      this.animationen?.setzeGeschwindigkeitsfaktor(this.animationsGeschwindigkeit);
      localStorage.setItem(LS_GESCHWINDIGKEIT, speichereGeschwindigkeit(this.animationsGeschwindigkeit));
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
    this.aktionsHinweis = aktionsHinweis;
    this.aktionsInhalt = aktionsInhalt;
    this.ergebnisInhalt = ergebnisInhalt;
    this.tischhintergrundSelect = tischhintergrundSelect;
    this.kiSchwierigkeitSelect = kiSchwierigkeitSelect;
    this.geschwindigkeitsButton = geschwindigkeitsButton;
    this.toastStack = toastStack;
    this.rundenEndeModal = rundenEndeModal;
    this.partieEndeModal = partieEndeModal;

    uiRoot.append(topBar, seitenlade, einstellungsModal, spielaktioneOverlay, toastStack, rundenEndeModal, partieEndeModal);
  }

  private aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    this.synchronisiereAktionZustand(modell);

    // ── Top-Bar aktualisieren ─────────────────────────────────────────────────
    this.aktualisiereTopBar(modell, zustand);

    // ── Seitenlade aktualisieren ──────────────────────────────────────────────
    this.aktualisiereSeitenlade(modell, zustand);

    // ── Spielaktionen-Overlay aktualisieren ──────────────────────────────────
    this.aktualisiereAktionsbereich(modell, zustand);

    // ── Einstellungs-Selects aktualisieren ────────────────────────────────────
    const darfKonfigurieren = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
    if (this.tischhintergrundSelect) {
      this.tischhintergrundSelect.value = modell.tischhintergrund;
      this.tischhintergrundSelect.disabled = zustand.wirdGeladen || !darfKonfigurieren;
    }
    if (this.kiSchwierigkeitSelect) {
      this.kiSchwierigkeitSelect.value = tisch.konfiguration.kiSchwierigkeit ?? 'STANDARD';
      this.kiSchwierigkeitSelect.disabled = zustand.wirdGeladen || !darfKonfigurieren;
    }

    // ── Ergebnis + Stiche in der Seitenlade ──────────────────────────────────
    this.aktualisiereErgebnis(modell);
    this.aktualisiereLetzteStiche(modell);

    // ── Toasts ────────────────────────────────────────────────────────────────
    this.aktualisiereToasts(zustand);
  }

  /** Aktualisiert die Top-Bar (Stichzaehler, Spieltyp/Nummer, Buttons). */
  private aktualisiereTopBar(modell: TischAnsichtModell, zustand: AppZustand): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    // Stichzaehler links
    if (this.hudStichzaehlerEl) {
      const spiel = zustand.partieStand?.laufendesSpiel;
      if (spiel) {
        const gesamtStiche = modell.spieler.reduce((summe, s) => summe + s.stiche, 0);
        this.hudStichzaehlerEl.textContent = `${gesamtStiche} Stiche`;
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

  /** Aktualisiert die Seitenlade: Spielerliste, Punktestand, Ansagehistorie, Letzte Stiche. */
  private aktualisiereSeitenlade(modell: TischAnsichtModell, zustand: AppZustand): void {
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
            <strong>${spieler.name}</strong>
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

  private renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    this.tischEbene?.destroy(true);
    this.handKartenobjekte.clear();
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const mitteX = breite / 2;
    const mitteY = hoehe / 2;
    const tischBreite = Math.min(breite * 0.76, 980);
    const tischHoehe = Math.min(hoehe * 0.74, 530);
    this.hintergrund
      ?.setTexture(texturFuerTischhintergrund(modell.tischhintergrund))
      .setPosition(mitteX, mitteY)
      .setSize(breite, hoehe);

    const ebene = this.add.container(0, 0);
    ebene.add(this.add.ellipse(mitteX, mitteY, tischBreite, tischHoehe, 0x081c15, 0.32).setStrokeStyle(8, 0xd8f3dc, 0.42));
    ebene.add(this.add.text(mitteX, hoehe * 0.06, modell.titel, {
      color: '#f8f9fa',
      fontSize: `${Math.round(Math.max(24, breite * 0.024))}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    ebene.add(this.add.text(mitteX, hoehe * 0.1, `${modell.untertitel} · ${modell.statusText}`, {
      color: '#d8f3dc',
      fontSize: `${Math.round(Math.max(14, breite * 0.013))}px`
    }).setOrigin(0.5));

    this.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      const position = layout[spieler.position];
      // Nameplate: rechteckig; SUED/NORD horizontal (breit, flach), WEST/OST vertikal (schmal, hoeher)
      const istHorizontal = spieler.position === 'SUED' || spieler.position === 'NORD';
      const nameplateBreite = istHorizontal ? Math.max(120, breite * 0.11) : Math.max(80, breite * 0.07);
      const nameplateHoehe = istHorizontal ? Math.max(54, hoehe * 0.075) : Math.max(80, hoehe * 0.11);
      // Aktiv-Hervorhebung: goldene Umrandung; sonst halbtransparentes Dunkelgruen
      const rahmenFarbe = spieler.istAktivHervorgehoben ? 0xffe082 : 0xd8f3dc;
      const rahmenStaerke = spieler.istAktivHervorgehoben ? 3 : 1;
      ebene.add(
        this.add.rectangle(position.x, position.y, nameplateBreite, nameplateHoehe, 0x0d3d1e, 0.92)
          .setStrokeStyle(rahmenStaerke, rahmenFarbe, 0.85)
      );
      // Name (fett, oben)
      const nameSchriftGroesse = Math.round(Math.max(13, breite * 0.012));
      ebene.add(this.add.text(position.x, position.y - Math.round(nameplateHoehe * 0.28), spieler.name, {
        color: '#f8f9fa',
        fontSize: `${nameSchriftGroesse}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5));
      // Typ-Badge: [Du] / [KI] / [Mensch]
      const typLabel = spieler.istSelbst ? '[Du]' : spieler.istMensch ? '[Mensch]' : '[KI]';
      const kleinSchrift = Math.round(Math.max(10, breite * 0.009));
      ebene.add(this.add.text(position.x, position.y, typLabel, {
        color: spieler.istSelbst ? '#ffd166' : '#a3c4a8',
        fontSize: `${kleinSchrift}px`
      }).setOrigin(0.5));
      // Stiche-Zahl + Geber-Badge
      const sticheText = spieler.istGeber ? `${spieler.stiche} Stiche [G]` : `${spieler.stiche} Stiche`;
      ebene.add(this.add.text(position.x, position.y + Math.round(nameplateHoehe * 0.28), sticheText, {
        color: spieler.istGeber ? '#ffd166' : '#d8f3dc',
        fontSize: `${kleinSchrift}px`
      }).setOrigin(0.5));
      // Partei-Badge: [RE] (gold) / [KONTRA] (blau) wenn bekannt
      if (spieler.partei) {
        ebene.add(this.add.text(position.x, position.y - Math.round(nameplateHoehe * 0.58), `[${spieler.partei}]`, {
          color: spieler.partei === 'RE' ? '#ffd166' : '#90caf9',
          fontSize: `${kleinSchrift}px`,
          fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      this.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    if (modell.gesamtpunktestand.length > 0) {
      const punktetext = modell.gesamtpunktestand
        .map((eintrag) => `${eintrag.name}: ${eintrag.punkte}`)
        .join(' · ');
      ebene.add(this.add.text(mitteX, hoehe * 0.94, `Gesamtstand · ${punktetext}`, {
        color: '#f8f9fa',
        fontSize: `${Math.round(Math.max(14, breite * 0.012))}px`
      }).setOrigin(0.5));
    }

    this.tischEbene = ebene;
  }

  private renderStichmitte(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    mitteX: number,
    mitteY: number,
    breite: number,
    hoehe: number
  ): void {
    const slotPositionen = stichSlotPositionen(mitteX, mitteY, breite, hoehe);
    const kgroesse = berechneKartenGroesse(breite);

    ebene.add(this.add.text(mitteX, mitteY - Math.round(hoehe * 0.222), modell.aktuellerSpieler ? `Am Zug: ${this.nameFuerPosition(modell, modell.aktuellerSpieler)}` : 'Warte auf den naechsten Zug', {
      color: '#f8f9fa',
      fontSize: `${Math.round(Math.max(16, breite * 0.016))}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (modell.aktuelleStichmitte.length === 0) {
      ebene.add(this.add.text(mitteX, mitteY, 'Noch keine Karte im laufenden Stich', {
        color: '#d8f3dc',
        fontSize: `${Math.round(Math.max(14, breite * 0.014))}px`,
        align: 'center'
      }).setOrigin(0.5));
      return;
    }

    modell.aktuelleStichmitte.forEach((eintrag) => {
      const slot = slotPositionen[eintrag.position];
      ebene.add(this.add.image(slot.x, slot.y, texturSchluesselFuerKarte(eintrag.karte.farbe, eintrag.karte.wert)).setDisplaySize(kgroesse.w, kgroesse.h));
      ebene.add(this.add.text(slot.x, slot.y + Math.round(kgroesse.h * 0.63), eintrag.name, {
        color: '#d8f3dc',
        fontSize: `${Math.round(Math.max(11, breite * 0.011))}px`
      }).setOrigin(0.5));
    });
  }


  private aktualisiereAktionsbereich(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.aktionsHinweis || !this.aktionsInhalt) {
      return;
    }

    const aktionenDeaktiviert = zustand.wirdGeladen || this.spielzugAnimationAktiv;
    this.aktionsHinweis.textContent = this.bestimmeAktionsHinweis(modell, zustand);
    this.aktionsInhalt.innerHTML = '';

    if (!zustand.partieStand?.laufendesSpiel) {
      this.aktionsInhalt.append(this.erstelleInfoSektion('Sobald die Partie laeuft, erscheinen hier deine phasenabhaengigen Aktionen.'));
      return;
    }

    const istEigenerZug = modell.aktuellerSpieler === 'SUED';
    if (istEigenerZug && modell.moeglicheVorbehalte.length > 0) {
      this.aktionsInhalt.append(this.erstelleVorbehaltSektion(modell.moeglicheVorbehalte, aktionenDeaktiviert));
    }

    if (istEigenerZug && modell.moeglicheAnsagen.length > 0) {
      this.aktionsInhalt.append(this.erstelleAnsageSektion(modell.moeglicheAnsagen, aktionenDeaktiviert));
    }

    if (istEigenerZug && modell.armutAktion) {
      this.aktionsInhalt.append(this.erstelleArmutSektion(modell, aktionenDeaktiviert));
    }

    if (this.aktionsInhalt.childElementCount === 0) {
      const text = istEigenerZug && modell.phase === 'STICHPHASE'
        ? 'Spiele eine der hervorgehobenen Karten aus deiner Hand.'
        : 'Aktuell wartet das Spiel auf andere Spieler oder auf den naechsten serverseitigen Statuswechsel.';
      this.aktionsInhalt.append(this.erstelleInfoSektion(text));
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
          <strong>${eintrag.name}</strong>
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
          <strong>${eintrag.name}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte} Punkte</span>
        </div>
      `;
      this.seitenladePunktestandListe?.append(li);
    });
  }

  private aktualisiereErgebnis(modell: TischAnsichtModell): void {
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
        <span>Re: ${ergebnis.sonderpunkteRe.length > 0 ? ergebnis.sonderpunkteRe.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
        <span>Kontra: ${ergebnis.sonderpunkteKontra.length > 0 ? ergebnis.sonderpunkteKontra.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
      </div>
    `;
    const punkteListe = document.createElement('ul');
    punkteListe.className = 'ui-list ui-list--dense';
    ergebnis.spielpunkte.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
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

  private aktualisiereLetzteStiche(modell: TischAnsichtModell): void {
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

  private aktualisiereToasts(zustand: AppZustand): void {
    if (!this.toastStack) {
      return;
    }
    this.toastStack.innerHTML = '';
    if (!zustand.meldung) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `ui-toast ${zustand.meldung.typ === 'fehler' ? 'ui-toast--error' : ''}`;
    toast.innerHTML = `
      <strong>${zustand.meldung.typ === 'fehler' ? 'Fehler' : 'Info'}</strong>
      <div>${zustand.meldung.text}</div>
    `;
    this.toastStack.append(toast);
  }

  private renderKartenFaecher(
    ebene: Phaser.GameObjects.Container,
    layout: TischLayout,
    spieler: TischAnsichtModell['spieler'][number],
    modell: TischAnsichtModell
  ): void {
    const position = layout[spieler.position];
    const offen = spieler.istSelbst || (modell.debugModus && spieler.sichtbareHandkarten.length > 0);
    const sichtbareHandkarten = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
    const kartenAnzahl = sichtbareHandkarten?.length ?? Math.max(spieler.verbleibendeKarten, 0);
    const armutKarten = spieler.istSelbst ? this.ermittleArmutAuswahl(modell, sichtbareHandkarten ?? []) : null;
    const hatInteraktion = spieler.istSelbst && (modell.spielbareKarten.length > 0 || armutKarten !== null);

    const { width: szBreite, height: szHoehe } = this.scale.gameSize;
    const kgroesse = berechneKartenGroesse(szBreite);
    const kartenAbstand = berechneKartenAbstand(szBreite, szHoehe);
    const auswahlVersatz = Math.round(kgroesse.h * 0.19);  // ≈ 24 bei Kartenhöhe 124

    for (let index = 0; index < kartenAnzahl; index += 1) {
      const abstand = spieler.position === 'SUED' || spieler.position === 'NORD'
        ? index * kartenAbstand.horizontal
        : index * kartenAbstand.vertikal;
      const x = (spieler.position === 'SUED' || spieler.position === 'NORD') ? position.kartenX + abstand : position.kartenX;
      const y = (spieler.position === 'SUED' || spieler.position === 'NORD') ? position.kartenY : position.kartenY + abstand;
      const winkel = spieler.position === 'SUED'
        ? -12 + index * 3
        : spieler.position === 'NORD'
          ? 12 - index * 3
          : position.kartenWinkel;
      const karte = sichtbareHandkarten?.[index];
      const istSpielbar = karte ? modell.spielbareKarten.includes(karte.id) : false;
      const istArmutauswahl = karte ? (armutKarten?.has(karte.id) ?? false) : false;
      const istInteraktiv = !this.spielzugAnimationAktiv && (istSpielbar || istArmutauswahl);
      const istAusgewaehlt = karte ? this.ausgewaehlteArmutKarten.has(karte.id) : false;
      // Kartenspezifische Textur fuer aufgedeckte Karten, Rueckseite fuer verdeckte
      const textur = (offen && karte)
        ? texturSchluesselFuerKarte(karte.farbe, karte.wert)
        : offen ? TEXTUR_KARTE_OFFEN : TEXTUR_KARTE_VERDECKT;
      const basisVersatz = istAusgewaehlt ? -auswahlVersatz : 0;

      // Waehrend der Austeilen-Animation werden Karten unsichtbar gerendert (die Animation zeigt sie)
      const alphaWert = this.austeilenAktiv
        ? 0
        : (offen ? (hatInteraktion && karte && !istInteraktiv ? 0.5 : 1) : 0.92);
      const bild = this.add.image(x, y + basisVersatz, textur)
        .setDisplaySize(kgroesse.w, kgroesse.h)
        .setAngle(winkel)
        .setAlpha(alphaWert);
      if (istAusgewaehlt) {
        bild.setTint(0xffe082);
      }
      ebene.add(bild);

      if (karte) {
        this.handKartenobjekte.set(karte.id, { bild });
      }

      if (offen && karte && istInteraktiv) {
        const setzeOffset = (zusatz: number): void => {
          bild.setY(y + basisVersatz + zusatz);
        };
        bild.setInteractive({ useHandCursor: true });
        // Hover-Versatz skaliert mit Kartengrösse
        const hoverVersatz = Math.round(kgroesse.h * 0.08);  // ≈ 10 bei Kartenhöhe 124
        bild.on('pointerover', () => setzeOffset(-hoverVersatz));
        bild.on('pointerout', () => setzeOffset(0));
        bild.on('pointerdown', () => {
          if (istSpielbar) {
            void this.spieleKarteMitAnimation(karte.id, modell);
            return;
          }
          this.toggleArmutKarte(karte.id, modell.armutAktion?.kartenAnzahl ?? 0);
          this.renderTisch(this.letzterZustand ?? appStore.snapshot());
          this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
        });
      }
    }
  }

  private erstelleVorbehaltSektion(vorbehalte: VorbehaltAnsage[], deaktiviert: boolean): HTMLElement {
    const sektion = this.erstelleSektion('Vorbehalt waehlen', 'Nur serverseitig erlaubte Optionen sind sichtbar.');
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    vorbehalte.forEach((vorbehalt) => {
      buttonReihe.append(this.erstelleButton(formatiereVorbehalt(vorbehalt), () => appStore.meldeVorbehalt(vorbehalt), deaktiviert));
    });
    sektion.append(buttonReihe);
    return sektion;
  }

  private erstelleAnsageSektion(ansagen: Ansage[], deaktiviert: boolean): HTMLElement {
    const sektion = this.erstelleSektion('Ansagen', 'Ansagen verschwinden automatisch, sobald sie nicht mehr regelkonform sind.');
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    ansagen.forEach((ansage) => {
      buttonReihe.append(this.erstelleButton(formatiereAnsage(ansage), () => appStore.sageAnsageAn(ansage), deaktiviert));
    });
    sektion.append(buttonReihe);
    return sektion;
  }

  private erstelleArmutSektion(modell: TischAnsichtModell, deaktiviert: boolean): HTMLElement {
    const armutAktion = modell.armutAktion;
    if (!armutAktion) {
      return this.erstelleInfoSektion('Keine aktive Armut-Aktion vorhanden.');
    }

    if (armutAktion.modus === 'ANBIETEN') {
      const sektion = this.erstelleSektion(
        'Armut anbieten',
        `Waehle genau ${armutAktion.kartenAnzahl} Trumpfkarte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} und bestaetige das Angebot.`
      );
      sektion.append(this.erstelleAuswahlHinweis(armutAktion.kartenAnzahl));
      sektion.append(this.erstelleButton(
        'Trumpfkarten anbieten',
        () => this.bestaetigeArmut(modell),
        deaktiviert || this.ausgewaehlteArmutKarten.size !== armutAktion.kartenAnzahl
      ));
      return sektion;
    }

    const sektion = this.erstelleSektion(
      `Armut von ${armutAktion.armutSpielerName}`,
      `Bei Annahme gibst du ${armutAktion.kartenAnzahl} Karte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} zurueck.`
    );
    if (!this.armutAnnahmeAktiv) {
      const buttonReihe = document.createElement('div');
      buttonReihe.className = 'ui-action-row';
      buttonReihe.append(this.erstelleButton('Annehmen', () => {
        if (armutAktion.kartenAnzahl === 0) {
          appStore.beantworteArmut(true, []);
          return;
        }
        this.armutAnnahmeAktiv = true;
        this.ausgewaehlteArmutKarten.clear();
        this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
        this.renderTisch(this.letzterZustand ?? appStore.snapshot());
      }, deaktiviert));
      buttonReihe.append(this.erstelleButton('Ablehnen', () => {
        this.armutAnnahmeAktiv = false;
        this.ausgewaehlteArmutKarten.clear();
        appStore.beantworteArmut(false, []);
      }, deaktiviert, 'ui-button--secondary'));
      sektion.append(buttonReihe);
      return sektion;
    }

    sektion.append(this.erstelleAuswahlHinweis(armutAktion.kartenAnzahl));
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    buttonReihe.append(this.erstelleButton(
      'Annahme bestaetigen',
      () => this.bestaetigeArmut(modell),
      deaktiviert || this.ausgewaehlteArmutKarten.size !== armutAktion.kartenAnzahl
    ));
    buttonReihe.append(this.erstelleButton('Abbrechen', () => {
      this.armutAnnahmeAktiv = false;
      this.ausgewaehlteArmutKarten.clear();
      this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
      this.renderTisch(this.letzterZustand ?? appStore.snapshot());
    }, deaktiviert, 'ui-button--secondary'));
    sektion.append(buttonReihe);
    return sektion;
  }

  private bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) {
      return;
    }
    appStore.beantworteArmut(true, Array.from(this.ausgewaehlteArmutKarten));
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const armutAktion = modell.armutAktion;
    if (!armutAktion || modell.aktuellerSpieler !== 'SUED') {
      return null;
    }
    if (armutAktion.modus === 'ANTWORTEN' && !this.armutAnnahmeAktiv) {
      return null;
    }
    const ids = armutAktion.modus === 'ANBIETEN'
      ? handkarten.filter((karte) => istTrumpfFuerSpieltyp(karte, modell.spieltyp)).map((karte) => karte.id)
      : handkarten.map((karte) => karte.id);
    return new Set(ids);
  }

  private synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== 'SUED') {
      this.armutAnnahmeAktiv = false;
      this.ausgewaehlteArmutKarten.clear();
      return;
    }

    if (modell.armutAktion.modus === 'ANBIETEN') {
      this.armutAnnahmeAktiv = false;
    }

    const eigeneHand = modell.spieler.find((spieler) => spieler.istSelbst)?.sichtbareHandkarten ?? [];
    const sichtbareIds = new Set(eigeneHand.map((karte) => karte.id));
    this.ausgewaehlteArmutKarten = new Set(
      [...this.ausgewaehlteArmutKarten].filter((karteId) => sichtbareIds.has(karteId)).slice(0, modell.armutAktion.kartenAnzahl)
    );
  }

  private toggleArmutKarte(karteId: string, maximum: number): void {
    if (maximum <= 0) {
      return;
    }
    if (this.ausgewaehlteArmutKarten.has(karteId)) {
      this.ausgewaehlteArmutKarten.delete(karteId);
      return;
    }
    if (this.ausgewaehlteArmutKarten.size >= maximum) {
      return;
    }
    this.ausgewaehlteArmutKarten.add(karteId);
  }

  private bestimmeAktionsHinweis(modell: TischAnsichtModell, zustand: AppZustand): string {
    if (this.spielzugAnimationAktiv) {
      return 'Deine Karte wird gerade ausgespielt. Warte kurz auf den serverseitigen Folgezustand.';
    }
    if (!zustand.partieStand?.laufendesSpiel) {
      return 'Noch keine laufende Partie.';
    }
    if (modell.aktuellerSpieler === 'SUED') {
      if (modell.phase === 'STICHPHASE') {
        return 'Du bist dran. Spiel eine serverseitig erlaubte Karte oder taetige eine Ansage.';
      }
      if (modell.phase === 'VORBEHALT_ANSAGE') {
        return 'Du bist an der Reihe, einen Vorbehalt zu melden.';
      }
      if (modell.phase === 'ARMUT_TAUSCH') {
        return 'Die Armutphase wartet auf deine Auswahl.';
      }
      return 'Die aktuelle Phase erwartet eine Aktion von dir.';
    }
    return modell.aktuellerSpieler
      ? `Aktuell ist ${this.nameFuerPosition(modell, modell.aktuellerSpieler)} dran.`
      : 'Warte auf den serverseitigen Phasenwechsel.';
  }

  private erstelleModell(zustand: AppZustand): TischAnsichtModell {
    return erstelleTischAnsichtAusStatus(
      zustand.spieler?.spielerId ?? null,
      zustand.aktuellerTisch,
      zustand.partieStand,
      zustand.debugModus
    );
  }

  private synchronisiereAnimationszustand(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.wartendeKartenId) {
      return;
    }
    const eigeneSichtbareHand = modell.spieler.find((spieler) => spieler.istSelbst)?.sichtbareHandkarten ?? [];
    const karteLiegtInHand = eigeneSichtbareHand.some((karte) => karte.id === this.wartendeKartenId);
    const karteLiegtImStich = modell.aktuelleStichmitte.some((eintrag) => eintrag.karte.id === this.wartendeKartenId);
    if (!karteLiegtInHand || karteLiegtImStich || zustand.meldung?.typ === 'fehler') {
      this.spielzugAnimationAktiv = false;
      this.wartendeKartenId = null;
    }
  }

  private async spieleKarteMitAnimation(karteId: string, modell: TischAnsichtModell): Promise<void> {
    Logger.szene('Karte angeklickt', { karte: karteId });
    if (this.spielzugAnimationAktiv) {
      return;
    }
    const kartenobjekte = this.handKartenobjekte.get(karteId);
    if (!kartenobjekte) {
      appStore.spieleKarte(karteId);
      return;
    }

    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const ziel = stichSlotPositionen(breite / 2, hoehe / 2, breite, hoehe).SUED;
    this.spielzugAnimationAktiv = true;
    this.wartendeKartenId = karteId;
    this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
    await this.animationen?.animiereKarteAusspielen(kartenobjekte, ziel);
    appStore.spieleKarte(karteId);
  }

  private async starteFolgeanimationen(vorherigesModell: TischAnsichtModell | null, aktuellesModell: TischAnsichtModell): Promise<void> {
    const abgeschlossenerStich = this.ermittleNeuAbgeschlossenenStich(vorherigesModell, aktuellesModell);
    if (!abgeschlossenerStich) {
      return;
    }

    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const slotPositionen = stichSlotPositionen(breite / 2, hoehe / 2, breite, hoehe);
    const layout = berechneLayout(breite, hoehe);
    const ziel = layout[abgeschlossenerStich.gewinnerPosition];
    const kgroesse = berechneKartenGroesse(breite);
    const animierteKarten = abgeschlossenerStich.gespielteKarten.map((karte) => {
      const slot = slotPositionen[karte.position];
      const bild = this.add.image(slot.x, slot.y, texturSchluesselFuerKarte(karte.karte.farbe, karte.karte.wert)).setDisplaySize(kgroesse.w, kgroesse.h);
      return { bild };
    });

    try {
      await this.animationen?.animiereStichEinziehen(animierteKarten, { x: ziel.x, y: ziel.y });
    } finally {
      animierteKarten.forEach((karte) => {
        karte.bild.destroy();
      });
    }
  }

  // Erkennt ob ein neues Spiel begonnen hat (andere spielNummer als zuvor)
  private ermittleNeuesSpiel(vorherigerZustand: AppZustand | undefined, aktuellerZustand: AppZustand): boolean {
    if (!vorherigerZustand) {
      return false;
    }
    const aktuelleNummer = aktuellerZustand.partieStand?.laufendesSpiel?.spielNummer;
    if (!aktuelleNummer) {
      return false;
    }
    const vorherigeNummer = vorherigerZustand.partieStand?.laufendesSpiel?.spielNummer;
    return vorherigeNummer !== aktuelleNummer;
  }

  // Animiert das Austeilen der Karten: temporaere Bilder gleiten von der Tischmitte zu den Haenden
  private async starteAusteilen(modell: TischAnsichtModell, zustand: AppZustand): Promise<void> {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const start = { x: breite / 2, y: hoehe / 2 };

    // Karten-Pakete fuer alle Spieler aufbauen: Startposition (Mitte) und Zielposition (Hand)
    const pakete: Array<{ kartenobjekte: AnimierbareKartenobjekte; ziel: { x: number; y: number } }> = [];
    for (const spieler of modell.spieler) {
      const pos = layout[spieler.position];
      const sichtbareHandkarten = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
      const kartenAnzahl = sichtbareHandkarten?.length ?? Math.max(spieler.verbleibendeKarten, 0);

      const kgroesse = berechneKartenGroesse(breite);
      const kartenAbstand = berechneKartenAbstand(breite, hoehe);

      for (let index = 0; index < kartenAnzahl; index += 1) {
        const abstand = (spieler.position === 'SUED' || spieler.position === 'NORD')
          ? index * kartenAbstand.horizontal
          : index * kartenAbstand.vertikal;
        const zielX = (spieler.position === 'SUED' || spieler.position === 'NORD') ? pos.kartenX + abstand : pos.kartenX;
        const zielY = (spieler.position === 'SUED' || spieler.position === 'NORD') ? pos.kartenY : pos.kartenY + abstand;
        const winkel = spieler.position === 'SUED'
          ? -12 + index * 3
          : spieler.position === 'NORD'
            ? 12 - index * 3
            : pos.kartenWinkel;

        // Eigene Karten offen austeilen, gegnerische Karten verdeckt
        const karte = sichtbareHandkarten?.[index];
        const textur = (spieler.istSelbst && karte)
          ? texturSchluesselFuerKarte(karte.farbe, karte.wert)
          : TEXTUR_KARTE_VERDECKT;

        const bild = this.add.image(start.x, start.y, textur)
          .setDisplaySize(kgroesse.w, kgroesse.h)
          .setAngle(winkel);
        pakete.push({ kartenobjekte: { bild }, ziel: { x: zielX, y: zielY } });
      }
    }

    try {
      await this.animationen?.animiereKartenAusteilen(pakete);
    } finally {
      // Temporaere Bilder entfernen und echte Karten sichtbar rendern
      pakete.forEach((paket) => paket.kartenobjekte.bild.destroy());
      this.austeilenAktiv = false;
      this.renderTisch(this.letzterZustand ?? zustand);
    }
  }

  private ermittleNeuAbgeschlossenenStich(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): TischAnsichtModell['letzteAbgeschlosseneStiche'][number] | null {
    if (!vorherigesModell || vorherigesModell.aktuelleStichmitte.length !== 4 || aktuellesModell.aktuelleStichmitte.length > 0) {
      return null;
    }
    const letzterVorher = vorherigesModell.letzteAbgeschlosseneStiche.at(-1);
    const letzterAktuell = aktuellesModell.letzteAbgeschlosseneStiche.at(-1);
    if (!letzterAktuell) {
      return null;
    }
    if (letzterVorher
      && letzterVorher.spielNummer === letzterAktuell.spielNummer
      && letzterVorher.stichNummer === letzterAktuell.stichNummer) {
      return null;
    }
    return letzterAktuell;
  }

  private nameFuerPosition(modell: TischAnsichtModell, position: SpielerPosition): string {
    return modell.spieler.find((spieler) => spieler.position === position)?.name ?? position;
  }

  // Erkennt neue Ansagen im Vergleich zum vorherigen Modell-Snapshot
  private ermittleNeueAnsagen(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): AnsageAnsicht[] {
    if (!vorherigesModell) {
      return [];
    }
    const anzahlVorher = vorherigesModell.ansageHistorie.length;
    if (aktuellesModell.ansageHistorie.length <= anzahlVorher) {
      return [];
    }
    return aktuellesModell.ansageHistorie.slice(anzahlVorher);
  }

  // Zeigt fuer jede neue Ansage ein Pop-up-Banner mit Spielername und Ansagetext (Fade-In/Out)
  private async starteAnsageBannerAnimationen(neueAnsagen: AnsageAnsicht[]): Promise<void> {
    for (const ansage of neueAnsagen) {
      const breite = this.scale.gameSize.width;
      const hoehe = this.scale.gameSize.height;
      const bannerText = `${ansage.name}\n${formatiereAnsage(ansage.ansage)}`;
      // Re-Ansagen in Gold, Kontra in Blau (Design-System: --farbe-gold / --farbe-blau)
      const textFarbe = ansage.ansage === 'RE' ? '#ffd166'
        : ansage.ansage === 'KONTRA' ? '#90caf9'
        : '#ffffff';
      await this.animationen?.animiereAnsageBanner(
        bannerText,
        { x: breite / 2, y: hoehe / 2 },
        undefined,
        textFarbe
      );
    }
  }

  // Erkennt neue Sonderpunkte (Fuchs gefangen, Karlchen, Doppelkopf) anhand eines neuen Spielergebnisses
  private ermittleNeueSonderpunkte(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): string[] {
    const neuesErgebnis = aktuellesModell.letztesSpielergebnis;
    if (!neuesErgebnis) {
      return [];
    }
    const vorherigeNummer = vorherigesModell?.letztesSpielergebnis?.spielNummer;
    if (vorherigeNummer === neuesErgebnis.spielNummer) {
      return [];
    }
    const sonderpunkte: string[] = [];
    for (const sp of neuesErgebnis.sonderpunkteRe) {
      sonderpunkte.push(`Re: ${formatiereSonderpunkt(sp)}`);
    }
    for (const sp of neuesErgebnis.sonderpunkteKontra) {
      sonderpunkte.push(`Kontra: ${formatiereSonderpunkt(sp)}`);
    }
    return sonderpunkte;
  }

  // Zeigt fuer jeden neuen Sonderpunkt kurzes goldenes Feedback-Banner (Fade-In/Out, nicht blockierend)
  private async starteSonderpunktFeedbackAnimationen(sonderpunkte: string[]): Promise<void> {
    for (const sonderpunkt of sonderpunkte) {
      const breite = this.scale.gameSize.width;
      const hoehe = this.scale.gameSize.height;
      await this.animationen?.animiereSonderpunktFeedback(
        sonderpunkt,
        { x: breite / 2, y: hoehe / 2 }
      );
    }
  }

  // Erkennt ob ein neues Spielergebnis eingetroffen ist (andere spielNummer als zuvor)
  private erkennteNeuesSpielErgebnis(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): boolean {
    const neues = aktuellesModell.letztesSpielergebnis;
    if (!neues) {
      return false;
    }
    return vorherigesModell?.letztesSpielergebnis?.spielNummer !== neues.spielNummer;
  }

  // Zeigt das Rundenende-Modal mit Augen, Sonderpunkten und Spielpunkten pro Spieler
  private zeigeRundenEndeModal(ergebnis: LetztesSpielergebnisAnsicht): void {
    if (!this.rundenEndeModal) {
      return;
    }
    const dialog = document.createElement('div');
    dialog.className = 'ui-modal';

    const titel = document.createElement('h2');
    titel.textContent = `Spiel ${ergebnis.spielNummer} · ${ergebnis.spieltyp}`;

    const untertitel = document.createElement('span');
    untertitel.className = 'ui-hint';
    untertitel.textContent = `Sieger: ${ergebnis.siegerPartei} · Spielwert ${ergebnis.spielwert}`;

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
        <span>Re: ${ergebnis.sonderpunkteRe.length > 0 ? ergebnis.sonderpunkteRe.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
        <span>Kontra: ${ergebnis.sonderpunkteKontra.length > 0 ? ergebnis.sonderpunkteKontra.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
      </div>
    `;

    const punkteListe = document.createElement('ul');
    punkteListe.className = 'ui-list ui-list--dense';
    ergebnis.spielpunkte.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte} Spielpunkte</span>
        </div>
      `;
      punkteListe.append(li);
    });

    const schliessenButton = this.erstelleButton('OK · Weiter', () => this.schliesseRundenEndeModal(), false);

    dialog.append(titel, untertitel, augen, sonderpunkte, punkteListe, schliessenButton);
    this.rundenEndeModal.innerHTML = '';
    this.rundenEndeModal.append(dialog);
    this.rundenEndeModal.hidden = false;

    // Backdrop-Klick schliesst Modal (Klick auf Dialog-Inhalt selbst schliesst nicht)
    this.backdropClickHandler = (event: MouseEvent) => {
      if (event.target === this.rundenEndeModal) {
        this.schliesseRundenEndeModal();
      }
    };
    this.rundenEndeModal.addEventListener('click', this.backdropClickHandler);

    // Escape-Taste schliesst Modal; Handler wird beim Schliessen entfernt
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.schliesseRundenEndeModal();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  // Schliesst das Rundenende-Modal (OK-Button, Escape-Taste oder Backdrop-Klick)
  private schliesseRundenEndeModal(): void {
    if (!this.rundenEndeModal) {
      return;
    }
    this.rundenEndeModal.hidden = true;
    this.rundenEndeModal.innerHTML = '';
    // Listener entfernen, damit sie nicht mehrfach ausgeloest werden koennen
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = undefined;
    }
    if (this.backdropClickHandler && this.rundenEndeModal) {
      this.rundenEndeModal.removeEventListener('click', this.backdropClickHandler);
      this.backdropClickHandler = undefined;
    }
  }

  // Zeigt das Partie-Ende-Modal mit Gesamtpunktestand und Countdown fuer automatischen Neustart
  private zeigePartieEndeModal(modell: TischAnsichtModell): void {
    if (!this.partieEndeModal) {
      return;
    }
    const COUNTDOWN_SEKUNDEN = 10;
    const dialog = document.createElement('div');
    dialog.className = 'ui-modal';

    const titel = document.createElement('h2');
    titel.textContent = 'Partie beendet!';

    const gesamtstandTitel = document.createElement('strong');
    gesamtstandTitel.textContent = 'Gesamtpunktestand';

    const gesamtstandListe = document.createElement('ul');
    gesamtstandListe.className = 'ui-list ui-list--dense';
    const sortiertePunkte = [...modell.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte);
    sortiertePunkte.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte} Punkte</span>
        </div>
      `;
      gesamtstandListe.append(li);
    });

    const countdownSpan = document.createElement('span');
    countdownSpan.className = 'ui-hint';
    countdownSpan.textContent = `Neue Partie startet in ${COUNTDOWN_SEKUNDEN} Sekunden ...`;

    const aktionenReihe = document.createElement('div');
    aktionenReihe.className = 'ui-action-row';

    const neuePartieButton = this.erstelleButton('Jetzt starten', () => {
      this.schliessePartieEndeModal();
      void appStore.starteNeuePartie();
    }, false);

    const verlassenButton = this.erstelleButton('Tisch verlassen', () => {
      this.schliessePartieEndeModal();
      void appStore.verlasseAktuellenTisch();
    }, true);
    verlassenButton.classList.add('ui-button--secondary');

    aktionenReihe.append(neuePartieButton, verlassenButton);
    dialog.append(titel, gesamtstandTitel, gesamtstandListe, countdownSpan, aktionenReihe);
    this.partieEndeModal.innerHTML = '';
    this.partieEndeModal.append(dialog);
    this.partieEndeModal.hidden = false;

    // Countdown: aktualisiert den Text jede Sekunde und startet neue Partie nach Ablauf
    let verbleibendeZeit = COUNTDOWN_SEKUNDEN;
    this.countdownTimerId = setInterval(() => {
      verbleibendeZeit -= 1;
      if (verbleibendeZeit <= 0) {
        this.schliessePartieEndeModal();
        void appStore.starteNeuePartie();
      } else {
        countdownSpan.textContent = `Neue Partie startet in ${verbleibendeZeit} Sekunden ...`;
      }
    }, 1000);
  }

  // Schliesst das Partie-Ende-Modal und bricht den Countdown ab
  private schliessePartieEndeModal(): void {
    if (this.countdownTimerId !== undefined) {
      clearInterval(this.countdownTimerId);
      this.countdownTimerId = undefined;
    }
    if (!this.partieEndeModal) {
      return;
    }
    this.partieEndeModal.hidden = true;
    this.partieEndeModal.innerHTML = '';
  }

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

  private erstelleAuswahlHinweis(erwarteteAnzahl: number): HTMLDivElement {
    const auswahl = document.createElement('div');
    auswahl.className = 'ui-selection';
    const ids = Array.from(this.ausgewaehlteArmutKarten);
    auswahl.textContent = ids.length > 0
      ? `Ausgewaehlt (${ids.length}/${erwarteteAnzahl}): ${ids.join(', ')}`
      : `Ausgewaehlt (0/${erwarteteAnzahl}): noch keine Karten.`;
    return auswahl;
  }

  private erstelleButton(
    text: string,
    handler: () => void,
    deaktiviert: boolean,
    klasse = ''
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ['ui-button', klasse].filter(Boolean).join(' ');
    button.textContent = text;
    button.disabled = deaktiviert;
    button.addEventListener('click', handler);
    return button;
  }

  private erstelleListenHinweis(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'ui-list-item ui-list-item--dense';
    li.innerHTML = `<span class="ui-hint">${text}</span>`;
    return li;
  }


  private handleResize(): void {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    this.hintergrund?.setPosition(breite / 2, hoehe / 2).setSize(breite, hoehe);
    if (this.letzterZustand?.bereich === 'TISCH') {
      this.renderTisch(this.letzterZustand);
    }
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
      this.escapeHandler = undefined;
    }
    if (this.backdropClickHandler && this.rundenEndeModal) {
      this.rundenEndeModal.removeEventListener('click', this.backdropClickHandler);
      this.backdropClickHandler = undefined;
    }
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    this.animationen?.abbrechen();
    this.animationen = undefined;
    this.tischEbene?.destroy(true);
    this.tischEbene = undefined;
    this.hintergrund?.destroy();
    this.hintergrund = undefined;
    this.letzterZustand = undefined;
    this.letztesModell = null;
    this.handKartenobjekte.clear();
    this.spielzugAnimationAktiv = false;
    this.wartendeKartenId = null;
    this.ausgewaehlteArmutKarten.clear();
    this.armutAnnahmeAktiv = false;
    this.letzteSticheOffen = false;
    this.seitenladeOffen = false;
    // UI-Root leeren (entfernt Top-Bar, Seitenlade, Overlay, Modals)
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
    this.aktionsHinweis = undefined;
    this.aktionsInhalt = undefined;
    this.ergebnisInhalt = undefined;
    this.tischhintergrundSelect = undefined;
    this.kiSchwierigkeitSelect = undefined;
    this.geschwindigkeitsButton = undefined;
    this.toastStack = undefined;
    this.schliessePartieEndeModal();
    this.partieEndeModal = undefined;
    this.rundenEndeModal = undefined;
  }
}
