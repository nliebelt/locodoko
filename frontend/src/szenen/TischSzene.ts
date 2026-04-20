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
  ladeKartenBilderVorab,
  registriereBasisTexturen,
  registriereKartenSpriteTexturen,
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
} from '../modelle/TischAnsichtModell';
import type { KarteAntwort, SonderpunktEreignisAntwortDto, Tischhintergrund, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
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
    SUED: { x: breite * 0.5, y: hoehe * 0.82, kartenX: breite * 0.28, kartenY: hoehe * 0.91, kartenWinkel: 0 },
    WEST: { x: breite * 0.12, y: hoehe * 0.5, kartenX: breite * 0.03, kartenY: hoehe * 0.37, kartenWinkel: 90 },
    NORD: { x: breite * 0.5, y: hoehe * 0.18, kartenX: breite * 0.28, kartenY: hoehe * 0.01, kartenWinkel: 0 },
    OST: { x: breite * 0.88, y: hoehe * 0.5, kartenX: breite * 0.97, kartenY: hoehe * 0.37, kartenWinkel: 90 }
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
    case 'NORD': return { x: breite * 0.5, y: hoehe * 0.15 };  // wird durch inline-Logik überschrieben
    case 'SUED': return { x: breite * 0.5, y: hoehe * 0.85 };  // wird durch inline-Logik überschrieben
    case 'WEST': return { x: breite * 0.14, y: hoehe * 0.84 };
    case 'OST':  return { x: breite * 0.86, y: hoehe * 0.16 };
  }
}

