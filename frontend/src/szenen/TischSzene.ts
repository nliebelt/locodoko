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
  type TischAnsichtModell,
  type SpielerPosition
} from '../modelle/TischAnsichtModell';
import type { Tischhintergrund } from '../modelle/SpielverwaltungDto';
import { AnimationenService } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';
import { TischInputHandler, type TischInputKontext } from './TischInputHandler';
import { ToastManager } from './ToastManager';
import { FlashTextManager } from '../ui/FlashTextManager';
import type { Nameplate } from '../ui/Nameplate';
import { SpielprotokollOverlay } from '../ui/SpielprotokollOverlay';
import {
  berechneLayout,
  nameplatePositionFuer
} from './layout';

import { TischKartenRenderer } from './TischKartenRenderer';
import { TischAnimationOrchestrator } from './TischAnimationOrchestrator';
import { TischEreignisHandler } from './TischEreignisHandler';
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
  public letzterZustand?: AppZustand;
  private hintergrund?: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  public tischEbene?: Phaser.GameObjects.Container;
  private animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;
  public toastManager?: ToastManager;
  public flashTextManager?: FlashTextManager;
  public nameplates = new Map<SpielerPosition, Nameplate>();
  private inputHandler?: TischInputHandler;
  public ausgewaehlteArmutKarten = new Set<string>();
  public armutAnnahmeAktiv = false;
  public animationen?: AnimationenService;
  public letztesModell: TischAnsichtModell | null = null;
  
  public kartenRenderer!: TischKartenRenderer;
  public rundenEndeController!: TischRundenEndeController;
  
  public wartendeKartenId: string | null = null;
  public austeilenAktiv = false;
  public _letzterGezeigterSpielBeendet: number | null = null;
  public _zeigeOverlayNachSnapshot: { spielNummer: number; partieBeendet: boolean } | null = null;
  
  private escapeHandler?: (e: KeyboardEvent) => void;
  private tastaturKarteIndex = -1;
  private tastaturVorbehaltIndex = 0;
  
  private spielprotokollOverlay?: SpielprotokollOverlay;
  private einstellungenOffen = false;
  private seitenladeOffen = false;
  private letztePersistierteSpielNummer: number | null = null;
  public stichEinziehenAktiv = false;

  public animationOrchestrator!: TischAnimationOrchestrator;
  public ereignisHandler!: TischEreignisHandler;

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
    this.animationOrchestrator = new TischAnimationOrchestrator(this);
    this.ereignisHandler = new TischEreignisHandler(this);
    
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
      onSpielKarteMitAnimation: (id) => { void this.animationOrchestrator.spieleKarteMitAnimation(id); },
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
      spieleKarteMitAnimation: (k) => this.animationOrchestrator.spieleKarteMitAnimation(k),
    };
    this.inputHandler = new TischInputHandler(inputKontext);
    this.inputHandler.registriere();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    
    const abmeldenEvents = appStore.abonniereEvents(async (e) => {
      await this.ereignisHandler.verarbeitePartieEreignis(e);
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

  public renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
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

  public erstelleModell(zustand: AppZustand): TischAnsichtModell {
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
