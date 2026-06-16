import type Phaser from 'phaser';
import { appStore } from '../anwendung';
import { Kartenansicht } from '../assets/Kartenansicht';
import {
  istHervorgehobeneKarteImVorbehalt,
  istTrumpfFuerSpieltyp,
  sortiereKartenFuerVorbehalt,
  SPIELER_POSITION,
  PARTEI,
  SPIELTYP,
} from '../modelle/TischAnsichtModell';
import type { TischAnsichtModell, SpielerPosition } from '../modelle/TischAnsichtModell';
import type { KarteAntwort, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import type { AnimierbareKartenobjekte } from '../services/AnimationenService';
import { FONT_FAMILY } from '../ui/designTokens';
import { Logger } from '../logger';
import {
  stichSlotPositionen,
  berechneKartenGroesse,
  berechneKartenAbstand,
  stichStapelPositionFuer,
  nameplatePositionFuer,
} from './layout';
import type { TischLayout } from './layout';
import { Nameplate, ansageBadgeTyp } from '../ui/Nameplate';
import type { NameplateDaten } from '../ui/Nameplate';

export interface TischKartenKontext {
  getWartendeKartenId: () => string | null;
  getStichEinziehenAktiv: () => boolean;
  getAusteilenAktiv: () => boolean;
  getTastaturKarteIndex: () => number;
  getTastaturVorbehaltIndex: () => number;
  getAusgewaehlteArmutKarten: () => Set<string>;
  getArmutAnnahmeAktiv: () => boolean;
  getAnimationLaeuft: () => boolean;
  onSpielKarteMitAnimation: (id: string) => void;
  onToggleArmutKarte: (id: string, max: number) => void;
  onRenderTisch: () => void;
}

type SpielerAnsicht = TischAnsichtModell['spieler'][number];

/** Fächer-Konstanten, die für alle Karten eines Spielers identisch sind (einmal pro Render berechnet). */
interface FaecherKontext {
  offen: boolean;
  sichtbare: KarteAntwort[] | undefined;
  kartenAnzahl: number;
  armutKartenIds: Set<string> | null;
  hatInteraktiveKarten: boolean;
  kartenGroesse: { w: number; h: number };
  kartenAbstand: { horizontal: number; vertikal: number };
  auswahlVersatz: number;
  elevationVersatz: number;
  istHorizontal: boolean;
  startX: number;
  position: { kartenX: number; kartenY: number };
  faecherBasisbreite: number;
  faecherSchrittweite: number;
  istGespiegelt: boolean;
  animationAktiv: boolean;
  aktuellerVorbehalt: VorbehaltAnsage | null;
  angezeigteKarten: KarteAntwort[] | undefined;
}

/** Pro Karte berechnete Zustands-Flags und der vertikale Versatz. */
interface KartenFlags {
  istSpielbar: boolean;
  istArmutAuswahl: boolean;
  istInteraktiv: boolean;
  istAusgewaehlt: boolean;
  istTastaturFokus: boolean;
  vertikalerVersatz: number;
}

/**
 * Kapselt die Karten-Rendering-Logik und den Zustand persistenter Karten-Sprites.
 */
export class TischKartenRenderer {
  readonly persistenteEigeneKarten = new Map<string, Kartenansicht>();
  readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();
  private letzterStichOverlay?: Phaser.GameObjects.Container;
  private letzterStichTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly szene: Phaser.Scene,
    private readonly kontext: TischKartenKontext
  ) {}

  erstelleKartenansicht(x: number, y: number, w: number, h: number, opt: { karte?: { farbe: string; wert: string }; verdeckt?: boolean }): Kartenansicht {
    if (opt.karte) return Kartenansicht.offen(this.szene, x, y, opt.karte.farbe, opt.karte.wert, w, h);
    if (opt.verdeckt) return Kartenansicht.verdeckt(this.szene, x, y, w, h);
    return Kartenansicht.leer(this.szene, x, y, w, h);
  }

  renderStichmitte(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, mitteX: number, mitteY: number, breite: number, hoehe: number): void {
    if (this.kontext.getStichEinziehenAktiv() || modell.aktuelleStichmitte.length === 0) return;
    const slotPos = stichSlotPositionen(mitteX, mitteY, breite, hoehe);
    const kg = berechneKartenGroesse(breite);
    modell.aktuelleStichmitte.forEach((e) => {
      if (this.kontext.getWartendeKartenId() === e.karte.id) return;
      const s = slotPos[e.position];
      const k = this.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: e.karte });
      k.setAngle(s.winkel);
      ebene.add(k);
    });
  }

  renderStichStapel(ebene: Phaser.GameObjects.Container, modell: TischAnsichtModell, breite: number, hoehe: number): void {
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
      ebene.add(this.szene.add.text(pos.x, pos.y + Math.round(stapelH * 0.65), `${spieler.stiche}`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${Math.round(Math.max(14, breite * 0.012))}px`, backgroundColor: '#0d3d1e', padding: { x: 4, y: 2 } }).setOrigin(0.5));
      const letzterStichDesSpielers = modell.letzteAbgeschlosseneStiche.filter((s) => s.gewinnerPosition === spieler.position).at(-1);
      if (letzterStichDesSpielers) {
        const hitZone = this.szene.add.rectangle(pos.x, pos.y, stapelW * 1.3, stapelH * 1.3 + stapelH * 0.65, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
          if (this.letzterStichOverlay) this.versteckeLetztesStichOverlay();
          else this.zeigeLetztesStichOverlay(letzterStichDesSpielers, breite, hoehe);
        });
        ebene.add(hitZone);
      }
    });
  }

  zeigeLetztesStichOverlay(stich: TischAnsichtModell['letzteAbgeschlosseneStiche'][number], breite: number, hoehe: number): void {
    this.versteckeLetztesStichOverlay();
    const kgroesse = berechneKartenGroesse(breite);
    const kAbstand = Math.round(kgroesse.w * 1.15);
    const panelW = Math.max(4 * kgroesse.w + 3 * (kAbstand - kgroesse.w) + kgroesse.w, 300);
    const panelH = kgroesse.h * 1.7;
    const container = this.szene.add.container(0, 0);
    const backdrop = this.szene.add.rectangle(breite / 2, hoehe / 2, breite, hoehe, 0x000000, 0.45).setInteractive({ useHandCursor: false });
    backdrop.on('pointerdown', () => this.versteckeLetztesStichOverlay());
    container.add(backdrop);
    container.add(this.szene.add.rectangle(breite / 2, hoehe / 2, panelW, panelH, 0x0a2818, 0.97).setStrokeStyle(2, 0x4adf7a, 0.7));
    container.add(this.szene.add.text(breite / 2, hoehe / 2 - panelH * 0.38, `Letzter Stich — ${stich.augen} Augen`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${Math.round(Math.max(12, breite * 0.011))}px` }).setOrigin(0.5));
    const startX = breite / 2 - ((stich.gespielteKarten.length - 1) * kAbstand) / 2;
    stich.gespielteKarten.forEach((e, i) => {
      const ansicht = this.erstelleKartenansicht(startX + i * kAbstand, hoehe / 2 + panelH * 0.05, kgroesse.w, kgroesse.h, { karte: e.karte });
      ansicht.setScale(0, 1);
      container.add(ansicht);
      this.szene.tweens.add({ targets: ansicht, scaleX: 1, duration: 150, ease: 'Cubic.Out', delay: i * 60 });
    });
    container.add(this.szene.add.text(breite / 2, hoehe / 2 + panelH * 0.44, 'Klick zum Schliessen', { fontFamily: FONT_FAMILY, color: '#a3c4a8', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px` }).setOrigin(0.5));
    this.letzterStichOverlay = container;
    this.letzterStichTimer = this.szene.time.addEvent({ delay: 4000, callback: () => this.versteckeLetztesStichOverlay(), callbackScope: this });
  }

  versteckeLetztesStichOverlay(): void {
    this.letzterStichTimer?.remove(false);
    this.letzterStichTimer = undefined;
    this.letzterStichOverlay?.destroy(true);
    this.letzterStichOverlay = undefined;
  }

  renderKartenFaecher(ebene: Phaser.GameObjects.Container, layout: TischLayout, spieler: SpielerAnsicht, modell: TischAnsichtModell): void {
    const f = this.berechneFaecherKontext(layout, spieler, modell);
    this.bereinigePersistenteEigeneKarten(spieler, f.sichtbare);
    for (let i = 0; i < f.kartenAnzahl; i++) {
      this.rendereHandkarte(ebene, spieler, modell, f, i);
    }
  }

  /** Berechnet die für alle Karten eines Spielers gemeinsamen Fächer-Konstanten. */
  private berechneFaecherKontext(layout: TischLayout, spieler: SpielerAnsicht, modell: TischAnsichtModell): FaecherKontext {
    const position = layout[spieler.position];
    const offen = spieler.istSelbst || (modell.debugModus && spieler.sichtbareHandkarten.length > 0);
    const sichtbare = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
    const kartenAnzahl = sichtbare?.length ?? Math.max(spieler.verbleibendeKarten, 0);
    const armutKartenIds = spieler.istSelbst ? this.ermittleArmutAuswahl(modell, sichtbare ?? []) : null;
    const hatInteraktiveKarten = spieler.istSelbst && (modell.spielbareKarten.length > 0 || armutKartenIds !== null);
    const { width: szenenBreite, height: szenenHoehe } = this.szene.scale.gameSize;
    const kartenGroesse = berechneKartenGroesse(szenenBreite);
    const kartenAbstand = berechneKartenAbstand(szenenBreite, szenenHoehe);
    const istHorizontal = spieler.position === SPIELER_POSITION.SUED || spieler.position === SPIELER_POSITION.NORD;
    const startX = istHorizontal ? szenenBreite / 2 - ((kartenAnzahl - 1) * kartenAbstand.horizontal) / 2 : position.kartenX;
    const [faecherBasisbreite, faecherSchrittweite]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[spieler.position] as [number, number];
    const vorbehaltIdx = Math.min(this.kontext.getTastaturVorbehaltIndex(), modell.moeglicheVorbehalte.length - 1);
    const aktuellerVorbehalt = spieler.istSelbst && modell.moeglicheVorbehalte.length > 0
      ? modell.moeglicheVorbehalte[vorbehaltIdx]
      : null;
    const angezeigteKarten = aktuellerVorbehalt && sichtbare
      ? sortiereKartenFuerVorbehalt(sichtbare, aktuellerVorbehalt)
      : sichtbare;
    return {
      offen, sichtbare, kartenAnzahl, armutKartenIds, hatInteraktiveKarten, kartenGroesse, kartenAbstand,
      auswahlVersatz: Math.round(kartenGroesse.h * 0.19),
      elevationVersatz: Math.round(kartenGroesse.h * 0.22),
      istHorizontal, startX, position, faecherBasisbreite, faecherSchrittweite,
      istGespiegelt: spieler.position === SPIELER_POSITION.NORD || spieler.position === SPIELER_POSITION.OST,
      animationAktiv: !!this.kontext.getWartendeKartenId(),
      aktuellerVorbehalt, angezeigteKarten,
    };
  }

  /** Rendert eine einzelne Handkarte des Fächers (Geometrie, Sprite, Darstellung, Interaktion). */
  private rendereHandkarte(ebene: Phaser.GameObjects.Container, spieler: SpielerAnsicht, modell: TischAnsichtModell, f: FaecherKontext, i: number): void {
    const faecherIndex = f.istGespiegelt ? f.kartenAnzahl - 1 - i : i;
    const abstand = f.istHorizontal ? faecherIndex * f.kartenAbstand.horizontal : faecherIndex * f.kartenAbstand.vertikal;
    const x = f.istHorizontal ? f.startX + abstand : f.position.kartenX;
    const y = f.istHorizontal ? f.position.kartenY : f.position.kartenY + abstand;
    const winkel = f.faecherBasisbreite + faecherIndex * f.faecherSchrittweite;
    const karte = f.angezeigteKarten?.[i];
    if (karte && this.kontext.getWartendeKartenId() === karte.id) return;

    const flags = this.berechneKartenFlags(spieler, modell, f, karte);
    const { sprite: kartenAnsicht, wiederverwendet } = this.erstelleOderAktualisiereKartenSprite(ebene, spieler, f.offen, karte, x, y + flags.vertikalerVersatz, f.kartenGroesse);

    if (spieler.istSelbst && karte) kartenAnsicht.setDepth(2 + i * 0.01);

    const istWartend = !!karte && this.kontext.getWartendeKartenId() === karte.id;
    kartenAnsicht.setVisible(!istWartend);

    kartenAnsicht.setAngle(winkel).setAlpha(this.kartenAlpha(f, flags.istInteraktiv, karte));
    if (flags.istAusgewaehlt) kartenAnsicht.markiereAuswahl(); else if (flags.istTastaturFokus) kartenAnsicht.markiereTastaturfokus(); else kartenAnsicht.loescheMarkierung();

    if (karte) this.handKartenobjekte.set(karte.id, { wurzel: kartenAnsicht, bild: kartenAnsicht.bildObjekt });

    this.setzeKartenInteraktion(kartenAnsicht, karte, wiederverwendet, f.offen, flags.istInteraktiv, flags.istSpielbar, f.aktuellerVorbehalt, y, flags.vertikalerVersatz, f.kartenGroesse.h, modell);
  }

  /** Ermittelt die Zustands-Flags und den vertikalen Versatz für eine einzelne Karte. */
  private berechneKartenFlags(spieler: SpielerAnsicht, modell: TischAnsichtModell, f: FaecherKontext, karte: KarteAntwort | undefined): KartenFlags {
    const istSpielbar = karte ? modell.spielbareKarten.includes(karte.id) : false;
    const istArmutAuswahl = karte ? (f.armutKartenIds?.has(karte.id) ?? false) : false;
    const istInteraktiv = !f.animationAktiv && (istSpielbar || istArmutAuswahl);
    const istAusgewaehlt = karte ? this.kontext.getAusgewaehlteArmutKarten().has(karte.id) : false;
    const istTastaturFokus = spieler.istSelbst && karte !== undefined && this.kontext.getTastaturKarteIndex() >= 0
      && modell.spielbareKarten[this.kontext.getTastaturKarteIndex()] === karte.id;
    const istVorbehaltEleviert = f.aktuellerVorbehalt && karte ? istHervorgehobeneKarteImVorbehalt(karte, f.aktuellerVorbehalt) : false;
    const vertikalerVersatz = (istAusgewaehlt || istTastaturFokus) ? -f.auswahlVersatz : (f.aktuellerVorbehalt && !istVorbehaltEleviert ? f.elevationVersatz : 0);
    return { istSpielbar, istArmutAuswahl, istInteraktiv, istAusgewaehlt, istTastaturFokus, vertikalerVersatz };
  }

  /** Deckkraft einer Handkarte: 0 beim Austeilen, gedimmt für nicht-spielbare Karten bei aktiver Interaktion. */
  private kartenAlpha(f: FaecherKontext, istInteraktiv: boolean, karte: KarteAntwort | undefined): number {
    if (this.kontext.getAusteilenAktiv()) return 0;
    if (!f.offen) return 0.92;
    return (f.hatInteraktiveKarten && karte && !istInteraktiv) ? 0.45 : 1;
  }

  bereinigePersistenteEigeneKarten(spieler: TischAnsichtModell['spieler'][number], sichtbare: KarteAntwort[] | undefined): void {
    if (!spieler.istSelbst || !sichtbare) return;
    const aktuelleIds = new Set(sichtbare.map((karte) => karte.id));
    for (const [id, kartenAnsicht] of this.persistenteEigeneKarten) {
      if (!aktuelleIds.has(id)) { kartenAnsicht.destroy(); this.persistenteEigeneKarten.delete(id); }
    }
  }

  erstelleOderAktualisiereKartenSprite(
    ebene: Phaser.GameObjects.Container,
    spieler: TischAnsichtModell['spieler'][number],
    offen: boolean,
    karte: KarteAntwort | undefined,
    x: number,
    y: number,
    kartenGroesse: { w: number; h: number }
  ): { sprite: Kartenansicht; wiederverwendet: boolean } {
    if (spieler.istSelbst && karte && this.persistenteEigeneKarten.has(karte.id)) {
      const kartenAnsicht = this.persistenteEigeneKarten.get(karte.id)!;
      kartenAnsicht.gleiteZu(x, y, 150);
      return { sprite: kartenAnsicht, wiederverwendet: true };
    }
    const kartenAnsicht = offen
      ? this.erstelleKartenansicht(x, y, kartenGroesse.w, kartenGroesse.h, karte ? { karte } : {})
      : this.erstelleKartenansicht(x, y, kartenGroesse.w, kartenGroesse.h, { verdeckt: true });
    if (spieler.istSelbst && karte) {
      kartenAnsicht.setDepth(2);
      this.persistenteEigeneKarten.set(karte.id, kartenAnsicht);
    } else {
      ebene.add(kartenAnsicht);
    }
    return { sprite: kartenAnsicht, wiederverwendet: false };
  }

  setzeKartenInteraktion(
    kartenAnsicht: Kartenansicht,
    karte: KarteAntwort | undefined,
    istWiederverwendet: boolean,
    offen: boolean,
    istInteraktiv: boolean,
    istSpielbar: boolean,
    aktuellerVorbehalt: VorbehaltAnsage | null,
    y: number,
    vertikalerVersatz: number,
    kartenHoehe: number,
    modell: TischAnsichtModell
  ): void {
    const inputVerfuegbar = kartenAnsicht.active && kartenAnsicht.scene?.input?.enabled;

    if (aktuellerVorbehalt && offen && karte && inputVerfuegbar) {
      if (istWiederverwendet) this.entferneKartenListener(kartenAnsicht);
      kartenAnsicht.setInteractive({ useHandCursor: true });
      kartenAnsicht.on('pointerdown', () => { void appStore.meldeVorbehalt(aktuellerVorbehalt); });
      return;
    }

    if (offen && karte && istInteraktiv && inputVerfuegbar) {
      if (istWiederverwendet) this.entferneKartenListener(kartenAnsicht);
      this.setzeSpielInteraktion(kartenAnsicht, karte, istSpielbar, y, vertikalerVersatz, kartenHoehe, modell);
      return;
    }

    if (offen && karte && !istInteraktiv && istWiederverwendet) {
      this.deaktiviereKartenInteraktion(kartenAnsicht);
    }
  }

  /** Entfernt die Pointer-Listener einer wiederverwendeten Karte, bevor neue gesetzt werden. */
  private entferneKartenListener(kartenAnsicht: Kartenansicht): void {
    kartenAnsicht.removeAllListeners?.('pointerover');
    kartenAnsicht.removeAllListeners?.('pointerout');
    kartenAnsicht.removeAllListeners?.('pointerdown');
  }

  /** Macht eine spielbare/auswählbare Karte interaktiv (Hover-Anhebung + Klick spielt/wählt sie). */
  private setzeSpielInteraktion(kartenAnsicht: Kartenansicht, karte: KarteAntwort, istSpielbar: boolean, y: number, vertikalerVersatz: number, kartenHoehe: number, modell: TischAnsichtModell): void {
    kartenAnsicht.setInteractive({ useHandCursor: true });
    const hoverVersatz = Math.round(kartenHoehe * 0.08);
    kartenAnsicht.on('pointerover', () => kartenAnsicht.setY(y + vertikalerVersatz - hoverVersatz));
    kartenAnsicht.on('pointerout', () => kartenAnsicht.setY(y + vertikalerVersatz));
    kartenAnsicht.on('pointerdown', () => {
      if (istSpielbar) {
        this.kontext.onSpielKarteMitAnimation(karte.id);
      } else {
        this.kontext.onToggleArmutKarte(karte.id, modell.armutAktion?.kartenAnzahl ?? 0);
        this.kontext.onRenderTisch();
      }
    });
  }

  /** Deaktiviert die Interaktion einer nicht mehr spielbaren, wiederverwendeten Karte. */
  private deaktiviereKartenInteraktion(kartenAnsicht: Kartenansicht): void {
    if (!(kartenAnsicht.active && kartenAnsicht.scene && kartenAnsicht.input?.enabled)) return;
    try {
      kartenAnsicht.disableInteractive();
      this.entferneKartenListener(kartenAnsicht);
    } catch (e) {
      Logger.error('Fehler beim Deaktivieren der Interaktion', e);
    }
  }

  loeseEigeneKartenAuf(): void {
    for (const kartenAnsicht of this.persistenteEigeneKarten.values()) kartenAnsicht.destroy();
    this.persistenteEigeneKarten.clear();
  }

  private setzeNameplateZustand(np: Nameplate, spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell): void {
    if (modell.phase === 'VORBEHALT_ANSAGE' && modell.aktuellerSpieler === spieler.position) {
      np.setZustand('amZug');
      np.showVorbehalt();
      return;
    }
    np.clearVorbehalt();
    if (modell.aktuellerSpieler === spieler.position) {
      np.setZustand('amZug');
    } else if (spieler.istGeber) {
      np.setZustand('geber');
    } else {
      np.setZustand('default');
    }
  }

  private setzeNameplateAnsage(np: Nameplate, spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell): void {
    const eigeneAnsagen = modell.ansageHistorie.filter(a => a.position === spieler.position);
    const reAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 're');
    const kontraAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 'kontra');
    if (reAnsage && !np.hatAnsageBadge()) np.showAnsage('re');
    if (kontraAnsage && !np.hatAnsageBadge()) np.showAnsage('kontra');
  }

  aktualisiereNameplate(spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell, nameplates: Map<SpielerPosition, Nameplate>, breite: number, hoehe: number): void {
    const pos = nameplatePositionFuer(spieler.position, breite, hoehe);
    let np = nameplates.get(spieler.position);

    if (!np) {
      const daten: NameplateDaten = {
        name: spieler.anzeigeName,
        position: spieler.position,
        istKI: !spieler.istMensch && !spieler.istSelbst,
      };
      np = new Nameplate(this.szene, pos.x, pos.y, daten);
      nameplates.set(spieler.position, np);
    } else {
      np.setPosition(pos.x, pos.y);
    }

    if (spieler.partei) {
      np.setTeamfarbe(spieler.partei === PARTEI.RE ? 're' : 'kontra');
    }

    this.setzeNameplateZustand(np, spieler, modell);
    this.setzeNameplateAnsage(np, spieler, modell);
    np.setHochzeitPartner(modell.spieltyp === SPIELTYP.HOCHZEIT && spieler.partei === PARTEI.RE);
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const a = modell.armutAktion;
    if (!a || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return null;
    if (a.modus === 'ANTWORTEN' && !this.kontext.getArmutAnnahmeAktiv()) return null;
    const ids = a.modus === 'ANBIETEN' ? handkarten.filter((k) => istTrumpfFuerSpieltyp(k, modell.spieltyp)).map((k) => k.id) : handkarten.map((k) => k.id);
    return new Set(ids);
  }
}
