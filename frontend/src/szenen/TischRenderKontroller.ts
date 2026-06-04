import Phaser from 'phaser';
import type { AppZustand } from '../store/AppStore';
import type { Tischhintergrund } from '../modelle/SpielverwaltungDto';
import { Logger } from '../logger';
import {
  TEXTUR_BILD_OVAL_1,
  TEXTUR_BILD_OVAL_2,
  TEXTUR_BILD_RECHTECK_1,
  TEXTUR_BILD_RECHTECK_2,
  TEXTUR_BILD_RUND_1,
  TEXTUR_BLAU_GRAFIK,
  TEXTUR_FILZ,
  TEXTUR_HOLZ_DUNKEL,
} from '../assets/AssetLoader';
import { renderHud, renderTopBar, renderEinstellungsModal, speichereGeschwindigkeit } from './TischHudRenderer';
import { renderAnsageButtons, renderArmutBereich, renderVorbehaltLabel } from './TischSpieleventRenderer';
import { berechneLayout } from './layout';
import type { TischSzene } from './TischSzene';

function texturFuerTischhintergrund(bg: Tischhintergrund): string {
  const tex = ({
    FILZ_GRUEN: TEXTUR_FILZ,
    HOLZ_DUNKEL: TEXTUR_HOLZ_DUNKEL,
    BLAU_GRAFIK: TEXTUR_BLAU_GRAFIK,
    RECHTECK_1: TEXTUR_BILD_RECHTECK_1,
    RECHTECK_2: TEXTUR_BILD_RECHTECK_2,
    OVAL_1: TEXTUR_BILD_OVAL_1,
    OVAL_2: TEXTUR_BILD_OVAL_2,
    RUND_1: TEXTUR_BILD_RUND_1,
  } as Record<Tischhintergrund, string>)[bg];
  Logger.szene(`Hintergrund-Mapping: ${bg} -> ${tex}`);
  return tex;
}

function istBildHintergrund(bg: Tischhintergrund): boolean {
  return bg === 'RECHTECK_1' || bg === 'RECHTECK_2' || bg === 'OVAL_1' || bg === 'OVAL_2' || bg === 'RUND_1';
}

/** Orchestriert Render-Zyklen: Tisch-Layout, Hintergrund, Seitenlade, Dialoge. */
export class TischRenderKontroller {
  private hintergrund?: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private renderAngefordert = false;
  private letztePersistierteSpielNummer: number | null = null;

  constructor(private readonly szene: TischSzene) {}

