import Phaser from 'phaser';
import { appStore } from '../anwendung';
import {
  ladeKartenBilderVorab,
  ladeHintergrundbilder,
  registriereBasisTexturen,
  registriereKartenSpriteTexturen,
  istBildHintergrund
} from '../assets/AssetLoader';
import {
  erstelleStandardTischAnsicht,
  erstelleTischAnsichtAusStatus,
  type TischAnsichtModell
} from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import { AnimationenService } from '../services/AnimationenService';
import { Kartenansicht } from '../assets/Kartenansicht';
import {
  formatiereAnsage,
  KARTEN_BREITE,
  KARTEN_HOEHE
} from './tischFormatierer';
import { TischInputHandler, type TischInputKontext } from './TischInputHandler';
import { TischUIManager, type TischUIKontext } from './TischUIManager';
import { Logger } from '../logger';
import type { Tischhintergrund } from '../modelle/SpielverwaltungDto';

/**
 * Phaser-Szene fuer die Top-Down-Ansicht des Spieltischs.
 *
 * Verwaltet das Rendering der Karten, Spieler-Infos, Animationen und die Interaktion.
 * Synchronisiert den Zustand aus dem `AppStore` with der visuellen Darstellung.
 */
export class TischSzene extends Phaser.Scene {
  private uiManager?: TischUIManager;

  private inputHandler?: TischInputHandler;

  private animationen?: AnimationenService;

  private letztesModell?: TischAnsichtModell;

  private letzterZustand?: AppZustand;

  private tischEbene?: Phaser.GameObjects.Container;

  private hintergrund?: Phaser.GameObjects.Shape | Phaser.GameObjects.Image;

  // Cache fuer Kartenobjekte der eigenen Hand (fuer Animationen)
  private readonly handKartenobjekte = new Map<string, Kartenansicht>();

  // Karten-IDs, die gerade zur Mitte animiert werden (fuer Render-Synchronisation)
  private wartendeKartenId: string | null = null;

  // Lokaler State fuer Armut-Tausch (ausgewaehlte Karten)
  private readonly ausgewaehlteArmutKarten = new Set<string>();

  // Status ob Armut gerade angenommen wurde (fuer Keyboard-Shortcut-Guard)
  private armutAnnahmeAktiv = false;

  // Aktueller Fokus-Index fuer Tastaturnavigation
  private tastaturKarteIndex = -1;

  private tastaturVorbehaltIndex = 0;

  // Overlay fuer "Letzter Stich" (Klick auf eigenen Stapel)
  private letzterStichOverlay?: Phaser.GameObjects.Container;

  private letzterStichTimer?: Phaser.Time.TimerEvent;

  private einstellungenOffen = false;

  private seitenladeOffen = false;

  constructor() {
    super('TischSzene');
  }

  /** Phaser-Lifecycle: Laedt alle benoetigten Bilder vorab in den Speicher. */
  preload(): void {
    ladeKartenBilderVorab(this);
    ladeHintergrundbilder(this);
  }

