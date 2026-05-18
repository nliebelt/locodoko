import Phaser from 'phaser';

import {
  ladeHintergrundbilder,
  ladeKartenBilderVorab,
  registriereBasisTexturen,
  registriereKartenSpriteTexturen,
} from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import {
  erstelleTischAnsichtAusStatus,
  type TischAnsichtModell,
  type SpielerPosition,
} from '../modelle/TischAnsichtModell';
import type { Tischhintergrund } from '../modelle/SpielverwaltungDto';
import { AnimationenService } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';
import { TischInputHandler } from './TischInputHandler';
import { ToastManager } from './ToastManager';
import { FlashTextManager } from '../ui/FlashTextManager';
import type { Nameplate } from '../ui/Nameplate';
import { SpielprotokollOverlay } from '../ui/SpielprotokollOverlay';

import { TischKartenRenderer } from './TischKartenRenderer';
import { TischAnimationOrchestrator } from './TischAnimationOrchestrator';
import { TischEreignisHandler } from './TischEreignisHandler';
import { TischRundenEndeController } from './TischRundenEndeController';
import { type AnimationsGeschwindigkeit, ladeGeschwindigkeit } from './TischHudRenderer';
import { TischRenderKontroller } from './TischRenderKontroller';
import { TischZustandsKontroller } from './TischZustandsKontroller';
import { richteE2EBrückeEin } from './TischBrücke';
import { richteStoreAbonnementsEin } from './TischStoreAbonnements';

/**
 * Hauptspielszene — duenner Orchestrator. Delegiert Render, Zustand und Store-Abonnements
 * an spezialisierte Klassen. Folgt dem Event-Driven UI Prinzip.
 */
export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private resizeHandler?: () => void;
  public letzterZustand?: AppZustand;
  public tischEbene?: Phaser.GameObjects.Container;
  public animationsGeschwindigkeit: AnimationsGeschwindigkeit = 1;
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
  public tastaturKarteIndex = -1;
  public tastaturVorbehaltIndex = 0;
  private spielprotokollOverlay?: SpielprotokollOverlay;
  public seitenladeOffen = false;
  public einstellungenOffen = false;
  public stichEinziehenAktiv = false;
  public animationOrchestrator!: TischAnimationOrchestrator;
  public ereignisHandler!: TischEreignisHandler;
  public renderKontroller!: TischRenderKontroller;
  public zustandsKontroller!: TischZustandsKontroller;

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
        stichEinziehenAktiv: this.stichEinziehenAktiv,
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
    this.zustandsKontroller = new TischZustandsKontroller(this);
    this.renderKontroller = new TischRenderKontroller(this);

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
      onToggleArmutKarte: (id, max) => this.zustandsKontroller.toggleArmutKarte(id, max),
      onRenderTisch: () => this.triggerRender(true),
    });

    this.animationsGeschwindigkeit = ladeGeschwindigkeit();
    this.animationen.setzeGeschwindigkeitsfaktor(this.animationsGeschwindigkeit);
    this.flashTextManager.setzeGeschwindigkeitsfaktor(this.animationsGeschwindigkeit);

    this.inputHandler = new TischInputHandler(TischInputHandler.erstelleKontext(this));
    this.inputHandler.registriere();

    this.resizeHandler = () => this.renderKontroller.handleResize();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);

    this.abmeldenStore = richteStoreAbonnementsEin(this);
    richteE2EBrückeEin(this);

    this.triggerRender();
  }

  public triggerRender(force = false): void {
    this.renderKontroller.triggerRender(force);
  }

  public initialisiereZustand(): void {
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

  public aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    if (!zustand.aktuellerTisch) return;
    this.zustandsKontroller.aktualisiereKartenNavigationsIndex(modell);
    this.zustandsKontroller.aktualisiereVorbehaltNavigationsIndex(modell);
    this.zustandsKontroller.synchronisiereAktionZustand(modell);
    if (zustand.meldung) {
      this.toastManager?.zeige({
        text: zustand.meldung.text,
        typ: zustand.meldung.typ === 'fehler' ? 'fehler' : 'info',
      });
      appStore.quittiereMeldung();
    }
    if (this.rundenEndeController.phaserPartieEndeModal && zustand.partieStand?.laufendesSpiel) {
      this.rundenEndeController.schliessePartieEndeModal();
    }
  }

  public renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    this.renderKontroller.renderTisch(zustand, modell);
  }

  public toggleSpielprotokoll(modell: TischAnsichtModell, zustand: AppZustand): void {
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

  public isSpielprotokollOffen(): boolean {
    return !!this.spielprotokollOverlay;
  }

  public erstelleModell(zustand: AppZustand): TischAnsichtModell {
    return erstelleTischAnsichtAusStatus(zustand.spieler?.spielerId ?? null, zustand.aktuellerTisch, zustand.partieStand, zustand.debugModus);
  }

  /** Delegiert an TischRenderKontroller — erhalten fuer Test-Kompatibilitaet. */
  public aktualisiereHintergrund(bg: Tischhintergrund, b: number, h: number): void {
    this.renderKontroller.aktualisiereHintergrund(bg, b, h);
  }

  private aufraeumen(): void {
    if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.inputHandler?.aufraeumen();
    this.rundenEndeController?.aufraeumen();
    this.abmeldenStore?.();
    this.flashTextManager?.destroy(); this.flashTextManager = undefined;
    this.nameplates.forEach(np => np.destroy()); this.nameplates.clear();
    this.animationen?.abbrechen(); this.animationen = undefined;
    this.kartenRenderer?.loeseEigeneKartenAuf();
    this.tischEbene?.destroy(true);
    this.renderKontroller?.aufraeumen();
    this.kartenRenderer?.handKartenobjekte.clear();
    this.spielprotokollOverlay?.destroy(true); this.spielprotokollOverlay = undefined;
  }
}
