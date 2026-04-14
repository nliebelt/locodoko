import Phaser from 'phaser';

import {
  TEXTUR_BILD_OVAL_1,
  TEXTUR_BILD_OVAL_2,
  TEXTUR_BILD_RECHTECK_1,
  TEXTUR_BILD_RECHTECK_2,
  TEXTUR_BILD_RUND_1,
  TEXTUR_BLAU_GRAFIK,
  TEXTUR_FILZ,
  TEXTUR_HOLZ_DUNKEL,
  ladeHintergrundbilder,
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
  type TischAnsichtModell,
  type SpielerPosition
} from '../model/TischAnsichtModell';
import type { KarteAntwort, Tischhintergrund, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte, type RundenauswertungDaten } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';
import { TischInputHandler, type TischInputKontext } from './TischInputHandler';
import { TischUIManager, type TischUIKontext } from './TischUIManager';
import {
  escapeHtml,
  formatiereAnsage,
  formatiereVorbehalt,
  formatiereSonderpunkt,
} from './tischFormatierer';

interface TischLayoutEintrag {
  x: number;
  y: number;
  kartenX: number;
  kartenY: number;
  kartenWinkel: number;
}

type TischLayout = Record<SpielerPosition, TischLayoutEintrag>;

// Stich-Slot-Positionen relativ zur Spielgrösse (früher hardcodiert 108/132px)
// winkel: kleine Rotation pro Position für natürliches „auf dem Tisch liegend"-Gefühl
function stichSlotPositionen(
  mitteX: number, mitteY: number, breite: number, hoehe: number
): Record<SpielerPosition, { x: number; y: number; winkel: number }> {
  const versatzY = Math.round(hoehe * 0.15);   // ≈ 108 bei 720px
  const versatzX = Math.round(breite * 0.103);  // ≈ 132 bei 1280px
  return {
    SUED: { x: mitteX,           y: mitteY + versatzY, winkel: -4 },
    WEST: { x: mitteX - versatzX, y: mitteY,            winkel:  6 },
    NORD: { x: mitteX,           y: mitteY - versatzY, winkel:  3 },
    OST:  { x: mitteX + versatzX, y: mitteY,            winkel: -5 }
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
    case 'NORD': return { x: breite * 0.12, y: hoehe * 0.15 };
    case 'SUED': return { x: breite * 0.68, y: hoehe * 0.85 };
    case 'WEST': return { x: breite * 0.14, y: hoehe * 0.84 };
    case 'OST':  return { x: breite * 0.86, y: hoehe * 0.16 };
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
    BLAU_GRAFIK: TEXTUR_BLAU_GRAFIK,
    RECHTECK_1: TEXTUR_BILD_RECHTECK_1,
    RECHTECK_2: TEXTUR_BILD_RECHTECK_2,
    OVAL_1: TEXTUR_BILD_OVAL_1,
    OVAL_2: TEXTUR_BILD_OVAL_2,
    RUND_1: TEXTUR_BILD_RUND_1,
  } as Record<Tischhintergrund, string>)[tischhintergrund];
}