// Stich-Stapel: dynamisch relativ zur tatsaechlichen Kartenstapel-Ausdehnung.
// SUED/NORD: links/rechts vom horizontalen Faecher (analog Nameplate-Logik, gegenüber).
// WEST/OST: oberhalb/unterhalb des vertikalen Stapels, gedreht 90°.
function stichStapelPositionFuer(
  position: SpielerPosition,
  breite: number,
  hoehe: number,
  kartenAnzahl: number
): { x: number; y: number; winkel: number } {
  const kAbstand = berechneKartenAbstand(breite, hoehe);
  const kGroesse = berechneKartenGroesse(breite);
  const layout = berechneLayout(breite, hoehe);
  const abstand = 12;

  switch (position) {
    case 'SUED': {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 - fHalbe - kGroesse.w / 2 - abstand, y: hoehe * 0.90, winkel: 0 };
    }
    case 'NORD': {
      const fHalbe = kartenAnzahl > 0 ? ((kartenAnzahl - 1) * kAbstand.horizontal + kGroesse.w) / 2 : 0;
      return { x: breite / 2 + fHalbe + kGroesse.w / 2 + abstand, y: hoehe * 0.10, winkel: 0 };
    }
    case 'WEST': {
      const fanOben = layout.WEST.kartenY - kGroesse.h / 2;
      return { x: layout.WEST.kartenX, y: fanOben - abstand, winkel: 90 };
    }
    case 'OST': {
      const fanUnten = layout.OST.kartenY + (kartenAnzahl > 0 ? (kartenAnzahl - 1) * kAbstand.vertikal : 0) + kGroesse.h / 2;
      return { x: layout.OST.kartenX, y: fanUnten + 50, winkel: 90 };
    }
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
 */
export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  private abmeldenSonderpunkte?: () => void;

  private letzterZustand?: AppZustand;

  private hintergrund?: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

  private tischEbene?: Phaser.GameObjects.Container;

  // Modaler Dialog am Rundenende — DOM-Element aus TischUIManager
  private get rundenEndeModal(): HTMLDivElement | undefined { return this.uiManager?.getRundenEndeModal(); }

  // Modaler Dialog am Partie-Ende — DOM-Element aus TischUIManager
  private get partieEndeModal(): HTMLDivElement | undefined { return this.uiManager?.getPartieEndeModal(); }

  private countdownTimerId?: ReturnType<typeof setInterval>;

  private uiManager?: TischUIManager;

  private inputHandler?: TischInputHandler;

  private ausgewaehlteArmutKarten = new Set<string>();

  private armutAnnahmeAktiv = false;

  private animationen?: AnimationenService;

  private letztesModell: TischAnsichtModell | null = null;

  private readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();

  private wartendeKartenId: string | null = null;

  private austeilenAktiv = false;

  private rundenauswertungObjekte: Phaser.GameObjects.GameObject[] = [];

  private escapeHandler?: (e: KeyboardEvent) => void;

  private backdropClickHandler?: (e: MouseEvent) => void;

  private tastaturKarteIndex = -1;

  private tastaturVorbehaltIndex = 0;

  private letzterStichOverlay?: Phaser.GameObjects.Container;

  private letzterStichTimer?: Phaser.Time.TimerEvent;

  private einstellungenOffen = false;

  private seitenladeOffen = false;

  constructor() {
    super('TischSzene');
  }

  preload(): void {
    ladeKartenBilderVorab(this);
    ladeHintergrundbilder(this);
  }

  create(): void {
    this.animationen?.abbrechen();
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
    this.schliesseRundenEndeModal();
    this.schliessePartieEndeModal();
    this.wartendeKartenId = null;

    registriereBasisTexturen(this);
    registriereKartenSpriteTexturen(this);

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

    const bridge = (window as unknown as Record<string, Record<string, unknown>>)['__locodoko'];
    if (bridge) {
      bridge['setzeAnimationsGeschwindigkeit'] = (faktor: number) => {
        this.animationen?.setzeGeschwindigkeitsfaktor(faktor);
        appStore.setzeKiKartenVerzögerung(faktor === Infinity ? 0 : Math.round(800 / faktor));
      };
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
      onLetzteSticheToggle: () => { 
        this.einstellungenOffen = !this.einstellungenOffen;
        if (this.letzterZustand) this.renderTisch(this.letzterZustand);
      },
    };
    this.uiManager = new TischUIManager(uiKontext);
    this.uiManager.baueUi();

    const inputKontext: TischInputKontext = {
      getLetztesModell: () => this.letztesModell ?? null,
      getLetzterZustand: () => this.letzterZustand,
      getAusgewaehlteArmutKarten: () => this.ausgewaehlteArmutKarten,
      getRundenEndeModal: () => this.uiManager?.getRundenEndeModal(),
      getPartieEndeModal: () => this.uiManager?.getPartieEndeModal(),
      getEinstellungsModalEl: () => undefined,
      isSeitenladeOffen: () => this.seitenladeOffen,
      isEinstellungenOffen: () => this.einstellungenOffen,
      isSpielzugAnimationAktiv: () => !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false),
      isArmutAnnahmeAktiv: () => this.armutAnnahmeAktiv,
      setArmutAnnahmeAktiv: (v) => { this.armutAnnahmeAktiv = v; },
      getTastaturKarteIndex: () => this.tastaturKarteIndex,
      setTastaturKarteIndex: (v) => { this.tastaturKarteIndex = v; },
      getTastaturVorbehaltIndex: () => this.tastaturVorbehaltIndex,
      setTastaturVorbehaltIndex: (v) => { this.tastaturVorbehaltIndex = v; },
      togglSeitenlade: () => { 
        this.seitenladeOffen = !this.seitenladeOffen;
        if (this.letzterZustand) this.renderTisch(this.letzterZustand);
      },
      togglEinstellungen: () => { 
        this.einstellungenOffen = !this.einstellungenOffen;
        if (this.letzterZustand) this.renderTisch(this.letzterZustand);
      },
      renderTisch: (z, m) => { this.renderTisch(z, m); },
      spieleKarteMitAnimation: (k) => this.spieleKarteMitAnimation(k),
    };
    this.inputHandler = new TischInputHandler(inputKontext);
    this.inputHandler.registriere();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    const anfangsZustand = appStore.snapshot();
    this.letzterZustand = anfangsZustand;
    this.letztesModell = this.erstelleModell(anfangsZustand);
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      const modell = this.erstelleModell(zustand);
      const vorherigesModell = this.letztesModell;
      const vorherigerZustand = this.letzterZustand;
      const aktuellePhase = zustand.partieStand?.laufendesSpiel?.phase;
      if (aktuellePhase && aktuellePhase !== vorherigerZustand?.partieStand?.laufendesSpiel?.phase) {
        Logger.szene('Spielphase', { vorher: vorherigerZustand?.partieStand?.laufendesSpiel?.phase ?? null, nachher: aktuellePhase });
      }
      this.synchronisiereAnimationszustand(modell, zustand);
      this.letzterZustand = zustand;
      this.aktualisiereUi(zustand, modell);
      if (zustand.bereich === 'SPIELVERWALTUNG') {
        this.scene.start('SpielverwaltungsSzene');
        return;
      }
      const neuesSpielErkannt = this.ermittleNeuesSpiel(vorherigerZustand, zustand);
      if (neuesSpielErkannt) {
        this.schliessePartieEndeModal();
        this.austeilenAktiv = true;
      }
      this.renderTisch(zustand, modell);
      const spielankuendigung = this.ermittleSpielankuendigung(vorherigerZustand ?? null, zustand);
      if (spielankuendigung && neuesSpielErkannt) {
        this.animationen?.reiheEin(() => this.zeigeSpielankuendigung(spielankuendigung));
      }
      if (this.ermittleNeuAbgeschlossenenStich(vorherigesModell, modell)) {
        this.animationen?.reiheEin(() => this.starteFolgeanimationen(vorherigesModell, modell));
      }
      this.animationen?.reiheEin(() => this.starteGegnerKartenAnimationen(vorherigesModell, modell));
      const neueAnsagen = this.ermittleNeueAnsagen(vorherigesModell, modell);
      const hochzeitMeldung = this.ermittleHochzeitEreignis(vorherigerZustand ?? null, zustand);
      const bockrundeMeldung = this.ermittleBockrundeEreignis(vorherigerZustand ?? null, zustand);
      const schweinchenMeldung = this.ermittleSchweinchenEreignis(vorherigesModell, modell);
      if (neueAnsagen.length > 0) this.animationen?.reiheEin(() => this.starteAnsageBannerAnimationen(neueAnsagen));
      if (hochzeitMeldung) this.animationen?.reiheEin(() => this.zeigeHochzeitEreignis(hochzeitMeldung));
      if (spielankuendigung && !neuesSpielErkannt) this.animationen?.reiheEin(() => this.zeigeSpielankuendigung(spielankuendigung));
      if (bockrundeMeldung) this.animationen?.reiheEin(() => this.zeigeBockrundeEreignis());
      if (schweinchenMeldung) this.animationen?.reiheEin(() => this.zeigeSchweinchenBanner(schweinchenMeldung));
      if (this.erkennteNeuesSpielErgebnis(vorherigesModell, modell) && modell.letztesSpielergebnis) {
        const ergebnisModell = modell;
        this.animationen?.reiheEin(() => this.zeigeGewinnerFlash(ergebnisModell));
        if (modell.partieBeendet) {
          this.animationen?.reiheEin(() => { this.zeigePartieEndeModal(ergebnisModell); return Promise.resolve(); });
        } else {
          this.animationen?.reiheEin(() => this.zeigeRundenEndeModal(ergebnisModell));
        }
      }
      if (neuesSpielErkannt) {
        const aktuellerZustand = zustand;
        if (this.animationen) {
          void this.animationen.reiheEin(() => this.starteAusteilen(modell, aktuellerZustand));
        } else {
          void this.starteAusteilen(modell, aktuellerZustand);
        }
      }
      this.letztesModell = modell;
      void this.animationen?.reiheEin(() => Promise.resolve())
        ?.then(() => { if (this.letzterZustand) this.renderTisch(this.letzterZustand); });
    });
    this.abmeldenSonderpunkte = appStore.abonniereSonderpunkte((sonderpunkte) => {
      const texte = sonderpunkte.map((sp) => this.formatiereEreignisSonderpunkt(sp));
      if (texte.length > 0) {
        this.animationen?.reiheEin(() => this.starteSonderpunktFeedbackAnimationen(texte));
      }
    });
    const aktuellerZustand = appStore.snapshot();
    this.renderTisch(aktuellerZustand, this.erstelleModell(aktuellerZustand));
  }

  shutdown(): void {
    Logger.szene('TischSzene shutdown');
    this.aufraeumen();
  }

  destroy(): void {
    Logger.szene('TischSzene destroy');
    this.aufraeumen();
  }

  private aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch) {
      return;
    }
    this.aktualisiereKartenNavigationsIndex(modell);
    this.synchronisiereAktionZustand(modell);
    if (!this.uiManager) return;
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
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.add.container(0, 0);

    this.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      this.renderNameplate(ebene, spieler, modell, layout, breite, hoehe);
      this.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    this.renderStichStapel(ebene, modell, breite, hoehe);
    this.renderTopBar(ebene, modell, zustand, breite);
    
    if (this.seitenladeOffen) {
      this.renderHud(ebene, modell, breite, hoehe);
    }

    if (zustand.partieStand?.laufendesSpiel) {
      this.renderAnsageButtons(ebene, modell, zustand, breite, hoehe);
      this.renderArmutBereich(ebene, modell, zustand, breite, hoehe);
      this.renderVorbehaltDialog(ebene, modell, zustand, breite, hoehe);
    }

    if (this.einstellungenOffen) {
      this.renderEinstellungsModal(ebene, modell, zustand, breite, hoehe);
    }

    this.tischEbene = ebene;
  }

  private renderTopBar(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number
  ): void {
    const barH = 40;
    const barColor = 0x0d1f12;
    ebene.add(this.add.rectangle(breite / 2, barH / 2, breite, barH, barColor, 1).setStrokeStyle(1, 0xd8f3dc, 0.15));
    const schriftM = Math.round(Math.max(12, breite * 0.011));
    const iconSize = Math.round(Math.max(16, breite * 0.014));
    const stichInfo = modell.spieltyp ? `Stich ${modell.spieler.reduce((sum, s) => sum + s.stiche, 0)}/12` : '';
    ebene.add(this.add.text(15, barH / 2, stichInfo, { color: '#a3c4a8', fontSize: `${schriftM}px`, fontStyle: 'bold' }).setOrigin(0, 0.5));
    const tisch = zustand.aktuellerTisch;
    const spiel = zustand.partieStand?.laufendesSpiel;
    let zentrumsText = tisch?.name ?? '';
    if (spiel) {
      zentrumsText += ` · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'}`;
      if (modell.spieltyp) zentrumsText += ` · ${modell.spieltyp}`;
    } else if (tisch) {
      zentrumsText += ` · ${tisch.status}`;
    }
    ebene.add(this.add.text(breite / 2, barH / 2, zentrumsText, { color: '#f8f9fa', fontSize: `${schriftM}px`, fontStyle: 'bold' }).setOrigin(0.5));
    let rightX = breite - 15;
    const debugIcon = this.add.text(rightX, barH / 2, '🐛', { fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    debugIcon.on('pointerdown', () => appStore.toggleDebugModus());
    rightX -= 35;
    const settingsIcon = this.add.text(rightX, barH / 2, '⚙', { fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    settingsIcon.on('pointerdown', () => { this.einstellungenOffen = !this.einstellungenOffen; this.renderTisch(zustand, modell); });
    rightX -= 35;
    const sidebarIcon = this.add.text(rightX, barH / 2, '≡', { fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    sidebarIcon.on('pointerdown', () => { this.seitenladeOffen = !this.seitenladeOffen; this.renderTisch(zustand, modell); });
    rightX -= 35;
    const leaveIcon = this.add.text(rightX, barH / 2, '←', { fontSize: `${iconSize}px`, color: '#ef4444' }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    leaveIcon.on('pointerdown', () => {
      const istImSpiel = appStore.snapshot().aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel && !window.confirm('Partie abbrechen und Tisch verlassen?')) return;
      void appStore.verlasseAktuellenTisch();
    });
    rightX -= 35;
    if (tisch?.status === 'WARTEND' && zustand.spieler?.spielerId === tisch.erstelltVonSpielerId) {
      const startBtnW = 100;
      this.erstellePhaserButton(ebene, rightX - startBtnW / 2, barH / 2, startBtnW, 28, 'START', () => { void appStore.starteAktuellenTisch(); }, zustand.wirdGeladen);
      rightX -= startBtnW + 15;
    }
    if (tisch?.einladungsCode) {
      const shareBtnW = 110;
      this.erstellePhaserButton(ebene, rightX - shareBtnW / 2, barH / 2, shareBtnW, 28, '🔗 LINK', () => {
        const url = `${window.location.origin}#join/${tisch.einladungsCode}`;
        void navigator.clipboard.writeText(url);
      }, false, true);
    }
  }

  private renderEinstellungsModal(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    const dialogW = Math.round(Math.min(420, breite * 0.35));
    const dialogH = Math.round(Math.min(480, hoehe * 0.7));
    const dialogX = breite / 2;
    const dialogY = hoehe / 2;
    const backdrop = this.add.rectangle(dialogX, dialogY, breite, hoehe, 0x000000, 0.45).setInteractive();
    backdrop.on('pointerdown', () => { this.einstellungenOffen = false; this.renderTisch(zustand, modell); });
    ebene.add(backdrop);
    const panel = this.add.rectangle(dialogX, dialogY, dialogW, dialogH, 0x0b3d24, 0.97).setStrokeStyle(2, 0xd8f3dc, 0.35);
    ebene.add(panel);
    const schriftH2 = Math.round(Math.max(18, breite * 0.016));
    const schriftHint = Math.round(Math.max(11, breite * 0.009));
    const zeilenAbstand = 70;
    let currentY = dialogY - dialogH / 2 + 40;
    ebene.add(this.add.text(dialogX, currentY, 'Einstellungen', { color: '#f8f9fa', fontSize: `${schriftH2}px`, fontStyle: 'bold' }).setOrigin(0.5));
    currentY += 50;
    const tisch = zustand.aktuellerTisch;
    const darfKonf = zustand.spieler?.spielerId === tisch?.erstelltVonSpielerId && tisch?.status === 'WARTEND';
    ebene.add(this.add.text(dialogX, currentY, 'Tischhintergrund', { color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const bgOptionen: Tischhintergrund[] = ['FILZ_GRUEN', 'HOLZ_DUNKEL', 'BLAU_GRAFIK', 'RECHTECK_1', 'RECHTECK_2', 'OVAL_1', 'OVAL_2', 'RUND_1'];
    const aktuellerBgIdx = bgOptionen.indexOf(modell.tischhintergrund);
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, modell.tischhintergrund.replace(/_/g, ' '), () => {
      const naechsterIdx = (aktuellerBgIdx + 1) % bgOptionen.length;
      void appStore.aktualisiereAktuellenTischhintergrund(bgOptionen[naechsterIdx]);
    }, zustand.wirdGeladen || !darfKonf, true);
    currentY += zeilenAbstand - 20;
    ebene.add(this.add.text(dialogX, currentY, 'KI-Schwierigkeit', { color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const kiOptionen: Array<'LEICHT' | 'STANDARD' | 'SCHWER'> = ['LEICHT', 'STANDARD', 'SCHWER'];
    const aktuelleKi = tisch?.konfiguration.kiSchwierigkeit ?? 'STANDARD';
    const kiIdx = kiOptionen.indexOf(aktuelleKi as 'LEICHT' | 'STANDARD' | 'SCHWER');
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, aktuelleKi, () => {
      const naechsterIdx = (kiIdx + 1) % kiOptionen.length;
      void appStore.aktualisiereAktuelleKiSchwierigkeit(kiOptionen[naechsterIdx]);
    }, zustand.wirdGeladen || !darfKonf, true);
    currentY += zeilenAbstand - 20;
    ebene.add(this.add.text(dialogX, currentY, 'Animationen', { color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const geschw = this.uiManager?.getAnimationsGeschwindigkeit() ?? 1;
    const label = geschw === Infinity ? 'Geschw.: sofort' : `Geschw.: ${geschw}x`;
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, label, () => {
      this.uiManager?.zyklusGeschwindigkeit();
      this.renderTisch(zustand, modell);
    }, false, true);
    currentY += 60;
    const btnW = Math.round(dialogW * 0.4);
    this.erstellePhaserButton(ebene, dialogX - btnW / 2 - 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Zur Lobby', () => { this.scene.start('SpielverwaltungsSzene'); }, false, true);
    this.erstellePhaserButton(ebene, dialogX + btnW / 2 + 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Schließen', () => { this.einstellungenOffen = false; this.renderTisch(zustand, modell); }, false, false);
  }

  private renderHud(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, breite: number, hoehe: number): void {
    const hudW = Math.round(breite * 0.18);
    const hudX = 0;
    const hudY = 40;
    const hudH = hoehe - hudY;
    ebene.add(this.add.rectangle(hudX + hudW / 2, hudY + hudH / 2, hudW, hudH, 0x0b3d24, 0.95).setStrokeStyle(1, 0xd8f3dc, 0.2));
    let currentY = hudY + 20;
    const schriftName = Math.round(Math.max(13, breite * 0.010));
    const schriftInfo = Math.round(Math.max(10, breite * 0.008));
    const zeilenAbstand = 35;
    ebene.add(this.add.text(hudX + 15, currentY, 'SPIELER', { color: '#a3c4a8', fontSize: `${schriftInfo}px`, fontStyle: 'bold' }));
    currentY += 25;
    modell.spieler.forEach((spieler) => {
      const farbe = spieler.istSelbst ? '#ffd166' : '#f8f9fa';
      ebene.add(this.add.text(hudX + 15, currentY, spieler.anzeigeName, { color: farbe, fontSize: `${schriftName}px`, fontStyle: spieler.istSelbst ? 'bold' : 'normal' }));
      const info = `${spieler.stiche} Stiche${spieler.partei ? ' · ' + spieler.partei : ''}`;
      ebene.add(this.add.text(hudX + 15, currentY + 16, info, { color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
      currentY += zeilenAbstand + 10;
    });
    currentY += 10;
    if (modell.gesamtpunktestand.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'PUNKTESTAND', { color: '#a3c4a8', fontSize: `${schriftInfo}px`, fontStyle: 'bold' }));
      currentY += 25;
      modell.gesamtpunktestand.forEach((eintrag) => {
        ebene.add(this.add.text(hudX + 15, currentY, `${eintrag.name}: ${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte}`, { color: '#f8f9fa', fontSize: `${schriftName}px` }));
        currentY += 22;
      });
    }
    currentY += 15;
    if (modell.ansageHistorie.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'HISTORIE', { color: '#a3c4a8', fontSize: `${schriftInfo}px`, fontStyle: 'bold' }));
      currentY += 25;
      modell.ansageHistorie.slice(-6).reverse().forEach((ansage) => {
        ebene.add(this.add.text(hudX + 15, currentY, `${ansage.name}: ${formatiereAnsage(ansage.ansage)}`, { color: '#d8f3dc', fontSize: `${schriftInfo}px` }));
        currentY += 18;
      });
    }
  }

  private renderStichStapel(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, breite: number, hoehe: number): void {
    const kgroesse = berechneKartenGroesse(breite);
    const stapelW = Math.round(kgroesse.w * 0.55);
    const stapelH = Math.round(kgroesse.h * 0.55);
    const versatzPx = Math.round(stapelH * 0.09);
    modell.spieler.forEach((spieler) => {
      if (spieler.stiche <= 0) return;
      const kartenAnzahl = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten.length : Math.max(spieler.verbleibendeKarten, 0);
      const pos = stichStapelPositionFuer(spieler.position, breite, hoehe, kartenAnzahl);
      const anzahlSichtbar = Math.min(4, spieler.stiche);
      const istVertikal = spieler.position === 'SUED' || spieler.position === 'NORD';
      for (let i = 0; i < anzahlSichtbar; i++) {
        const versatz = -(anzahlSichtbar - 1 - i) * versatzPx;
        const kx = pos.x + (istVertikal ? 0 : versatz);
        const ky = pos.y + (istVertikal ? versatz : 0);
        ebene.add(this.erstelleKartenansicht(kx, ky, stapelW, stapelH, { verdeckt: true }).setAngle(pos.winkel).setAlpha(0.88));
      }
      ebene.add(this.add.text(pos.x, pos.y + Math.round(stapelH * 0.65), `${spieler.stiche}`, { color: '#ffd166', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px`, fontStyle: 'bold', backgroundColor: '#0d3d1e', padding: { x: 3, y: 1 } }).setOrigin(0.5));
      if (spieler.istSelbst) {
        const letzterEigenerStich = modell.letzteAbgeschlosseneStiche.filter((s) => s.gewinnerPosition === 'SUED').at(-1);
        if (letzterEigenerStich) {
          const hitZone = this.add.rectangle(pos.x, pos.y, stapelW * 1.3, stapelH * 1.3 + stapelH * 0.65, 0xffffff, 0).setInteractive({ useHandCursor: true });
          hitZone.on('pointerdown', () => { if (this.letzterStichOverlay) this.versteckeLetztesStichOverlay(); else this.zeigeLetztesStichOverlay(letzterEigenerStich, breite, hoehe); });
          ebene.add(hitZone);
        }
      }
    });
  }

  private zeigeLetztesStichOverlay(stich: AbgeschlossenerStichAnsicht, breite: number, hoehe: number): void {
    this.versteckeLetztesStichOverlay();
    const kgroesse = berechneKartenGroesse(breite);
    const kAbstand = Math.round(kgroesse.w * 1.15);
    const panelW = Math.max(4 * kgroesse.w + 3 * (kAbstand - kgroesse.w) + kgroesse.w, 300);
    const panelH = kgroesse.h * 1.7;
    const container = this.add.container(0, 0);
    const backdrop = this.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, 0x000000, 0.45).setInteractive({ useHandCursor: false });
    backdrop.on('pointerdown', () => this.versteckeLetztesStichOverlay());
    container.add(backdrop);
    container.add(this.add.rectangle(breite / 2, hoehe / 2, panelW, panelH, 0x0a2818, 0.97).setStrokeStyle(2, 0x4adf7a, 0.7));
    container.add(this.add.text(breite / 2, hoehe / 2 - panelH * 0.38, `Letzter Stich — ${stich.augen} Augen`, { color: '#ffd166', fontSize: `${Math.round(Math.max(12, breite * 0.011))}px`, fontStyle: 'bold' }).setOrigin(0.5));
    const startX = breite / 2 - ((stich.gespielteKarten.length - 1) * kAbstand) / 2;
    stich.gespielteKarten.forEach((e, i) => {
      const ansicht = this.erstelleKartenansicht(startX + i * kAbstand, hoehe / 2 + panelH * 0.05, kgroesse.w, kgroesse.h, { karte: e.karte });
      ansicht.setScale(0, 1);
      container.add(ansicht);
      this.tweens.add({ targets: ansicht, scaleX: 1, duration: 150, ease: 'Cubic.Out', delay: i * 60 });
    });
    container.add(this.add.text(breite / 2, hoehe / 2 + panelH * 0.44, 'Klick zum Schliessen', { color: '#a3c4a8', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px` }).setOrigin(0.5));
    this.letzterStichOverlay = container;
    this.letzterStichTimer = this.time.addEvent({ delay: 4000, callback: () => this.versteckeLetztesStichOverlay(), callbackScope: this });
  }

  private versteckeLetztesStichOverlay(): void {
    this.letzterStichTimer?.remove(false);
    this.letzterStichTimer = undefined;
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
  }

  private renderStichmitte(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, mitteX: number, mitteY: number, breite: number, hoehe: number): void {
    if (modell.aktuelleStichmitte.length === 0) return;
    const slotPos = stichSlotPositionen(mitteX, mitteY, breite, hoehe);
    const kg = berechneKartenGroesse(breite);
    modell.aktuelleStichmitte.forEach((e) => {
      const s = slotPos[e.position];
      const k = this.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: e.karte });
      k.setAngle(s.winkel);
      ebene.add(k);
    });
  }

  private erstelleKartenansicht(x: number, y: number, w: number, h: number, opt: { karte?: { farbe: string; wert: string }; verdeckt?: boolean }): Kartenansicht {
    if (opt.karte) return Kartenansicht.offen(this, x, y, opt.karte.farbe, opt.karte.wert, w, h);
    if (opt.verdeckt) return Kartenansicht.verdeckt(this, x, y, w, h);
    return Kartenansicht.leer(this, x, y, w, h);
  }

  private renderNameplate(ebene: Phaser.GameObjects.Container, spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell, layout: TischLayout, breite: number, hoehe: number): void {
    const npW = Math.max(120, breite * 0.11);
    const npH = Math.max(54, hoehe * 0.075);
    const kAb = berechneKartenAbstand(breite, hoehe);
    const kG = berechneKartenGroesse(breite);
    const kAnzahl = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten.length : Math.max(spieler.verbleibendeKarten, 0);
    let pos: { x: number; y: number };
    if (spieler.position === 'SUED') {
      const fH = kAnzahl > 0 ? ((kAnzahl - 1) * kAb.horizontal + kG.w) / 2 : 0;
      pos = { x: Math.min(breite / 2 + fH + npW / 2 + 40, breite - npW / 2 - 4), y: hoehe * 0.85 };
    } else if (spieler.position === 'NORD') {
      const fH = kAnzahl > 0 ? ((kAnzahl - 1) * kAb.horizontal + kG.w) / 2 : 0;
      pos = { x: Math.max(breite / 2 - fH - npW / 2 - 20, npW / 2 + 4), y: hoehe * 0.15 };
    } else if (spieler.position === 'WEST') {
      const fU = layout.WEST.kartenY + (kAnzahl > 0 ? (kAnzahl - 1) * kAb.vertikal : 0) + kG.h / 2;
      pos = { x: Math.max(npW / 2 + 4, layout.WEST.kartenX), y: Math.min(fU + npH / 2 + 50, hoehe - npH / 2 - 4) };
    } else {
      const fO = layout.OST.kartenY - kG.h / 2;
      pos = { x: Math.min(breite - npW / 2 - 4, layout.OST.kartenX), y: Math.max(fO - npH / 2 - 12, npH / 2 + 4) };
    }
    const rad = Math.max(6, Math.round(npH * 0.15));
    const aR = Math.max(2, Math.round(npH * 0.04));
    const hg = spieler.istAktivHervorgehoben ? 0x1a4a20 : 0x0d3d1e;
    const g = this.add.graphics();
    if (spieler.istAktivHervorgehoben) { g.fillStyle(0xffe082, 0.18); g.fillRoundedRect(pos.x - npW / 2 - 5, pos.y - npH / 2 - 5, npW + 10, npH + 10, rad + 3); }
    g.fillStyle(hg, 0.55); g.fillRoundedRect(pos.x - npW / 2, pos.y - npH / 2, npW, npH, rad);
    g.lineStyle(aR, spieler.istAktivHervorgehoben ? 0xffe082 : 0x111111, spieler.istAktivHervorgehoben ? 1 : 0.9);
    g.strokeRoundedRect(pos.x - npW / 2, pos.y - npH / 2, npW, npH, rad);
    g.lineStyle(1, 0xe5e7eb, 0.4); g.strokeRoundedRect(pos.x - npW / 2 + aR, pos.y - npH / 2 + aR, npW - aR * 2, npH - aR * 2, Math.max(3, rad - aR));
    ebene.add(g);
    const nS = Math.round(Math.max(15, breite * 0.014));
    const kS = Math.round(Math.max(10, breite * 0.009));
    if (spieler.avatarFarbe) { ebene.add(this.add.circle(pos.x - npW * 0.38, pos.y - npH * 0.22, nS * 0.55, parseInt(spieler.avatarFarbe.replace('#', ''), 16), 1)); }
    ebene.add(this.add.text(pos.x, pos.y - npH * 0.22, spieler.anzeigeName, { color: '#f8f9fa', fontSize: `${nS}px`, fontStyle: 'bold' }).setOrigin(0.5));
    if (spieler.partei) { ebene.add(this.add.text(pos.x, pos.y - npH / 2 - 10, spieler.partei, { color: spieler.partei === 'RE' ? '#ffd166' : '#90caf9', fontSize: `${kS}px`, fontStyle: 'bold' }).setOrigin(0.5)); }
    const ansageBadges: Partial<Record<string, string>> = { KEINE_90: 'K90', KEINE_60: 'K60', KEINE_30: 'K30', SCHWARZ: 'S' };
    const ansSuf = modell.ansageHistorie.filter((a) => a.position === spieler.position && ansageBadges[a.ansage] !== undefined).map((a) => ansageBadges[a.ansage]).join(' ');
    ebene.add(this.add.text(pos.x, pos.y + npH * 0.22, `${spieler.istSelbst ? 'Du' : spieler.istMensch ? 'Mensch' : 'KI'} · ${spieler.stiche} Stiche${spieler.istGeber ? ' G' : ''}${ansSuf ? ' · ' + ansSuf : ''}`, { color: spieler.istGeber ? '#ffd166' : '#a3c4a8', fontSize: `${kS}px` }).setOrigin(0.5));
  }

  private renderKartenFaecher(ebene: Phaser.GameObjects.Container, layout: TischLayout, spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell): void {
    const pos = layout[spieler.position];
    const offen = spieler.istSelbst || (modell.debugModus && spieler.sichtbareHandkarten.length > 0);
    const sichtbare = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
    const kAnzahl = sichtbare?.length ?? Math.max(spieler.verbleibendeKarten, 0);
    const armutK = spieler.istSelbst ? this.ermittleArmutAuswahl(modell, sichtbare ?? []) : null;
    const hatInt = spieler.istSelbst && (modell.spielbareKarten.length > 0 || armutK !== null);
    const { width: szB, height: szH } = this.scale.gameSize;
    const kG = berechneKartenGroesse(szB);
    const kAb = berechneKartenAbstand(szB, szH);
    const auswV = Math.round(kG.h * 0.19);
    const istH = spieler.position === 'SUED' || spieler.position === 'NORD';
    const stX = istH ? szB / 2 - ((kAnzahl - 1) * kAb.horizontal) / 2 : pos.kartenX;
    const [fB, fS]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[spieler.position] as [number, number];
    const istGesp = spieler.position === 'NORD' || spieler.position === 'OST';
    const animA = !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    for (let i = 0; i < kAnzahl; i++) {
      const fI = istGesp ? kAnzahl - 1 - i : i;
      const ab = istH ? fI * kAb.horizontal : fI * kAb.vertikal;
      const x = istH ? stX + ab : pos.kartenX;
      const y = istH ? pos.kartenY : pos.kartenY + ab;
      const w = fB + fI * fS;
      const k = sichtbare?.[i];
      const istSp = k ? modell.spielbareKarten.includes(k.id) : false;
      const istArm = k ? (armutK?.has(k.id) ?? false) : false;
      const istInt = !animA && (istSp || istArm);
      const istAus = k ? this.ausgewaehlteArmutKarten.has(k.id) : false;
      const istTast = spieler.istSelbst && k !== undefined && this.tastaturKarteIndex >= 0 && modell.spielbareKarten[this.tastaturKarteIndex] === k.id;
      const bV = (istAus || istTast) ? -auswV : 0;
      const kA = offen ? this.erstelleKartenansicht(x, y + bV, kG.w, kG.h, k ? { karte: k } : {}) : this.erstelleKartenansicht(x, y + bV, kG.w, kG.h, { verdeckt: true });
      kA.setAngle(w).setAlpha(this.austeilenAktiv ? 0 : (offen ? (hatInt && k && !istInt ? 0.45 : 1) : 0.92));
      if (istAus) kA.markiereAuswahl(); else if (istTast) kA.markiereTastaturfokus(); else kA.loescheMarkierung();
      ebene.add(kA);
      if (k) this.handKartenobjekte.set(k.id, { wurzel: kA, bild: kA.bildObjekt });
      if (offen && k && istInt) {
        kA.setInteractive({ useHandCursor: true });
        const hV = Math.round(kG.h * 0.08);
        kA.on('pointerover', () => kA.setY(y + bV - hV));
        kA.on('pointerout', () => kA.setY(y + bV));
        kA.on('pointerdown', () => { if (istSp) void this.spieleKarteMitAnimation(k.id); else { this.toggleArmutKarte(k.id, modell.armutAktion?.kartenAnzahl ?? 0); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); } });
      }
    }
  }

  private bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) return;
    appStore.beantworteArmut(true, Array.from(this.ausgewaehlteArmutKarten));
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const a = modell.armutAktion;
    if (!a || modell.aktuellerSpieler !== 'SUED') return null;
    if (a.modus === 'ANTWORTEN' && !this.armutAnnahmeAktiv) return null;
    const ids = a.modus === 'ANBIETEN' ? handkarten.filter((k) => istTrumpfFuerSpieltyp(k, modell.spieltyp)).map((k) => k.id) : handkarten.map((k) => k.id);
    return new Set(ids);
  }

  private synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== 'SUED') { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); return; }
    if (modell.armutAktion.modus === 'ANBIETEN') this.armutAnnahmeAktiv = false;
    const eigeneHand = modell.spieler.find((s) => s.istSelbst)?.sichtbareHandkarten ?? [];
    const sichtbareIds = new Set(eigeneHand.map((k) => k.id));
    this.ausgewaehlteArmutKarten = new Set([...this.ausgewaehlteArmutKarten].filter((id) => sichtbareIds.has(id)).slice(0, modell.armutAktion.kartenAnzahl));
  }

  private toggleArmutKarte(id: string, max: number): void {
    if (max <= 0) return;
    if (this.ausgewaehlteArmutKarten.has(id)) this.ausgewaehlteArmutKarten.delete(id);
    else if (this.ausgewaehlteArmutKarten.size < max) this.ausgewaehlteArmutKarten.add(id);
  }

  private erstelleModell(zustand: AppZustand): TischAnsichtModell {
    return erstelleTischAnsichtAusStatus(zustand.spieler?.spielerId ?? null, zustand.aktuellerTisch, zustand.partieStand, zustand.debugModus);
  }

  private synchronisiereAnimationszustand(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.wartendeKartenId) return;
    const sHand = modell.spieler.find((s) => s.istSelbst)?.sichtbareHandkarten ?? [];
    const inHand = sHand.some((k) => k.id === this.wartendeKartenId);
    const imStich = modell.aktuelleStichmitte.some((e) => e.karte.id === this.wartendeKartenId);
    if (!inHand || imStich || zustand.meldung?.typ === 'fehler') this.wartendeKartenId = null;
  }

  private async spieleKarteMitAnimation(id: string): Promise<void> {
    if (this.wartendeKartenId || this.animationen?.animationLaeuft) return;
    const kObj = this.handKartenobjekte.get(id);
    if (!kObj) { appStore.spieleKarte(id); return; }
    const { width: b, height: h } = this.scale.gameSize;
    const ziel = stichSlotPositionen(b / 2, h / 2, b, h).SUED;
    this.wartendeKartenId = id;
    await this.animationen?.reiheEin(async () => {
      await this.animationen?.animiereKarteAusspielen(kObj, ziel);
      appStore.spieleKarte(id);
      window.setTimeout(() => { if (this.wartendeKartenId === id) this.wartendeKartenId = null; }, 4000);
    });
  }

  private async starteFolgeanimationen(vModell: TischAnsichtModell | null, aModell: TischAnsichtModell): Promise<void> {
    const stich = this.ermittleNeuAbgeschlossenenStich(vModell, aModell);
    if (!stich) return;
    const { width: b, height: h } = this.scale.gameSize;
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h);
    const gSp = aModell.spieler.find((s) => s.position === stich.gewinnerPosition);
    const gKAnz = gSp ? (gSp.sichtbareHandkarten.length > 0 ? gSp.sichtbareHandkarten.length : Math.max(gSp.verbleibendeKarten, 0)) : 0;
    const ziel = stichStapelPositionFuer(stich.gewinnerPosition, b, h, gKAnz);
    const kg = berechneKartenGroesse(b);
    const animK = stich.gespielteKarten.map((k) => { const s = slotPos[k.position]; const w = this.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: k.karte }); return { wurzel: w, bild: w.bildObjekt }; });
    const npPos = nameplatePositionFuer(stich.gewinnerPosition, b, h);
    const istH = stich.gewinnerPosition === 'SUED' || stich.gewinnerPosition === 'NORD';
    const flash = this.add.rectangle(npPos.x, npPos.y, istH ? Math.max(120, b * 0.11) : Math.max(80, b * 0.07), istH ? Math.max(54, h * 0.075) : Math.max(80, h * 0.11), 0xffe082, 0.7).setDepth(150).setAlpha(0);
    try { await this.animationen?.animiereStichEinziehen(animK, ziel, stich.augen, flash); } finally { animK.forEach((k) => k.wurzel.destroy()); flash.destroy(); }
  }

  private async starteGegnerKartenAnimationen(vModell: TischAnsichtModell | null, aModell: TischAnsichtModell): Promise<void> {
    if (!vModell) return;
    const eigPos = aModell.spieler.find((s) => s.istSelbst)?.position;
    const neueGK = aModell.aktuelleStichmitte.filter((e) => e.position !== eigPos && !vModell.aktuelleStichmitte.some((v) => v.karte.id === e.karte.id));
    if (neueGK.length === 0) return;
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h);
    const kg = berechneKartenGroesse(b);
    await Promise.all(neueGK.map(async (e) => {
      const tempK = this.erstelleKartenansicht(layout[e.position].kartenX, layout[e.position].kartenY, kg.w, kg.h, { verdeckt: true });
      try { await this.animationen?.animiereKarteAusspielen({ wurzel: tempK }, slotPos[e.position]); } finally { tempK.destroy(true); }
    }));
  }

  private ermittleNeuesSpiel(vSt: AppZustand | undefined, aSt: AppZustand): boolean {
    if (!vSt) return false;
    const aN = aSt.partieStand?.laufendesSpiel?.spielNummer;
    if (!aN) return false;
    const vN = vSt.partieStand?.laufendesSpiel?.spielNummer;
    if (!vN) return vSt.aktuellerTisch?.status === 'WARTEND';
    return vN !== aN;
  }

  private async starteAusteilen(modell: TischAnsichtModell, zustand: AppZustand): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const pakete: Array<{ kartenobjekte: AnimierbareKartenobjekte; ziel: { x: number; y: number } }> = [];
    for (const s of modell.spieler) {
      const kAnz = s.sichtbareHandkarten.length > 0 ? s.sichtbareHandkarten.length : Math.max(s.verbleibendeKarten, 0);
      const kg = berechneKartenGroesse(b);
      const kAb = berechneKartenAbstand(b, h);
      const istH = s.position === 'SUED' || s.position === 'NORD';
      const stX = istH ? b / 2 - ((kAnz - 1) * kAb.horizontal) / 2 : layout[s.position].kartenX;
      const [fB, fS]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[s.position] as [number, number];
      const istG = s.position === 'NORD' || s.position === 'OST';
      for (let i = 0; i < kAnz; i++) {
        const fI = istG ? kAnz - 1 - i : i;
        const w = fB + fI * fS;
        const k = s.sichtbareHandkarten?.[i];
        const wuz = (s.istSelbst && k) ? this.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { karte: k }) : this.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { verdeckt: true });
        wuz.setAngle(w);
        pakete.push({ kartenobjekte: { wurzel: wuz, bild: wuz.bildObjekt }, ziel: { x: istH ? stX + fI * kAb.horizontal : layout[s.position].kartenX, y: istH ? layout[s.position].kartenY : layout[s.position].kartenY + fI * kAb.vertikal } });
      }
    }
    try { await this.animationen?.animiereKartenAusteilen(pakete); } finally { pakete.forEach((p) => p.kartenobjekte.wurzel.destroy()); this.austeilenAktiv = false; this.renderTisch(this.letzterZustand ?? zustand); }
  }

  private ermittleNeuAbgeschlossenenStich(vM: TischAnsichtModell | null, aM: TischAnsichtModell): TischAnsichtModell['letzteAbgeschlosseneStiche'][number] | null {
    if (!vM) return null;
    const lA = aM.letzteAbgeschlosseneStiche.at(-1);
    if (!lA) return null;
    const lV = vM.letzteAbgeschlosseneStiche.at(-1);
    if (lV && lV.spielNummer === lA.spielNummer && lV.stichNummer === lA.stichNummer) return null;
    return lA;
  }

  private ermittleNeueAnsagen(vM: TischAnsichtModell | null, aM: TischAnsichtModell): AnsageAnsicht[] {
    if (!vM) return [];
    return aM.ansageHistorie.slice(vM.ansageHistorie.length);
  }

  private async starteAnsageBannerAnimationen(neue: AnsageAnsicht[]): Promise<void> {
    for (const a of neue) {
      const { width: b, height: h } = this.scale.gameSize;
      const f = a.ansage === 'RE' ? '#ffd166' : a.ansage === 'KONTRA' ? '#90caf9' : '#ffffff';
      await this.animationen?.animiereAnsageBanner(`${a.name}\n${formatiereAnsage(a.ansage)}`, { x: b / 2, y: h * 0.18 }, undefined, f);
    }
  }

  private formatiereEreignisSonderpunkt(sp: SonderpunktEreignisAntwortDto): string {
    return { FUCHS_GEFANGEN: 'Fuchs gefangen!', DOPPELKOPF: 'Doppelkopf!', KARLCHEN: 'Karlchen!' }[sp.typ];
  }

  private async starteSonderpunktFeedbackAnimationen(texte: string[]): Promise<void> {
    for (const t of texte) { await this.animationen?.animiereSonderpunktFeedback(t, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 }); }
  }

  private ermittleHochzeitEreignis(vS: AppZustand | null, aS: AppZustand): string | null {
    const vG = vS?.partieStand?.laufendesSpiel;
    const aG = aS.partieStand?.laufendesSpiel;
    if (!vG || !aG) return null;
    if (vG.spieltyp === 'HOCHZEIT' && aG.spieltyp !== 'HOCHZEIT') return 'Stilles Solo';
    if (aG.spieltyp !== 'HOCHZEIT') return null;
    for (const s of aG.spieler) {
      if (s.istSelbst) continue;
      if (vG.spieler.find((os) => os.position === s.position)?.partei === null && s.partei === 'RE') return `Partner gefunden: ${s.name}`;
    }
    return null;
  }

  private async zeigeHochzeitEreignis(m: string | null): Promise<void> {
    if (m) await this.animationen?.animiereSonderpunktFeedback(m, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height * 0.4 }, 2000);
  }

  private ermittleSpielankuendigung(vS: AppZustand | null, aS: AppZustand): string | null {
    const vG = vS?.partieStand?.laufendesSpiel;
    const aG = aS.partieStand?.laufendesSpiel;
    if (!vG || !aG) return null;
    const aT = aG.spieltyp;
    if (vG.spielNummer !== aG.spielNummer) { if (aT === 'NORMALSPIEL') return null; }
    else if (vG.spieltyp === aT || vG.spieltyp !== 'NORMALSPIEL') return null;
    const labels: Partial<Record<string, string>> = { SOLO_DAME: 'Damensolo', SOLO_BUBE: 'Bubensolo', SOLO_TRUMPF: 'Karosolo', SOLO_TRUMPF_HERZ: 'Herzsolo', SOLO_TRUMPF_PIK: 'Piksolo', SOLO_TRUMPF_KREUZ: 'Kreuzsolo', SOLO_FLEISCHLOS: 'Fleischlos', HOCHZEIT: 'Hochzeit', ARMUT: 'Armut' };
    const label = labels[aT] ?? aT;
    const solist = aG.spieler.find((s) => s.partei === 'RE');
    return solist ? `${solist.name} spielt ${label}` : label;
  }

  private async zeigeSpielankuendigung(m: string | null): Promise<void> {
    if (m) await this.animationen?.animiereSoloAnkuendigung(m, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 });
  }

  private ermittleBockrundeEreignis(vS: AppZustand | null, aS: AppZustand): boolean {
    if (!vS || !aS.partieStand?.laufendesSpiel?.istBockrunde) return false;
    return vS.partieStand?.laufendesSpiel?.spielNummer !== aS.partieStand?.laufendesSpiel?.spielNummer;
  }

  private async zeigeBockrundeEreignis(): Promise<void> {
    await this.animationen?.animiereBockrunde({ x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 });
  }

  private ermittleSchweinchenEreignis(vM: TischAnsichtModell | null, aM: TischAnsichtModell): string | null {
    if (!aM.schweinchenGemeldetVon || vM?.schweinchenGemeldetVon === aM.schweinchenGemeldetVon) return null;
    const s = aM.spieler.find((ps) => ps.position === aM.schweinchenGemeldetVon);
    return `${s?.name ?? aM.schweinchenGemeldetVon}: Schweinchen!`;
  }

  private async zeigeSchweinchenBanner(m: string): Promise<void> {
    await this.animationen?.animiereAnsageBanner(m, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height * 0.18 }, undefined, '#ff69b4');
  }

  private async zeigeGewinnerFlash(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) return;
    const { width: b, height: h } = this.scale.gameSize;
    await this.animationen?.animiereGewinnerFlash(`${e.siegerPartei} gewinnt!`, m.spieler.filter((s) => s.partei === e.siegerPartei).map((s) => s.name).join(', '), `+${e.spielwert} Punkte`, e.siegerPartei === 'RE' ? '#ffd166' : '#90caf9', { x: b / 2, y: h / 2 });
  }

  private erkennteNeuesSpielErgebnis(vM: TischAnsichtModell | null, aM: TischAnsichtModell): boolean {
    if (!vM || !aM.letztesSpielergebnis) return false;
    return vM.letztesSpielergebnis?.spielNummer !== aM.letztesSpielergebnis.spielNummer;
  }

  private async zeigeRundenEndeModal(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!this.rundenEndeModal || !e) return;
    const anzahlS = this.letzterZustand?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));
    const bZ: string[] = [`Grundwert: +${e.grundwert}`];
    if (e.absagePunkte !== 0) bZ.push(`Ansagen: ${e.absagePunkte > 0 ? '+' : ''}${e.absagePunkte}`);
    if (e.gegenDieAltenPunkte > 0) bZ.push(`Gegen die Alten: +${e.gegenDieAltenPunkte}`);
    const sp = [...e.sonderpunkteRe.map((s) => `Re: ${formatiereSonderpunkt(s, sNMap)}`), ...e.sonderpunkteKontra.map((s) => `Kontra: ${formatiereSonderpunkt(s, sNMap)}`)];
    if (sp.length > 0) bZ.push(`Sonderpunkte: +${sp.length}`);
    if (e.soloMultiplikator === 3) bZ.push('Solo-Multiplikator: ×3');
    const daten: RundenauswertungDaten = { spieltypLabel: formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp, spielNummerText: anzahlS ? `Spiel ${e.spielNummer} von ${anzahlS}` : `Spiel ${e.spielNummer}`, siegerPartei: e.siegerPartei, spielwert: e.spielwert, reSpielerNamen: m.spieler.filter((s) => s.partei === 'RE').map((s) => s.name).join(', ') || '–', kontraSpielerNamen: m.spieler.filter((s) => s.partei === 'KONTRA').map((s) => s.name).join(', ') || '–', augenRe: e.augenRe, augenKontra: e.augenKontra, berechnungZeilen: bZ, spielpunkte: e.spielpunkte.map((p) => ({ name: p.name, punkte: p.punkte, istSelbst: p.position === 'SUED' })), gesamtstand: m.gesamtpunktestand.map((p) => ({ name: p.name, punkte: p.punkte })) };
    const { width: b, height: h } = this.scale.gameSize;
    if (this.animationen) this.rundenauswertungObjekte = await this.animationen.animiereRundenauswertung(daten, b, h);
    const btn = this.erstelleButton('Weiter →', () => this.schliesseRundenEndeModal(), false);
    btn.dataset['testid'] = 'btn-rundenauswertung-weiter';
    const sTS = document.createElement('span'); sTS.dataset['testid'] = 'rundenauswertung-spieltyp'; sTS.textContent = daten.spieltypLabel; sTS.hidden = true;
    const mS = document.createElement('span'); mS.dataset['testid'] = 'rundenauswertung-punktemultiplikator'; mS.textContent = e.soloMultiplikator === 3 ? '×3' : '×1'; mS.hidden = true;
    this.rundenEndeModal.innerHTML = ''; this.rundenEndeModal.className = 'ui-rundenauswertung-overlay'; this.rundenEndeModal.append(btn, sTS, mS); this.rundenEndeModal.hidden = false;
    setTimeout(() => btn.focus(), 0);
    this.escapeHandler = (ev: KeyboardEvent) => { if (ev.key === 'Escape') this.schliesseRundenEndeModal(); };
    document.addEventListener('keydown', this.escapeHandler);
    this.backdropClickHandler = (ev: MouseEvent) => { if (ev.target === this.rundenEndeModal) this.schliesseRundenEndeModal(); };
    this.rundenEndeModal.addEventListener('click', this.backdropClickHandler);
  }

  private schliesseRundenEndeModal(): void {
    if (!this.rundenEndeModal) return;
    this.rundenEndeModal.hidden = true; this.rundenEndeModal.innerHTML = '';
    this.rundenauswertungObjekte.forEach((o) => o.destroy()); this.rundenauswertungObjekte = [];
    if (this.escapeHandler) { document.removeEventListener('keydown', this.escapeHandler); this.escapeHandler = undefined; }
    if (this.backdropClickHandler && this.rundenEndeModal) { this.rundenEndeModal.removeEventListener('click', this.backdropClickHandler); this.backdropClickHandler = undefined; }
  }

  private zeigePartieEndeModal(m: TischAnsichtModell): void {
    if (!this.partieEndeModal) return;
    const dia = document.createElement('div'); dia.className = 'ui-modal';
    const tit = document.createElement('h2'); tit.textContent = 'Partie beendet!';
    const gsT = document.createElement('strong'); gsT.textContent = 'Gesamtpunktestand';
    const gsL = document.createElement('ul'); gsL.className = 'ui-list ui-list--dense'; gsL.dataset['testid'] = 'partieende-gesamtauswertung';
    [...m.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte).forEach((ei) => {
      const li = document.createElement('li'); li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `<div class="ui-list-item__headline"><strong>${escapeHtml(ei.name)}</strong><span class="ui-badge ${ei.position === 'SUED' ? 'ui-badge--highlight' : ''}">${ei.position}</span></div><div class="ui-list-item__meta"><span>${ei.punkte >= 0 ? '+' : ''}${ei.punkte} Punkte</span></div>`;
      gsL.append(li);
    });
    const cS = document.createElement('span'); cS.className = 'ui-hint'; cS.dataset['testid'] = 'partieende-neustart-countdown'; cS.textContent = 'Neue Partie startet in 10 Sekunden ...';
    const aR = document.createElement('div'); aR.className = 'ui-action-row';
    const nPB = this.erstelleButton('Jetzt starten', () => { this.schliessePartieEndeModal(); void appStore.starteNeuePartie(); }, false);
    const vB = this.erstelleButton('Tisch verlassen', () => { this.schliessePartieEndeModal(); void appStore.verlasseAktuellenTisch(); }, true); vB.classList.add('ui-button--secondary');
    aR.append(nPB, vB); dia.append(tit, gsT, gsL, cS, aR); this.partieEndeModal.innerHTML = ''; this.partieEndeModal.append(dia); this.partieEndeModal.hidden = false;
    let vZ = 10; this.countdownTimerId = setInterval(() => { vZ -= 1; if (vZ <= 0) { this.schliessePartieEndeModal(); void appStore.starteNeuePartie(); } else cS.textContent = `Neue Partie startet in ${vZ} Sekunden ...`; }, 1000);
  }

  private schliessePartieEndeModal(): void {
    if (this.countdownTimerId !== undefined) { clearInterval(this.countdownTimerId); this.countdownTimerId = undefined; }
    if (!this.partieEndeModal) return;
    this.partieEndeModal.hidden = true; this.partieEndeModal.innerHTML = '';
  }

  private erstellePhaserButton(ebene: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, txt: string, hdl: () => void, d = false, s = false, hv = false): void {
    const hgF = d ? 0x2a2a2a : hv ? 0xffd166 : s ? 0x1a2a1a : 0x1a5a2a;
    const rF = d ? 0x555555 : hv ? 0xf8f9fa : s ? 0x4a7a5a : 0x4adf7a;
    const tF = d ? '#888888' : hv ? '#0d1f12' : '#f8f9fa';
    const bg = this.add.rectangle(x, y, w, h, hgF, d ? 0.5 : 0.92).setStrokeStyle(hv ? 2 : 1, rF, 0.9);
    ebene.add(bg); ebene.add(this.add.text(x, y, txt, { color: tF, fontSize: `${Math.round(Math.max(12, this.scale.gameSize.width * 0.011))}px`, fontStyle: 'bold' }).setOrigin(0.5));
    if (!d) bg.setInteractive({ useHandCursor: true }).on('pointerdown', hdl);
  }

  private renderVorbehaltDialog(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheVorbehalte.length === 0) return;
    const opt = modell.moeglicheVorbehalte;
    const bH = Math.round(Math.max(32, hoehe * 0.048));
    const bW = Math.round(Math.min(130, breite * 0.11));
    const aX = Math.round(breite * 0.008);
    const aY = Math.round(bH * 0.3);
    const spal = 2;
    const zeil = Math.ceil(opt.length / spal);
    const diaW = spal * bW + (spal + 1) * aX;
    const titH = Math.round(hoehe * 0.04);
    const zeiH = Math.round(hoehe * 0.025);
    const aDek = modell.deklarierteVorbehalte.filter((d) => d.position !== 'SUED');
    const diaH = titH + (aDek.length > 0 ? aDek.length * zeiH + Math.round(zeiH * 0.5) : 0) + zeil * (bH + aY) + aY;
    const diaY = Math.round(hoehe * 0.28);
    ebene.add(this.add.rectangle(breite / 2, diaY, diaW, diaH, 0x0a2818, 0.97).setStrokeStyle(2, 0x4adf7a, 0.7));
    ebene.add(this.add.text(breite / 2, diaY - diaH / 2 + titH * 0.5, 'Vorbehalt ansagen', { color: '#f8f9fa', fontSize: `${Math.round(Math.max(13, breite * 0.012))}px`, fontStyle: 'bold' }).setOrigin(0.5));
    if (aDek.length > 0) {
      const sY = diaY - diaH / 2 + titH + zeiH * 0.5;
      aDek.forEach((d, i) => {
        const sN = modell.spieler.find((s) => s.position === d.position)?.name ?? d.position;
        const hV = d.ansage !== 'GESUND';
        ebene.add(this.add.text(breite / 2, sY + i * zeiH, `${sN}: ${hV ? '⚑ Vorbehalt' : '✓ Gesund'}`, { color: hV ? '#ffd700' : '#aaffaa', fontSize: `${Math.round(Math.max(11, breite * 0.009))}px` }).setOrigin(0.5));
      });
    }
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const gX = breite / 2 - bW / 2 - aX / 2;
    const gY = diaY - diaH / 2 + titH + (aDek.length > 0 ? aDek.length * zeiH + Math.round(zeiH * 0.5) : 0) + aY + bH / 2;
    opt.forEach((v, i) => {
      this.erstellePhaserButton(ebene, gX + (i % spal) * (bW + aX), gY + Math.floor(i / spal) * (bH + aY), bW, bH, formatiereVorbehalt(v), () => appStore.meldeVorbehalt(v), dkt, false, i === this.tastaturVorbehaltIndex);
    });
  }

  private renderAnsageButtons(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheAnsagen.length === 0) return;
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const bH = Math.round(Math.max(32, hoehe * 0.048));
    const bW = Math.round(Math.min(110, breite * 0.09));
    const ab = Math.round(breite * 0.008);
    const ans = modell.moeglicheAnsagen;
    const sP = modell.spieler.find((s) => s.position === 'SUED');
    const kAnz = sP ? (sP.sichtbareHandkarten.length > 0 ? sP.sichtbareHandkarten.length : Math.max(sP.verbleibendeKarten, 0)) : 0;
    const kAb = berechneKartenAbstand(breite, hoehe);
    const kG = berechneKartenGroesse(breite);
    const npX = Math.min(breite / 2 + (kAnz > 0 ? ((kAnz - 1) * kAb.horizontal + kG.w) / 2 : 0) + Math.max(120, breite * 0.11) / 2 + 40, breite - Math.max(120, breite * 0.11) / 2 - 4);
    const stX = npX - (ans.length * (bW + ab) - ab) / 2 + bW / 2;
    const y = Math.min(hoehe * 0.85 + Math.max(54, hoehe * 0.075) / 2 + bH / 2 + 8, hoehe - bH / 2 - 4);
    ans.forEach((a, i) => { this.erstellePhaserButton(ebene, stX + i * (bW + ab), y, bW, bH, formatiereAnsage(a), () => appStore.sageAnsageAn(a), dkt); });
  }

  private renderArmutBereich(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== 'SUED') return;
    const a = modell.armutAktion;
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const bH = Math.round(Math.max(32, hoehe * 0.048));
    const y = hoehe * 0.73;
    if (a.modus === 'ANBIETEN') {
      const anz = this.ausgewaehlteArmutKarten.size;
      ebene.add(this.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Trumpfkarte${a.kartenAnzahl === 1 ? '' : 'n'} (${anz}/${a.kartenAnzahl} gewaehlt)`, { color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
      this.erstellePhaserButton(ebene, breite / 2, y, Math.round(Math.min(200, breite * 0.17)), bH, 'Trumpfkarten anbieten', () => this.bestaetigeArmut(modell), dkt || anz !== a.kartenAnzahl);
    } else if (!this.armutAnnahmeAktiv) {
      const bW = Math.round(Math.min(130, breite * 0.11));
      const ab = Math.round(breite * 0.012);
      this.erstellePhaserButton(ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annehmen', () => { if (a.kartenAnzahl === 0) appStore.beantworteArmut(true, []); else { this.armutAnnahmeAktiv = true; this.ausgewaehlteArmutKarten.clear(); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); } }, dkt);
      this.erstellePhaserButton(ebene, breite / 2 + bW / 2 + ab / 2, y, bW, bH, 'Ablehnen', () => { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); appStore.beantworteArmut(false, []); }, dkt, true);
    } else {
      const anz = this.ausgewaehlteArmutKarten.size;
      ebene.add(this.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Karte${a.kartenAnzahl === 1 ? '' : 'n'} zurueck (${anz}/${a.kartenAnzahl})`, { color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
      const bW = Math.round(Math.min(150, breite * 0.13));
      const ab = Math.round(breite * 0.012);
      this.erstellePhaserButton(ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annahme bestaetigen', () => this.bestaetigeArmut(modell), dkt || anz !== a.kartenAnzahl);
      this.erstellePhaserButton(ebene, breite / 2 + bW / 2 + ab / 2, y, Math.round(Math.min(100, breite * 0.085)), bH, 'Abbrechen', () => { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); }, dkt, true);
    }
  }

  private erstelleButton(txt: string, hdl: () => void, d: boolean, kl = ''): HTMLButtonElement {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = ['ui-button', kl].filter(Boolean).join(' '); btn.textContent = txt; btn.disabled = d; btn.addEventListener('click', hdl); return btn;
  }

  private aktualisiereHintergrund(bg: Tischhintergrund, b: number, h: number): void {
    const tex = texturFuerTischhintergrund(bg);
    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === tex) { this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h); return; }
      this.hintergrund?.destroy(); this.hintergrund = this.add.image(b / 2, h / 2, tex).setDisplaySize(b, h).setDepth(0);
    } else {
      if (this.hintergrund instanceof Phaser.GameObjects.TileSprite && this.hintergrund.texture.key === tex) { this.hintergrund.setPosition(b / 2, h / 2).setSize(b, h); return; }
      this.hintergrund?.destroy(); this.hintergrund = this.add.tileSprite(b / 2, h / 2, b, h, tex).setDepth(0);
    }
  }

  private aktualisiereKartenNavigationsIndex(m: TischAnsichtModell): void {
    const wE = this.letztesModell?.aktuellerSpieler === 'SUED' && (this.letztesModell?.spielbareKarten.length ?? 0) > 0;
    const iE = m.aktuellerSpieler === 'SUED' && m.spielbareKarten.length > 0;
    if (!wE && iE) this.tastaturKarteIndex = 0;
    else if (!iE) this.tastaturKarteIndex = -1;
    else if (iE && this.tastaturKarteIndex >= m.spielbareKarten.length) this.tastaturKarteIndex = m.spielbareKarten.length - 1;
  }

  private handleResize(): void {
    const { width: b, height: h } = this.scale.gameSize;
    if (this.hintergrund instanceof Phaser.GameObjects.Image) this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h);
    else (this.hintergrund as Phaser.GameObjects.TileSprite)?.setPosition(b / 2, h / 2).setSize(b, h);
    if (this.letzterZustand?.bereich === 'TISCH') this.renderTisch(this.letzterZustand);
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.inputHandler?.aufraeumen();
    if (this.escapeHandler) document.removeEventListener('keydown', this.escapeHandler);
    if (this.backdropClickHandler && this.rundenEndeModal) this.rundenEndeModal.removeEventListener('click', this.backdropClickHandler);
    this.abmeldenStore?.(); this.abmeldenSonderpunkte?.();
    this.animationen?.abbrechen(); this.animationen = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy()); this.tischEbene?.destroy(true);
    this.hintergrund?.destroy(); this.handKartenobjekte.clear();
    this.versteckeLetztesStichOverlay(); this.schliessePartieEndeModal();
    this.uiManager?.aufraeumen();
  }
}
