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
      ebene.add(this.szene.add.text(pos.x, pos.y + Math.round(stapelH * 0.65), `${spieler.stiche}`, { fontFamily: FONT_FAMILY, color: '#ffd166', fontSize: `${Math.round(Math.max(10, breite * 0.009))}px`, backgroundColor: '#0d3d1e', padding: { x: 3, y: 1 } }).setOrigin(0.5));
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

  renderKartenFaecher(ebene: Phaser.GameObjects.Container, layout: TischLayout, spieler: TischAnsichtModell['spieler'][number], modell: TischAnsichtModell): void {
    const pos = layout[spieler.position];
    const offen = spieler.istSelbst || (modell.debugModus && spieler.sichtbareHandkarten.length > 0);
    const sichtbare = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
    const kAnzahl = sichtbare?.length ?? Math.max(spieler.verbleibendeKarten, 0);
    const armutK = spieler.istSelbst ? this.ermittleArmutAuswahl(modell, sichtbare ?? []) : null;
    const hatInt = spieler.istSelbst && (modell.spielbareKarten.length > 0 || armutK !== null);
    const { width: szB, height: szH } = this.szene.scale.gameSize;
    const kG = berechneKartenGroesse(szB);
    const kAb = berechneKartenAbstand(szB, szH);
    const auswV = Math.round(kG.h * 0.19);
    const elevV = Math.round(kG.h * 0.22);
    const istH = spieler.position === SPIELER_POSITION.SUED || spieler.position === SPIELER_POSITION.NORD;
    const stX = istH ? szB / 2 - ((kAnzahl - 1) * kAb.horizontal) / 2 : pos.kartenX;
    const [fB, fS]: [number, number] = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] }[spieler.position] as [number, number];
    const istGesp = spieler.position === SPIELER_POSITION.NORD || spieler.position === SPIELER_POSITION.OST;
    const animA = !!this.kontext.getWartendeKartenId() || false;

    const vorbehaltIdx = Math.min(this.kontext.getTastaturVorbehaltIndex(), modell.moeglicheVorbehalte.length - 1);
    const aktuellerVorbehalt = spieler.istSelbst && modell.moeglicheVorbehalte.length > 0
      ? modell.moeglicheVorbehalte[vorbehaltIdx]
      : null;
    const angezeigteKarten = aktuellerVorbehalt && sichtbare
      ? sortiereKartenFuerVorbehalt(sichtbare, aktuellerVorbehalt)
      : sichtbare;

    this.bereinigePersistenteEigeneKarten(spieler, sichtbare);

    for (let i = 0; i < kAnzahl; i++) {
      const fI = istGesp ? kAnzahl - 1 - i : i;
      const ab = istH ? fI * kAb.horizontal : fI * kAb.vertikal;
      const x = istH ? stX + ab : pos.kartenX;
      const y = istH ? pos.kartenY : pos.kartenY + ab;
      const w = fB + fI * fS;
      const k = angezeigteKarten?.[i];
      if (k && this.kontext.getWartendeKartenId() === k.id) continue;
      const istSp = k ? modell.spielbareKarten.includes(k.id) : false;
      const istArm = k ? (armutK?.has(k.id) ?? false) : false;
      const istInt = !animA && (istSp || istArm);
      const istAus = k ? this.kontext.getAusgewaehlteArmutKarten().has(k.id) : false;
      const istTast = spieler.istSelbst && k !== undefined && this.kontext.getTastaturKarteIndex() >= 0 && modell.spielbareKarten[this.kontext.getTastaturKarteIndex()] === k.id;
      const istVorbEleviert = aktuellerVorbehalt && k ? istHervorgehobeneKarteImVorbehalt(k, aktuellerVorbehalt) : false;
      const bV = (istAus || istTast) ? -auswV : (istVorbEleviert ? -elevV : 0);

      const { sprite: kA, wiederverwendet: istWiederverwendet } = this.erstelleOderAktualisiereKartenSprite(
        ebene, spieler, offen, k, x, y + bV, kG
      );

      const istWartend = !!k && this.kontext.getWartendeKartenId() === k.id;
      kA.setVisible(!istWartend);

      kA.setAngle(w).setAlpha(this.kontext.getAusteilenAktiv() ? 0 : (offen ? (hatInt && k && !istInt ? 0.45 : 1) : 0.92));
      if (istAus) kA.markiereAuswahl(); else if (istTast) kA.markiereTastaturfokus(); else kA.loescheMarkierung();

      if (k) this.handKartenobjekte.set(k.id, { wurzel: kA, bild: kA.bildObjekt });

      this.setzeKartenInteraktion(kA, k, istWiederverwendet, offen, istInt, istSp, aktuellerVorbehalt, y, bV, kG.h, modell);
    }
  }

  bereinigePersistenteEigeneKarten(spieler: TischAnsichtModell['spieler'][number], sichtbare: KarteAntwort[] | undefined): void {
    if (!spieler.istSelbst || !sichtbare) return;
    const aktuelleIds = new Set(sichtbare.map((k) => k.id));
    for (const [id, kA] of this.persistenteEigeneKarten) {
      if (!aktuelleIds.has(id)) { kA.destroy(); this.persistenteEigeneKarten.delete(id); }
    }
  }

  erstelleOderAktualisiereKartenSprite(
    ebene: Phaser.GameObjects.Container,
    spieler: TischAnsichtModell['spieler'][number],
    offen: boolean,
    k: KarteAntwort | undefined,
    x: number,
    y: number,
    kG: { w: number; h: number }
  ): { sprite: Kartenansicht; wiederverwendet: boolean } {
    if (spieler.istSelbst && k && this.persistenteEigeneKarten.has(k.id)) {
      const kA = this.persistenteEigeneKarten.get(k.id)!;
      kA.gleiteZu(x, y, 150);
      return { sprite: kA, wiederverwendet: true };
    }
    const kA = offen
      ? this.erstelleKartenansicht(x, y, kG.w, kG.h, k ? { karte: k } : {})
      : this.erstelleKartenansicht(x, y, kG.w, kG.h, { verdeckt: true });
    if (spieler.istSelbst && k) {
      kA.setDepth(2);
      this.persistenteEigeneKarten.set(k.id, kA);
    } else {
      ebene.add(kA);
    }
    return { sprite: kA, wiederverwendet: false };
  }

  setzeKartenInteraktion(
    kA: Kartenansicht,
    k: KarteAntwort | undefined,
    istWiederverwendet: boolean,
    offen: boolean,
    istInt: boolean,
    istSp: boolean,
    aktuellerVorbehalt: VorbehaltAnsage | null,
    y: number,
    bV: number,
    kartenHoehe: number,
    modell: TischAnsichtModell
  ): void {
    const inputVerfuegbar = kA.active && kA.scene?.input?.enabled;

    if (aktuellerVorbehalt && offen && k && inputVerfuegbar) {
      if (istWiederverwendet) {
        kA.removeAllListeners?.('pointerover');
        kA.removeAllListeners?.('pointerout');
        kA.removeAllListeners?.('pointerdown');
      }
      kA.setInteractive({ useHandCursor: true });
      kA.on('pointerdown', () => { void appStore.meldeVorbehalt(aktuellerVorbehalt); });
      return;
    }

    if (offen && k && istInt && inputVerfuegbar) {
      if (istWiederverwendet) {
        kA.removeAllListeners?.('pointerover');
        kA.removeAllListeners?.('pointerout');
        kA.removeAllListeners?.('pointerdown');
      }
      kA.setInteractive({ useHandCursor: true });
      const hV = Math.round(kartenHoehe * 0.08);
      kA.on('pointerover', () => kA.setY(y + bV - hV));
      kA.on('pointerout', () => kA.setY(y + bV));
      kA.on('pointerdown', () => {
        if (istSp) {
          this.kontext.onSpielKarteMitAnimation(k.id);
        } else {
          this.kontext.onToggleArmutKarte(k.id, modell.armutAktion?.kartenAnzahl ?? 0);
          this.kontext.onRenderTisch();
        }
      });
      return;
    }

    if (offen && k && !istInt && istWiederverwendet) {
      if (kA.active && kA.scene && kA.input?.enabled) {
        try {
          kA.disableInteractive();
          kA.removeAllListeners?.('pointerover');
          kA.removeAllListeners?.('pointerout');
          kA.removeAllListeners?.('pointerdown');
        } catch (e) {
          console.warn('[TischSzene] Fehler beim Deaktivieren der Interaktion', e);
        }
      }
    }
  }

  loeseEigeneKartenAuf(): void {
    for (const kA of this.persistenteEigeneKarten.values()) kA.destroy();
    this.persistenteEigeneKarten.clear();
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

    const eigeneAnsagen = modell.ansageHistorie.filter(a => a.position === spieler.position);
    const reAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 're');
    const kontraAnsage = eigeneAnsagen.find(a => ansageBadgeTyp(a.ansage) === 'kontra');
    if (reAnsage && !np.hatAnsageBadge()) np.showAnsage('re');
    if (kontraAnsage && !np.hatAnsageBadge()) np.showAnsage('kontra');

    const istHochzeitPartner = modell.spieltyp === SPIELTYP.HOCHZEIT && spieler.partei === PARTEI.RE;
    np.setHochzeitPartner(istHochzeitPartner);
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const a = modell.armutAktion;
    if (!a || modell.aktuellerSpieler !== SPIELER_POSITION.SUED) return null;
    if (a.modus === 'ANTWORTEN' && !this.kontext.getArmutAnnahmeAktiv()) return null;
    const ids = a.modus === 'ANBIETEN' ? handkarten.filter((k) => istTrumpfFuerSpieltyp(k, modell.spieltyp)).map((k) => k.id) : handkarten.map((k) => k.id);
    return new Set(ids);
  }
}
