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
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import {
  erstelleTischAnsichtAusStatus,
  SPIELER_POSITION,
  PARTEI,
  type TischAnsichtModell,
  type SpielerPosition
} from '../modelle/TischAnsichtModell';
import type { 
  Ansage,
  KarteAntwort, 
  PartieEreignisAntwort, 
  Tischhintergrund, 
  KarteGespieltEreignis,
  SchweinchenGemeldetEreignis,
  HochzeitPartnerGefundenEreignis,
  AktionAbgelehntEreignis,
  AbgeschlossenerStichAntwort
} from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';
import { TischInputHandler, type TischInputKontext } from './TischInputHandler';
import { ToastManager } from './ToastManager';
import { FlashTextManager } from '../ui/FlashTextManager';
import type { Nameplate} from '../ui/Nameplate';
import { ansageBadgeTyp } from '../ui/Nameplate';
import { SpielprotokollOverlay } from '../ui/SpielprotokollOverlay';
import { formatiereAnsage } from './tischFormatierer';
import {
  berechneLayout,
  nameplatePositionFuer,
  stichSlotPositionen,
  berechneKartenGroesse,
  berechneKartenAbstand,
  stichStapelPositionFuer
} from './layout';

import { TischKartenRenderer } from './TischKartenRenderer';
import { TischRundenEndeController } from './TischRundenEndeController';
import { renderHud, renderTopBar, renderEinstellungsModal } from './TischHudRenderer';
import { renderVorbehaltLabel, renderAnsageButtons, renderArmutBereich } from './TischSpieleventRenderer';

/** Moegliche Animations-Geschwindigkeitsstufen: normal (1x), doppelt (2x), sofort (Infinity). */
type AnimationsGeschwindigkeit = 1 | 2 | typeof Infinity;
const LS_GESCHWINDIGKEIT = 'locodoko.animationsgeschwindigkeit';

function ladeGeschwindigkeit(): AnimationsGeschwindigkeit {
  const wert = localStorage.getItem(LS_GESCHWINDIGKEIT);
  if (wert === '2') return 2;
  if (wert === 'sofort') return Infinity;
  return 1;
}

function speichereGeschwindigkeit(faktor: AnimationsGeschwindigkeit): void {
  const wert = faktor === Infinity ? 'sofort' : String(faktor);
  localStorage.setItem(LS_GESCHWINDIGKEIT, wert);
}

function texturFuerTischhintergrund(bg: Tischhintergrund): string {
  const tex = ({
    FILZ_GRUEN: TEXTUR_FILZ,
    HOLZ_DUNKEL: TEXTUR_HOLZ_DUNKEL,
    BLAU_GRAFIK: TEXTUR_BLAU_GRAFIK,
    RECHTECK_1: TEXTUR_BILD_RECHTECK_1,
    RECHTECK_2: TEXTUR_BILD_RECHTECK_2,
    OVAL_1: TEXTUR_BILD_OVAL_1,
    OVAL_2: TEXTUR_BILD_OVAL_2,
    RUND_1: TEXTUR_BILD_RUND_1
  } as Record<Tischhintergrund, string>)[bg];
  console.log(`[TischSzene] Hintergrund-Mapping: ${bg} -> ${tex}`);
  return tex;
}

function istBildHintergrund(bg: Tischhintergrund): boolean {
  return bg === 'RECHTECK_1' || bg === 'RECHTECK_2' || bg === 'OVAL_1' || bg === 'OVAL_2' || bg === 'RUND_1';
}

/**
 * Hauptspielszene — rendert den Doppelkopf-Tisch und verwaltet alle Spielinteraktionen.
 * Folgt dem Event-Driven UI Prinzip: Snapshot fuer Statik, Events fuer Animationen.
 */
