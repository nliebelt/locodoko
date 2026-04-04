import Phaser from 'phaser';

import {
  TEXTUR_BLAU_GRAFIK,
  TEXTUR_FILZ,
  TEXTUR_HOLZ_DUNKEL,
  ladeKartenBilderVorab
} from '../assets/AssetLoader';
import { Kartenansicht } from '../assets/Kartenansicht';
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import {
  erstelleTischAnsichtAusStatus,
  istTrumpfFuerSpieltyp,
  type AbgeschlossenerStichAnsicht,
  type AnsageAnsicht,
  type LetztesSpielergebnisAnsicht,
  type TischAnsichtModell,
  type SpielerPosition
} from '../model/TischAnsichtModell';
import type { Ansage, KarteAntwort, KiSchwierigkeit, Sonderpunkt, Tischhintergrund, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

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
    SOLO_TRUMPF: 'Karosolo',
    SOLO_TRUMPF_HERZ: 'Herzsolo',
    SOLO_TRUMPF_PIK: 'Piksolo',
    SOLO_TRUMPF_KREUZ: 'Kreuzsolo',
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

// Berechnet die Nameplate-Position fuer jeden Spieler so, dass keine Ueberlappung mit dem Kartenfaecher entsteht.
// SUED/NORD: rechts vom horizontalen Kartenfaecher. WEST: unterhalb des vertikalen Kartenstapels.
// OST: oberhalb des vertikalen Kartenstapels.
function nameplatePositionFuer(
  spielerPosition: SpielerPosition,
  breite: number,
  hoehe: number
): { x: number; y: number } {
  switch (spielerPosition) {
    case 'NORD': return { x: breite * 0.12, y: hoehe * 0.1 };
    case 'SUED': return { x: breite * 0.68, y: hoehe * 0.94 };
    case 'WEST': return { x: breite * 0.04, y: hoehe * 0.84 };
    case 'OST':  return { x: breite * 0.96, y: hoehe * 0.16 };
  }
}

// Stich-Stapel: Position des gestapelten Kartenf‌ächers fuer jeden Spieler.
// SUED/NORD: rechts vom Kartenfaecher. WEST: zwischen Kartenende und Nameplate. OST: zwischen Nameplate und Kartenstapel.
function stichStapelPositionFuer(position: SpielerPosition, breite: number, hoehe: number): { x: number; y: number } {
  switch (position) {
    case 'SUED': return { x: breite * 0.84, y: hoehe * 0.90 };
    case 'NORD': return { x: breite * 0.84, y: hoehe * 0.10 };
    case 'WEST': return { x: breite * 0.06, y: hoehe * 0.78 };
    case 'OST':  return { x: breite * 0.94, y: hoehe * 0.27 };
  }
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

  // (Vorbehalt, Ansage, Armut-Dialog, Aktions-Hinweis werden als Phaser-Objekte in renderTisch() gerendert)

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

  // Handler fuer globale Tastatursteuerung (wird in create() registriert, in aufraeumen() entfernt)
  private tastaturHandler?: (e: KeyboardEvent) => void;

  // Index der per Tastatur ausgewaehlten spielbaren Karte in modell.spielbareKarten (-1 = keine Auswahl)
  private tastaturKarteIndex = -1;

  // Index der aktuell per Tastatur markierten Option im Vorbehalt-Modal (0-basiert)
  private tastaturVorbehaltIndex = 0;

  // Aktuell gewaehlte Animations-Geschwindigkeit (wird in localStorage persistiert)
  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;

  // Overlay fuer "Letzter Stich" (Klick auf eigenen Stapel)
  private letzterStichOverlay?: Phaser.GameObjects.Container;

  private letzterStichTimer?: Phaser.Time.TimerEvent;

  // Referenz auf den Geschwindigkeits-Toggle-Button fuer Label-Aktualisierungen
  private geschwindigkeitsButton?: HTMLButtonElement;

  constructor() {
    super('TischSzene');
  }

  /**
   * Phaser-Lifecycle: Laedt Karten-PNG-Assets vorab.
   *
   * Wird von Phaser vor create() aufgerufen. Queued alle 24 Karten-PNGs
   * aus /assets/cards/ in den Phaser-Loader.
   */
  preload(): void {
    ladeKartenBilderVorab(this);
  }

  /**
   * Phaser-Lifecycle: Initialisiert die TischSzene.
   *
  * Erstellt Hintergrund, AnimationenService und HTML-UI, laedt die gespeicherte
  * Animationsgeschwindigkeit und abonniert den AppStore.
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
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.registriereTastaturHandler();
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
      if (zustand.bereich === 'SPIELVERWALTUNG') {
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
      void this.starteGegnerKartenAnimationen(vorherigesModell, modell);
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
    // Initialen Zustand nachziehen: sicherstellt dass renderTisch() erst nach vollstaendigem
    // create() laeuft. abonnieren() feuert sofort, aber erst hier ist die Szene vollstaendig
    // initialisiert. Falls zwischenzeitlich ein WebSocket-Snapshot eintraf, wird er jetzt
    // mit dem aktuellsten Stand gerendert.
    const aktuellerZustand = appStore.snapshot();
    this.renderTisch(aktuellerZustand, this.erstelleModell(aktuellerZustand));
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
        <button class="hud-icon-btn" type="button" title="Tisch verlassen" data-leave-top-button>&#x2190;</button>
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
    const ergebnisInhalt = seitenlade.querySelector('[data-ergebnis]');
    const lobbyButton = seitenlade.querySelector('[data-lobby-button]');
    const leaveButton = seitenlade.querySelector('[data-leave-button]');
    const startButton = topBar.querySelector('[data-start-button]');
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
    this.ergebnisInhalt = ergebnisInhalt;
    this.tischhintergrundSelect = tischhintergrundSelect;
    this.kiSchwierigkeitSelect = kiSchwierigkeitSelect;
    this.geschwindigkeitsButton = geschwindigkeitsButton;
    this.toastStack = toastStack;
    this.rundenEndeModal = rundenEndeModal;
    this.partieEndeModal = partieEndeModal;

    uiRoot.append(topBar, seitenlade, einstellungsModal, toastStack, rundenEndeModal, partieEndeModal);
  }

  private aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    // Tastatur-Kartenindex automatisch nachfuehren wenn sich der Spielzug aendert
    this.aktualisiereKartenNavigationsIndex(modell);
    this.synchronisiereAktionZustand(modell);

    // ── Top-Bar aktualisieren ─────────────────────────────────────────────────
    this.aktualisiereTopBar(modell, zustand);

    // ── Seitenlade aktualisieren ──────────────────────────────────────────────
    this.aktualisiereSeitenlade(modell, zustand);

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

    this.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      const npPos = nameplatePositionFuer(spieler.position, breite, hoehe);
      // Nameplate: rechteckig; SUED/NORD horizontal (breit, flach), WEST/OST vertikal (schmal, hoeher)
      const istHorizontal = spieler.position === 'SUED' || spieler.position === 'NORD';
      const nameplateBreite = istHorizontal ? Math.max(120, breite * 0.11) : Math.max(80, breite * 0.07);
      const nameplateHoehe = istHorizontal ? Math.max(54, hoehe * 0.075) : Math.max(80, hoehe * 0.11);
      // Aktiv-Hervorhebung: goldenes Glow-Rechteck + dicker Rahmen; sonst halbtransparentes Dunkelgruen
      const rahmenFarbe = spieler.istAktivHervorgehoben ? 0xffe082 : 0xd8f3dc;
      const rahmenStaerke = spieler.istAktivHervorgehoben ? 4 : 1;
      const hgFarbe = spieler.istAktivHervorgehoben ? 0x1a4a20 : 0x0d3d1e;
      if (spieler.istAktivHervorgehoben) {
        // Aeusserer Glow-Ring
        ebene.add(
          this.add.rectangle(npPos.x, npPos.y, nameplateBreite + 10, nameplateHoehe + 10, 0xffe082, 0.18)
        );
      }
      ebene.add(
        this.add.rectangle(npPos.x, npPos.y, nameplateBreite, nameplateHoehe, hgFarbe, 0.95)
          .setStrokeStyle(rahmenStaerke, rahmenFarbe, 0.95)
      );
      // Name (fett, oben)
      const nameSchriftGroesse = Math.round(Math.max(13, breite * 0.012));
      ebene.add(this.add.text(npPos.x, npPos.y - Math.round(nameplateHoehe * 0.28), spieler.name, {
        color: '#f8f9fa',
        fontSize: `${nameSchriftGroesse}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5));
      // Typ-Badge: [Du] / [KI] / [Mensch]
      const typLabel = spieler.istSelbst ? '[Du]' : spieler.istMensch ? '[Mensch]' : '[KI]';
      const kleinSchrift = Math.round(Math.max(10, breite * 0.009));
      ebene.add(this.add.text(npPos.x, npPos.y, typLabel, {
        color: spieler.istSelbst ? '#ffd166' : '#a3c4a8',
        fontSize: `${kleinSchrift}px`
      }).setOrigin(0.5));
      // Stiche-Zahl + Geber-Badge
      const sticheText = spieler.istGeber ? `${spieler.stiche} Stiche [G]` : `${spieler.stiche} Stiche`;
      ebene.add(this.add.text(npPos.x, npPos.y + Math.round(nameplateHoehe * 0.28), sticheText, {
        color: spieler.istGeber ? '#ffd166' : '#d8f3dc',
        fontSize: `${kleinSchrift}px`
      }).setOrigin(0.5));
      // Partei-Badge: [RE] (gold) / [KONTRA] (blau) wenn bekannt
      if (spieler.partei) {
        ebene.add(this.add.text(npPos.x, npPos.y - Math.round(nameplateHoehe * 0.58), `[${spieler.partei}]`, {
          color: spieler.partei === 'RE' ? '#ffd166' : '#90caf9',
          fontSize: `${kleinSchrift}px`,
          fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      this.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    this.renderStichStapel(ebene, modell, breite, hoehe);

    // if (modell.gesamtpunktestand.length > 0) {
    //   const punktetext = modell.gesamtpunktestand
    //     .map((eintrag) => `${eintrag.name}: ${eintrag.punkte}`)
    //     .join(' · ');
    //   ebene.add(this.add.text(mitteX, hoehe * 0.94, `Gesamtstand · ${punktetext}`, {
    //     color: '#f8f9fa',
    //     fontSize: `${Math.round(Math.max(14, breite * 0.012))}px`
    //   }).setOrigin(0.5));
    // }

    // Phaser-UI: Ansage-Buttons, Armut-Dialog (zuerst); Vorbehalt-Dialog zuletzt (liegt oben)
    if (zustand.partieStand?.laufendesSpiel) {
      this.renderAnsageButtons(ebene, modell, zustand, breite, hoehe);
      this.renderArmutBereich(ebene, modell, zustand, breite, hoehe);
      this.renderVorbehaltDialog(ebene, modell, zustand, breite, hoehe);
    }

    this.tischEbene = ebene;
  }

  private renderStichStapel(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    breite: number,
    hoehe: number
  ): void {
    const kgroesse = berechneKartenGroesse(breite);
    const stapelW = Math.round(kgroesse.w * 0.55);
    const stapelH = Math.round(kgroesse.h * 0.55);
    const versatzPx = Math.round(stapelH * 0.09); // vertikaler Versatz zwischen gestapelten Karten

    modell.spieler.forEach((spieler) => {
      if (spieler.stiche <= 0) {
        return;
      }
      const pos = stichStapelPositionFuer(spieler.position, breite, hoehe);
      const anzahlSichtbar = Math.min(4, spieler.stiche);

      for (let i = 0; i < anzahlSichtbar; i++) {
        const yVersatz = -(anzahlSichtbar - 1 - i) * versatzPx;
        ebene.add(this.erstelleKartenansicht(pos.x, pos.y + yVersatz, stapelW, stapelH, { verdeckt: true }).setAlpha(0.88));
      }

      const schriftGroesse = Math.round(Math.max(10, breite * 0.009));
      ebene.add(
        this.add.text(pos.x, pos.y + Math.round(stapelH * 0.65), `${spieler.stiche}`, {
          color: '#ffd166',
          fontSize: `${schriftGroesse}px`,
          fontStyle: 'bold',
          backgroundColor: '#0d3d1e',
          padding: { x: 3, y: 1 }
        }).setOrigin(0.5)
      );

      // Eigener Stapel ist klickbar: zeigt die 4 Karten des letzten gewonnenen Stichs
      if (spieler.istSelbst) {
        const letzterEigenerStich = modell.letzteAbgeschlosseneStiche
          .filter((s) => s.gewinnerPosition === 'SUED')
          .at(-1);
        if (letzterEigenerStich) {
          const hitBreite = stapelW + Math.round(stapelW * 0.3);
          const hitHoehe = stapelH + Math.round(stapelH * 0.3) + Math.round(stapelH * 0.65);
          const hitZone = this.add.rectangle(pos.x, pos.y, hitBreite, hitHoehe, 0xffffff, 0)
            .setInteractive({ useHandCursor: true });
          hitZone.on('pointerdown', () => {
            if (this.letzterStichOverlay) {
              this.versteckeLetztesStichOverlay();
            } else {
              this.zeigeLetztesStichOverlay(letzterEigenerStich, breite, hoehe);
            }
          });
          ebene.add(hitZone);
        }
      }
    });
  }

  /** Zeigt ein Overlay mit den 4 Karten des letzten eigenen Stichs. */
  private zeigeLetztesStichOverlay(stich: AbgeschlossenerStichAnsicht, breite: number, hoehe: number): void {
    this.versteckeLetztesStichOverlay();
    const kgroesse = berechneKartenGroesse(breite);
    const kartenAbstand = Math.round(kgroesse.w * 1.15);
    const gesamtBreite = 4 * kgroesse.w + 3 * (kartenAbstand - kgroesse.w);
    const panelBreite = Math.max(gesamtBreite + kgroesse.w, 300);
    const panelHoehe = kgroesse.h + Math.round(kgroesse.h * 0.7);
    const panelX = breite / 2;
    const panelY = hoehe / 2;

    const container = this.add.container(0, 0);

    // Halbtransparenter Hintergrund (ganzer Bildschirm zum Schliessen)
    const backdrop = this.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, 0x000000, 0.45)
      .setInteractive({ useHandCursor: false });
    backdrop.on('pointerdown', () => this.versteckeLetztesStichOverlay());
    container.add(backdrop);

    // Panel
    container.add(this.add.rectangle(panelX, panelY, panelBreite, panelHoehe, 0x0a2818, 0.97)
      .setStrokeStyle(2, 0x4adf7a, 0.7));

    // Titel
    const titelSchrift = Math.round(Math.max(12, breite * 0.011));
    container.add(this.add.text(panelX, panelY - Math.round(panelHoehe * 0.38),
      `Letzter Stich — ${stich.augen} Augen`, {
        color: '#ffd166',
        fontSize: `${titelSchrift}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5));

    // Karten in einer Reihe
    const karten = stich.gespielteKarten;
    const startX = panelX - ((karten.length - 1) * kartenAbstand) / 2;
    const kartenY = panelY + Math.round(panelHoehe * 0.05);
    karten.forEach((eintrag, index) => {
      const x = startX + index * kartenAbstand;
      container.add(this.erstelleKartenansicht(x, kartenY, kgroesse.w, kgroesse.h, { karte: eintrag.karte }));
    });

    // Hinweis-Text
    const hinweisSchrift = Math.round(Math.max(10, breite * 0.009));
    container.add(this.add.text(panelX, panelY + Math.round(panelHoehe * 0.44),
      'Klick zum Schliessen', {
        color: '#a3c4a8',
        fontSize: `${hinweisSchrift}px`
      }).setOrigin(0.5));

    this.letzterStichOverlay = container;

    // Auto-Close nach 4 Sekunden
    this.letzterStichTimer = this.time.addEvent({
      delay: 4000,
      callback: () => this.versteckeLetztesStichOverlay(),
      callbackScope: this
    });
  }

  /** Schliesst das Letzter-Stich-Overlay und bricht den Auto-Close-Timer ab. */
  private versteckeLetztesStichOverlay(): void {
    this.letzterStichTimer?.remove(false);
    this.letzterStichTimer = undefined;
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
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

    if (modell.aktuelleStichmitte.length === 0) {
      return;
    }

    modell.aktuelleStichmitte.forEach((eintrag) => {
      const slot = slotPositionen[eintrag.position];
      // Karte an der Slot-Position ihres Spielers — Position macht Zuordnung deutlich, kein Text noetig
      ebene.add(this.erstelleKartenansicht(slot.x, slot.y, kgroesse.w, kgroesse.h, { karte: eintrag.karte }));
    });
  }

  private erstelleKartenansicht(
    x: number,
    y: number,
    breite: number,
    hoehe: number,
    optionen: { karte?: { farbe: string; wert: string }; verdeckt?: boolean }
  ): Kartenansicht {
    if (optionen.karte) {
      return Kartenansicht.offen(this, x, y, optionen.karte.farbe, optionen.karte.wert, breite, hoehe);
    }
    if (optionen.verdeckt) {
      return Kartenansicht.verdeckt(this, x, y, breite, hoehe);
    }
    return Kartenansicht.leer(this, x, y, breite, hoehe);
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
          : spieler.position === 'WEST'
            ? 78 + index * 3
            : 102 - index * 3;
      const karte = sichtbareHandkarten?.[index];
      const istSpielbar = karte ? modell.spielbareKarten.includes(karte.id) : false;
      const istArmutauswahl = karte ? (armutKarten?.has(karte.id) ?? false) : false;
      const istInteraktiv = !this.spielzugAnimationAktiv && (istSpielbar || istArmutauswahl);
      const istAusgewaehlt = karte ? this.ausgewaehlteArmutKarten.has(karte.id) : false;
      // Tastatur-Markierung: die spielbare Karte am aktuellen Index ist visuell hervorgehoben
      const istTastaturMarkiert = spieler.istSelbst
        && karte !== undefined
        && this.tastaturKarteIndex >= 0
        && modell.spielbareKarten[this.tastaturKarteIndex] === karte.id;
      const basisVersatz = (istAusgewaehlt || istTastaturMarkiert) ? -auswahlVersatz : 0;
      const karteAnsicht = offen
        ? this.erstelleKartenansicht(x, y + basisVersatz, kgroesse.w, kgroesse.h, karte ? { karte } : {})
        : this.erstelleKartenansicht(x, y + basisVersatz, kgroesse.w, kgroesse.h, { verdeckt: true });

      // Waehrend der Austeilen-Animation werden Karten unsichtbar gerendert (die Animation zeigt sie)
      const alphaWert = this.austeilenAktiv
        ? 0
        : (offen ? (hatInteraktion && karte && !istInteraktiv ? 0.5 : 1) : 0.92);
      karteAnsicht
        .setAngle(winkel)
        .setAlpha(alphaWert);
      if (istAusgewaehlt) {
        karteAnsicht.markiereAuswahl(); // Armut-Auswahl: gelb
      } else if (istTastaturMarkiert) {
        karteAnsicht.markiereTastaturfokus(); // Tastatur-Selektion: weisser Rahmen
      } else {
        karteAnsicht.loescheMarkierung();
      }
      ebene.add(karteAnsicht);

      if (karte) {
        this.handKartenobjekte.set(karte.id, { wurzel: karteAnsicht, bild: karteAnsicht.bildObjekt });
      }

      if (offen && karte && istInteraktiv) {
        const setzeOffset = (zusatz: number): void => {
          karteAnsicht.setY(y + basisVersatz + zusatz);
        };
        karteAnsicht.setInteractive({ useHandCursor: true });
        // Hover-Versatz skaliert mit Kartengrösse
        const hoverVersatz = Math.round(kgroesse.h * 0.08);  // ≈ 10 bei Kartenhöhe 124
        karteAnsicht.on('pointerover', () => setzeOffset(-hoverVersatz));
        karteAnsicht.on('pointerout', () => setzeOffset(0));
        karteAnsicht.on('pointerdown', () => {
          if (istSpielbar) {
            void this.spieleKarteMitAnimation(karte.id);
            return;
          }
          this.toggleArmutKarte(karte.id, modell.armutAktion?.kartenAnzahl ?? 0);
          this.renderTisch(this.letzterZustand ?? appStore.snapshot());
        });
      }
    }
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

  private async spieleKarteMitAnimation(karteId: string): Promise<void> {
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
    const ziel = stichStapelPositionFuer(abgeschlossenerStich.gewinnerPosition, breite, hoehe);
    const kgroesse = berechneKartenGroesse(breite);
    const animierteKarten = abgeschlossenerStich.gespielteKarten.map((karte) => {
      const slot = slotPositionen[karte.position];
      const wurzel = this.erstelleKartenansicht(slot.x, slot.y, kgroesse.w, kgroesse.h, { karte: karte.karte });
      return { wurzel, bild: wurzel.bildObjekt };
    });

    // Gewinn-Flash: goldenes Overlay-Rechteck über dem Nameplate des Gewinners (startet unsichtbar)
    const gewinnerPos = abgeschlossenerStich.gewinnerPosition;
    const npPos = nameplatePositionFuer(gewinnerPos, breite, hoehe);
    const istHorizontal = gewinnerPos === 'SUED' || gewinnerPos === 'NORD';
    const flashBreite = istHorizontal ? Math.max(120, breite * 0.11) : Math.max(80, breite * 0.07);
    const flashHoehe = istHorizontal ? Math.max(54, hoehe * 0.075) : Math.max(80, hoehe * 0.11);
    const flashRechteck = this.add.rectangle(npPos.x, npPos.y, flashBreite, flashHoehe, 0xffe082, 0.7)
      .setDepth(150)
      .setAlpha(0);

    try {
      await this.animationen?.animiereStichEinziehen(animierteKarten, ziel, abgeschlossenerStich.augen, flashRechteck);
    } finally {
      animierteKarten.forEach((karte) => {
        karte.wurzel.destroy();
      });
      flashRechteck.destroy();
    }
  }

  /**
   * Animiert neu gespielte Karten fremder Spieler: verdeckte Karte gleitet von der
   * Faecher-Position des Gegners zur Stich-Slot-Position und wird dann zerstoert,
   * sodass die darunter bereits statisch gerenderte offene Karte erscheint.
   */
  private async starteGegnerKartenAnimationen(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): Promise<void> {
    if (!vorherigesModell) {
      return;
    }
    const eigeneSpielerPosition = aktuellesModell.spieler.find((s) => s.istSelbst)?.position;
    const neueGegnerKarten = aktuellesModell.aktuelleStichmitte.filter((eintrag) => {
      if (eintrag.position === eigeneSpielerPosition) return false;
      return !vorherigesModell.aktuelleStichmitte.some((v) => v.karte.id === eintrag.karte.id);
    });

    if (neueGegnerKarten.length === 0) {
      return;
    }

    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const slotPositionen = stichSlotPositionen(breite / 2, hoehe / 2, breite, hoehe);
    const kgroesse = berechneKartenGroesse(breite);

    const animationen = neueGegnerKarten.map(async (eintrag) => {
      const start = layout[eintrag.position];
      const ziel = slotPositionen[eintrag.position];
      const tempKarte = this.erstelleKartenansicht(start.kartenX, start.kartenY, kgroesse.w, kgroesse.h, { verdeckt: true });
      try {
        await this.animationen?.animiereKarteAusspielen({ wurzel: tempKarte }, ziel);
      } finally {
        tempKarte.destroy(true);
      }
    });

    await Promise.all(animationen);
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
    if (!vorherigeNummer) {
      // Kein vorheriges Spiel bekannt. Austeilen-Animation nur wenn der Tisch vorher wartete
      // (status 'WARTEND') — das signalisiert einen echten Spielstart aus dem Wartezimmer.
      // War der Tisch bereits 'IM_SPIEL' oder aktuellerTisch noch null, handelt es sich um
      // einen Reconnect nach Seitenladen; die Karten sollen sofort ohne Animation sichtbar sein.
      return vorherigerZustand.aktuellerTisch?.status === 'WARTEND';
    }
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
        const wurzel = (spieler.istSelbst && karte)
          ? this.erstelleKartenansicht(start.x, start.y, kgroesse.w, kgroesse.h, { karte })
          : this.erstelleKartenansicht(start.x, start.y, kgroesse.w, kgroesse.h, { verdeckt: true });

        wurzel.setAngle(winkel);
        pakete.push({ kartenobjekte: { wurzel, bild: wurzel.bildObjekt }, ziel: { x: zielX, y: zielY } });
      }
    }

    try {
      await this.animationen?.animiereKartenAusteilen(pakete);
    } finally {
      // Temporaere Bilder entfernen und echte Karten sichtbar rendern
      pakete.forEach((paket) => paket.kartenobjekte.wurzel.destroy());
      this.austeilenAktiv = false;
      this.renderTisch(this.letzterZustand ?? zustand);
    }
  }

  private ermittleNeuAbgeschlossenenStich(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): TischAnsichtModell['letzteAbgeschlosseneStiche'][number] | null {
    if (!vorherigesModell) {
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
          <strong>${escapeHtml(eintrag.name)}</strong>
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

    // Focus-Trap: Fokus auf ersten Button setzen (Tastatursteuerung)
    setTimeout(() => schliessenButton.focus(), 0);

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
          <strong>${escapeHtml(eintrag.name)}</strong>
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

  // ── Phaser-UI Hilfsmethoden ──────────────────────────────────────────────────

  /**
   * Erzeugt einen Phaser-Button bestehend aus einem interaktiven Rechteck und einem Text-Label.
   * Beide Objekte werden direkt der uebergebenen Ebene hinzugefuegt (kein Container-Overhead).
   * Der Handler wird nur gebunden wenn deaktiviert=false.
   */
  private erstellePhaserButton(
    ebene: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    beschriftung: string,
    handler: () => void,
    deaktiviert = false,
    sekundaer = false
  ): void {
    const hgFarbe = deaktiviert ? 0x2a2a2a : sekundaer ? 0x1a2a1a : 0x1a5a2a;
    const rahmenFarbe = deaktiviert ? 0x555555 : sekundaer ? 0x4a7a5a : 0x4adf7a;
    const textFarbe = deaktiviert ? '#888888' : '#f8f9fa';
    const schriftGroesse = `${Math.round(Math.max(12, this.scale.gameSize.width * 0.011))}px`;

    const bg = this.add.rectangle(x, y, w, h, hgFarbe, deaktiviert ? 0.5 : 0.92)
      .setStrokeStyle(1, rahmenFarbe, 0.9);
    ebene.add(bg);
    ebene.add(this.add.text(x, y, beschriftung, {
      color: textFarbe,
      fontSize: schriftGroesse,
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (!deaktiviert) {
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', handler);
    }
  }

  /**
   * Rendert das Vorbehalt-Dialog-Overlay als Phaser-Objekt (ersetzt das HTML-Modal).
   * Erscheint nur wenn der eigene Spieler in der Vorbehalt-Phase eine Auswahl treffen muss.
   * Legt sich als halbtransparenter Block ueber das gesamte Spielfeld (kein HTML-Dimm-Effekt).
   */
  private renderVorbehaltDialog(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheVorbehalte.length === 0) {
      return;
    }

    const optionen = modell.moeglicheVorbehalte;
    const btnH = Math.round(Math.max(32, hoehe * 0.048));
    const btnW = Math.round(Math.min(130, breite * 0.11));
    const abstandX = Math.round(breite * 0.008);
    const abstandY = Math.round(btnH * 0.3);
    const spalten = 2;
    const zeilen = Math.ceil(optionen.length / spalten);
    const dialogW = spalten * btnW + (spalten + 1) * abstandX;
    const titelH = Math.round(hoehe * 0.04);
    const dialogH = titelH + zeilen * (btnH + abstandY) + abstandY;
    const dialogY = Math.round(hoehe * 0.28);

    ebene.add(this.add.rectangle(breite / 2, dialogY, dialogW, dialogH, 0x0a2818, 0.97)
      .setStrokeStyle(2, 0x4adf7a, 0.7));

    ebene.add(this.add.text(breite / 2, dialogY - dialogH / 2 + Math.round(titelH * 0.5), 'Vorbehalt ansagen', {
      color: '#f8f9fa',
      fontSize: `${Math.round(Math.max(13, breite * 0.012))}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const deaktiviert = zustand.wirdGeladen || this.spielzugAnimationAktiv;
    const gridStartX = breite / 2 - btnW / 2 - abstandX / 2;
    const gridStartY = dialogY - dialogH / 2 + titelH + abstandY + btnH / 2;
    optionen.forEach((vorbehalt, index) => {
      const spalte = index % spalten;
      const zeile = Math.floor(index / spalten);
      this.erstellePhaserButton(
        ebene,
        gridStartX + spalte * (btnW + abstandX),
        gridStartY + zeile * (btnH + abstandY),
        btnW,
        btnH,
        formatiereVorbehalt(vorbehalt),
        () => appStore.meldeVorbehalt(vorbehalt),
        deaktiviert
      );
    });
  }

  /**
   * Rendert Ansage-Buttons (Re, Kontra, Keine 90 usw.) als Phaser-Objekte.
   * Erscheinen nur wenn der eigene Spieler Ansagen machen kann.
   * Positioniert zwischen Stichmitte und eigener Hand.
   */
  private renderAnsageButtons(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheAnsagen.length === 0) {
      return;
    }

    const deaktiviert = zustand.wirdGeladen || this.spielzugAnimationAktiv;
    const btnH = Math.round(Math.max(32, hoehe * 0.048));
    const btnW = Math.round(Math.min(110, breite * 0.09));
    const abstand = Math.round(breite * 0.008);
    const ansagen = modell.moeglicheAnsagen;
    const gesamtBreite = ansagen.length * (btnW + abstand) - abstand;
    const startX = breite / 2 - gesamtBreite / 2 + btnW / 2;
    const y = hoehe * 0.70;

    ansagen.forEach((ansage, index) => {
      this.erstellePhaserButton(
        ebene,
        startX + index * (btnW + abstand),
        y,
        btnW,
        btnH,
        formatiereAnsage(ansage),
        () => appStore.sageAnsageAn(ansage),
        deaktiviert
      );
    });
  }

  /**
   * Rendert Armut-Aktionsbuttons als Phaser-Objekte (ersetzt den HTML-Aktionsbereich).
   * Erscheint nur in der ARMUT_TAUSCH-Phase wenn der eigene Spieler betroffen ist.
   * Trumpfkarten-Auswahl erfolgt weiterhin per Klick auf die Phaser-Handkarten.
   */
  private renderArmutBereich(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== 'SUED') {
      return;
    }
    const armutAktion = modell.armutAktion;
    const deaktiviert = zustand.wirdGeladen || this.spielzugAnimationAktiv;
    const btnH = Math.round(Math.max(32, hoehe * 0.048));
    const y = hoehe * 0.73;

    if (armutAktion.modus === 'ANBIETEN') {
      const ausgewaehlt = this.ausgewaehlteArmutKarten.size;
      const hinweis = `Waehle ${armutAktion.kartenAnzahl} Trumpfkarte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} (${ausgewaehlt}/${armutAktion.kartenAnzahl} gewaehlt)`;
      ebene.add(this.add.text(breite / 2, y - Math.round(hoehe * 0.032), hinweis, {
        color: '#d8f3dc',
        fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`,
        align: 'center'
      }).setOrigin(0.5));
      this.erstellePhaserButton(
        ebene, breite / 2, y,
        Math.round(Math.min(200, breite * 0.17)), btnH,
        'Trumpfkarten anbieten',
        () => this.bestaetigeArmut(modell),
        deaktiviert || ausgewaehlt !== armutAktion.kartenAnzahl
      );
      return;
    }

    // ANTWORTEN: Annehmen oder Ablehnen
    if (!this.armutAnnahmeAktiv) {
      const btnW = Math.round(Math.min(130, breite * 0.11));
      const abstand = Math.round(breite * 0.012);
      this.erstellePhaserButton(
        ebene, breite / 2 - btnW / 2 - abstand / 2, y,
        btnW, btnH,
        'Annehmen',
        () => {
          if (armutAktion.kartenAnzahl === 0) {
            appStore.beantworteArmut(true, []);
            return;
          }
          this.armutAnnahmeAktiv = true;
          this.ausgewaehlteArmutKarten.clear();
          this.renderTisch(this.letzterZustand ?? appStore.snapshot());
        },
        deaktiviert
      );
      this.erstellePhaserButton(
        ebene, breite / 2 + btnW / 2 + abstand / 2, y,
        btnW, btnH,
        'Ablehnen',
        () => {
          this.armutAnnahmeAktiv = false;
          this.ausgewaehlteArmutKarten.clear();
          appStore.beantworteArmut(false, []);
        },
        deaktiviert,
        true
      );
    } else {
      const ausgewaehlt = this.ausgewaehlteArmutKarten.size;
      const hinweis = `Waehle ${armutAktion.kartenAnzahl} Karte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} zurueck (${ausgewaehlt}/${armutAktion.kartenAnzahl})`;
      ebene.add(this.add.text(breite / 2, y - Math.round(hoehe * 0.032), hinweis, {
        color: '#d8f3dc',
        fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`,
        align: 'center'
      }).setOrigin(0.5));
      const btnW = Math.round(Math.min(150, breite * 0.13));
      const abstand = Math.round(breite * 0.012);
      this.erstellePhaserButton(
        ebene, breite / 2 - btnW / 2 - abstand / 2, y,
        btnW, btnH,
        'Annahme bestaetigen',
        () => this.bestaetigeArmut(modell),
        deaktiviert || ausgewaehlt !== armutAktion.kartenAnzahl
      );
      this.erstellePhaserButton(
        ebene, breite / 2 + btnW / 2 + abstand / 2, y,
        Math.round(Math.min(100, breite * 0.085)), btnH,
        'Abbrechen',
        () => {
          this.armutAnnahmeAktiv = false;
          this.ausgewaehlteArmutKarten.clear();
          this.renderTisch(this.letzterZustand ?? appStore.snapshot());
        },
        deaktiviert,
        true
      );
    }
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


  // ── Tastatursteuerung ───────────────────────────────────────────────────────

  /** Registriert den globalen Tastatur-Handler auf document. Wird einmalig in create() aufgerufen. */
  private registriereTastaturHandler(): void {
    this.tastaturHandler = (e: KeyboardEvent) => this.verarbeiteTastatureingabe(e);
    document.addEventListener('keydown', this.tastaturHandler);
  }

  /**
   * Aktualisiert den tastaturKarteIndex wenn sich der Spielzug aendert.
   * Wird in aktualisiereUi() aufgerufen — zu diesem Zeitpunkt ist this.letztesModell noch der Vorzustand.
   * Auto-Fokus: erste spielbare Karte bei Spielzugbeginn; Deselect wenn nicht mehr am Zug.
   */
  private aktualisiereKartenNavigationsIndex(modell: TischAnsichtModell): void {
    const warEigenerZug = this.letztesModell?.aktuellerSpieler === 'SUED'
      && (this.letztesModell?.spielbareKarten.length ?? 0) > 0;
    const istEigenerZug = modell.aktuellerSpieler === 'SUED' && modell.spielbareKarten.length > 0;

    if (!warEigenerZug && istEigenerZug) {
      // Spielzug beginnt: erste spielbare Karte automatisch markieren
      this.tastaturKarteIndex = 0;
    } else if (!istEigenerZug) {
      // Kein eigener Spielzug: Markierung aufheben
      this.tastaturKarteIndex = -1;
    } else if (istEigenerZug && this.tastaturKarteIndex >= modell.spielbareKarten.length) {
      // Index sanieren falls Anzahl spielbarer Karten gesunken ist
      this.tastaturKarteIndex = modell.spielbareKarten.length - 1;
    }
  }

  /**
   * Zentraler Tastatur-Dispatcher: prueft den aktuellen Kontext (Vorbehalt-Modal offen?
   * Rundenende-Modal offen? etc.) und delegiert an den passenden Handler.
   */
  private verarbeiteTastatureingabe(e: KeyboardEvent): void {
    const modell = this.letztesModell;
    const zustand = this.letzterZustand;
    if (!modell || !zustand) {
      return;
    }

    // 1. Vorbehalt-Dialog hat absoluten Vorrang — keine anderen Shortcuts moeglich
    const vorbehaltAktiv = modell.aktuellerSpieler === 'SUED' && modell.moeglicheVorbehalte.length > 0;
    if (vorbehaltAktiv) {
      this.verarbeiteVorbehaltTaste(e, modell);
      return;
    }

    // 2. Armut-Antwort-Shortcuts (Annehmen / Ablehnen) — direkt ohne DOM-Button-Suche
    if (modell.aktuellerSpieler === 'SUED'
        && modell.armutAktion?.modus === 'ANTWORTEN'
        && !this.armutAnnahmeAktiv) {
      if (e.key === 'a' || e.key === 'A') {
        if (modell.armutAktion.kartenAnzahl === 0) {
          appStore.beantworteArmut(true, []);
        } else {
          this.armutAnnahmeAktiv = true;
          this.ausgewaehlteArmutKarten.clear();
          this.renderTisch(zustand, modell);
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        this.armutAnnahmeAktiv = false;
        this.ausgewaehlteArmutKarten.clear();
        appStore.beantworteArmut(false, []);
        e.preventDefault();
        return;
      }
    }

    // 3. Rundenende-Modal: Focus-Trap (Tab-Zirkulation) und Enter-Bestaetigung
    if (this.rundenEndeModal && !this.rundenEndeModal.hidden) {
      this.verarbeiteModalFocusTrap(e, this.rundenEndeModal);
      return;
    }

    // 4. Partie-Ende-Modal: Focus-Trap
    if (this.partieEndeModal && !this.partieEndeModal.hidden) {
      this.verarbeiteModalFocusTrap(e, this.partieEndeModal);
      return;
    }

    // 5. Einstellungs-Modal: Escape schliesst, sonst Focus-Trap
    if (this.einstellungsModalEl && !this.einstellungsModalEl.hidden) {
      if (e.key === 'Escape') {
        this.einstellungsModalEl.hidden = true;
        e.preventDefault();
      } else {
        this.verarbeiteModalFocusTrap(e, this.einstellungsModalEl);
      }
      return;
    }

    // 6. Navigationskuerzel: I=Seitenlade, S=Einstellungen
    if (e.key === 'i' || e.key === 'I') {
      this.togglSeitenlade();
      e.preventDefault();
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      this.togglEinstellungen();
      e.preventDefault();
      return;
    }

    // 7. Escape schliesst Seitenlade (falls offen)
    if (e.key === 'Escape' && this.seitenladeOffen) {
      this.togglSeitenlade();
      e.preventDefault();
      return;
    }

    // 8. Ansage-Shortcuts (nur wenn Floating Action Bar Buttons zeigt)
    if (modell.aktuellerSpieler === 'SUED' && modell.moeglicheAnsagen.length > 0) {
      if (this.verarbeiteAnsageTaste(e, modell)) {
        return;
      }
    }

    // 9. Karten-Navigation (nur wenn eigener Spielzug mit spielbaren Karten)
    if (modell.aktuellerSpieler === 'SUED' && modell.spielbareKarten.length > 0) {
      this.verarbeiteKartenNavigationTaste(e, modell, zustand);
    }
  }

  /**
   * Verarbeitet Tastatureingaben im Vorbehalt-Modal.
   * Ziffern 1-N waehlen direkt, ArrowUp/Down navigieren, Enter bestaetigt.
   * Escape ist absichtlich nicht unterstuetzt — eine Entscheidung ist zwingend.
   */
  private verarbeiteVorbehaltTaste(e: KeyboardEvent, modell: TischAnsichtModell): void {
    const optionen = modell.moeglicheVorbehalte;
    if (optionen.length === 0) {
      return;
    }

    // Ziffer 1-N: direkte Auswahl und sofortiger Abschluss
    const ziffer = parseInt(e.key, 10);
    if (!isNaN(ziffer) && ziffer >= 1 && ziffer <= optionen.length) {
      e.preventDefault();
      appStore.meldeVorbehalt(optionen[ziffer - 1]);
      return;
    }

    // ArrowUp/Down: Navigation durch Optionen (Phaser-Dialog hat keinen DOM-Focus)
    if (e.key === 'ArrowUp') {
      this.tastaturVorbehaltIndex = Math.max(0, this.tastaturVorbehaltIndex - 1);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      this.tastaturVorbehaltIndex = Math.min(optionen.length - 1, this.tastaturVorbehaltIndex + 1);
      e.preventDefault();
      return;
    }

    // Enter: aktuell markierte Option bestaetigen
    if (e.key === 'Enter') {
      const option = optionen[this.tastaturVorbehaltIndex];
      if (option !== undefined) {
        appStore.meldeVorbehalt(option);
      }
      e.preventDefault();
    }
  }

  /**
   * Verarbeitet Ansage-Shortcuts in der Floating Action Bar.
   * R=Re, K=Kontra, 1-5 fuer die Buttons in Anzeigereihenfolge.
   * Gibt true zurueck wenn eine Taste verarbeitet wurde.
   */
  private verarbeiteAnsageTaste(e: KeyboardEvent, modell: TischAnsichtModell): boolean {
    const ansagen = modell.moeglicheAnsagen;

    if (e.key === 'r' || e.key === 'R') {
      if (ansagen.includes('RE')) {
        appStore.sageAnsageAn('RE');
        e.preventDefault();
        return true;
      }
    }
    if (e.key === 'k' || e.key === 'K') {
      if (ansagen.includes('KONTRA')) {
        appStore.sageAnsageAn('KONTRA');
        e.preventDefault();
        return true;
      }
    }

    // 1-5: Ansage nach Position in der angezeigten Liste
    const ziffer = parseInt(e.key, 10);
    if (!isNaN(ziffer) && ziffer >= 1 && ziffer <= ansagen.length) {
      const ansage = ansagen[ziffer - 1];
      if (ansage) {
        appStore.sageAnsageAn(ansage);
        e.preventDefault();
        return true;
      }
    }

    return false;
  }

  /**
   * Verarbeitet Pfeiltasten/Enter/Space/Escape fuer die Karten-Navigation.
   * ArrowLeft/Right navigieren durch spielbare Karten (kreisfoermig).
   * Enter/Space spielen die markierte Karte.
   * Escape hebt die Markierung auf.
   */
  private verarbeiteKartenNavigationTaste(e: KeyboardEvent, modell: TischAnsichtModell, zustand: AppZustand): void {
    const kartenAnzahl = modell.spielbareKarten.length;

    if (e.key === 'ArrowLeft') {
      this.tastaturKarteIndex = this.tastaturKarteIndex <= 0
        ? kartenAnzahl - 1
        : this.tastaturKarteIndex - 1;
      this.renderTisch(zustand, modell);
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowRight') {
      this.tastaturKarteIndex = this.tastaturKarteIndex < 0 || this.tastaturKarteIndex >= kartenAnzahl - 1
        ? 0
        : this.tastaturKarteIndex + 1;
      this.renderTisch(zustand, modell);
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      if (this.tastaturKarteIndex >= 0 && this.tastaturKarteIndex < kartenAnzahl) {
        const karteId = modell.spielbareKarten[this.tastaturKarteIndex];
        if (karteId && !this.spielzugAnimationAktiv) {
          void this.spieleKarteMitAnimation(karteId);
        }
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      this.tastaturKarteIndex = -1;
      this.renderTisch(zustand, modell);
      e.preventDefault();
    }
  }

  /**
   * Focus-Trap fuer modale Dialoge: Tab zirkuliert zwischen fokussierbaren Elementen,
   * Enter bestaetigt den ersten aktiven Button.
   */
  private verarbeiteModalFocusTrap(e: KeyboardEvent, modal: HTMLElement): void {
    if (e.key === 'Tab') {
      const fokussierbar = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')
      );
      if (fokussierbar.length === 0) {
        return;
      }
      const aktuellerIndex = fokussierbar.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        const vorheriger = aktuellerIndex <= 0 ? fokussierbar.length - 1 : aktuellerIndex - 1;
        fokussierbar[vorheriger].focus();
      } else {
        const naechster = aktuellerIndex >= fokussierbar.length - 1 ? 0 : aktuellerIndex + 1;
        fokussierbar[naechster].focus();
      }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const ersterButton = modal.querySelector<HTMLButtonElement>('button:not([disabled])');
      ersterButton?.click();
      e.preventDefault();
    }
  }

  /** Oeffnet oder schliesst die Seitenlade programmatisch (z.B. per Tastenkuerzel I). */
  private togglSeitenlade(): void {
    this.seitenladeOffen = !this.seitenladeOffen;
    if (this.seitenladeEl) {
      if (this.seitenladeOffen) {
        this.seitenladeEl.classList.add('seitenlade--offen');
      } else {
        this.seitenladeEl.classList.remove('seitenlade--offen');
      }
    }
  }

  /** Oeffnet oder schliesst das Einstellungs-Modal programmatisch (z.B. per Tastenkuerzel S). */
  private togglEinstellungen(): void {
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
    if (this.tastaturHandler) {
      document.removeEventListener('keydown', this.tastaturHandler);
      this.tastaturHandler = undefined;
    }
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
    this.austeilenAktiv = false;
    this.wartendeKartenId = null;
    this.tastaturKarteIndex = -1;
    this.tastaturVorbehaltIndex = 0;
    this.versteckeLetztesStichOverlay();
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
