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
  SPIELER_POSITION,
  PARTEI,
  type AbgeschlossenerStichAnsicht,
  type TischAnsichtModell,
  type SpielerPosition
} from '../modelle/TischAnsichtModell';
import type { 
  Ansage,
  KarteAntwort, 
  PartieEreignisAntwort, 
  PartieStandAntwort,
  Tischhintergrund, 
  VorbehaltAnsage,
  KarteGespieltEreignis,
  SchweinchenGemeldetEreignis,
  HochzeitPartnerGefundenEreignis,
  AktionAbgelehntEreignis,
  AbgeschlossenerStichAntwort
} from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';
import { TischInputHandler, type TischInputKontext } from './TischInputHandler';
import { TischUIManager, type TischUIKontext } from './TischUIManager';
import { ToastManager } from './ToastManager';
import { FlashTextManager } from '../ui/FlashTextManager';
import { Nameplate, ansageBadgeTyp, type NameplateDaten } from '../ui/Nameplate';
import { PhaserModal } from '../ui/PhaserModal';
import { SpielprotokollOverlay } from '../ui/SpielprotokollOverlay';
import { FONT_FAMILY } from '../ui/designTokens';
import {
  formatiereAnsage,
  formatiereVorbehalt,
  formatiereSonderpunkt,
  formatiereCountdownText,
} from './tischFormatierer';
import {
  type TischLayout,
  stichSlotPositionen,
  berechneKartenGroesse,
  berechneKartenAbstand,
  berechneLayout,
  nameplatePositionFuer,
  stichStapelPositionFuer,
} from './layout';

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
  private uiManager?: TischUIManager;
  private toastManager?: ToastManager;
  private flashTextManager?: FlashTextManager;
  private nameplates = new Map<SpielerPosition, Nameplate>();
  private inputHandler?: TischInputHandler;
  private ausgewaehlteArmutKarten = new Set<string>();
  private armutAnnahmeAktiv = false;
  private animationen?: AnimationenService;
  private letztesModell: TischAnsichtModell | null = null;
  private readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();
  private wartendeKartenId: string | null = null;
  private austeilenAktiv = false;
  private _letzterGezeigterSpielBeendet: number | null = null;
  private _zeigeOverlayNachSnapshot: { spielNummer: number; partieBeendet: boolean } | null = null;
  private rundenauswertungObjekte: Phaser.GameObjects.GameObject[] = [];
  private phaserRundenEndeModal?: PhaserModal;
  private phaserPartieEndeModal?: PhaserModal;
  private partieCountdownInterval?: number;
  private escapeHandler?: (e: KeyboardEvent) => void;
  private tastaturKarteIndex = -1;
  private tastaturVorbehaltIndex = 0;
  private letzterStichOverlay?: Phaser.GameObjects.Container;
  private letzterStichTimer?: Phaser.Time.TimerEvent;
  private spielprotokollOverlay?: SpielprotokollOverlay;
  private einstellungenOffen = false;
  private seitenladeOffen = false;
  /** Persistente Karten-Sprites fuer die eigene Hand (SUED). Bleiben zwischen renderTisch()-Aufrufen erhalten. */
  private persistenteEigeneKarten = new Map<string, Kartenansicht>();
  /** Spielnummer des zuletzt persistierten Kartensatzes — bei Wechsel werden persistente Sprites invalidiert. */
  private letztePersistierteSpielNummer: number | null = null;

  /**
   * Gibt zurück, ob die TischSzene (und der zugrundeliegende AppStore) im Leerlauf ist.
   */
  public isIdle(ignoreStore = false): boolean {
    const storeIdle = ignoreStore ? true : appStore.isIdle();
    const animationenLaeuft = this.animationen?.animationLaeuft ?? false;
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

    const uiKontext: TischUIKontext = {
      szeneStarten: (name) => { this.scene.start(name); },
      onGeschwindigkeitGeaendert: (f) => { this.animationen?.setzeGeschwindigkeitsfaktor(f); },
      onLetzteSticheToggle: () => { 
        this.einstellungenOffen = !this.einstellungenOffen;
        this.triggerRender();
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
    
    // PARTIE-EREIGNISSE (Animationen & Modals)
    const abmeldenEvents = appStore.abonniereEvents((e) => {
      this.verarbeitePartieEreignis(e);
      // Re-Sync erst triggern, wenn die Queue dieses Ereignisses durch ist
      void this.animationen?.reiheEin(() => Promise.resolve())
        .then(() => { if (this.sys?.displayList) this.triggerRender(); });
    });

    // SNAPSHOT-ABO (Statische Ansicht)
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      if (zustand.bereich === 'SPIELVERWALTUNG') {
        this.scene.start('SpielverwaltungsSzene');
        return;
      }
      // Reconnect: Übergang von verbundenem Tisch zu null (Warten auf neuen Snapshot).
      // Alten UI-Zustand vollständig zurücksetzen, damit keine Overlays/Animationen des
      // vorherigen Spiels sichtbar bleiben, bevor der neue Snapshot verarbeitet wird.
      if (!zustand.aktuellerTisch && this.letzterZustand?.aktuellerTisch) {
        this.initialisiereZustand();
      }
      const modell = this.erstelleModell(zustand);
      this.synchronisiereAnimationszustand(modell, zustand);
      this.letzterZustand = zustand;
      this.letztesModell = modell;
      this.aktualisiereUi(zustand, modell);

      // Overlay nach Reload wiederherstellen: erst wenn aktuellerTisch und letztesSpielergebnis gesetzt sind.
      if (this._zeigeOverlayNachSnapshot && zustand.aktuellerTisch && modell.letztesSpielergebnis) {
        const { partieBeendet } = this._zeigeOverlayNachSnapshot;
        this._zeigeOverlayNachSnapshot = null;
        appStore.pausiereQueue();
        if (partieBeendet) {
          this.animationen?.reiheEin(() => { this.zeigePartieEndeModal(modell); return Promise.resolve(); });
        } else {
          this.animationen?.reiheEin(() => this.zeigeRundenEndeModal(modell));
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
        switch (s.typ) {
          case 'FUCHS_GEFANGEN':
            this.flashTextManager?.zeigeSpielevent('FuchsGefangen', { spielerName: name });
            if (gewinnerSpieler) this.nameplates.get(gewinnerSpieler.position)?.shake();
            break;
          case 'KARLCHEN':
            this.flashTextManager?.zeigeSpielevent('KarlchenGespielt', { spielerName: name });
            if (gewinnerSpieler) this.nameplates.get(gewinnerSpieler.position)?.shake();
            break;
          case 'DOPPELKOPF':     this.flashTextManager?.zeigeSpielevent('DoppelkopfGestochen'); break;
        }
      }
    });

    // TEST-HOOK: Animationsgeschwindigkeit steuerbar machen fuer E2E-Tests
    const bridge = (window as any)['__locodoko'];
    if (bridge) {
      bridge.setzeAnimationsGeschwindigkeit = (f: number) => {
        this.animationen?.setzeGeschwindigkeitsfaktor(f);
        if (f >= 50) {
          appStore.setzeKiKartenVerzögerung(0);
        }
      };
      bridge.setzeKiVerzoegerung = (ms: number) => appStore.setzeKiKartenVerzögerung(ms);
      bridge.isOverlaySichtbar = () => {
        const rSichtbar = !!this.phaserRundenEndeModal && this.phaserRundenEndeModal.active;
        const pSichtbar = !!this.phaserPartieEndeModal && this.phaserPartieEndeModal.active;
        return rSichtbar || pSichtbar;
      };
      bridge.isIdle = (ignoreStore = false) => this.isIdle(ignoreStore);
      bridge._rundenEndeModalGezeigt = 0;
    }

    this.triggerRender();

    // E2E-Marker fuer Playwright (TischSzene ist immer da)
    this.aktualisiereE2EMarker('tischszene', true);
  }

  private aktualisiereE2EMarker(testId: string, sichtbar: boolean): void {
    const root = document.getElementById('ui-root');
    if (!root) return;
    let marker = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
    if (sichtbar) {
      if (!marker) {
        marker = document.createElement('div');
        marker.dataset['testid'] = testId;
        marker.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none';
        root.appendChild(marker);
      }
      marker.hidden = false;
    } else if (marker) {
      marker.hidden = true;
      // Fuer Playwright ist .hidden = true oft nicht genug bei toBeHidden(), 
      // daher entfernen wir es lieber ganz.
      marker.remove();
    }
  }

  private renderAngefodert = false;

  public triggerRender(force = false): void {
    if (force) {
      // Force overrides any pending requests and renders immediately synchronously
      this.renderAngefodert = false;
      if (this.letzterZustand && this.letztesModell) {
        this.renderTisch(this.letzterZustand, this.letztesModell);
      }
      return;
    }

    // Waehrend Animation/Austeilen laeuft: kein Render einplanen.
    // Die Re-Sync-Logik (reiheEin(...).then(triggerRender)) stellt sicher,
    // dass nach Ende aller Animationen ein Render ausgeloest wird.
    if (this.animationen?.animationLaeuft || this.austeilenAktiv) {
      return;
    }

    // renderAngefodert=true bedeutet: ein rAF ist bereits eingeplant — kein Duplikat noetig.
    if (this.renderAngefodert) return;

    this.renderAngefodert = true;
    
    // In Vitest/JSDOM ist requestAnimationFrame oft problematisch, daher rendern wir dort synchron.
    // Wir nutzen eine sicherere Pruefung fuer die Testumgebung.
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
      if (!this.sys?.displayList) return; // Szene wurde zwischenzeitlich zerstoert
      // Race-Condition: Animation koennte zwischen triggerRender() und dem rAF gestartet sein.
      // In diesem Fall: nicht rendern. Die Re-Sync-Logik triggert nach Animationsende erneut.
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
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
    this.letzterStichTimer?.remove(false);
    this.letzterStichTimer = undefined;
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
    this.schliesseRundenEndeModal();
    this.schliessePartieEndeModal();
    this.wartendeKartenId = null;
    this.austeilenAktiv = false;
    this._letzterGezeigterSpielBeendet = null;
    this._zeigeOverlayNachSnapshot = null;
  }

  private verarbeitePartieEreignis(ereignis: PartieEreignisAntwort): void {
    Logger.szene('Verarbeite PartieEreignis', { typ: ereignis.ereignisTyp });
    
    switch (ereignis.ereignisTyp) {
      case 'SPIEL_GESTARTET': {
        this.schliesseRundenEndeModal();
        this.schliessePartieEndeModal();
        this.austeilenAktiv = true;
        this.flashTextManager?.zeigeSpielevent('SpielGestartet');
        if (ereignis.partieStand.laufendesSpiel?.phase === 'VORBEHALT_ANSAGE') {
          this.flashTextManager?.zeigeSpielevent('VorbehaltErwartet');
        }
        // Wir nehmen den Stand direkt aus dem Event, da der Store ggf. noch nicht gepatcht ist
        const modellG = this.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        this.animationen?.reiheEin(async () => {
          await this.starteAusteilen(modellG, { ...appStore.snapshot(), partieStand: ereignis.partieStand });
          this.austeilenAktiv = false;
        });
        const ankuendigung = modellG.spielankuendigungstext;
        if (ankuendigung) this.animationen?.reiheEin(() => this.zeigeSpielankuendigung(ankuendigung));
        {
          const bockrundenZaehler = ereignis.partieStand?.laufendesSpiel?.bockrundenZaehler ?? 0;
          if (bockrundenZaehler > 0) {
            const pos = { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 };
            this.animationen?.reiheEin(() => this.animationen!.animiereBockrunde(bockrundenZaehler, pos));
          }
        }
        break;
      }

      case 'KARTE_GESPIELT': {
        const e = ereignis as KarteGespieltEreignis;
        const eigPos = this.letztesModell?.spieler.find(s => s.istSelbst)?.position;
        if (e.spielerPosition !== eigPos) {
           this.wartendeKartenId = e.karteId;
           const verzoegerung = appStore.snapshot().uiKonfiguration.kiVerzoegerungMs || 400;
           this.animationen?.reiheEin(() => this.animiereGegnerKarte(e.spielerPosition, verzoegerung));
        }
        break;
      }

      case 'STICH_ABGESCHLOSSEN': {
        const stiche = ereignis.partieStand.letzteAbgeschlosseneStiche;
        const letzterStich = stiche && stiche.length > 0 ? stiche[stiche.length - 1] : null;
        if (letzterStich) {
          Logger.szene('STICH_ABGESCHLOSSEN Event verarbeitet', {
            gewinner: letzterStich.gewinnerPosition,
            kartenAnzahl: letzterStich.gespielteKarten?.length
          });
          const gewinnerName = this.letztesModell?.spieler.find(s => s.absolutePosition === letzterStich.gewinnerPosition)?.name;
          this.flashTextManager?.zeigeSpielevent('StichAbgeschlossen');
          const laufendesSpiel = ereignis.partieStand.laufendesSpiel;
          this.animationen?.reiheEin(async () => {
            await this.animiereStichEinziehen(letzterStich, ereignis.partieStand);
            if (laufendesSpiel && gewinnerName) {
              this.flashTextManager?.zeigeSpielevent('NaechsterSpielerErwartet', { spielerName: gewinnerName });
            }
          });
        }
        break;
      }

      case 'ANSAGE_ERFOLGT': {
        // Da AnsageErfolgtEreignis aktuell keine 'ansage' Eigenschaft im DTO hat (nur partieStand),
        // nehmen wir die letzte Ansage aus dem Historie-Snapshot.
        const historie = ereignis.partieStand.laufendesSpiel?.ansageHistorie;
        const letzteAnsage = historie && historie.length > 0 ? historie[historie.length - 1] : null;
        if (letzteAnsage) {
          this.animationen?.reiheEin(() => this.starteAnsageBannerAnimationen([letzteAnsage.ansage]));
          const relPos = this.letztesModell?.spieler.find(s => s.absolutePosition === letzteAnsage.spielerPosition)?.position;
          const badgeTyp = ansageBadgeTyp(letzteAnsage.ansage);
          if (relPos && badgeTyp) this.nameplates.get(relPos)?.showAnsage(badgeTyp);
        }
        break;
      }

      case 'SCHWEINCHEN_GEMELDET': {
        const e = ereignis as SchweinchenGemeldetEreignis;
        const name = this.letztesModell?.spieler.find(s => s.absolutePosition === e.spielerPosition)?.name ?? 'Spieler';
        this.flashTextManager?.zeigeSpielevent('SchweinchenGemeldet', { spielerName: name });
        break;
      }

      case 'HOCHZEIT_PARTNER_GEFUNDEN': {
        const e = ereignis as HochzeitPartnerGefundenEreignis;
        const partner = this.letztesModell?.spieler.find(s => s.position === e.partnerPosition);
        this.flashTextManager?.zeigeSpielevent('HochzeitPartnerGefunden', { spielerName: partner?.name ?? 'Spieler' });
        break;
      }

      case 'SPIEL_BEENDET': {
        const m = this.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        const spielNr = m.letztesSpielergebnis?.spielNummer ?? null;
        if (spielNr !== null && spielNr === this._letzterGezeigterSpielBeendet) break;
        this._letzterGezeigterSpielBeendet = spielNr;
        this.flashTextManager?.zeigeSpielevent('SpielBeendet');
        this.animationen?.reiheEin(() => this.zeigeGewinnerFlash(m));
        
        // Blockiere die Verarbeitung von Folge-Events (z.B. SPIEL_GESTARTET oder KI-Züge), 
        // bis der Nutzer das Modal bestätigt hat.
        appStore.pausiereQueue();
        
        if (m.partieBeendet) {
          this.animationen?.reiheEin(() => { this.zeigePartieEndeModal(m); return Promise.resolve(); });
        } else {
          this.animationen?.reiheEin(() => this.zeigeRundenEndeModal(m));
        }
        break;
      }

      case 'SNAPSHOT': {
        // Nach einem Reload: Overlay für abgeschlossenes Spiel wiederherstellen.
        // laufendesSpiel === null + letztesSpielergebnis vorhanden → Rundenauswertung war aktiv.
        // Das Modell wird erst im Store-Abo aufgebaut (aktuellerTisch kann hier noch null sein).
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
        break;
      }
    }
  }

  private async animiereGegnerKarte(pos: SpielerPosition, dauer = 400): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h);
    const kg = berechneKartenGroesse(b);
    const tempK = this.erstelleKartenansicht(layout[pos].kartenX, layout[pos].kartenY, kg.w, kg.h, { verdeckt: true });
    tempK.setDepth(10); // Über tischEbene (depth 3) sichtbar
    try {
      await this.animationen?.animiereKarteAusspielen({ wurzel: tempK }, slotPos[pos], dauer);
    } finally {
      tempK.destroy(true);
      // Guard aufheben, damit die statische (offene) Karte nun gerendert werden kann
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
    
    // Wir muessen das Modell mit dem uebergebenen State (aus dem Event) bauen,
    // da der AppStore noch den alten State (ohne diesen neuen Stich in der Historie) hat.
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
          // Fallback zur Mitte
          return { wurzel: this.erstelleKartenansicht(b/2, h/2, kg.w, kg.h, { karte: k.karte }) };
      }
      const w = this.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: k.karte }); 
      w.setAngle(s.winkel);
      w.setDepth(100); // Garantiert Sichtbarkeit ueber dem Tisch und UI
      return { wurzel: w, bild: w.bildObjekt }; 
    });
    
    const npPos = nameplatePositionFuer(mStich.gewinnerPosition, b, h);
    const istH = mStich.gewinnerPosition === SPIELER_POSITION.SUED || mStich.gewinnerPosition === SPIELER_POSITION.NORD;
    const flash = this.add.rectangle(npPos.x, npPos.y, istH ? Math.max(120, b * 0.11) : Math.max(80, b * 0.07), istH ? Math.max(54, h * 0.075) : Math.max(80, h * 0.11), 0xffe082, 0.7).setDepth(150).setAlpha(0);
    
    this.stichEinziehenAktiv = true;
    this.triggerRender(true); // Loescht die statischen Karten aus der Mitte (Guard ist aktiv)
    
    try { 
      await this.animationen?.animiereStichEinziehen(animK, ziel, mStich.augen, flash); 
    } finally { 
      animK.forEach((k: any) => k.wurzel.destroy()); 
      flash.destroy(); 
      this.stichEinziehenAktiv = false;
      // Wieder statisch rendern, falls der Store den State noch nicht gepatcht hat
      this.triggerRender(true);
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
    this.synchronisiereAktionZustand(modell);
    if (zustand.meldung) {
      this.toastManager?.zeige({
        text: zustand.meldung.text,
        typ: zustand.meldung.typ === 'fehler' ? 'fehler' : 'info'
      });
      appStore.quittiereMeldung();
    }
    // Modal automatisch schliessen wenn eine neue Partie gestartet wurde (z.B. Auto-Start)
    if (this.phaserPartieEndeModal && zustand.partieStand?.laufendesSpiel) {
      this.schliessePartieEndeModal();
    }
  }

  private renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    // Persistente eigene Karten invalidieren wenn sich die Spielnummer aendert (neues Spiel).
    const aktuelleSpielNummer = zustand.partieStand?.laufendesSpiel?.spielNummer ?? null;
    if (aktuelleSpielNummer !== this.letztePersistierteSpielNummer) {
      this.loeseEigeneKartenAuf();
      this.letztePersistierteSpielNummer = aktuelleSpielNummer;
    }

    this.tischEbene?.destroy(true);
    document.getElementById('ui-root')?.querySelectorAll('[data-testid^="btn-vorbehalt-"],[data-testid^="btn-ansage-"],[data-testid^="btn-armut-"]').forEach(el => el.remove());
    this.handKartenobjekte.clear();
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const mitteX = breite / 2;
    const mitteY = hoehe / 2;
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.add.container(0, 0);
    // tischEbene (depth 3) rendert ueber eigenem Hand (depth 2) und Hintergrund (depth 0).
    // Overlays (Dialoge) sind Kinder von ebene und ueberdecken dadurch auch persistente Karten. ✓
    ebene.setDepth(3);

    this.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      this.aktualisiereNameplate(spieler, modell, breite, hoehe);
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

  private renderTopBar(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number): void {
    const barH = 40;
    const barColor = 0x0d1f12;
    ebene.add(this.add.rectangle(breite / 2, barH / 2, breite, barH, barColor, 1).setStrokeStyle(1, 0xd8f3dc, 0.15));
    const schriftM = Math.round(Math.max(12, breite * 0.011));
    const iconSize = Math.round(Math.max(16, breite * 0.014));
    const stichAnzahl = modell.spieler.reduce((sum, s) => sum + s.stiche, 0);
    const maxStiche = zustand.aktuellerTisch?.konfiguration.ohneNeunen ? 10 : 12;
    const stichInfo = modell.spieltyp ? `Stich ${stichAnzahl}/${maxStiche}` : '';
    ebene.add(this.add.text(15, barH / 2, stichInfo, { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftM}px` }).setOrigin(0, 0.5));
    const tisch = zustand.aktuellerTisch;
    const spiel = zustand.partieStand?.laufendesSpiel;
    let zentrumsText = tisch?.name ?? '';
    if (spiel) {
      zentrumsText += ` · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'}`;
      if (modell.spieltyp) zentrumsText += ` · ${modell.spieltyp}`;
    } else if (tisch) {
      zentrumsText += ` · ${tisch.status}`;
    }
    ebene.add(this.add.text(breite / 2, barH / 2, zentrumsText, { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${schriftM}px` }).setOrigin(0.5));
    let rightX = breite - 15;
    const debugIcon = this.add.text(rightX, barH / 2, '🐛', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    debugIcon.on('pointerdown', () => appStore.toggleDebugModus());
    rightX -= 35;
    const settingsIcon = this.add.text(rightX, barH / 2, '⚙', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    settingsIcon.on('pointerdown', () => { this.einstellungenOffen = !this.einstellungenOffen; this.renderTisch(zustand, modell); });
    rightX -= 35;
    const sidebarIcon = this.add.text(rightX, barH / 2, '≡', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    sidebarIcon.on('pointerdown', () => { this.seitenladeOffen = !this.seitenladeOffen; this.renderTisch(zustand, modell); });
    rightX -= 35;
    const protokollIcon = this.add.text(rightX, barH / 2, '📋', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px` }).setOrigin(1, 0.5).setAlpha(this.spielprotokollOverlay ? 1 : 0.6).setInteractive({ useHandCursor: true });
    protokollIcon.on('pointerdown', () => { this.toggleSpielprotokoll(modell, zustand); });
    rightX -= 35;
    const leaveIcon = this.add.text(rightX, barH / 2, '←', { fontFamily: FONT_FAMILY, fontSize: `${iconSize}px`, color: '#ef4444' }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    leaveIcon.on('pointerdown', () => {
      const istImSpiel = appStore.snapshot().aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel && !window.confirm('Partie abbrechen und Tisch verlassen?')) return;
      void appStore.verlasseAktuellenTisch();
    });
    rightX -= 35;
    const startBtnSichtbar = tisch?.status === 'WARTEND' && zustand.spieler?.spielerId === tisch.erstelltVonSpielerId;
    if (startBtnSichtbar) {
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
    this.uiManager?.aktualisiereTopBar(stichInfo, modell.spieltyp ?? '', startBtnSichtbar);
  }

  private renderEinstellungsModal(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
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
    ebene.add(this.add.text(dialogX, currentY, 'Einstellungen', { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${schriftH2}px` }).setOrigin(0.5));
    currentY += 50;
    const tisch = zustand.aktuellerTisch;
    const darfKonf = zustand.spieler?.spielerId === tisch?.erstelltVonSpielerId && tisch?.status === 'WARTEND';
    ebene.add(this.add.text(dialogX, currentY, 'Tischhintergrund', { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const bgOptionen: Tischhintergrund[] = ['FILZ_GRUEN', 'HOLZ_DUNKEL', 'BLAU_GRAFIK', 'RECHTECK_1', 'RECHTECK_2', 'OVAL_1', 'OVAL_2', 'RUND_1'];
    const aktuellerBgIdx = bgOptionen.indexOf(modell.tischhintergrund);
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, modell.tischhintergrund.replace(/_/g, ' '), () => {
      const naechsterIdx = (aktuellerBgIdx + 1) % bgOptionen.length;
      void appStore.aktualisiereAktuellenTischhintergrund(bgOptionen[naechsterIdx]);
    }, zustand.wirdGeladen || !darfKonf, true);
    currentY += zeilenAbstand - 20;
    ebene.add(this.add.text(dialogX, currentY, 'KI-Schwierigkeit', { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const kiOptionen: Array<'LEICHT' | 'STANDARD' | 'SCHWER'> = ['LEICHT', 'STANDARD', 'SCHWER'];
    const aktuelleKi = tisch?.konfiguration.kiSchwierigkeit ?? 'STANDARD';
    const kiIdx = kiOptionen.indexOf(aktuelleKi as 'LEICHT' | 'STANDARD' | 'SCHWER');
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, aktuelleKi, () => {
      const naechsterIdx = (kiIdx + 1) % kiOptionen.length;
      void appStore.aktualisiereAktuelleKiSchwierigkeit(kiOptionen[naechsterIdx]);
    }, zustand.wirdGeladen || !darfKonf, true);
    currentY += zeilenAbstand - 20;
    ebene.add(this.add.text(dialogX, currentY, 'Animationen', { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
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
    ebene.add(this.add.text(hudX + 15, currentY, 'SPIELER', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
    currentY += 25;
    modell.spieler.forEach((spieler) => {
      const farbe = spieler.istSelbst ? '#ffd166' : '#f8f9fa';
      ebene.add(this.add.text(hudX + 15, currentY, spieler.anzeigeName, { fontFamily: FONT_FAMILY, color: farbe, fontSize: `${schriftName}px`, fontStyle: spieler.istSelbst ? 'bold' : 'normal' }));
      const info = `${spieler.stiche} Stiche${spieler.partei ? ' · ' + spieler.partei : ''}`;
      ebene.add(this.add.text(hudX + 15, currentY + 16, info, { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
      currentY += zeilenAbstand + 10;
    });
    currentY += 10;
    if (modell.gesamtpunktestand.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'PUNKTESTAND', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
      currentY += 25;
      modell.gesamtpunktestand.forEach((eintrag) => {
        ebene.add(this.add.text(hudX + 15, currentY, `${eintrag.name}: ${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte}`, { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${schriftName}px` }));
        currentY += 22;
      });
    }
    currentY += 15;
    if (modell.ansageHistorie.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'HISTORIE', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
      currentY += 25;
      modell.ansageHistorie.slice(-6).reverse().forEach((ansage) => {
        ebene.add(this.add.text(hudX + 15, currentY, `${ansage.name}: ${formatiereAnsage(ansage.ansage)}`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${schriftInfo}px` }));
        currentY += 18;
      });
    }
    currentY += 15;
    const letzteStiche = modell.letzteAbgeschlosseneStiche.slice(-3).reverse();
    if (letzteStiche.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'LETZTE STICHE', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${schriftInfo}px` }));
      currentY += 25;
      letzteStiche.forEach((stich) => {
        ebene.add(this.add.text(hudX + 15, currentY, `${stich.gewinnerName}: ${stich.augen} Augen`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${schriftInfo}px` }));
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
      const istVertikal = spieler.position === SPIELER_POSITION.SUED || spieler.position === SPIELER_POSITION.NORD;
      for (let i = 0; i < anzahlSichtbar; i++) {
        const versatz = -(anzahlSichtbar - 1 - i) * versatzPx;
        const kx = pos.x + (istVertikal ? 0 : versatz);
        const ky = pos.y + (istVertikal ? versatz : 0);
        ebene.add(this.erstelleKartenansicht(kx, ky, stapelW, stapelH, { verdeckt: true }).setAngle(pos.winkel).setAlpha(0.88));
      }
      ebene.add(this.add.text(pos.x, pos.y + Math.round(stapelH * 0.65), `${spieler.stiche}`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px`, backgroundColor: '#0d3d1e', padding: { x: 3, y: 1 } }).setOrigin(0.5));
      const letzterStichDesSpielers = modell.letzteAbgeschlosseneStiche.filter((s) => s.gewinnerPosition === spieler.position).at(-1);
      if (letzterStichDesSpielers) {
        const hitZone = this.add.rectangle(pos.x, pos.y, stapelW * 1.3, stapelH * 1.3 + stapelH * 0.65, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => { if (this.letzterStichOverlay) this.versteckeLetztesStichOverlay(); else this.zeigeLetztesStichOverlay(letzterStichDesSpielers, breite, hoehe); });
        ebene.add(hitZone);
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
    container.add(this.add.text(breite / 2, hoehe / 2 - panelH * 0.38, `Letzter Stich — ${stich.augen} Augen`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${Math.round(Math.max(12, breite * 0.011))}px` }).setOrigin(0.5));
    const startX = breite / 2 - ((stich.gespielteKarten.length - 1) * kAbstand) / 2;
    stich.gespielteKarten.forEach((e, i) => {
      const ansicht = this.erstelleKartenansicht(startX + i * kAbstand, hoehe / 2 + panelH * 0.05, kgroesse.w, kgroesse.h, { karte: e.karte });
      ansicht.setScale(0, 1);
      container.add(ansicht);
      this.tweens.add({ targets: ansicht, scaleX: 1, duration: 150, ease: 'Cubic.Out', delay: i * 60 });
    });
    container.add(this.add.text(breite / 2, hoehe / 2 + panelH * 0.44, 'Klick zum Schliessen', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px` }).setOrigin(0.5));
    this.letzterStichOverlay = container;
    this.letzterStichTimer = this.time.addEvent({ delay: 4000, callback: () => this.versteckeLetztesStichOverlay(), callbackScope: this });
  }

  private versteckeLetztesStichOverlay(): void {
    this.letzterStichTimer?.remove(false);
    this.letzterStichTimer = undefined;
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
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

  private stichEinziehenAktiv = false;

  private renderStichmitte(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, mitteX: number, mitteY: number, breite: number, hoehe: number): void {
    // AnimationGuard: Waehrend der Stich eingezogen wird, uebernehmen die Klone in der Animation das Rendering
    if (this.stichEinziehenAktiv || modell.aktuelleStichmitte.length === 0) return;
    const slotPos = stichSlotPositionen(mitteX, mitteY, breite, hoehe);
    const kg = berechneKartenGroesse(breite);
    modell.aktuelleStichmitte.forEach((e) => {
      if (this.wartendeKartenId === e.karte.id) return; // AnimationGuard: Animation übernimmt Rendering
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

  private aktualisiereNameplate(spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell, breite: number, hoehe: number): void {
    const pos = nameplatePositionFuer(spieler.position, breite, hoehe);
    let np = this.nameplates.get(spieler.position);

    if (!np) {
      const daten: NameplateDaten = {
        name: spieler.anzeigeName,
        position: spieler.position,
        istKI: !spieler.istMensch && !spieler.istSelbst,
      };
      np = new Nameplate(this, pos.x, pos.y, daten);
      this.nameplates.set(spieler.position, np);
    } else {
      np.setPosition(pos.x, pos.y);
    }

    if (spieler.partei) {
      np.setTeamfarbe(spieler.partei === PARTEI.RE ? 're' : 'kontra');
    }

    if (modell.phase === 'VORBEHALT_ANSAGE' && modell.aktuellerSpieler === spieler.position) {
      np.setZustand('amZug');
      np.showVorbehalt();
    } else {
      np.clearVorbehalt();
      if (modell.aktuellerSpieler === spieler.position) {
        np.setZustand('amZug');
      } else if (spieler.istGeber) {
        np.setZustand('geber');
      } else {
        np.setZustand('default');
      }
    }

    // Ansage-Badges aus Historie setzen (idempotent — showAnsage erkennt Duplikate nicht, daher nur einmal)
    const eigeneAnsagen = modell.ansageHistorie.filter(a => a.position === spieler.position);
    const reAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 're');
    const kontraAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 'kontra');
    if (reAnsage && !np['ansageBadge']) np.showAnsage('re');
    if (kontraAnsage && !np['ansageBadge']) np.showAnsage('kontra');
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
    const istH = spieler.position === SPIELER_POSITION.SUED || spieler.position === SPIELER_POSITION.NORD;
    const stX = istH ? szB / 2 - ((kAnzahl - 1) * kAb.horizontal) / 2 : pos.kartenX;
    const [fB, fS]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[spieler.position] as [number, number];
    const istGesp = spieler.position === SPIELER_POSITION.NORD || spieler.position === SPIELER_POSITION.OST;
    const animA = !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);

    // Eigene Hand (SUED): Karten-Sprites werden persistiert und wiederverwendet, damit keine Flackern-Artefakte entstehen.
    if (spieler.istSelbst && sichtbare) {
      const aktuelleIds = new Set(sichtbare.map((k) => k.id));
      // Sprites entfernen, die nicht mehr in der Hand sind
      for (const [id, kA] of this.persistenteEigeneKarten) {
        if (!aktuelleIds.has(id)) { kA.destroy(); this.persistenteEigeneKarten.delete(id); }
      }
    }

    for (let i = 0; i < kAnzahl; i++) {
      const fI = istGesp ? kAnzahl - 1 - i : i;
      const ab = istH ? fI * kAb.horizontal : fI * kAb.vertikal;
      const x = istH ? stX + ab : pos.kartenX;
      const y = istH ? pos.kartenY : pos.kartenY + ab;
      const w = fB + fI * fS;
      const k = sichtbare?.[i];
      // AnimationGuard: Karte wird exklusiv durch die Animation dargestellt — statischen Render überspringen
      if (k && this.wartendeKartenId === k.id) continue;
      const istSp = k ? modell.spielbareKarten.includes(k.id) : false;
      const istArm = k ? (armutK?.has(k.id) ?? false) : false;
      const istInt = !animA && (istSp || istArm);
      const istAus = k ? this.ausgewaehlteArmutKarten.has(k.id) : false;
      const istTast = spieler.istSelbst && k !== undefined && this.tastaturKarteIndex >= 0 && modell.spielbareKarten[this.tastaturKarteIndex] === k.id;
      const bV = (istAus || istTast) ? -auswV : 0;

      let kA: Kartenansicht;
      let istWiederverwendet = false;
      if (spieler.istSelbst && k && this.persistenteEigeneKarten.has(k.id)) {
        // Persistierten Sprite wiederverwenden: Position und Darstellung aktualisieren
        kA = this.persistenteEigeneKarten.get(k.id)!;
        kA.setPosition(x, y + bV);
        istWiederverwendet = true;
      } else {
        kA = offen ? this.erstelleKartenansicht(x, y + bV, kG.w, kG.h, k ? { karte: k } : {}) : this.erstelleKartenansicht(x, y + bV, kG.w, kG.h, { verdeckt: true });
        if (spieler.istSelbst && k) {
          // Neuen eigenen Sprite im Scene-Root verankern (nicht in tischEbene) und persistent merken.
          // depth(2): ueber Hintergrund (0), unter tischEbene (3) — Overlays in tischEbene ueberdecken korrekt.
          kA.setDepth(2);
          this.persistenteEigeneKarten.set(k.id, kA);
        } else {
          ebene.add(kA);
        }
      }

      kA.setAngle(w).setAlpha(this.austeilenAktiv ? 0 : (offen ? (hatInt && k && !istInt ? 0.45 : 1) : 0.92));
      if (istAus) kA.markiereAuswahl(); else if (istTast) kA.markiereTastaturfokus(); else kA.loescheMarkierung();

      if (k) this.handKartenobjekte.set(k.id, { wurzel: kA, bild: kA.bildObjekt });
      if (offen && k && istInt) {
        // Bestehende Handler entfernen bevor neue angebunden werden (verhindert Akkumulation bei Reconciliation).
        if (istWiederverwendet) {
          kA.removeAllListeners?.('pointerover');
          kA.removeAllListeners?.('pointerout');
          kA.removeAllListeners?.('pointerdown');
        }
        kA.setInteractive({ useHandCursor: true });
        const hV = Math.round(kG.h * 0.08);
        kA.on('pointerover', () => kA.setY(y + bV - hV));
        kA.on('pointerout', () => kA.setY(y + bV));
        kA.on('pointerdown', () => { if (istSp) void this.spieleKarteMitAnimation(k.id); else { this.toggleArmutKarte(k.id, modell.armutAktion?.kartenAnzahl ?? 0); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); } });
      } else if (offen && k && !istInt && istWiederverwendet) {
        // Reusierter Sprite war vorher interaktiv — Zustand zuruecksetzen.
        kA.disableInteractive?.();
        kA.removeAllListeners?.('pointerover');
        kA.removeAllListeners?.('pointerout');
        kA.removeAllListeners?.('pointerdown');
      }
    }
  }

  /** Zerstoert alle persistierten eigenen Karten-Sprites und leert den Cache. */
  private loeseEigeneKartenAuf(): void {
    for (const kA of this.persistenteEigeneKarten.values()) kA.destroy();
    this.persistenteEigeneKarten.clear();
  }

  private bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) return;
    appStore.beantworteArmut(true, Array.from(this.ausgewaehlteArmutKarten));
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const a = modell.armutAktion;
    if (!a || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return null;
    if (a.modus === 'ANTWORTEN' && !this.armutAnnahmeAktiv) return null;
    const ids = a.modus === 'ANBIETEN' ? handkarten.filter((k) => istTrumpfFuerSpieltyp(k, modell.spieltyp)).map((k) => k.id) : handkarten.map((k) => k.id);
    return new Set(ids);
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
    const kObj = this.handKartenobjekte.get(id);
    if (!kObj) { appStore.spieleKarte(id); return; }
    const { width: b, height: h } = this.scale.gameSize;
    const ziel = stichSlotPositionen(b / 2, h / 2, b, h).SUED;
    this.wartendeKartenId = id;
    
    // Wir nehmen die Karte manuell aus der Hand, damit sie bei State-Updates
    // nicht durch renderHandkarten() zerstoert wird, waehrend sie noch animiert.
    this.persistenteEigeneKarten.delete(id);
    this.tischEbene?.add(kObj.wurzel); // in die Tisch-Ebene verschieben, damit sie ueber der Hand schwebt
    
    // API Call SOFORT absetzen (Optimistic UI). 
    appStore.spieleKarte(id);
    
    await this.animationen?.reiheEin(async () => {
      await this.animationen?.animiereKarteAusspielen(kObj, ziel);
      kObj.wurzel.destroy(); // am Ende der Animation manuell zerstoeren
      if (this.wartendeKartenId === id) this.wartendeKartenId = null;
      // Kein triggerRender(true) hier: Der KARTE_GESPIELT-Event ist bereits in der Queue
      // und wird verarbeitet, sobald wartendeKartenId=null den Quiescence-Guard aufhebt.
      // Das State-Patch des Events loest den Render mit dem korrekten Zustand aus
      // (Karte in der Mitte, nicht mehr in der Hand) — verhindert das kurzzeitige
      // Zurueck-Rendern der Karte in die Hand bei der alten triggerRender(true)-Variante.
    });
  }

  private async starteAusteilen(modell: TischAnsichtModell, zustand: AppZustand): Promise<void> {
    const { width: b, height: h } = this.scale.gameSize;
    const layout = berechneLayout(b, h);
    const kg = berechneKartenGroesse(b);
    const kAb = berechneKartenAbstand(b, h);

    // Austeil-Reihenfolge nach DKV: Vorhand zuerst (Spieler nach dem Geber), Geber zuletzt
    const uhrzeigersinn: SpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];
    const geber = modell.spieler.find((s) => s.istGeber);
    const geberIdx = geber ? uhrzeigersinn.indexOf(geber.position) : 0;
    const dealReihenfolge = [1, 2, 3, 0].map((offset) => {
      const pos = uhrzeigersinn[(geberIdx + offset) % 4];
      return modell.spieler.find((s) => s.position === pos);
    }).filter((s): s is TischAnsichtModell['spieler'][number] => s !== undefined);

    // Karten-Pakete pro Spieler vorbereiten (Reihenfolge im Fächer)
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
        const wuz = (s.istSelbst && k) ? this.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { karte: k }) : this.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { verdeckt: true });
        wuz.setAngle(w);
        // Animationskarten über tischEbene (depth 3) rendern, damit sie sichtbar sind
        wuz.setDepth(10);
        spielerPakete.push({ kartenobjekte: { wurzel: wuz, bild: wuz.bildObjekt }, ziel: { x: istH ? stX + fI * kAb.horizontal : layout[s.position].kartenX, y: istH ? layout[s.position].kartenY : layout[s.position].kartenY + fI * kAb.vertikal } });
      }
      kartenProSpieler.set(s.position, spielerPakete);
    }

    // DKV-Reihenfolge: erst 3, dann 4, dann 3 Karten pro Spieler im Uhrzeigersinn
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
    // Wir nehmen an, dass das Event-Handling die Ansage passend zuordnet (vereinfacht fuer Banner)
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

  private async zeigeRundenEndeModal(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigeRundenEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    // E2E-Bridge sofort erhoehen damit Tests die Anzeige erkennen
    const br = (window as { __locodoko?: { _rundenEndeModalGezeigt?: number; _rundenauswertungSpieltypLabel?: string; _rundenauswertungMultiplikator?: number } }).__locodoko;
    if (br) {
      br._rundenEndeModalGezeigt = (br._rundenEndeModalGezeigt ?? 0) + 1;
      br._rundenauswertungSpieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
      br._rundenauswertungMultiplikator = e.soloMultiplikator;
    }

    const anzahlS = this.letzterZustand?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const { width: bw, height: bh } = this.scale.gameSize;
    const cx = bw / 2, cy = bh / 2;
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;

    this.phaserRundenEndeModal = new PhaserModal(this, cx, cy, {
      breite: 620,
      hoehe: 520,
      titel: anzahlS ? `${spieltypLabel} | Spiel ${e.spielNummer}/${anzahlS}` : `${spieltypLabel} | Spiel ${e.spielNummer}`,
      aktionen: [{ text: 'Weiter', callback: () => this.schliesseRundenEndeModal() }]
    });
    this.rundenauswertungObjekte.push(this.phaserRundenEndeModal);

    // Content-Zeilen relativ zum Modal-Zentrum (Panel-Mitte = cy)
    const gewinner = e.siegerPartei === PARTEI.RE ? 'RE gewinnt!' : 'KONTRA gewinnt!';
    const siegerFarbe = e.siegerPartei === PARTEI.RE ? '#ffd700' : '#ff4455';
    let ry = -520 / 2 + 70;

    const siegerText = this.add.text(0, ry, gewinner, {
      fontSize: '18px', color: siegerFarbe, fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(100);
    this.phaserRundenEndeModal.getContentContainer().add(siegerText);
    ry += 36;

    // Punkte-Aufschluesselung mit Fallback auf berechnete Zeilen
    const aufschluesselung = e.punkteAufschluesselung.length > 0
      ? e.punkteAufschluesselung
      : [
          { label: 'Grundwert', punkte: e.grundwert },
          ...(e.absagePunkte !== 0 ? [{ label: 'Ansagen', punkte: e.absagePunkte }] : []),
          ...(e.gegenDieAltenPunkte > 0 ? [{ label: 'Gegen die Alten', punkte: e.gegenDieAltenPunkte }] : []),
          ...(e.sonderpunkteRe.length + e.sonderpunkteKontra.length > 0
            ? [{ label: 'Sonderpunkte', punkte: e.sonderpunkteRe.length + e.sonderpunkteKontra.length }]
            : [])
        ];

    const countUpTexte: { wert: number; label: string; textObj: Phaser.GameObjects.Text }[] = [];
    aufschluesselung.forEach((pc) => {
      const txt = this.add.text(-290, ry, `${pc.label}: 0`, {
        fontSize: '12px', color: '#f0e6ff', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0).setDepth(100);
      this.phaserRundenEndeModal!.getContentContainer().add(txt);
      countUpTexte.push({ wert: pc.punkte, label: pc.label, textObj: txt });
      ry += 24;
    });

    // Count-up 0 → finaler Wert, 800ms Cubic.Out
    const targets = countUpTexte.map(() => ({ t: 0 }));
    this.tweens.add({
      targets,
      t: 1,
      duration: 800,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => {
        countUpTexte.forEach((ct, idx) => {
          const val = Math.round(ct.wert * targets[idx].t);
          ct.textObj.setText(`${ct.label}: ${val > 0 ? '+' : ''}${val}`);
          // Sonderpunkt-Glow bei Annaeherung an den Endwert
          if (targets[idx].t >= 0.95) {
            ct.textObj.setColor('#ffff66');
            this.tweens.add({ targets: ct.textObj, alpha: 0.6, duration: 150, yoyo: true, repeat: 1,
              onComplete: () => { ct.textObj.setColor('#f0e6ff'); ct.textObj.setAlpha(1); }
            });
          }
        });
      }
    });

    // Spielwert
    ry += 12;
    const swText = this.add.text(0, ry, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: '13px', color: siegerFarbe, fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0).setDepth(100);
    this.phaserRundenEndeModal.getContentContainer().add(swText);
    ry += 28;

    // Spieler-Punkte
    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const marker = istSelbst ? ' <<' : '';
      const spTxt = this.add.text(-290, ry, `${sp.name}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}${marker}`, {
        fontSize: '10px', color: istSelbst ? '#ffd700' : '#c0b0d0', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0).setDepth(100);
      this.phaserRundenEndeModal!.getContentContainer().add(spTxt);
      ry += 20;
    });

    this.tischEbene?.add(this.phaserRundenEndeModal);
  }

  private schliesseRundenEndeModal(): void {
    this.phaserRundenEndeModal?.destroy(); this.phaserRundenEndeModal = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy()); this.rundenauswertungObjekte = [];
    appStore.setzeQueueFort();
  }

  private zeigePartieEndeModal(m: TischAnsichtModell): void {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigePartieEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    const anzahlS = this.letzterZustand?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
    const siegerFarbe = e.siegerPartei === 'RE' ? '#4adf7a' : '#ff6b6b';

    this.phaserPartieEndeModal = new PhaserModal(this, this.scale.gameSize.width / 2, this.scale.gameSize.height / 2, {
      breite: 500,
      hoehe: 600,
      titel: 'Partie beendet',
      zeigeSchliessenButton: false,
      aktionen: [
        {
          text: 'Neue Partie',
          callback: () => { this.schliessePartieEndeModal(); void appStore.starteNeuePartie(); }
        },
        {
          text: 'Tisch verlassen',
          typ: 'secondary',
          callback: () => { this.schliessePartieEndeModal(); void appStore.verlasseAktuellenTisch(); }
        }
      ]
    });

    const container = this.phaserPartieEndeModal?.getContentContainer();
    let y = -280;

    // Spielinfo
    const infoTxt = this.add.text(0, y, `${spieltypLabel} · ${anzahlS ? `Spiel ${e.spielNummer} von ${anzahlS}` : `Spiel ${e.spielNummer}`}`, {
      fontSize: '12px', color: '#d8f3dc', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(infoTxt);
    y += 20;

    // Sieger
    const siegerTxt = this.add.text(0, y, `${e.siegerPartei} gewinnt`, {
      fontSize: '16px', color: siegerFarbe, fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5, 0);
    container.add(siegerTxt);
    y += 28;

    // Augen
    const augenTxt = this.add.text(0, y, `Re ${e.augenRe}:${e.augenKontra} Kontra Augen`, {
      fontSize: '11px', color: '#90caf9', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(augenTxt);
    y += 20;

    // Parteien
    const reNamen = m.spieler.filter((s) => s.partei === PARTEI.RE).map((s) => s.name).join(', ') || '–';
    const kontraNamen = m.spieler.filter((s) => s.partei === PARTEI.KONTRA).map((s) => s.name).join(', ') || '–';
    const parteienTxt = this.add.text(0, y, `Re: ${reNamen}\nKontra: ${kontraNamen}`, {
      fontSize: '9px', color: '#c0b0d0', fontFamily: 'Press Start 2P', align: 'center'
    }).setOrigin(0.5, 0);
    container.add(parteienTxt);
    y += 36;

    // Berechnung
    const bZ: string[] = [`Grundwert: +${e.grundwert}`];
    if (e.absagePunkte !== 0) bZ.push(`Ansagen: ${e.absagePunkte > 0 ? '+' : ''}${e.absagePunkte}`);
    if (e.gegenDieAltenPunkte > 0) bZ.push(`Gegen die Alten: +${e.gegenDieAltenPunkte}`);
    if (e.soloMultiplikator > 1) bZ.push(`Solo-Multiplikator: ×${e.soloMultiplikator}`);
    const sp = [...e.sonderpunkteRe.map((s) => `Re: ${formatiereSonderpunkt(s, sNMap)}`), ...e.sonderpunkteKontra.map((s) => `Kontra: ${formatiereSonderpunkt(s, sNMap)}`)];
    if (sp.length > 0) bZ.push(`Sonderpunkte: ${sp.join(', ')}`);

    bZ.forEach((zeile) => {
      const berechnungTxt = this.add.text(-220, y, zeile, {
        fontSize: '10px', color: '#f0e6ff', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(berechnungTxt);
      y += 18;
    });

    // Spielwert
    y += 6;
    const spielwertTxt = this.add.text(0, y, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: '12px', color: siegerFarbe, fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(spielwertTxt);
    y += 22;

    // Spieler-Punkte
    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const marker = istSelbst ? ' <<' : '';
      const puntFarbe = sp.punkte >= 0 ? '#4adf7a' : '#ff6b6b';
      const punktTxt = this.add.text(-220, y, `${sp.name}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}${marker}`, {
        fontSize: '10px', color: puntFarbe, fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(punktTxt);
      y += 18;
    });

    // Gesamtstand (Top 4)
    y += 12;
    const gesamtstandTitel = this.add.text(0, y, 'Gesamtstand', {
      fontSize: '12px', color: '#ffd700', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(gesamtstandTitel);
    y += 20;

    const sortedGs = [...m.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte).slice(0, 4);
    const maxPkt = sortedGs.length > 0 ? sortedGs[0].punkte : 0;
    sortedGs.forEach((ei) => {
      const istVorne = ei.punkte === maxPkt && maxPkt > 0;
      const sternchenText = istVorne ? ' ★' : '';
      const gsTxt = this.add.text(-220, y, `${ei.name}${sternchenText}: ${ei.punkte}`, {
        fontSize: '10px', color: istVorne ? '#ffd166' : '#c0b0d0', fontFamily: 'Press Start 2P'
      }).setOrigin(0, 0);
      container.add(gsTxt);
      y += 18;
    });

    // Countdown Timer
    y += 12;
    const countdownTxt = this.add.text(0, y, '', {
      fontSize: '10px', color: '#888888', fontFamily: 'Press Start 2P'
    }).setOrigin(0.5, 0);
    container.add(countdownTxt);

    const updateCountdown = () => {
      const aktuellerCountdown = appStore.snapshot().countdownSekunden ?? 0;
      countdownTxt.setText(formatiereCountdownText(aktuellerCountdown));
      if (aktuellerCountdown <= 0) {
        this.schliessePartieEndeModal();
        void appStore.starteNeuePartie();
      }
    };

    updateCountdown();
    this.partieCountdownInterval = window.setInterval(updateCountdown, 1000);

    this.tischEbene?.add(this.phaserPartieEndeModal);

    const br = (window as { __locodoko?: { _partieEndeModalGezeigt?: number } }).__locodoko;
    if (br) {
      br._partieEndeModalGezeigt = (br._partieEndeModalGezeigt ?? 0) + 1;
    }
  }

  private schliessePartieEndeModal(): void {
    if (this.partieCountdownInterval !== undefined) {
      clearInterval(this.partieCountdownInterval);
      this.partieCountdownInterval = undefined;
    }
    this.phaserPartieEndeModal?.destroy();
    this.phaserPartieEndeModal = undefined;
    appStore.setzeQueueFort();
  }

  private async zeigeSpielankuendigung(m: string): Promise<void> {
    await this.animationen?.animiereSoloAnkuendigung(m, { x: this.scale.gameSize.width / 2, y: this.scale.gameSize.height / 2 });
  }

  private erstellePhaserButton(ebene: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, txt: string, hdl: () => void, d = false, s = false, hv = false, testId?: string): void {
    const hgF = d ? 0x2a2a2a : hv ? 0xffd166 : s ? 0x1a2a1a : 0x1a5a2a;
    const rF = d ? 0x555555 : hv ? 0xf8f9fa : s ? 0x4a7a5a : 0x4adf7a;
    const tF = d ? '#888888' : hv ? '#0d1f12' : '#f8f9fa';
    const bg = this.add.rectangle(x, y, w, h, hgF, d ? 0.5 : 0.92).setStrokeStyle(hv ? 2 : 1, rF, 0.9);
    ebene.add(bg); ebene.add(this.add.text(x, y, txt, { fontFamily: FONT_FAMILY, color: tF, fontSize: `${Math.round(Math.max(12, this.scale.gameSize.width * 0.011))}px` }).setOrigin(0.5));
    if (!d) bg.setInteractive({ useHandCursor: true }).on('pointerdown', hdl);
    if (testId) this.aktualisiereE2EMarker(testId, true);
  }

  private renderVorbehaltDialog(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (modell.aktuellerSpieler !== SPIELER_POSITION.SUED || modell.moeglicheVorbehalte.length === 0) return;
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
    const aDek = modell.deklarierteVorbehalte.filter((d) => d.position !== SPIELER_POSITION.SUED);
    const diaH = titH + (aDek.length > 0 ? aDek.length * zeiH + Math.round(zeiH * 0.5) : 0) + zeil * (bH + aY) + aY;
    const diaY = Math.round(hoehe * 0.28);
    ebene.add(this.add.rectangle(breite / 2, diaY, diaW, diaH, 0x0a2818, 0.97).setStrokeStyle(2, 0x4adf7a, 0.7));
    ebene.add(this.add.text(breite / 2, diaY - diaH / 2 + titH * 0.5, 'Vorbehalt ansagen', { fontFamily: FONT_FAMILY, color: '#f8f9fa', fontSize: `${Math.round(Math.max(13, breite * 0.012))}px` }).setOrigin(0.5));
    if (aDek.length > 0) {
      const sY = diaY - diaH / 2 + titH + zeiH * 0.5;
      aDek.forEach((d, i) => {
        const sN = modell.spieler.find((s) => s.position === d.position)?.name ?? d.position;
        const hV = d.ansage !== 'GESUND';
        ebene.add(this.add.text(breite / 2, sY + i * zeiH, `${sN}: ${hV ? '⚑ Vorbehalt' : '✓ Gesund'}`, { fontFamily: FONT_FAMILY, color: hV ? '#ffd700' : '#aaffaa', fontSize: `${Math.round(Math.max(11, breite * 0.009))}px` }).setOrigin(0.5));
      });
    }
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const gX = breite / 2 - bW / 2 - aX / 2;
    const gY = diaY - diaH / 2 + titH + (aDek.length > 0 ? aDek.length * zeiH + Math.round(zeiH * 0.5) : 0) + aY + bH / 2;
    opt.forEach((v, i) => {
      this.erstellePhaserButton(ebene, gX + (i % spal) * (bW + aX), gY + Math.floor(i / spal) * (bH + aY), bW, bH, formatiereVorbehalt(v), () => appStore.meldeVorbehalt(v), dkt, false, i === this.tastaturVorbehaltIndex, `btn-vorbehalt-${v.toLowerCase().replace(/_/g, '-')}`);
    });
  }

  private renderAnsageButtons(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (modell.aktuellerSpieler !== SPIELER_POSITION.SUED || modell.moeglicheAnsagen.length === 0) return;
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const bH = Math.round(Math.max(32, hoehe * 0.048));
    const bW = Math.round(Math.min(110, breite * 0.09));
    const ab = Math.round(breite * 0.008);
    const ans = modell.moeglicheAnsagen;
    const sP = modell.spieler.find((s) => s.position === SPIELER_POSITION.SUED);
    const kAnz = sP ? (sP.sichtbareHandkarten.length > 0 ? sP.sichtbareHandkarten.length : Math.max(sP.verbleibendeKarten, 0)) : 0;
    const kAb = berechneKartenAbstand(breite, hoehe);
    const kG = berechneKartenGroesse(breite);
    const npX = Math.min(breite / 2 + (kAnz > 0 ? ((kAnz - 1) * kAb.horizontal + kG.w) / 2 : 0) + Math.max(120, breite * 0.11) / 2 + 40, breite - Math.max(120, breite * 0.11) / 2 - 4);
    const stX = npX - (ans.length * (bW + ab) - ab) / 2 + bW / 2;
    const y = Math.min(hoehe * 0.85 + Math.max(54, hoehe * 0.075) / 2 + bH / 2 + 8, hoehe - bH / 2 - 4);
    ans.forEach((a, i) => { this.erstellePhaserButton(ebene, stX + i * (bW + ab), y, bW, bH, formatiereAnsage(a), () => appStore.sageAnsageAn(a), dkt, false, false, `btn-ansage-${a.toLowerCase().replace(/_/g, '-')}`); });
  }

  private renderArmutBereich(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, zustand: AppZustand, breite: number, hoehe: number): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return;
    const a = modell.armutAktion;
    const dkt = zustand.wirdGeladen || !!this.wartendeKartenId || (this.animationen?.animationLaeuft ?? false);
    const bH = Math.round(Math.max(32, hoehe * 0.048));
    const y = hoehe * 0.73;
    if (a.modus === 'ANBIETEN') {
      const anz = this.ausgewaehlteArmutKarten.size;
      ebene.add(this.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Trumpfkarte${a.kartenAnzahl === 1 ? '' : 'n'} (${anz}/${a.kartenAnzahl} gewaehlt)`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
      this.erstellePhaserButton(ebene, breite / 2, y, Math.round(Math.min(200, breite * 0.17)), bH, 'Trumpfkarten anbieten', () => this.bestaetigeArmut(modell), dkt || anz !== a.kartenAnzahl, false, false, 'btn-armut-anbieten');
    } else if (!this.armutAnnahmeAktiv) {
      const bW = Math.round(Math.min(130, breite * 0.11));
      const ab = Math.round(breite * 0.012);
      this.erstellePhaserButton(ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annehmen', () => { if (a.kartenAnzahl === 0) appStore.beantworteArmut(true, []); else { this.armutAnnahmeAktiv = true; this.ausgewaehlteArmutKarten.clear(); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); } }, dkt, false, false, 'btn-armut-annehmen');
      this.erstellePhaserButton(ebene, breite / 2 + bW / 2 + ab / 2, y, bW, bH, 'Ablehnen', () => { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); appStore.beantworteArmut(false, []); }, dkt, true, false, 'btn-armut-ablehnen');
    } else {
      const anz = this.ausgewaehlteArmutKarten.size;
      ebene.add(this.add.text(breite / 2, y - hoehe * 0.032, `Waehle ${a.kartenAnzahl} Karte${a.kartenAnzahl === 1 ? '' : 'n'} zurueck (${anz}/${a.kartenAnzahl})`, { fontFamily: FONT_FAMILY, color: '#d8f3dc', fontSize: `${Math.round(Math.max(11, breite * 0.010))}px`, align: 'center' }).setOrigin(0.5));
      const bW = Math.round(Math.min(150, breite * 0.13));
      const ab = Math.round(breite * 0.012);
      this.erstellePhaserButton(ebene, breite / 2 - bW / 2 - ab / 2, y, bW, bH, 'Annahme bestaetigen', () => this.bestaetigeArmut(modell), dkt || anz !== a.kartenAnzahl, false, false, 'btn-armut-annahme-bestaetigen');
      this.erstellePhaserButton(ebene, breite / 2 + bW / 2 + ab / 2, y, Math.round(Math.min(100, breite * 0.085)), bH, 'Abbrechen', () => { this.armutAnnahmeAktiv = false; this.ausgewaehlteArmutKarten.clear(); this.renderTisch(this.letzterZustand ?? appStore.snapshot()); }, dkt, true, false, 'btn-armut-abbrechen');
    }
  }


  private aktualisiereHintergrund(bg: Tischhintergrund, b: number, h: number): void {
    const tex = texturFuerTischhintergrund(bg);
    console.log(`[TischSzene] aktualisiereHintergrund: bg=${bg}, tex=${tex}, istBild=${istBildHintergrund(bg)}`);
    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === tex) { 
        console.log(`[TischSzene] Nutze existierendes Image`);
        this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h); 
        return; 
      }
      console.log(`[TischSzene] Erstelle neues Image für ${tex}`);
      this.hintergrund?.destroy(); this.hintergrund = this.add.image(b / 2, h / 2, tex).setDisplaySize(b, h).setDepth(0);
    } else {
      if (this.hintergrund instanceof Phaser.GameObjects.TileSprite && this.hintergrund.texture.key === tex) { 
        console.log(`[TischSzene] Nutze existierendes TileSprite`);
        this.hintergrund.setPosition(b / 2, h / 2).setSize(b, h); 
        return; 
      }
      console.log(`[TischSzene] Erstelle neues TileSprite für ${tex}`);
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

  private handleResize(): void {
    const { width: b, height: h } = this.scale.gameSize;
    if (this.hintergrund instanceof Phaser.GameObjects.Image) this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h);
    else (this.hintergrund as Phaser.GameObjects.TileSprite)?.setPosition(b / 2, h / 2).setSize(b, h);
    // Persistierte eigene Karten invalidieren: Kartengrösse aendert sich mit dem Fenster.
    this.loeseEigeneKartenAuf();
    this.letztePersistierteSpielNummer = null;
    if (this.letzterZustand?.bereich === 'TISCH') this.renderTisch(this.letzterZustand);
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.inputHandler?.aufraeumen();
    if (this.escapeHandler) document.removeEventListener('keydown', this.escapeHandler);
    this.phaserRundenEndeModal?.destroy(); this.phaserRundenEndeModal = undefined;
    this.abmeldenStore?.(); this.abmeldenSonderpunkte?.();
    this.flashTextManager?.destroy(); this.flashTextManager = undefined;
    this.nameplates.forEach(np => np.destroy()); this.nameplates.clear();
    this.animationen?.abbrechen(); this.animationen = undefined;
    this.loeseEigeneKartenAuf();
    this.rundenauswertungObjekte.forEach((o) => o.destroy()); this.tischEbene?.destroy(true);
    this.hintergrund?.destroy(); this.handKartenobjekte.clear();
    this.schliesseRundenEndeModal(); this.versteckeLetztesStichOverlay(); this.schliessePartieEndeModal();
    this.spielprotokollOverlay?.destroy(true); this.spielprotokollOverlay = undefined;
    document.getElementById('ui-root')?.querySelectorAll('[data-testid^="btn-vorbehalt-"],[data-testid^="btn-ansage-"],[data-testid^="btn-armut-"]').forEach(el => el.remove());
    this.uiManager?.aufraeumen();
  }
}