export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private abmeldenSonderpunkte?: () => void;
  private letzterZustand?: AppZustand;
  private hintergrund?: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private tischEbene?: Phaser.GameObjects.Container;
  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;
  private toastManager?: ToastManager;
  private flashTextManager?: FlashTextManager;
  private nameplates = new Map<SpielerPosition, Nameplate>();
  private inputHandler?: TischInputHandler;
  private ausgewaehlteArmutKarten = new Set<string>();
  private armutAnnahmeAktiv = false;
  private animationen?: AnimationenService;
  private letztesModell: TischAnsichtModell | null = null;
  
  private kartenRenderer!: TischKartenRenderer;
  private rundenEndeController!: TischRundenEndeController;
  
  private wartendeKartenId: string | null = null;
  private austeilenAktiv = false;
  private _letzterGezeigterSpielBeendet: number | null = null;
  private _zeigeOverlayNachSnapshot: { spielNummer: number; partieBeendet: boolean } | null = null;
  
  private escapeHandler?: (e: KeyboardEvent) => void;
  private tastaturKarteIndex = -1;
  private tastaturVorbehaltIndex = 0;
  
  private spielprotokollOverlay?: SpielprotokollOverlay;
  private einstellungenOffen = false;
  private seitenladeOffen = false;
  private letztePersistierteSpielNummer: number | null = null;
  private stichEinziehenAktiv = false;

  public isIdle(ignoreStore = false): boolean {
    const storeIdle = ignoreStore ? true : appStore.isIdle();
    const animationenLaeuft = this.animationen?.animationLaeuft ?? false;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E Bridge Pattern
    const loco = (window as any).__locodoko;
    if (loco) {
      loco._idleDebug = {
        storeIdle,
        animationenLaeuft,
        austeilenAktiv: this.austeilenAktiv,
        wartendeKartenId: this.wartendeKartenId,
        stichEinziehenAktiv: this.stichEinziehenAktiv
      };
    }
    
    return storeIdle && !animationenLaeuft && !this.austeilenAktiv && !this.wartendeKartenId && !this.stichEinziehenAktiv;
  }

  constructor() {
    super('TischSzene');
  }

  preload(): void {
    console.log('[TischSzene] preload: lade Assets...');
    ladeKartenBilderVorab(this);
    ladeHintergrundbilder(this);
  }

  create(): void {
    this.initialisiereZustand();
    registriereBasisTexturen(this);
    registriereKartenSpriteTexturen(this);

    const snapshot = appStore.snapshot();
    Logger.szene('TischSzene create', { tischId: snapshot.aktuellerTisch?.id });
    
    this.animationen = new AnimationenService(this);
    this.toastManager = new ToastManager(this);
    this.flashTextManager = new FlashTextManager(this);
    
    this.rundenEndeController = new TischRundenEndeController(this, () => this.letzterZustand);
    
    this.kartenRenderer = new TischKartenRenderer(this, {
      getWartendeKartenId: () => this.wartendeKartenId,
      getStichEinziehenAktiv: () => this.stichEinziehenAktiv,
      getAusteilenAktiv: () => this.austeilenAktiv,
      getTastaturKarteIndex: () => this.tastaturKarteIndex,
      getTastaturVorbehaltIndex: () => this.tastaturVorbehaltIndex,
      getAusgewaehlteArmutKarten: () => this.ausgewaehlteArmutKarten,
      getArmutAnnahmeAktiv: () => this.armutAnnahmeAktiv,
      getAnimationLaeuft: () => this.animationen?.animationLaeuft ?? false,
      onSpielKarteMitAnimation: (id) => { void this.spieleKarteMitAnimation(id); },
      onToggleArmutKarte: (id, max) => this.toggleArmutKarte(id, max),
      onRenderTisch: () => this.triggerRender(true),
    });

    this.animationsGeschwindigkeit = ladeGeschwindigkeit();
    this.animationen.setzeGeschwindigkeitsfaktor(this.animationsGeschwindigkeit);
    this.flashTextManager.setzeGeschwindigkeitsfaktor(this.animationsGeschwindigkeit);

    const inputKontext: TischInputKontext = {
      getLetztesModell: () => this.letztesModell ?? null,
      getLetzterZustand: () => this.letzterZustand,
      getAusgewaehlteArmutKarten: () => this.ausgewaehlteArmutKarten,
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
        this.triggerRender();
      },
      togglEinstellungen: () => { 
        this.einstellungenOffen = !this.einstellungenOffen;
        this.triggerRender();
      },
      renderTisch: (z, m) => { this.renderTisch(z, m); },
      spieleKarteMitAnimation: (k) => this.spieleKarteMitAnimation(k),
    };
    this.inputHandler = new TischInputHandler(inputKontext);
    this.inputHandler.registriere();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    
    const abmeldenEvents = appStore.abonniereEvents(async (e) => {
      await this.verarbeitePartieEreignis(e);
      void this.animationen?.reiheEin(() => Promise.resolve())
        .then(() => { if (this.sys?.displayList) this.triggerRender(); })
        .catch(() => { /* Szene wurde zerstört */ });
    });

    this.abmeldenStore?.();
    this.abmeldenStore = appStore.abonniere((zustand) => {
      if (zustand.bereich === 'SPIELVERWALTUNG') {
        this.abmeldenStore?.();
        this.scene.start('SpielverwaltungsSzene');
        return;
      }
      if (!zustand.aktuellerTisch && this.letzterZustand?.aktuellerTisch) {
        this.initialisiereZustand();
      }
      const modell = this.erstelleModell(zustand);
      this.synchronisiereAnimationszustand(modell, zustand);
      this.letzterZustand = zustand;
      this.letztesModell = modell;
      this.aktualisiereUi(zustand, modell);

      if (this._zeigeOverlayNachSnapshot && zustand.aktuellerTisch && modell.letztesSpielergebnis) {
        const { partieBeendet } = this._zeigeOverlayNachSnapshot;
        this._zeigeOverlayNachSnapshot = null;
        appStore.pausiereQueue();
        if (partieBeendet) {
          this.rundenEndeController.zeigePartieEndeModal(modell);
        } else {
          void this.rundenEndeController.zeigeRundenEndeModal(modell);
        }
      }
      
      this.triggerRender();
    });

    const originalAbmelden = this.abmeldenStore;
    this.abmeldenStore = () => { originalAbmelden?.(); abmeldenEvents(); };

    this.abmeldenSonderpunkte = appStore.abonniereSonderpunkte((sp) => {
      for (const s of sp) {
        const gewinnerSpieler = this.letztesModell?.spieler.find(p => p.absolutePosition === s.gewinner);
        const name = gewinnerSpieler?.name;
        const { width: b, height: h } = this.scale.gameSize;
        const pos = nameplatePositionFuer(s.gewinner, b, h);

        switch (s.typ) {
          case 'FUCHS_GEFANGEN':
            this.animationen?.reiheEin(async () => {
              await this.flashTextManager?.zeigeSpielevent('FuchsGefangen', { spielerName: name, x: pos.x, y: pos.y });
            });
            if (gewinnerSpieler) this.nameplates.get(gewinnerSpieler.position)?.shake();
            break;
          case 'KARLCHEN':
            this.animationen?.reiheEin(async () => {
              await this.flashTextManager?.zeigeSpielevent('KarlchenGespielt', { spielerName: name, x: pos.x, y: pos.y });
            });
            if (gewinnerSpieler) this.nameplates.get(gewinnerSpieler.position)?.shake();
            break;
          case 'DOPPELKOPF':
            this.animationen?.reiheEin(async () => {
              await this.flashTextManager?.zeigeSpielevent('DoppelkopfGestochen', { x: pos.x, y: pos.y });
            });
            break;
        }
      }
    });

    const bridge = (window as {
      __locodoko?: {
        setzeAnimationsGeschwindigkeit?: (f: number) => void;
        setzeKiVerzoegerung?: (ms: number) => void;
        isOverlaySichtbar?: () => boolean;
        isIdle?: (ignoreStore?: boolean) => boolean;
        getHudState?: () => { stichzaehler: string; spieltyp: string; startBtnSichtbar: boolean; rundenEndeSichtbar: boolean };
        schliesseRundenEndeModal?: () => void;
        _rundenEndeModalGezeigt?: number;
      };
    }).__locodoko;
    
    if (bridge) {
      bridge.setzeAnimationsGeschwindigkeit = (f: number) => {
        this.animationsGeschwindigkeit = f as AnimationsGeschwindigkeit;
        this.animationen?.setzeGeschwindigkeitsfaktor(f);
        this.flashTextManager?.setzeGeschwindigkeitsfaktor(f);
        if (f >= 50) {
          appStore.setzeKiKartenVerzögerung(0);
        }
      };
      bridge.setzeKiVerzoegerung = (ms: number) => appStore.setzeKiKartenVerzögerung(ms);
      bridge.isOverlaySichtbar = () => {
        const rSichtbar = !!this.rundenEndeController?.phaserRundenEndeModal;
        const pSichtbar = !!this.rundenEndeController?.phaserPartieEndeModal;
        const eSichtbar = this.einstellungenOffen;
        const pOSichtbar = !!this.spielprotokollOverlay;
        return rSichtbar || pSichtbar || eSichtbar || pOSichtbar;
      };
      bridge.isIdle = (ignoreStore = false) => this.isIdle(ignoreStore);
      bridge.getHudState = () => {
        const zustand = this.letzterZustand;
        const modell = this.letztesModell;
        const stichAnzahl = modell?.spieler.reduce((sum, s) => sum + s.stiche, 0) ?? 0;
        const maxStiche = zustand?.aktuellerTisch?.konfiguration.ohneNeunen ? 10 : 12;
        return {
          stichzaehler: modell?.spieltyp ? `Stich ${stichAnzahl}/${maxStiche}` : '',
          spieltyp: modell?.spieltyp ?? '',
          startBtnSichtbar: !!(zustand?.aktuellerTisch?.status === 'WARTEND' && zustand?.spieler?.spielerId === zustand?.aktuellerTisch?.erstelltVonSpielerId),
          rundenEndeSichtbar: !!this.rundenEndeController?.phaserRundenEndeModal
        };
      };
      bridge._rundenEndeModalGezeigt = 0;
      bridge.schliesseRundenEndeModal = () => this.rundenEndeController?.schliesseRundenEndeModal();
    }

    this.triggerRender();
  }

  private renderAngefodert = false;
  public triggerRender(force = false): void {
    if (force) {
      this.renderAngefodert = false;
      if (this.letzterZustand && this.letztesModell) {
        this.renderTisch(this.letzterZustand, this.letztesModell);
      }
      return;
    }

    if (this.animationen?.animationLaeuft || this.austeilenAktiv || this.stichEinziehenAktiv) {
      return;
    }

    if (this.renderAngefodert) return;

    this.renderAngefodert = true;
    
    const isTest = (window as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === 'test' || (globalThis as { vi?: unknown }).vi;

    if (isTest) {
      this.renderAngefodert = false;
      if (this.letzterZustand && this.letztesModell) {
        this.renderTisch(this.letzterZustand, this.letztesModell);
      }
      return;
    }

    requestAnimationFrame(() => {
      this.renderAngefodert = false;
      if (!this.sys?.isActive()) return; 
      if (this.animationen?.animationLaeuft || this.austeilenAktiv) {
        return;
      }
      if (this.letzterZustand && this.letztesModell) {
        this.renderTisch(this.letzterZustand, this.letztesModell);
      }
    });
  }

  private initialisiereZustand(): void {
    console.log('[TischSzene] initialisiereZustand');
    this.animationen?.abbrechen();
    this.kartenRenderer?.loeseEigeneKartenAuf();
    this.kartenRenderer?.versteckeLetztesStichOverlay();
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
    this.rundenEndeController?.schliesseRundenEndeModal();
    this.rundenEndeController?.schliessePartieEndeModal();
    this.wartendeKartenId = null;
    this.austeilenAktiv = false;
    this._letzterGezeigterSpielBeendet = null;
    this._zeigeOverlayNachSnapshot = null;
  }

  private async verarbeitePartieEreignis(ereignis: PartieEreignisAntwort): Promise<void> {
    Logger.szene('Verarbeite PartieEreignis', { typ: ereignis.ereignisTyp });
    
    switch (ereignis.ereignisTyp) {
      case 'SPIEL_GESTARTET': {
        this.rundenEndeController.schliesseRundenEndeModal();
        this.rundenEndeController.schliessePartieEndeModal();
        this.austeilenAktiv = true;
        await this.animationen?.reiheEin(() => this.flashTextManager!.zeigeSpielevent('SpielGestartet'));
        if (ereignis.partieStand.laufendesSpiel?.phase === 'VORBEHALT_ANSAGE') {
          await this.animationen?.reiheEin(() => this.flashTextManager!.zeigeSpielevent('VorbehaltErwartet'));
        }
        const modellG = this.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        await this.animationen?.reiheEin(async () => {
          await this.starteAusteilen(modellG, { ...appStore.snapshot(), partieStand: ereignis.partieStand });
          this.austeilenAktiv = false;
        });
        const ankuendigung = modellG.spielankuendigungstext;
        if (ankuendigung) await this.animationen?.reiheEin(() => this.zeigeSpielankuendigung(ankuendigung));
        {
          const bockrundenZaehler = ereignis.partieStand?.laufendesSpiel?.bockrundenZaehler ?? 0;
          if (bockrundenZaehler > 0) {
            const pos = { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 };
            await this.animationen?.reiheEin(() => this.animationen!.animiereBockrunde(bockrundenZaehler, pos));
          }
        }
        break;
      }

      case 'KARTE_GESPIELT': {
        const e = ereignis as KarteGespieltEreignis;
        const eventModell = this.erstelleModell({ ...appStore.snapshot(), partieStand: e.partieStand });
        const eigAbsPos = eventModell.spieler.find(s => s.istSelbst)?.absolutePosition;
        const relPos = eventModell.spieler.find(s => s.absolutePosition === e.spielerPosition)?.position;
        if (eigAbsPos && e.spielerPosition !== eigAbsPos && relPos) {
           this.wartendeKartenId = e.karteId;
           const verzoegerung = appStore.snapshot().uiKonfiguration.kiVerzoegerungMs || 400;
           await this.animationen?.reiheEin(() => this.animiereGegnerKarte(relPos, verzoegerung));
        }
        break;
      }

      case 'STICH_ABGESCHLOSSEN': {
        const stiche = ereignis.partieStand.letzteAbgeschlosseneStiche;
        const letzterStich = stiche && stiche.length > 0 ? stiche[stiche.length - 1] : null;
        if (letzterStich) {
          const gewinnerName = this.letztesModell?.spieler.find(s => s.absolutePosition === letzterStich.gewinnerPosition)?.name;
          const laufendesSpiel = ereignis.partieStand.laufendesSpiel;
          await this.animationen?.reiheEin(async () => {
            const { width: b, height: h } = this.scale.gameSize;
            const npPos = nameplatePositionFuer(letzterStich.gewinnerPosition, b, h);
            await this.flashTextManager?.zeigeSpielevent('StichAbgeschlossen', { x: npPos.x, y: npPos.y, punkte: letzterStich.augen });
            await this.animiereStichEinziehen(letzterStich, ereignis.partieStand);
            if (laufendesSpiel && gewinnerName) {
              await this.flashTextManager?.zeigeSpielevent('NaechsterSpielerErwartet', { spielerName: gewinnerName });
            }
          });
        }
        break;
      }

      case 'ANSAGE_ERFOLGT': {
        const historie = ereignis.partieStand.laufendesSpiel?.ansageHistorie;
        const letzteAnsage = historie && historie.length > 0 ? historie[historie.length - 1] : null;
        if (letzteAnsage) {
          await this.animationen?.reiheEin(() => this.starteAnsageBannerAnimationen([letzteAnsage.ansage]));
          const relPos = this.letztesModell?.spieler.find(s => s.absolutePosition === letzteAnsage.spielerPosition)?.position;
          const badgeTyp = ansageBadgeTyp(letzteAnsage.ansage);
          if (relPos && badgeTyp) this.nameplates.get(relPos)?.showAnsage(badgeTyp);
        }
        break;
      }

      case 'SCHWEINCHEN_GEMELDET': {
        const e = ereignis as SchweinchenGemeldetEreignis;
        const gewinnerSpieler = this.letztesModell?.spieler.find(s => s.absolutePosition === e.spielerPosition);
        const name = gewinnerSpieler?.name ?? 'Spieler';
        const { width: b, height: h } = this.scale.gameSize;
        const pos = nameplatePositionFuer(e.spielerPosition, b, h);
        await this.animationen?.reiheEin(() => this.flashTextManager!.zeigeSpielevent('SchweinchenGemeldet', { spielerName: name, x: pos.x, y: pos.y }));
        break;
      }

      case 'HOCHZEIT_PARTNER_GEFUNDEN': {
        const e = ereignis as HochzeitPartnerGefundenEreignis;
        const partner = this.letztesModell?.spieler.find(s => s.absolutePosition === e.partnerPosition);
        const solist = this.letztesModell?.spieler.find(s => s.position === SPIELER_POSITION.SUED);
        
        if (partner) this.nameplates.get(partner.position)?.setHochzeitPartner(true);
        if (solist) this.nameplates.get(solist.position)?.setHochzeitPartner(true);

        await this.animationen?.reiheEin(() => this.flashTextManager!.zeigeSpielevent('HochzeitPartnerGefunden', { spielerName: partner?.name ?? 'Spieler' }));
        break;
      }

      case 'SPIEL_BEENDET': {
        const m = this.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        const spielNr = m.letztesSpielergebnis?.spielNummer ?? null;
        Logger.szene('Verarbeite SPIEL_BEENDET', { spielNr, bereitsGezeigt: this._letzterGezeigterSpielBeendet });
        if (spielNr !== null && spielNr === this._letzterGezeigterSpielBeendet) break;
        this._letzterGezeigterSpielBeendet = spielNr;

        await this.animationen?.reiheEin(async () => {
          await this.flashTextManager?.zeigeSpielevent('SpielBeendet');
          await this.zeigeGewinnerFlash(m);
        });

        appStore.pausiereQueue();

        if (m.partieBeendet) {
          this.rundenEndeController.zeigePartieEndeModal(m);
        } else {
          void this.rundenEndeController.zeigeRundenEndeModal(m);
        }
        break;
      }

      case 'SNAPSHOT': {
        const ps = ereignis.partieStand;
        if (ps && !ps.laufendesSpiel && ps.letztesSpielergebnis) {
          const spielNr = ps.letztesSpielergebnis.spielNummer;
          if (spielNr !== this._letzterGezeigterSpielBeendet) {
            this._letzterGezeigterSpielBeendet = spielNr;
            this._zeigeOverlayNachSnapshot = { spielNummer: spielNr, partieBeendet: ps.status === 'BEENDET' };
          }
        }
        break;
      }

      case 'AKTION_ABGELEHNT': {
        const e = ereignis as AktionAbgelehntEreignis;
        this.toastManager?.zeige({ text: e.fehlerCode, typ: 'fehler' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E Bridge Pattern
        const loco = (window as any).__locodoko;
        if (loco) loco._letzterFehlerToast = e.fehlerCode;
        break;
      }
    }
  }

  private async animiereGegnerKarte(pos: SpielerPosition, dauer = 400): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h);
    const kg = berechneKartenGroesse(b);
    const tempK = this.kartenRenderer.erstelleKartenansicht(layout[pos].kartenX, layout[pos].kartenY, kg.w, kg.h, { verdeckt: true });
    tempK.setDepth(10); 
    try {
      await this.animationen?.animiereKarteAusspielen({ wurzel: tempK }, slotPos[pos], dauer);
    } finally {
      tempK.destroy(true);
      if (this.wartendeKartenId) {
        this.wartendeKartenId = null;
      }
      this.triggerRender(true);
    }
  }

  private async animiereStichEinziehen(stich: AbgeschlossenerStichAntwort, partieStandAusEvent: PartieStandAntwort): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h);
    const kg = berechneKartenGroesse(b);
    
    const aModell = this.erstelleModell({ ...appStore.snapshot(), partieStand: partieStandAusEvent });
    const mStich = aModell.letzteAbgeschlosseneStiche.find(s => s.spielNummer === stich.spielNummer && s.stichNummer === stich.stichNummer);
    if (!mStich) {
      Logger.error('Konnte relativen Stich im Modell nicht finden!');
      return;
    }
    
    const gSp = aModell.spieler.find((s) => s.position === mStich.gewinnerPosition);
    const gKAnz = gSp ? (gSp.sichtbareHandkarten.length > 0 ? gSp.sichtbareHandkarten.length : Math.max(gSp.verbleibendeKarten, 0)) : 0;
    const ziel = stichStapelPositionFuer(mStich.gewinnerPosition, b, h, gKAnz);
    
    Logger.szene('Starte animiereStichEinziehen', { 
      zielX: ziel.x, zielY: ziel.y, gewinner: mStich.gewinnerPosition, karten: mStich.gespielteKarten?.length 
    });

    if (!mStich.gespielteKarten || mStich.gespielteKarten.length === 0) {
      Logger.error('Keine Karten im abgeschlossenen Stich gefunden!');
      return;
    }

    const animK = mStich.gespielteKarten.map((k: { position: string, karte: KarteAntwort }) => { 
      const s = slotPos[k.position as SpielerPosition]; 
      if (!s) {
          Logger.error('Keine Slot-Position fuer SpielerPosition gefunden!', { pos: k.position });
          return { wurzel: this.kartenRenderer.erstelleKartenansicht(b/2, h/2, kg.w, kg.h, { karte: k.karte }) };
      }
      const w = this.kartenRenderer.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: k.karte }); 
      w.setAngle(s.winkel);
      w.setDepth(100); 
      return { wurzel: w, bild: w.bildObjekt }; 
    });
    
    const npPos = nameplatePositionFuer(mStich.gewinnerPosition, b, h);
    const istH = mStich.gewinnerPosition === SPIELER_POSITION.SUED || mStich.gewinnerPosition === SPIELER_POSITION.NORD;
    const flash = this.add.rectangle(npPos.x, npPos.y, istH ? Math.max(120, b * 0.11) : Math.max(80, b * 0.07), istH ? Math.max(54, h * 0.075) : Math.max(80, h * 0.11), 0xffe082, 0.7).setDepth(150).setAlpha(0);
    
    this.stichEinziehenAktiv = true;
    this.triggerRender(true); 
    
    try { 
      await this.animationen?.animiereStichEinziehen(animK, ziel, mStich.augen, flash); 
    } finally { 
      animK.forEach((k: { wurzel: { destroy: () => void } }) => k.wurzel.destroy()); 
      flash.destroy(); 
      this.stichEinziehenAktiv = false;
    }
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
    if (!tisch) return;
    this.aktualisiereKartenNavigationsIndex(modell);
    this.aktualisiereVorbehaltNavigationsIndex(modell);
    this.synchronisiereAktionZustand(modell);
    if (zustand.meldung) {
      this.toastManager?.zeige({
        text: zustand.meldung.text,
        typ: zustand.meldung.typ === 'fehler' ? 'fehler' : 'info'
      });
      appStore.quittiereMeldung();
    }
    if (this.rundenEndeController.phaserPartieEndeModal && zustand.partieStand?.laufendesSpiel) {
      this.rundenEndeController.schliessePartieEndeModal();
    }
  }

  private renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    if (this.sys && !this.sys.displayList) return; 
    const aktuelleSpielNummer = zustand.partieStand?.laufendesSpiel?.spielNummer ?? null;
    if (aktuelleSpielNummer !== this.letztePersistierteSpielNummer) {
      this.kartenRenderer.loeseEigeneKartenAuf();
      this.letztePersistierteSpielNummer = aktuelleSpielNummer;
    }

    this.tischEbene?.destroy(true);
    this.kartenRenderer.handKartenobjekte.clear();
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const mitteX = breite / 2;
    const mitteY = hoehe / 2;
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.add.container(0, 0);
    ebene.setDepth(3);

    this.kartenRenderer.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      this.kartenRenderer.aktualisiereNameplate(spieler, modell, this.nameplates, breite, hoehe);
      this.kartenRenderer.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    this.kartenRenderer.renderStichStapel(ebene, modell, breite, hoehe);
    
    renderTopBar(this, ebene, modell, zustand, breite, {
        einstellungenOffen: this.einstellungenOffen,
        seitenladeOffen: this.seitenladeOffen,
        spielprotokollOffen: !!this.spielprotokollOverlay,
        wirdGeladen: zustand.wirdGeladen,
        onToggleEinstellungen: () => { this.einstellungenOffen = !this.einstellungenOffen; this.renderTisch(zustand, modell); },
        onToggleSeitenlade: () => { this.seitenladeOffen = !this.seitenladeOffen; this.renderTisch(zustand, modell); },
        onToggleSpielprotokoll: () => { this.toggleSpielprotokoll(modell, zustand); },
    });
    
    if (this.seitenladeOffen) {
      renderHud(this, ebene, modell, breite, hoehe);
    }

    if (zustand.partieStand?.laufendesSpiel) {
      const spieleventKontext = {
        wartendeKartenId: this.wartendeKartenId,
        animationLaeuft: this.animationen?.animationLaeuft ?? false,
        ausgewaehlteArmutKarten: this.ausgewaehlteArmutKarten,
        armutAnnahmeAktiv: this.armutAnnahmeAktiv,
        tastaturVorbehaltIndex: this.tastaturVorbehaltIndex,
        onTastaturVorbehaltIndexAendern: (v: number) => { this.tastaturVorbehaltIndex = v; },
        onRenderTisch: () => this.triggerRender(true),
        onArmutKarteToggle: (id: string, max: number) => this.toggleArmutKarte(id, max),
        onBestaetigeArmut: () => this.bestaetigeArmut(modell),
        onArmutAnnahmeAktivSetzen: (v: boolean) => { this.armutAnnahmeAktiv = v; },
      };
      
      renderAnsageButtons(this, ebene, modell, zustand, breite, hoehe, spieleventKontext);
      renderArmutBereich(this, ebene, modell, zustand, breite, hoehe, spieleventKontext);
      renderVorbehaltLabel(this, ebene, modell, breite, hoehe, spieleventKontext);
    }

    if (this.einstellungenOffen) {
      renderEinstellungsModal(this, ebene, modell, zustand, breite, hoehe, {
        animationsGeschwindigkeit: this.animationsGeschwindigkeit,
        onEinstellungenSchliessen: () => { this.einstellungenOffen = false; this.renderTisch(zustand, modell); },
        onAnimationsGeschwindigkeitAendern: (v) => {
            this.animationsGeschwindigkeit = v;
            speichereGeschwindigkeit(v);
            this.animationen?.setzeGeschwindigkeitsfaktor(v);
            this.renderTisch(zustand, modell);
        }
      });
    }

    this.tischEbene = ebene;
  }

  private toggleSpielprotokoll(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (this.spielprotokollOverlay) {
      this.spielprotokollOverlay.destroy(true);
      this.spielprotokollOverlay = undefined;
      return;
    }
    const { width: breite, height: hoehe } = this.scale.gameSize;
    this.spielprotokollOverlay = new SpielprotokollOverlay(
      this, breite / 2, hoehe / 2, breite, hoehe,
      zustand.spielProtokollEintraege,
      modell,
      () => { this.spielprotokollOverlay = undefined; }
    );
  }

  private bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) return;
    appStore.beantworteArmut(true, Array.from(this.ausgewaehlteArmutKarten));
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
  }

  private synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); return; }
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
    if (!inHand && zustand.meldung?.typ === 'fehler') {
        this.wartendeKartenId = null;
    }
  }

  private async spieleKarteMitAnimation(id: string): Promise<void> {
    if (this.wartendeKartenId || this.animationen?.animationLaeuft) return;
    const kObj = this.kartenRenderer.handKartenobjekte.get(id);
    if (!kObj) { appStore.spieleKarte(id); return; }
    const { width: b, height: h } = this.scale.gameSize;
    const ziel = stichSlotPositionen(b / 2, h / 2, b, h).SUED;
    this.wartendeKartenId = id;
    
    this.kartenRenderer.persistenteEigeneKarten.delete(id);
    this.tischEbene?.add(kObj.wurzel); 
    
    appStore.spieleKarte(id);
    
    await this.animationen?.reiheEin(async () => {
      await this.animationen?.animiereKarteAusspielen(kObj, ziel);
      kObj.wurzel.destroy(); 
      if (this.wartendeKartenId === id) this.wartendeKartenId = null;
    });
  }

  private async starteAusteilen(modell: TischAnsichtModell, zustand: AppZustand): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const kg = berechneKartenGroesse(b);
    const kAb = berechneKartenAbstand(b, h);

    const uhrzeigersinn: SpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];
    const geber = modell.spieler.find((s) => s.istGeber);
    const geberIdx = geber ? uhrzeigersinn.indexOf(geber.position) : 0;
    const dealReihenfolge = [1, 2, 3, 0].map((offset) => {
      const pos = uhrzeigersinn[(geberIdx + offset) % 4];
      return modell.spieler.find((s) => s.position === pos);
    }).filter((s): s is TischAnsichtModell['spieler'][number] => s !== undefined);

    type Paket = { kartenobjekte: AnimierbareKartenobjekte; ziel: { x: number; y: number } };
    const kartenProSpieler = new Map<SpielerPosition, Paket[]>();
    for (const s of dealReihenfolge) {
      const kAnz = s.sichtbareHandkarten.length > 0 ? s.sichtbareHandkarten.length : Math.max(s.verbleibendeKarten, 0);
      const istH = s.position === SPIELER_POSITION.SUED || s.position === SPIELER_POSITION.NORD;
      const stX = istH ? b / 2 - ((kAnz - 1) * kAb.horizontal) / 2 : layout[s.position].kartenX;
      const [fB, fS]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[s.position] as [number, number];
      const istG = s.position === SPIELER_POSITION.NORD || s.position === SPIELER_POSITION.OST;
      const spielerPakete: Paket[] = [];
      for (let i = 0; i < kAnz; i++) {
        const fI = istG ? kAnz - 1 - i : i;
        const w = fB + fI * fS;
        const k = s.sichtbareHandkarten?.[i];
        const wuz = (s.istSelbst && k) ? this.kartenRenderer.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { karte: k }) : this.kartenRenderer.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { verdeckt: true });
        wuz.setAngle(w);
        wuz.setDepth(10);
        spielerPakete.push({ kartenobjekte: { wurzel: wuz, bild: wuz.bildObjekt }, ziel: { x: istH ? stX + fI * kAb.horizontal : layout[s.position].kartenX, y: istH ? layout[s.position].kartenY : layout[s.position].kartenY + fI * kAb.vertikal } });
      }
      kartenProSpieler.set(s.position, spielerPakete);
    }

    const pakete: Paket[] = [];
    const perPlayerIndex = new Map<SpielerPosition, number>(dealReihenfolge.map((s) => [s.position, 0]));
    for (const rundeKarten of [3, 4, 3]) {
      for (let k = 0; k < rundeKarten; k++) {
        for (const s of dealReihenfolge) {
          const idx = perPlayerIndex.get(s.position)!;
          const sp = kartenProSpieler.get(s.position)!;
          if (idx < sp.length) { pakete.push(sp[idx]); perPlayerIndex.set(s.position, idx + 1); }
        }
      }
    }

    try { await this.animationen?.animiereKartenAusteilen(pakete); } finally { pakete.forEach((p) => p.kartenobjekte.wurzel.destroy()); this.austeilenAktiv = false; this.renderTisch(this.letzterZustand ?? zustand); }
  }

  private async starteAnsageBannerAnimationen(neue: Ansage[]): Promise<void> {
    const modell = this.letztesModell;
    if (!modell) return;
    for (const a of neue) {
      const { width: b, height: h } = this.scale.gameSize;
      const f = a === PARTEI.RE ? '#ffd166' : a === PARTEI.KONTRA ? '#90caf9' : '#ffffff';
      await this.animationen?.animiereAnsageBanner(formatiereAnsage(a), { x: b / 2, y: h * 0.18 }, undefined, f);
    }
  }

  private async zeigeGewinnerFlash(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) return;
    const { width: b, height: h } = this.scale.gameSize;
    await this.animationen?.animiereGewinnerFlash(`${e.siegerPartei} gewinnt!`, m.spieler.filter((s) => s.partei === e.siegerPartei).map((s) => s.name).join(', '), `+${e.spielwert} Punkte`, e.siegerPartei === PARTEI.RE ? '#ffd166' : '#90caf9', { x: b / 2, y: h / 2 });
  }

  private async zeigeSpielankuendigung(m: string): Promise<void> {
    await this.animationen?.animiereSoloAnkuendigung(m, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 });
  }

  private aktualisiereHintergrund(bg: Tischhintergrund, b: number, h: number): void {
    const tex = texturFuerTischhintergrund(bg);
    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === tex) { 
        this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h); 
        return; 
      }
      this.hintergrund?.destroy(); this.hintergrund = this.add.image(b / 2, h / 2, tex).setDisplaySize(b, h).setDepth(0);
    } else {
      if (this.hintergrund instanceof Phaser.GameObjects.TileSprite && this.hintergrund.texture.key === tex) { 
        this.hintergrund.setPosition(b / 2, h / 2).setSize(b, h); 
        return; 
      }
      this.hintergrund?.destroy(); this.hintergrund = this.add.tileSprite(b / 2, h / 2, b, h, tex).setDepth(0);
    }
  }

  private aktualisiereKartenNavigationsIndex(m: TischAnsichtModell): void {
    const wE = this.letztesModell?.aktuellerSpieler === SPIELER_POSITION.SUED && (this.letztesModell?.spielbareKarten.length ?? 0) > 0;
    const iE = m.aktuellerSpieler === SPIELER_POSITION.SUED && m.spielbareKarten.length > 0;
    if ((!wE && iE) || (iE && this.tastaturKarteIndex === -1)) this.tastaturKarteIndex = 0;
    else if (!iE) this.tastaturKarteIndex = -1;
    else if (iE && this.tastaturKarteIndex >= m.spielbareKarten.length) this.tastaturKarteIndex = m.spielbareKarten.length - 1;
  }

  private aktualisiereVorbehaltNavigationsIndex(m: TischAnsichtModell): void {
    const hatteVorbehalt = (this.letztesModell?.moeglicheVorbehalte.length ?? 0) > 0;
    const hatVorbehalt = m.moeglicheVorbehalte.length > 0 && m.aktuellerSpieler === SPIELER_POSITION.SUED;
    if (!hatteVorbehalt && hatVorbehalt) {
      const gesundIdx = m.moeglicheVorbehalte.indexOf('GESUND');
      this.tastaturVorbehaltIndex = gesundIdx >= 0 ? gesundIdx : 0;
    } else if (!hatteVorbehalt) {
      this.tastaturVorbehaltIndex = 0;
    }
  }

  private handleResize(): void {
    const { width: b, height: h } = this.scale.gameSize;
    if (this.hintergrund instanceof Phaser.GameObjects.Image) this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h);
    else (this.hintergrund as Phaser.GameObjects.TileSprite)?.setPosition(b / 2, h / 2).setSize(b, h);
    this.kartenRenderer.loeseEigeneKartenAuf();
    this.letztePersistierteSpielNummer = null;
    if (this.letzterZustand?.bereich === 'TISCH') this.renderTisch(this.letzterZustand);
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.inputHandler?.aufraeumen();
    if (this.escapeHandler) document.removeEventListener('keydown', this.escapeHandler);
    this.rundenEndeController?.aufraeumen();
    this.abmeldenStore?.(); this.abmeldenSonderpunkte?.();
    this.flashTextManager?.destroy(); this.flashTextManager = undefined;
    this.nameplates.forEach(np => np.destroy()); this.nameplates.clear();
    this.animationen?.abbrechen(); this.animationen = undefined;
    this.kartenRenderer?.loeseEigeneKartenAuf();
    this.tischEbene?.destroy(true);
    this.hintergrund?.destroy(); 
    this.kartenRenderer?.handKartenobjekte.clear();
    this.spielprotokollOverlay?.destroy(true); this.spielprotokollOverlay = undefined;
  }
}