  /** Phaser-Lifecycle: Initialisiert das UI, die Steuerung and abonniert Store-Updates. */
  create(): void {
    registriereBasisTexturen(this);
    registriereKartenSpriteTexturen(this);

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

    this.animationen = new AnimationenService(this, this.uiManager.getAnimationsGeschwindigkeit());

    // Initiales Rendering mit Standard-Platzhaltern
    this.letztesModell = erstelleStandardTischAnsicht(appStore.snapshot().spieler?.name ?? 'Spieler');
    this.renderTisch(appStore.snapshot(), this.letztesModell);

    // Abo fuer Store-Updates — loest Re-Render bei jeder Aenderung aus
    this.events.on('shutdown', () => deabonnieren());
    const deabonnieren = appStore.abonnieren((zustand) => {
      void this.verarbeiteZustandsAenderung(zustand);
    });

    void this.animationen.reiheEin(async () => { this.verarbeiteZustandsAenderung(appStore.snapshot()); });

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.handleResize());
  }

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene gestoppt wird. */
  shutdown(): void {
    Logger.szene('TischSzene shutdown');
    this.aufraeumen();
  }

  /** Phaser-Lifecycle: Raeumt Ressourcen auf wenn die Szene zerstoert wird. */
  destroy(): void {
    Logger.szene('TischSzene destroy');
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
    this.uiManager.aktualisiereToasts(zustand);
  }


  private renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    this.tischEbene?.destroy(true);
    this.handKartenobjekte.clear();
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.add.container(0, 0);

    this.renderStichmitte();

    modell.spieler.forEach(() => {
      this.renderNameplate();
      this.renderKartenFaecher();
    });

    this.renderStichStapel(ebene, modell, hoehe);
    this.renderTopBar(ebene, modell, zustand, breite);
    this.renderHud(ebene, modell, breite, hoehe);

    // Phaser-UI: Ansage-Buttons, Armut-Dialog (zuerst); Vorbehalt-Dialog zuletzt (liegt oben)
    if (zustand.partieStand?.laufendesSpiel) {
      this.renderAnsageButtons(ebene, modell, zustand, breite, hoehe);
      this.renderArmutBereich();
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

    // Bar Background
    ebene.add(this.add.rectangle(breite / 2, barH / 2, breite, barH, barColor, 1)
      .setStrokeStyle(1, 0xd8f3dc, 0.15));

    const schriftM = Math.round(Math.max(12, breite * 0.011));
    const iconSize = Math.round(Math.max(16, breite * 0.014));

    // Left: Stichzaehler
    const stichInfo = modell.spieltyp ? `Stich ${modell.spieler.reduce((sum, s) => sum + s.stiche, 0)}/12` : '';
    ebene.add(this.add.text(15, barH / 2, stichInfo, {
      color: '#a3c4a8',
      fontSize: `${schriftM}px`,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5));

    // Center: Spiele Info
    const tisch = zustand.aktuellerTisch;
    const spiel = zustand.partieStand?.laufendesSpiel;
    let zentrumsText = tisch?.name ?? '';
    if (spiel) {
      zentrumsText += ` · Spiel ${spiel.spielNummer}/${zustand.partieStand?.anzahlSpiele ?? '?'}`;
      if (modell.spieltyp) zentrumsText += ` · ${modell.spieltyp}`;
    } else if (tisch) {
      zentrumsText += ` · ${tisch.status}`;
    }
    ebene.add(this.add.text(breite / 2, barH / 2, zentrumsText, {
      color: '#f8f9fa',
      fontSize: `${schriftM}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Right: Buttons / Icons
    let rightX = breite - 15;

    // Debug Button
    const debugIcon = this.add.text(rightX, barH / 2, '🐛', { fontSize: `${iconSize}px` })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    debugIcon.on('pointerdown', () => appStore.toggleDebugModus());
    rightX -= 35;

    // Einstellungen Button
    const settingsIcon = this.add.text(rightX, barH / 2, '⚙', { fontSize: `${iconSize}px` })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    settingsIcon.on('pointerdown', () => {
      this.einstellungenOffen = !this.einstellungenOffen;
      this.renderTisch(zustand, modell);
    });
    rightX -= 35;

    // Sidebar Toggle (≡)
    const sidebarIcon = this.add.text(rightX, barH / 2, '≡', { fontSize: `${iconSize}px` })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    sidebarIcon.on('pointerdown', () => {
      this.seitenladeOffen = !this.seitenladeOffen;
      this.renderTisch(zustand, modell);
    });
    rightX -= 35;

    // Leave Button (←)
    const leaveIcon = this.add.text(rightX, barH / 2, '←', { fontSize: `${iconSize}px`, color: '#ef4444' })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    leaveIcon.on('pointerdown', () => {
      const istImSpiel = appStore.snapshot().aktuellerTisch?.status === 'IM_SPIEL';
      if (istImSpiel && !window.confirm('Partie abbrechen und Tisch verlassen?')) return;
      void appStore.verlasseAktuellenTisch();
    });
    rightX -= 35;

    // Start Button (if applicable)
    if (tisch?.status === 'WARTEND' && zustand.spieler?.spielerId === tisch.erstelltVonSpielerId) {
      const startBtnW = 100;
      this.erstellePhaserButton(ebene, rightX - startBtnW / 2, barH / 2, startBtnW, 28, 'START', () => {
        void appStore.starteAktuellenTisch();
      }, zustand.wirdGeladen);
      rightX -= startBtnW + 15;
    }

    // Link teilen Button
    if (tisch?.einladungsCode) {
      const shareBtnW = 110;
      this.erstellePhaserButton(ebene, rightX - shareBtnW / 2, barH / 2, shareBtnW, 28, '🔗 LINK', () => {
        const url = `${window.location.origin}#join/${tisch.einladungsCode}`;
        void navigator.clipboard.writeText(url).then(() => {
          // Visual feedback would be nice, but for now simple
        });
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

    // Backdrop
    const backdrop = this.add.rectangle(dialogX, dialogY, breite, hoehe, 0x000000, 0.45)
      .setInteractive();
    backdrop.on('pointerdown', () => {
      this.einstellungenOffen = false;
      this.renderTisch(zustand, modell);
    });
    ebene.add(backdrop);

    // Modal Panel
    const panel = this.add.rectangle(dialogX, dialogY, dialogW, dialogH, 0x0b3d24, 0.97)
      .setStrokeStyle(2, 0xd8f3dc, 0.35);
    ebene.add(panel);

    const schriftH2 = Math.round(Math.max(18, breite * 0.016));
    const schriftHint = Math.round(Math.max(11, breite * 0.009));
    const zeilenAbstand = 70;
    let currentY = dialogY - dialogH / 2 + 40;

    ebene.add(this.add.text(dialogX, currentY, 'Einstellungen', {
      color: '#f8f9fa',
      fontSize: `${schriftH2}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    currentY += 50;

    const tisch = zustand.aktuellerTisch;
    const darfKonf = zustand.spieler?.spielerId === tisch?.erstelltVonSpielerId && tisch?.status === 'WARTEND';

    // Tischhintergrund
    ebene.add(this.add.text(dialogX, currentY, 'Tischhintergrund', { color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const bgOptionen: Tischhintergrund[] = ['FILZ_GRUEN', 'HOLZ_DUNKEL', 'BLAU_GRAFIK', 'RECHTECK_1', 'RECHTECK_2', 'OVAL_1', 'OVAL_2', 'RUND_1'];
    const aktuellerBgIdx = bgOptionen.indexOf(modell.tischhintergrund);
    const bgLabel = modell.tischhintergrund.replace(/_/g, ' ');
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, bgLabel, () => {
      const naechsterIdx = (aktuellerBgIdx + 1) % bgOptionen.length;
      void appStore.aktualisiereAktuellenTischhintergrund(bgOptionen[naechsterIdx]);
    }, zustand.wirdGeladen || !darfKonf, true);
    currentY += zeilenAbstand - 20;

    // KI-Schwierigkeit
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

    // Animationen
    ebene.add(this.add.text(dialogX, currentY, 'Animationen', { color: '#d8f3dc', fontSize: `${schriftHint}px` }).setOrigin(0.5));
    currentY += 25;
    const geschw = this.uiManager?.getAnimationsGeschwindigkeit() ?? 1;
    const label = geschw === Infinity ? 'Geschw.: sofort' : `Geschw.: ${geschw}x`;
    this.erstellePhaserButton(ebene, dialogX, currentY, dialogW - 60, 34, label, () => {
      this.uiManager?.zyklusGeschwindigkeit();
      this.renderTisch(zustand, modell);
    }, false, true);
    currentY += 60;

    // Bottom Actions
    const btnW = Math.round(dialogW * 0.4);
    this.erstellePhaserButton(ebene, dialogX - btnW / 2 - 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Zur Lobby', () => {
      this.scene.start('SpielverwaltungsSzene');
    }, false, true);

    this.erstellePhaserButton(ebene, dialogX + btnW / 2 + 10, dialogY + dialogH / 2 - 40, btnW, 40, 'Schließen', () => {
      this.einstellungenOffen = false;
      this.renderTisch(zustand, modell);
    }, false, false);
  }

  private renderHud(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    breite: number,
    hoehe: number
  ): void {
    if (!this.seitenladeOffen) {
      return;
    }

    const hudW = Math.round(breite * 0.18);
    const hudX = 0;
    const hudY = 40; // Unter der Topbar
    const hudH = hoehe - hudY;

    // Hintergrund-Panel für das HUD (Neo-Brutalist style)
    const bg = this.add.rectangle(hudX + hudW / 2, hudY + hudH / 2, hudW, hudH, 0x0b3d24, 0.95)
      .setStrokeStyle(1, 0xd8f3dc, 0.2);
    ebene.add(bg);

    let currentY = hudY + 20;
    const schriftName = Math.round(Math.max(13, breite * 0.010));
    const schriftInfo = Math.round(Math.max(10, breite * 0.008));
    const zeilenAbstand = 35;

    // Spielerliste
    ebene.add(this.add.text(hudX + 15, currentY, 'SPIELER', {
      color: '#a3c4a8',
      fontSize: `${schriftInfo}px`,
      fontStyle: 'bold'
    }));
    currentY += 25;

    modell.spieler.forEach((spieler) => {
      const farbe = spieler.istSelbst ? '#ffd166' : '#f8f9fa';
      ebene.add(this.add.text(hudX + 15, currentY, spieler.anzeigeName, {
        color: farbe,
        fontSize: `${schriftName}px`,
        fontStyle: spieler.istSelbst ? 'bold' : 'normal'
      }));
      const info = `${spieler.stiche} Stiche${spieler.partei ? ' · ' + spieler.partei : ''}`;
      ebene.add(this.add.text(hudX + 15, currentY + 16, info, {
        color: '#a3c4a8',
        fontSize: `${schriftInfo}px`
      }));
      currentY += zeilenAbstand + 10;
    });

    currentY += 10;

    // Punktestand
    if (modell.gesamtpunktestand.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'PUNKTESTAND', {
        color: '#a3c4a8',
        fontSize: `${schriftInfo}px`,
        fontStyle: 'bold'
      }));
      currentY += 25;

      modell.gesamtpunktestand.forEach((eintrag) => {
        const txt = `${eintrag.name}: ${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte}`;
        ebene.add(this.add.text(hudX + 15, currentY, txt, {
          color: '#f8f9fa',
          fontSize: `${schriftName}px`
        }));
        currentY += 22;
      });
    }

    currentY += 15;

    // Historie (Ansagen)
    if (modell.ansageHistorie.length > 0) {
      ebene.add(this.add.text(hudX + 15, currentY, 'HISTORIE', {
        color: '#a3c4a8',
        fontSize: `${schriftInfo}px`,
        fontStyle: 'bold'
      }));
      currentY += 25;

      const maxHistorie = 6;
      modell.ansageHistorie.slice(-maxHistorie).reverse().forEach((ansage) => {
        const txt = `${ansage.name}: ${formatiereAnsage(ansage.ansage)}`;
        ebene.add(this.add.text(hudX + 15, currentY, txt, {
          color: '#d8f3dc',
          fontSize: `${schriftInfo}px`
        }));
        currentY += 18;
      });
    }
  }

  private renderStichStapel(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    hoehe: number
  ): void {
    const s = modell.spieler.find((sp) => sp.istSelbst);
    if (!s || s.stiche === 0) return;

    // Stapel unten links
    const stapelX = 40;
    const stapelY = hoehe - 40;

    const stapel = this.add.container(stapelX, stapelY);
    ebene.add(stapel);

    const fächerW = KARTEN_BREITE * 0.45;
    const fächerH = KARTEN_HOEHE * 0.45;

    // Dummy-Karten für den Stapel
    for (let i = 0; i < Math.min(s.stiche, 5); i++) {
      const k = this.add.rectangle(i * 3, -i * 3, fächerW, fächerH, 0x123524)
        .setStrokeStyle(1, 0xd8f3dc, 0.4);
      stapel.add(k);
    }

    const t = this.add.text(0, 0, String(s.stiche), {
      font: "bold 16px 'Space Grotesk', sans-serif",
      color: '#ffd166'
    }).setOrigin(0.5);
    stapel.add(t);

    stapel.setInteractive(new Phaser.Geom.Rectangle(-fächerW / 2, -fächerH / 2, fächerW, fächerH), Phaser.Geom.Rectangle.Contains);
    stapel.on('pointerdown', () => this.zeigeLetztesStichOverlay(modell, this.scale.gameSize.width, hoehe));
  }

  private zeigeLetztesStichOverlay(modell: TischAnsichtModell, breite: number, hoehe: number): void {
    if (this.letzterStichOverlay) return;
    const stich = modell.letzteAbgeschlosseneStiche[modell.letzteAbgeschlosseneStiche.length - 1];
    if (!stich) return;

    const overlay = this.add.container(0, 0).setDepth(2000);
    this.letzterStichOverlay = overlay;

    const bg = this.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, 0x000000, 0.6)
      .setInteractive();
    overlay.add(bg);

    const panelW = 500;
    const panelH = 220;
    const panel = this.add.rectangle(breite / 2, hoehe / 2, panelW, panelH, 0x1a3a24, 0.95)
      .setStrokeStyle(2, 0xf8f9fa, 0.5);
    overlay.add(panel);

    overlay.add(this.add.text(breite / 2, hoehe / 2 - 80, `Letzter Stich (${stich.gewinnerName} gewinnt ${stich.augen} Augen)`, {
      fontSize: '18px', color: '#f8f9fa', fontStyle: 'bold'
    }).setOrigin(0.5));

    const kartenX = breite / 2 - 150;
    stich.gespielteKarten.forEach((gk, idx) => {
      const k = Kartenansicht.offen(this, kartenX + idx * 100, hoehe / 2 + 20, gk.karte.farbe, gk.karte.wert, 80, 120);
      overlay.add(k);
    });

    bg.on('pointerdown', () => this.schliesseLetzteStiche());

    if (this.letzterStichTimer) this.letzterStichTimer.remove();
    this.letzterStichTimer = this.time.delayedCall(4000, () => this.schliesseLetzteStiche());
  }

  private schliesseLetzteStiche(): void {
    this.letzterStichOverlay?.destroy();
    this.letzterStichOverlay = undefined;
    if (this.letzterStichTimer) {
      this.letzterStichTimer.remove();
      this.letzterStichTimer = undefined;
    }
  }

  private handleResize(): void {
    if (this.letzterZustand) {
      this.renderTisch(this.letzterZustand);
    }
  }

  private async verarbeiteZustandsAenderung(zustand: AppZustand): Promise<void> {
    const altesModell = this.letztesModell;
    const neuesModell = this.erstelleModell(zustand);

    this.letzterZustand = zustand;
    this.letztesModell = neuesModell;

    this.aktualisiereUi(zustand, neuesModell);

    // Spezialfall: Neues Spiel gestartet (Animation)
    if (altesModell && neuesModell.spieltyp && altesModell.untertitel !== neuesModell.untertitel && neuesModell.phase === 'VORBEHALT_ANSAGE') {
      this.animiereNeuesSpiel(zustand, neuesModell);
      return;
    }

    this.renderTisch(zustand, neuesModell);
  }

  private animiereNeuesSpiel(zustand: AppZustand, modell: TischAnsichtModell): void {
     // TODO: Implementierung der Karten-Austeil-Animation
     this.renderTisch(zustand, modell);
  }

  private erstelleModell(zustand: AppZustand): TischAnsichtModell {
    return erstelleTischAnsichtAusStatus(
      zustand.spieler?.spielerId ?? null,
      zustand.aktuellerTisch,
      zustand.partieStand,
      zustand.debugModus
    );
  }

  private aktualisiereHintergrund(bg: Tischhintergrund, breite: number, hoehe: number): void {
    const textur = istBildHintergrund(bg) ? bg.toLowerCase().replace(/_/g, '-') : null;

    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === textur) {
        this.hintergrund.setPosition(breite / 2, hoehe / 2).setDisplaySize(breite, hoehe);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.add.image(breite / 2, hoehe / 2, textur!).setDisplaySize(breite, hoehe).setDepth(-100);
    } else {
      const farbe = bg === 'FILZ_GRUEN' ? 0x0b3d24 : bg === 'HOLZ_DUNKEL' ? 0x4e342e : 0x10304a;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (this.hintergrund instanceof Phaser.GameObjects.Rectangle && (this.hintergrund as any).fillColor === farbe) {
        this.hintergrund.setPosition(breite / 2, hoehe / 2).setSize(breite, hoehe);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, farbe).setDepth(-100);
    }
  }

  private renderStichmitte(): void {
     // TODO: Karten in der Mitte rendern
  }

  private renderNameplate(): void {
     // TODO: Nameplates rendern
  }

  private renderKartenFaecher(): void {
     // TODO: Handkarten rendern
  }

  private renderAnsageButtons(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheAnsagen.length === 0) return;
    
    let x = breite / 2 - (modell.moeglicheAnsagen.length * 110) / 2;
    const y = hoehe - 180;

    modell.moeglicheAnsagen.forEach((ansage) => {
      this.erstellePhaserButton(ebene, x, y, 100, 40, formatiereAnsage(ansage), () => {
        void appStore.sageAnsageAn(ansage);
      }, zustand.wirdGeladen);
      x += 110;
    });
  }

  private renderArmutBereich(): void {
     // TODO: Armut-UI rendern
  }

  private renderVorbehaltDialog(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    zustand: AppZustand,
    breite: number,
    hoehe: number
  ): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.moeglicheVorbehalte.length === 0) return;

    const dialogW = 300;
    const dialogH = 40 + modell.moeglicheVorbehalte.length * 50;
    const x = breite / 2;
    const y = hoehe / 2;

    const panel = this.add.rectangle(x, y, dialogW, dialogH, 0x1a3a24, 0.9)
      .setStrokeStyle(2, 0xf8f9fa, 0.5);
    ebene.add(panel);

    ebene.add(this.add.text(x, y - dialogH / 2 + 20, 'Vorbehalt wählen', {
      fontSize: '18px', color: '#f8f9fa', fontStyle: 'bold'
    }).setOrigin(0.5));

    modell.moeglicheVorbehalte.forEach((vorbehalt, idx) => {
      const btnY = y - dialogH / 2 + 60 + idx * 50;
      this.erstellePhaserButton(ebene, x, btnY, 260, 40, this.formatiereVorbehalt(vorbehalt), () => {
        void appStore.meldeVorbehalt(vorbehalt);
      }, zustand.wirdGeladen, idx === this.tastaturVorbehaltIndex);
    });
  }

  private erstellePhaserButton(
    ebene: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    callback: () => void,
    deaktiviert = false,
    hervorgehoben = false
  ): void {
    const bg = this.add.rectangle(x, y, w, h, hervorgehoben ? 0xffd166 : 0x2d5a3d, deaktiviert ? 0.3 : 1)
      .setStrokeStyle(2, 0xf8f9fa, deaktiviert ? 0.2 : 0.8)
      .setInteractive({ useHandCursor: !deaktiviert });

    const txt = this.add.text(x, y, text, {
      fontSize: '14px',
      color: hervorgehoben ? '#0d1f12' : '#f8f9fa',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    if (!deaktiviert) {
      bg.on('pointerdown', callback);
      bg.on('pointerover', () => bg.setFillStyle(hervorgehoben ? 0xffe082 : 0x3d6a4d));
      bg.on('pointerout', () => bg.setFillStyle(hervorgehoben ? 0xffd166 : 0x2d5a3d));
    }

    ebene.add(bg);
    ebene.add(txt);
  }

  private formatiereVorbehalt(v: string): string {
    return v.charAt(0) + v.slice(1).toLowerCase();
  }

  private synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (modell.aktuellerSpieler !== 'SUED' || modell.phase !== 'ARMUT_TAUSCH') {
      this.ausgewaehlteArmutKarten.clear();
      this.armutAnnahmeAktiv = false;
    }
  }

  private aktualisiereKartenNavigationsIndex(modell: TischAnsichtModell): void {
    if (modell.aktuellerSpieler !== 'SUED') {
      this.tastaturKarteIndex = -1;
      return;
    }
    if (this.tastaturKarteIndex < 0 && modell.spielbareKarten.length > 0) {
      this.tastaturKarteIndex = 0;
    }
    if (this.tastaturKarteIndex >= modell.spielbareKarten.length) {
      this.tastaturKarteIndex = modell.spielbareKarten.length - 1;
    }
  }

  private async spieleKarteMitAnimation(karteId: string): Promise<void> {
    // TODO: Implementierung
    void appStore.spieleKarte(karteId);
  }

  private aufraeumen(): void {
    this.uiManager?.aufraeumen();
    this.inputHandler?.aufraeumen();
    this.animationen?.abbrechen();
    this.handKartenobjekte.clear();
    this.schliesseLetzteStiche();
  }
}