  triggerRender(force = false): void {
    if (force) {
      this.renderAngefordert = false;
      if (this.szene.letzterZustand && this.szene.letztesModell) {
        this.renderTisch(this.szene.letzterZustand, this.szene.letztesModell);
      }
      return;
    }

    if (this.szene.animationen?.animationLaeuft || this.szene.austeilenAktiv || this.szene.stichEinziehenAktiv) {
      return;
    }

    if (this.renderAngefordert) return;
    this.renderAngefordert = true;

    const isTest = (window as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === 'test'
      || (globalThis as { vi?: unknown }).vi;

    if (isTest) {
      this.renderAngefordert = false;
      if (this.szene.letzterZustand && this.szene.letztesModell) {
        this.renderTisch(this.szene.letzterZustand, this.szene.letztesModell);
      }
      return;
    }

    requestAnimationFrame(() => {
      this.renderAngefordert = false;
      if (!this.szene.sys?.isActive()) return;
      if (this.szene.animationen?.animationLaeuft || this.szene.austeilenAktiv) return;
      if (this.szene.letzterZustand && this.szene.letztesModell) {
        this.renderTisch(this.szene.letzterZustand, this.szene.letztesModell);
      }
    });
  }

  renderTisch(zustand: AppZustand, modell = this.szene.erstelleModell(zustand)): void {
    if (this.szene.sys && !this.szene.sys.displayList) return;
    const aktuelleSpielNummer = zustand.partieStand?.laufendesSpiel?.spielNummer ?? null;
    if (aktuelleSpielNummer !== this.letztePersistierteSpielNummer) {
      this.szene.kartenRenderer.loeseEigeneKartenAuf();
      this.letztePersistierteSpielNummer = aktuelleSpielNummer;
    }

    this.szene.tischEbene?.destroy(true);
    this.szene.kartenRenderer.handKartenobjekte.clear();
    const breite = this.szene.scale.gameSize.width;
    const hoehe = this.szene.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const mitteX = breite / 2;
    const mitteY = hoehe / 2;
    this.aktualisiereHintergrund(modell.tischhintergrund, breite, hoehe);

    const ebene = this.szene.add.container(0, 0);
    ebene.setDepth(3);

    this.szene.kartenRenderer.renderStichmitte(ebene, modell, mitteX, mitteY, breite, hoehe);

    modell.spieler.forEach((spieler) => {
      this.szene.kartenRenderer.aktualisiereNameplate(spieler, modell, this.szene.nameplates, breite, hoehe);
      this.szene.kartenRenderer.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    this.szene.kartenRenderer.renderStichStapel(ebene, modell, breite, hoehe);

    renderTopBar(this.szene, ebene, modell, zustand, breite, {
      einstellungenOffen: this.szene.einstellungenOffen,
      seitenladeOffen: this.szene.seitenladeOffen,
      spielprotokollOffen: this.szene.isSpielprotokollOffen(),
      wirdGeladen: zustand.wirdGeladen,
      onToggleEinstellungen: () => { this.szene.einstellungenOffen = !this.szene.einstellungenOffen; this.renderTisch(zustand, modell); },
      onToggleSeitenlade: () => { this.szene.seitenladeOffen = !this.szene.seitenladeOffen; this.renderTisch(zustand, modell); },
      onToggleSpielprotokoll: () => { this.szene.toggleSpielprotokoll(modell, zustand); },
      onToggleHilfe: () => { this.szene.scene.launch('HilfeSzene', { modus: 'overlay' }); },
    });

    if (this.szene.seitenladeOffen) {
      renderHud(this.szene, ebene, modell, breite, hoehe);
    }

    if (zustand.partieStand?.laufendesSpiel) {
      const spieleventKontext = {
        wartendeKartenId: this.szene.wartendeKartenId,
        animationLaeuft: this.szene.animationen?.animationLaeuft ?? false,
        ausgewaehlteArmutKarten: this.szene.ausgewaehlteArmutKarten,
        armutAnnahmeAktiv: this.szene.armutAnnahmeAktiv,
        tastaturVorbehaltIndex: this.szene.tastaturVorbehaltIndex,
        onTastaturVorbehaltIndexAendern: (v: number) => { this.szene.tastaturVorbehaltIndex = v; },
        onRenderTisch: () => this.triggerRender(true),
        onArmutKarteToggle: (id: string, max: number) => this.szene.zustandsKontroller.toggleArmutKarte(id, max),
        onBestaetigeArmut: () => this.szene.zustandsKontroller.bestaetigeArmut(modell),
        onArmutAnnahmeAktivSetzen: (v: boolean) => { this.szene.armutAnnahmeAktiv = v; },
      };
      renderAnsageButtons(this.szene, ebene, modell, zustand, breite, hoehe, spieleventKontext);
      renderArmutBereich(this.szene, ebene, modell, zustand, breite, hoehe, spieleventKontext);
      renderVorbehaltLabel(this.szene, ebene, modell, breite, hoehe, spieleventKontext);
    }

    if (this.szene.einstellungenOffen) {
      renderEinstellungsModal(this.szene, ebene, modell, zustand, breite, hoehe, {
        animationsGeschwindigkeit: this.szene.animationsGeschwindigkeit,
        onEinstellungenSchliessen: () => { this.szene.einstellungenOffen = false; this.renderTisch(zustand, modell); },
        onAnimationsGeschwindigkeitAendern: (v) => {
          this.szene.animationsGeschwindigkeit = v;
          speichereGeschwindigkeit(v);
          this.szene.animationen?.setzeGeschwindigkeitsfaktor(v);
          this.renderTisch(zustand, modell);
        },
      });
    }

    this.szene.tischEbene = ebene;
  }

  aktualisiereHintergrund(bg: Tischhintergrund, b: number, h: number): void {
    const tex = texturFuerTischhintergrund(bg);
    if (istBildHintergrund(bg)) {
      if (this.hintergrund instanceof Phaser.GameObjects.Image && this.hintergrund.texture.key === tex) {
        this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.szene.add.image(b / 2, h / 2, tex).setDisplaySize(b, h).setDepth(0);
    } else {
      if (this.hintergrund instanceof Phaser.GameObjects.TileSprite && this.hintergrund.texture.key === tex) {
        this.hintergrund.setPosition(b / 2, h / 2).setSize(b, h);
        return;
      }
      this.hintergrund?.destroy();
      this.hintergrund = this.szene.add.tileSprite(b / 2, h / 2, b, h, tex).setDepth(0);
    }
  }

  handleResize(): void {
    const { width: b, height: h } = this.szene.scale.gameSize;
    if (this.hintergrund instanceof Phaser.GameObjects.Image) {
      this.hintergrund.setPosition(b / 2, h / 2).setDisplaySize(b, h);
    } else {
      (this.hintergrund as Phaser.GameObjects.TileSprite)?.setPosition(b / 2, h / 2).setSize(b, h);
    }
    this.szene.kartenRenderer.loeseEigeneKartenAuf();
    this.letztePersistierteSpielNummer = null;
    if (this.szene.letzterZustand?.bereich === 'TISCH') this.renderTisch(this.szene.letzterZustand);
  }

  aufraeumen(): void {
    this.hintergrund?.destroy();
    this.hintergrund = undefined;
  }
}