function istBildHintergrund(bg: Tischhintergrund): boolean {
  return bg === 'RECHTECK_1' || bg === 'RECHTECK_2' || bg === 'OVAL_1' || bg === 'OVAL_2' || bg === 'RUND_1';
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

  private hintergrund?: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;

  private tischEbene?: Phaser.GameObjects.Container;

  // (Vorbehalt, Ansage, Armut-Dialog, Aktions-Hinweis werden als Phaser-Objekte in renderTisch() gerendert)

  // Modaler Dialog am Rundenende (bleibt bis Spieler ihn schliesst) — DOM-Element aus TischUIManager
  private get rundenEndeModal(): HTMLDivElement | undefined { return this.uiManager?.getRundenEndeModal(); }

  // Modaler Dialog am Partie-Ende — DOM-Element aus TischUIManager
  private get partieEndeModal(): HTMLDivElement | undefined { return this.uiManager?.getPartieEndeModal(); }

  // Countdown-Intervall fuer den Partie-Ende-Neustart (Referenz fuer Cleanup)
  private countdownTimerId?: ReturnType<typeof setInterval>;

  private uiManager?: TischUIManager;

  private inputHandler?: TischInputHandler;

  private ausgewaehlteArmutKarten = new Set<string>();

  private armutAnnahmeAktiv = false;

  private animationen?: AnimationenService;

  private letztesModell: TischAnsichtModell | null = null;

  private readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();

  private spielzugAnimationAktiv = false;

  private wartendeKartenId: string | null = null;

  // Wird waehrend der Austeilen-Animation auf true gesetzt; Karten werden dann unsichtbar gerendert
  private austeilenAktiv = false;

  // Laeuft eine Stich-Einziehen-Animation, wird hier das Promise gespeichert damit
  // nachfolgende KI-Karten-Animationen erst danach starten koennen.
  private stichEinziehenLaeuft: Promise<void> | null = null;

  // Phaser-Objekte der aktuell sichtbaren Rundenauswertung — werden beim Schliessen zerstoert.
  private rundenauswertungObjekte: Phaser.GameObjects.GameObject[] = [];

  // Sequentielle Kette fuer alle Banner-Animationen (Ansagen, Sonderpunkte, Ankuendigungen).
  // Jede neue Banner-Animation wird ans Ende gekettet, damit sie nicht parallel auftauchen.
  private animationsKette: Promise<void> = Promise.resolve();

  // Handler fuer Escape-Taste am Rundenende-Modal (wird bei Schliessen entfernt)
  private escapeHandler?: (e: KeyboardEvent) => void;

  // Handler fuer Backdrop-Klick am Rundenende-Modal (wird bei Schliessen entfernt)
  private backdropClickHandler?: (e: MouseEvent) => void;

  // Index der per Tastatur ausgewaehlten spielbaren Karte in modell.spielbareKarten (-1 = keine Auswahl)
  private tastaturKarteIndex = -1;

  // Index der aktuell per Tastatur markierten Option im Vorbehalt-Modal (0-basiert)
  private tastaturVorbehaltIndex = 0;

  // Overlay fuer "Letzter Stich" (Klick auf eigenen Stapel)
  private letzterStichOverlay?: Phaser.GameObjects.Container;

  private letzterStichTimer?: Phaser.Time.TimerEvent;

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
    ladeHintergrundbilder(this);
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
    this.aktualisiereHintergrund(anfangsModell.tischhintergrund, breite, hoehe);
    this.animationen = new AnimationenService(this);

    // E2E-Test-Hook: Animationsgeschwindigkeit per Bridge steuerbar machen.
    // Ermoeglicht Tests, Animationen auf Sofort zu beschleunigen (geschwindigkeitsfaktor = Infinity).
    const bridge = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    if (bridge) {
      bridge['setzeAnimationsGeschwindigkeit'] = (faktor: number) => {
        this.animationen?.setzeGeschwindigkeitsfaktor(faktor);
      };
      // Phaser-GameLoop von requestAnimationFrame (60fps) auf setTimeout (2fps) umschalten:
      // gibt den Main-Thread frei damit page.waitForFunction schnell pollen kann.
      // sleep() → Konfiguration aendern → wake() startet mit neuer Konfiguration.
      bridge['reduziereRendering'] = () => {
        const loop = this.game.loop;
        loop.sleep();
        (loop as unknown as Record<string, unknown>)['forceSetTimeOut'] = true;
        (loop as unknown as Record<string, unknown>)['_target'] = 500;
        loop.wake();
      };
    }

    const uiKontext: TischUIKontext = {
      szeneStarten: (name) => { this.scene.start(name); },
      onGeschwindigkeitGeaendert: (f) => { this.animationen?.setzeGeschwindigkeitsfaktor(f); },
      onLetzteSticheToggle: () => { if (this.letzterZustand) this.aktualisiereUi(this.letzterZustand); },
    };
    this.uiManager = new TischUIManager(uiKontext);
    this.uiManager.baueUi();

    const inputKontext: TischInputKontext = {
      getLetztesModell: () => this.letztesModell ?? null,
      getLetzterZustand: () => this.letzterZustand,
      getAusgewaehlteArmutKarten: () => this.ausgewaehlteArmutKarten,
      getRundenEndeModal: () => this.uiManager?.getRundenEndeModal(),
      getPartieEndeModal: () => this.uiManager?.getPartieEndeModal(),
      getEinstellungsModalEl: () => this.uiManager?.getEinstellungsModalEl(),
      isSeitenladeOffen: () => this.uiManager?.isSeitenladeOffen() ?? false,
      isSpielzugAnimationAktiv: () => this.spielzugAnimationAktiv,
      isArmutAnnahmeAktiv: () => this.armutAnnahmeAktiv,
      setArmutAnnahmeAktiv: (v) => { this.armutAnnahmeAktiv = v; },
      getTastaturKarteIndex: () => this.tastaturKarteIndex,
      setTastaturKarteIndex: (v) => { this.tastaturKarteIndex = v; },
      getTastaturVorbehaltIndex: () => this.tastaturVorbehaltIndex,
      setTastaturVorbehaltIndex: (v) => { this.tastaturVorbehaltIndex = v; },
      togglSeitenlade: () => { this.uiManager?.togglSeitenlade(); },
      togglEinstellungen: () => { this.uiManager?.togglEinstellungen(); },
      renderTisch: (z, m) => { this.renderTisch(z, m); },
      spieleKarteMitAnimation: (k) => this.spieleKarteMitAnimation(k),
    };
    this.inputHandler = new TischInputHandler(inputKontext);
    this.inputHandler.registriere();

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
      if (zustand.bereich === 'SPIELVERWALTUNG') {
        this.scene.start('SpielverwaltungsSzene');
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
      // Alle Banner-Animationen nacheinander in eine gemeinsame Kette einreihen
      const neueAnsagen = this.ermittleNeueAnsagen(vorherigesModell, modell);
      const neueSonderpunkte = this.ermittleNeueSonderpunkte(vorherigesModell, modell);
      const hochzeitMeldung = this.ermittleHochzeitEreignis(vorherigerZustand ?? null, zustand);
      const spielankuendigung = this.ermittleSpielankuendigung(vorherigerZustand ?? null, zustand);
      const bockrundeMeldung = this.ermittleBockrundeEreignis(vorherigerZustand ?? null, zustand);
      if (neueAnsagen.length > 0) this.reiheBannerEin(() => this.starteAnsageBannerAnimationen(neueAnsagen));
      if (neueSonderpunkte.length > 0) this.reiheBannerEin(() => this.starteSonderpunktFeedbackAnimationen(neueSonderpunkte));
      if (hochzeitMeldung) this.reiheBannerEin(() => this.zeigeHochzeitEreignis(hochzeitMeldung));
      if (spielankuendigung) this.reiheBannerEin(() => this.zeigeSpielankuendigung(spielankuendigung));
      if (bockrundeMeldung) this.reiheBannerEin(() => this.zeigeBockrundeEreignis());
      // Neues Spielergebnis → erst Gewinner-Flash, dann Modal einblenden (beides in der Queue)
      if (this.erkennteNeuesSpielErgebnis(vorherigesModell, modell) && modell.letztesSpielergebnis) {
        const ergebnisModell = modell;
        this.reiheBannerEin(() => this.zeigeGewinnerFlash(ergebnisModell));
        if (modell.partieBeendet) {
          this.reiheBannerEin(() => { this.zeigePartieEndeModal(ergebnisModell); return Promise.resolve(); });
        } else {
          this.reiheBannerEin(() => this.zeigeRundenEndeModal(ergebnisModell));
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

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene gestoppt wird (z.B. Wechsel zur SpielverwaltungsSzene). */
  shutdown(): void {
    this.aufraeumen();
  }

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene zerstoert wird. */
  destroy(): void {
    this.aufraeumen();
  }

  private aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    // Tastatur-Kartenindex automatisch nachfuehren wenn sich der Spielzug aendert
    this.aktualisiereKartenNavigationsIndex(modell);
    this.synchronisiereAktionZustand(modell);

    if (!this.uiManager) return;
    this.uiManager.aktualisiereTopBar(modell, zustand);
    this.uiManager.aktualisiereSeitenlade(modell, zustand);
    this.uiManager.aktualisiereEinstellungsModal(modell, zustand);
    this.uiManager.aktualisiereErgebnis(modell);
    this.uiManager.aktualisiereLetzteStiche(modell);
    this.uiManager.aktualisiereToasts(zustand);
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
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.add.container(0, 0);
    ebene.add(this.add.ellipse(mitteX, mitteY, tischBreite, tischHoehe, 0x081c15, 0.32).setStrokeStyle(8, 0xd8f3dc, 0.42));

    this.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      const npPos = nameplatePositionFuer(spieler.position, breite, hoehe);
      // Nameplate: rechteckig; SUED/NORD horizontal (breit, flach), WEST/OST vertikal (schmal, hoeher)
      const istHorizontal = spieler.position === 'SUED' || spieler.position === 'NORD';
      const nameplateBreite = istHorizontal ? Math.max(120, breite * 0.11) : Math.max(120, breite * 0.07);
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
      // Ansage-Badges: laufende Ansagen (Keine90/60/30/Schwarz) dauerhaft im Nameplate
      const ansageBadgeLabels: Partial<Record<string, string>> = {
        KEINE_90: '[K90]', KEINE_60: '[K60]', KEINE_30: '[K30]', SCHWARZ: '[S]'
      };
      const spielerAnsagen = modell.ansageHistorie.filter(
        (a) => a.position === spieler.position && ansageBadgeLabels[a.ansage] !== undefined
      );
      if (spielerAnsagen.length > 0) {
        const badgeText = spielerAnsagen.map((a) => ansageBadgeLabels[a.ansage]).join(' ');
        ebene.add(this.add.text(npPos.x, npPos.y + Math.round(nameplateHoehe * 0.58), badgeText, {
          color: '#ff9800',
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
    const kartenObjekte: Kartenansicht[] = [];
    karten.forEach((eintrag, index) => {
      const x = startX + index * kartenAbstand;
      const ansicht = this.erstelleKartenansicht(x, kartenY, kgroesse.w, kgroesse.h, { karte: eintrag.karte });
      ansicht.setScale(0, 1);
      kartenObjekte.push(ansicht);
      container.add(ansicht);
    });

    // Flip-Animation: Karten versetzt von scaleX=0 auf 1 aufklappen (simuliert Kartenumdrehen)
    kartenObjekte.forEach((ansicht, i) => {
      this.tweens.add({
        targets: ansicht,
        scaleX: 1,
        duration: 150,
        ease: 'Cubic.Out',
        delay: i * 60
      });
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
      const kartenansicht = this.erstelleKartenansicht(slot.x, slot.y, kgroesse.w, kgroesse.h, { karte: eintrag.karte });
      kartenansicht.setAngle(slot.winkel);
      ebene.add(kartenansicht);
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
        : (offen ? (hatInteraktion && karte && !istInteraktiv ? 0.45 : 1) : 0.92);
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

    const animation = this.animationen?.animiereStichEinziehen(animierteKarten, ziel, abgeschlossenerStich.augen, flashRechteck)
      ?? Promise.resolve();
    this.stichEinziehenLaeuft = animation.finally(() => {
      this.stichEinziehenLaeuft = null;
    });

    try {
      await animation;
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
    // Warten bis eine laufende Stich-Einziehen-Animation abgeschlossen ist,
    // damit KI-Karten nicht waehrend des Einziehens in die Mitte gleiten.
    if (this.stichEinziehenLaeuft) {
      await this.stichEinziehenLaeuft;
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
      // Banner im oberen Drittel (y < 200px) anzeigen, damit Handkarten nicht ueberdeckt werden
      await this.animationen?.animiereAnsageBanner(
        bannerText,
        { x: breite / 2, y: Math.round(hoehe * 0.18) },
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
    const spielerNamen = new Map(aktuellesModell.spieler.map((s) => [s.position, s.name] as const));
    const sonderpunkte: string[] = [];
    for (const sp of neuesErgebnis.sonderpunkteRe) {
      sonderpunkte.push(`Re: ${formatiereSonderpunkt(sp, spielerNamen)}`);
    }
    for (const sp of neuesErgebnis.sonderpunkteKontra) {
      sonderpunkte.push(`Kontra: ${formatiereSonderpunkt(sp, spielerNamen)}`);
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

  // Erkennt Hochzeit-Ereignisse (Partner gefunden / Stilles Solo) anhand von Zustandsänderungen
  private ermittleHochzeitEreignis(
    vorherigerZustand: AppZustand | null,
    aktuellerZustand: AppZustand
  ): string | null {
    const vorherigesSpiel = vorherigerZustand?.partieStand?.laufendesSpiel;
    const aktuellesSpiel = aktuellerZustand.partieStand?.laufendesSpiel;
    if (!vorherigesSpiel || !aktuellesSpiel) {
      return null;
    }
    // Stilles Solo: Spieltyp wechselt von HOCHZEIT zu einem Solo-Typ (kein Partner gefunden)
    if (vorherigesSpiel.spieltyp === 'HOCHZEIT' && aktuellesSpiel.spieltyp !== 'HOCHZEIT') {
      return 'Stilles Solo';
    }
    // Partner gefunden: Nicht-selbst-Spieler bekommt Partei RE (war vorher null)
    if (aktuellesSpiel.spieltyp !== 'HOCHZEIT') {
      return null;
    }
    for (const spieler of aktuellesSpiel.spieler) {
      if (spieler.istSelbst) {
        continue;
      }
      const vorher = vorherigesSpiel.spieler.find((s) => s.position === spieler.position);
      if (vorher?.partei === null && spieler.partei === 'RE') {
        return `Partner gefunden: ${spieler.name}`;
      }
    }
    return null;
  }

  private async zeigeHochzeitEreignis(meldung: string | null): Promise<void> {
    if (!meldung) {
      return;
    }
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    await this.animationen?.animiereSonderpunktFeedback(meldung, { x: breite / 2, y: hoehe * 0.4 }, 2000);
  }

  // Erkennt wenn der Spieltyp von NORMALSPIEL auf ein Solo oder Hochzeit wechselt (nach Vorbehalt-Aufloesung)
  private ermittleSpielankuendigung(
    vorherigerZustand: AppZustand | null,
    aktuellerZustand: AppZustand
  ): string | null {
    const vorherigesSpiel = vorherigerZustand?.partieStand?.laufendesSpiel;
    const aktuellesSpiel = aktuellerZustand.partieStand?.laufendesSpiel;
    if (!vorherigesSpiel || !aktuellesSpiel) {
      return null;
    }
    const vorherigerTyp = vorherigesSpiel.spieltyp;
    const aktuellerTyp = aktuellesSpiel.spieltyp;
    // Nur bei Uebergang von NORMALSPIEL -> etwas anderes (Solo, Hochzeit, Armut)
    if (vorherigerTyp === aktuellerTyp || vorherigerTyp !== 'NORMALSPIEL') {
      return null;
    }
    const spieltypLabels: Partial<Record<string, string>> = {
      SOLO_DAME: 'Damensolo',
      SOLO_BUBE: 'Bubensolo',
      SOLO_TRUMPF: 'Karosolo',
      SOLO_TRUMPF_HERZ: 'Herzsolo',
      SOLO_TRUMPF_PIK: 'Piksolo',
      SOLO_TRUMPF_KREUZ: 'Kreuzsolo',
      SOLO_FLEISCHLOS: 'Fleischlos',
      HOCHZEIT: 'Hochzeit',
      ARMUT: 'Armut',
    };
    const label = spieltypLabels[aktuellerTyp] ?? aktuellerTyp;
    // Solist: bei Solo-Typen gibt es genau einen RE-Spieler
    const solist = aktuellesSpiel.spieler.find((s) => s.partei === 'RE');
    if (!solist) {
      return label;
    }
    return `${solist.name} spielt ${label}`;
  }

  // Zeigt die Solo-/Hochzeit-Ankuendigung als dramatisches Einfahrt-Banner
  private async zeigeSpielankuendigung(meldung: string | null): Promise<void> {
    if (!meldung) {
      return;
    }
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    await this.animationen?.animiereSoloAnkuendigung(meldung, { x: breite / 2, y: hoehe / 2 });
  }

  // Reiht eine Banner-Animationsfunktion ans Ende der sequentiellen Kette ein.
  // Fehler werden abgefangen damit ein fehlgeschlagenes Banner die Kette nicht blockiert.
  private reiheBannerEin(fn: () => Promise<void>): void {
    this.animationsKette = this.animationsKette.then(fn).catch(() => undefined);
  }

  // Erkennt ob das naechste Spiel eine Bockrunde ist (bockrundenZaehler > 0 beim Spielstart).
  // Gibt true zurueck wenn ein neues Spiel beginnt und istBockrunde gesetzt ist.
  private ermittleBockrundeEreignis(
    vorherigerZustand: AppZustand | null,
    aktuellerZustand: AppZustand
  ): boolean {
    const vorherigesSpiel = vorherigerZustand?.partieStand?.laufendesSpiel;
    const aktuellesSpiel = aktuellerZustand.partieStand?.laufendesSpiel;
    if (!aktuellesSpiel?.istBockrunde) {
      return false;
    }
    // Nur beim Uebergang zu einem neuen Spiel anzeigen, nicht bei jedem State-Update
    if (vorherigesSpiel?.spielNummer === aktuellesSpiel.spielNummer) {
      return false;
    }
    return true;
  }

  private async zeigeBockrundeEreignis(): Promise<void> {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    await this.animationen?.animiereBockrunde({ x: breite / 2, y: hoehe / 2 });
  }

  // Zeigt Siegerpartei, Spielernamen und Spielwert als animierten Flash vor dem Rundenende-Modal
  private async zeigeGewinnerFlash(modell: TischAnsichtModell): Promise<void> {
    const ergebnis = modell.letztesSpielergebnis;
    if (!ergebnis) {
      return;
    }
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const farbe = ergebnis.siegerPartei === 'RE' ? '#ffd166' : '#90caf9';
    const parteiText = `${ergebnis.siegerPartei} gewinnt!`;
    const siegerNamen = modell.spieler
      .filter((s) => s.partei === ergebnis.siegerPartei)
      .map((s) => s.name)
      .join(', ');
    const punkteText = `+${ergebnis.spielwert} Punkte`;
    await this.animationen?.animiereGewinnerFlash(
      parteiText,
      siegerNamen,
      punkteText,
      farbe,
      { x: breite / 2, y: hoehe / 2 }
    );
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

  // Baut die Rundenauswertung vollstaendig in Phaser auf und zeigt den HTML-Marker.
  // Gibt eine Promise zurueck, die nach Abschluss aller Intro-Animationen aufloest
  // (nicht erst wenn der Nutzer "Weiter" klickt).
  private async zeigeRundenEndeModal(modell: TischAnsichtModell): Promise<void> {
    const ergebnis = modell.letztesSpielergebnis;
    if (!this.rundenEndeModal || !ergebnis) {
      return;
    }

    const anzahlSpiele = this.letzterZustand?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const spielNummerText = anzahlSpiele
      ? `Spiel ${ergebnis.spielNummer} von ${anzahlSpiele}`
      : `Spiel ${ergebnis.spielNummer}`;
    const spieltypLabel = formatiereVorbehalt(ergebnis.spieltyp as VorbehaltAnsage) ?? ergebnis.spieltyp;
    const spielerNamenMap = new Map(modell.spieler.map((s) => [s.position, s.name] as const));

    // Berechnungszeilen fuer die Phaser-Darstellung aufbereiten
    const berechnungZeilen: string[] = [];
    berechnungZeilen.push(`Grundwert: +${ergebnis.grundwert}`);
    if (ergebnis.absagePunkte !== 0) {
      berechnungZeilen.push(`Ansagen: ${ergebnis.absagePunkte > 0 ? '+' : ''}${ergebnis.absagePunkte}`);
    }
    if (ergebnis.gegenDieAltenPunkte > 0) {
      berechnungZeilen.push(`Gegen die Alten: +${ergebnis.gegenDieAltenPunkte}`);
    }
    const alleSonderpunkte = [
      ...ergebnis.sonderpunkteRe.map((sp) => `Re: ${formatiereSonderpunkt(sp, spielerNamenMap)}`),
      ...ergebnis.sonderpunkteKontra.map((sp) => `Kontra: ${formatiereSonderpunkt(sp, spielerNamenMap)}`)
    ];
    if (alleSonderpunkte.length > 0) {
      berechnungZeilen.push(`Sonderpunkte: +${alleSonderpunkte.length}`);
    }
    if (ergebnis.soloMultiplikator === 3) {
      berechnungZeilen.push('Solo-Multiplikator: ×3');
    }

    const daten: RundenauswertungDaten = {
      spieltypLabel,
      spielNummerText,
      siegerPartei: ergebnis.siegerPartei,
      spielwert: ergebnis.spielwert,
      reSpielerNamen: modell.spieler.filter((s) => s.partei === 'RE').map((s) => s.name).join(', ') || '–',
      kontraSpielerNamen: modell.spieler.filter((s) => s.partei === 'KONTRA').map((s) => s.name).join(', ') || '–',
      augenRe: ergebnis.augenRe,
      augenKontra: ergebnis.augenKontra,
      berechnungZeilen,
      spielpunkte: ergebnis.spielpunkte.map((e) => ({
        name: e.name,
        punkte: e.punkte,
        istSelbst: e.position === 'SUED',
      })),
      gesamtstand: modell.gesamtpunktestand.map((e) => ({ name: e.name, punkte: e.punkte })),
    };

    // Phaser-Animation starten
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    if (this.animationen) {
      this.rundenauswertungObjekte = await this.animationen.animiereRundenauswertung(daten, breite, hoehe);
    }

    // HTML-Overlay als transparenter Marker sichtbar schalten (fuer E2E-Erkennung und Tastatur-Handling)
    // Kein visueller Inhalt — alles laeuft in Phaser
    const schliessenButton = this.erstelleButton('Weiter →', () => this.schliesseRundenEndeModal(), false);
    schliessenButton.dataset['testid'] = 'btn-rundenauswertung-weiter';

    // Versteckte data-testid-Elemente fuer E2E-Tests (Solo-Spielfluss)
    const spieltypSpan = document.createElement('span');
    spieltypSpan.dataset['testid'] = 'rundenauswertung-spieltyp';
    spieltypSpan.textContent = spieltypLabel;
    spieltypSpan.hidden = true;

    const multiplikatorSpan = document.createElement('span');
    multiplikatorSpan.dataset['testid'] = 'rundenauswertung-punktemultiplikator';
    multiplikatorSpan.textContent = ergebnis.soloMultiplikator === 3 ? '×3' : '×1';
    multiplikatorSpan.hidden = true;

    this.rundenEndeModal.innerHTML = '';
    this.rundenEndeModal.className = 'ui-rundenauswertung-overlay';
    this.rundenEndeModal.append(schliessenButton, spieltypSpan, multiplikatorSpan);
    this.rundenEndeModal.hidden = false;

    // Fokus setzen damit Enter direkt den Button trifft
    setTimeout(() => schliessenButton.focus(), 0);

    // Klick auf Overlay (nicht Button) schliesst ebenfalls
    this.backdropClickHandler = (event: MouseEvent) => {
      if (event.target === this.rundenEndeModal) {
        this.schliesseRundenEndeModal();
      }
    };
    this.rundenEndeModal.addEventListener('click', this.backdropClickHandler);
  }

  // Schliesst das Rundenende-Modal und raeumt Phaser-Objekte ab
  private schliesseRundenEndeModal(): void {
    if (!this.rundenEndeModal) {
      return;
    }
    this.rundenEndeModal.hidden = true;
    this.rundenEndeModal.innerHTML = '';
    // Phaser-Objekte der Rundenauswertung zerstoeren
    this.rundenauswertungObjekte.forEach((obj) => obj.destroy());
    this.rundenauswertungObjekte = [];
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
    gesamtstandListe.dataset['testid'] = 'partieende-gesamtauswertung';
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
    countdownSpan.dataset['testid'] = 'partieende-neustart-countdown';
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



  // ── Tastatursteuerung ───────────────────────────────────────────────────────

  /**
   * Erstellt oder aktualisiert das Hintergrund-Objekt.
   * Prozedurale Texturen werden als TileSprite gerendert (gekachelt),
   * Foto-Hintergruende als Image mit Cover-Skalierung.
   */
  private aktualisiereHintergrund(bg: Tischhintergrund, breite: number, hoehe: number): void {
    const textur = texturFuerTischhintergrund(bg);
    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === textur) {
        this.hintergrund.setPosition(breite / 2, hoehe / 2).setDisplaySize(breite, hoehe);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.add.image(breite / 2, hoehe / 2, textur).setDisplaySize(breite, hoehe).setDepth(0);
    } else {
      if (this.hintergrund instanceof Phaser.GameObjects.TileSprite && this.hintergrund.texture.key === textur) {
        this.hintergrund.setPosition(breite / 2, hoehe / 2).setSize(breite, hoehe);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.add.tileSprite(breite / 2, hoehe / 2, breite, hoehe, textur).setDepth(0);
    }
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

  private handleResize(): void {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    if (this.hintergrund instanceof Phaser.GameObjects.Image) {
      this.hintergrund.setPosition(breite / 2, hoehe / 2).setDisplaySize(breite, hoehe);
    } else {
      this.hintergrund?.setPosition(breite / 2, hoehe / 2).setSize(breite, hoehe);
    }
    if (this.letzterZustand?.bereich === 'TISCH') {
      this.renderTisch(this.letzterZustand);
    }
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.inputHandler?.aufraeumen();
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
    this.rundenauswertungObjekte.forEach((obj) => obj.destroy());
    this.rundenauswertungObjekte = [];
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
    this.schliessePartieEndeModal();
    this.uiManager?.aufraeumen();
    this.uiManager = undefined;
    this.inputHandler = undefined;
  }
}
