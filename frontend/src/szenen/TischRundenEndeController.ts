import Phaser from 'phaser';
import { appStore } from '../anwendung';
import { Logger } from '../logger';
import { PARTEI, SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { TischAnsichtModell, LetztesSpielergebnisAnsicht } from '../modelle/TischAnsichtModell';
import type { AppZustand } from '../store/AppStore';
import type { VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import type { PhaserModal } from '../ui/PhaserModal';
import {
  formatiereVorbehalt,
  formatiereSonderpunkt,
  formatiereCountdownText,
} from './tischFormatierer';

const BG_COL = 0x0d1f0d;
const BG_ALPHA = 0.92;
const TRENNER_COL = 0x4a7c59;
const C_GRAUGRUEN = '#a3c4a8';
const C_WEISS = '#f8f9fa';
const C_GOLD = '#f8c94e';
const C_KONTRA_F = '#90caf9';
const C_NEGATIV = '#ff6b6b';
const SCHRIFT = 'Press Start 2P';
const MAX_SICHTBARE_ZEILEN = 5;
const ZEILEN_HOEHE = 20;

export class TischRundenEndeController {
  // Öffentliche Felder für Kompatibilität mit TischSzene
  phaserRundenEndeModal?: PhaserModal;
  rundenauswertungObjekte: Phaser.GameObjects.GameObject[] = [];
  phaserPartieEndeModal?: PhaserModal;
  partieCountdownInterval?: number;

  private tweenCountUp?: Phaser.Tweens.Tween;
  private yoyoTweens: Phaser.Tweens.Tween[] = [];
  private scrollOffset = 0;
  private tabellenZeilen: Phaser.GameObjects.GameObject[] = [];
  private tabellenContainer?: Phaser.GameObjects.Container;
  private tabellenMaskeGfx?: Phaser.GameObjects.Graphics;
  private tabellenMaske?: Phaser.Display.Masks.GeometryMask;
  private rundenEndeObjekte: Phaser.GameObjects.GameObject[] = [];
  private partieEndeObjekte: Phaser.GameObjects.GameObject[] = [];
  private wheelHandler?: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number
  ) => void;
  private spielverlaufSnapshot: LetztesSpielergebnisAnsicht[] = [];
  private aktuellesSpielNr = 0;
  private tabZeilenHoehe = ZEILEN_HOEHE;
  private tabMaxZeilen = MAX_SICHTBARE_ZEILEN;
  private tabBreite = 880;
  private tabSkala = 1;

  constructor(
    private readonly szene: Phaser.Scene,
    private readonly getLetzterZustand: () => AppZustand | undefined
  ) {}

  private erstelleTrenner(y: number, breite: number, tiefe: number, cx: number): Phaser.GameObjects.Graphics {
    const g = this.szene.add.graphics();
    g.lineStyle(1, TRENNER_COL, 1);
    g.lineBetween(cx - breite / 2, y, cx + breite / 2, y);
    g.setDepth(tiefe);
    return g;
  }

  private erstelleButton(
    x: number, y: number, text: string,
    callback: () => void,
    sekundaer = false
  ): Phaser.GameObjects.Container {
    const fg = sekundaer ? C_GRAUGRUEN : C_WEISS;
    const randCol = sekundaer ? TRENNER_COL : 0x4a7c59;
    const hgCol = sekundaer ? 0x1a3a1a : 0x2d5a3a;
    const pad = 20;
    const hoehe = 32;

    const txt = this.szene.add.text(0, 0, text, {
      fontSize: '11px', color: fg, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0.5);
    const breite = Math.max(160, txt.width + pad * 2);

    const bg = this.szene.add.graphics();
    const zeichneBg = (hov: boolean) => {
      bg.clear();
      bg.fillStyle(hov ? 0x3a6a4a : hgCol, 1);
      bg.fillRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 4);
      bg.lineStyle(2, randCol, 1);
      bg.strokeRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 4);
    };
    zeichneBg(false);

    const container = this.szene.add.container(x, y, [bg, txt]);
    container.setDepth(200);
    container.setSize(breite, hoehe);
    container.setInteractive();
    container.on('pointerover', () => zeichneBg(true));
    container.on('pointerout', () => zeichneBg(false));
    container.on('pointerdown', callback);
    return container;
  }

  private zeichneTabelle(): void {
    this.tabellenZeilen.forEach((o) => o.destroy());
    this.tabellenZeilen = [];
    if (!this.tabellenContainer) return;

    const zh = this.tabZeilenHoehe;
    const sk = this.tabSkala;
    const daten = this.spielverlaufSnapshot;
    const sichtbar = Math.min(this.tabMaxZeilen, Math.max(0, daten.length - this.scrollOffset));
    const xNr = 4;
    const xTyp = Math.round(54 * sk);
    const xSieger = Math.round(160 * sk);
    const xSpStart = Math.round(240 * sk);
    const xSpAbstand = Math.round(160 * sk);
    const fsSz = `${Math.max(7, Math.round(8 * Math.min(1, zh / ZEILEN_HOEHE)))}px`;

    for (let i = 0; i < sichtbar; i++) {
      const eintrag = daten[this.scrollOffset + i];
      if (!eintrag) break;

      const istAktuell = eintrag.spielNummer === this.aktuellesSpielNr;

      if (istAktuell) {
        const zeilenBg = this.szene.add.graphics();
        zeilenBg.fillStyle(0x1a4a2a, 0.8);
        zeilenBg.fillRect(0, i * zh, this.tabBreite, zh);
        if (this.tabellenMaske) zeilenBg.setMask(this.tabellenMaske);
        this.tabellenContainer.add(zeilenBg);
        this.tabellenZeilen.push(zeilenBg);
      }

      const pfeil = istAktuell ? '▶' : ' ';
      const farbe = istAktuell ? C_WEISS : C_GRAUGRUEN;
      const siegerFarbe = eintrag.siegerPartei === PARTEI.RE ? C_GOLD : C_KONTRA_F;
      const typLabel = (formatiereVorbehalt(eintrag.spieltyp as VorbehaltAnsage) ?? eintrag.spieltyp).slice(0, 10);

      const nrTxt = this.szene.add.text(xNr, i * zh + 3, `${pfeil}${String(eintrag.spielNummer).padStart(2)}`, {
        fontSize: fsSz, color: farbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      if (this.tabellenMaske) nrTxt.setMask(this.tabellenMaske);
      this.tabellenContainer.add(nrTxt);
      this.tabellenZeilen.push(nrTxt);

      const typTxt = this.szene.add.text(xTyp, i * zh + 3, typLabel, {
        fontSize: fsSz, color: farbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      if (this.tabellenMaske) typTxt.setMask(this.tabellenMaske);
      this.tabellenContainer.add(typTxt);
      this.tabellenZeilen.push(typTxt);

      const siegerTxt = this.szene.add.text(xSieger, i * zh + 3, eintrag.siegerPartei, {
        fontSize: fsSz, color: siegerFarbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      if (this.tabellenMaske) siegerTxt.setMask(this.tabellenMaske);
      this.tabellenContainer.add(siegerTxt);
      this.tabellenZeilen.push(siegerTxt);

      eintrag.spielpunkte.forEach((sp, idx) => {
        const xPos = xSpStart + idx * xSpAbstand;
        const pFarbe = sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV;
        const pTxt = this.szene.add.text(xPos, i * zh + 3,
          `${sp.name.slice(0, 6)}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
            fontSize: fsSz, color: pFarbe, fontFamily: SCHRIFT
          }).setOrigin(0, 0);
        if (this.tabellenMaske) pTxt.setMask(this.tabellenMaske);
        this.tabellenContainer!.add(pTxt);
        this.tabellenZeilen.push(pTxt);
      });
    }
  }

  private lo(bw: number, bh: number) {
    const skala = Math.min(1, bh / 680);
    const p = (n: number) => Math.round(n * skala);
    const fs = (n: number) => `${Math.max(7, p(n))}px`;
    const tabelleBreite = Math.min(880, bw - 16);
    return {
      p, fs, skala,
      trennerBreite: Math.min(900, bw - 40),
      reSpalteX: bw / 2 - Math.min(350, Math.round(bw * 0.41)),
      kontraSpalteX: bw / 2 + Math.round(bw * 0.06),
      tabelleX: Math.max(8, bw / 2 - Math.min(440, Math.round(bw * 0.515))),
      tabelleBreite,
      zeilenHoehe: Math.max(12, p(ZEILEN_HOEHE)),
      maxZeilen: Math.max(3, Math.floor(MAX_SICHTBARE_ZEILEN * skala)),
      linksX: bw / 2 - Math.min(380, Math.round(bw * 0.44)),
    };
  }

  private erstelleAufschluesselung(e: LetztesSpielergebnisAnsicht): { label: string; punkte: number }[] {
    if (e.punkteAufschluesselung.length > 0) return e.punkteAufschluesselung;
    const zeilen: { label: string; punkte: number }[] = [{ label: 'Grundwert', punkte: e.grundwert }];
    if (e.absagePunkte !== 0) zeilen.push({ label: 'Ansagen', punkte: e.absagePunkte });
    if (e.gegenDieAltenPunkte > 0) zeilen.push({ label: 'Gegen die Alten', punkte: e.gegenDieAltenPunkte });
    const sonderpunkte = e.sonderpunkteRe.length + e.sonderpunkteKontra.length;
    if (sonderpunkte > 0) zeilen.push({ label: 'Sonderpunkte', punkte: sonderpunkte });
    return zeilen;
  }

  private starteCountUpTween(countUpTexte: { wert: number; label: string; textObj: Phaser.GameObjects.Text }[]): void {
    const targets = countUpTexte.map(() => ({ t: 0 }));
    this.tweenCountUp = this.szene.tweens.add({
      targets,
      t: 1,
      duration: 800,
      ease: Phaser.Math.Easing.Cubic.Out,
      onUpdate: () => {
        countUpTexte.forEach((ct, idx) => {
          const val = Math.round(ct.wert * targets[idx].t);
          ct.textObj.setText(`${ct.label}: ${val > 0 ? '+' : ''}${val}`);
          if (targets[idx].t >= 0.95 && !ct.textObj.getData('yoyo-started')) {
            ct.textObj.setData('yoyo-started', true);
            ct.textObj.setColor('#ffff66');
            const tween = this.szene.tweens.add({
              targets: ct.textObj, alpha: 0.6, duration: 150, yoyo: true, repeat: 1,
              onComplete: () => { ct.textObj.setColor(C_GOLD); ct.textObj.setAlpha(1); }
            });
            this.yoyoTweens.push(tween);
          }
        });
      }
    });
  }

  async zeigeRundenEndeModal(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigeRundenEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    const br = (window as { __locodoko?: { _rundenEndeModalGezeigt?: number; _rundenauswertungSpieltypLabel?: string; _rundenauswertungMultiplikator?: number } }).__locodoko;
    if (br) {
      br._rundenEndeModalGezeigt = (br._rundenEndeModalGezeigt ?? 0) + 1;
      br._rundenauswertungSpieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
      br._rundenauswertungMultiplikator = e.soloMultiplikator;
    }

    const anzahlS = this.getLetzterZustand()?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const { width: bw, height: bh } = this.szene.scale.gameSize;
    const cx = bw / 2;
    const lo = this.lo(bw, bh);
    const { p, fs, reSpalteX, kontraSpalteX } = lo;
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));

    this.spielverlaufSnapshot = m.spielverlauf ?? [];
    this.aktuellesSpielNr = e.spielNummer;
    this.scrollOffset = Math.max(0, this.spielverlaufSnapshot.length - lo.maxZeilen);
    this.tabZeilenHoehe = lo.zeilenHoehe;
    this.tabMaxZeilen = lo.maxZeilen;
    this.tabBreite = lo.tabelleBreite;
    this.tabSkala = lo.tabelleBreite / 880;

    const bg = this.szene.add.graphics();
    bg.fillStyle(BG_COL, BG_ALPHA);
    bg.fillRect(0, 0, bw, bh);
    bg.setDepth(199);
    this.rundenEndeObjekte.push(bg);

    let y = p(22);

    // (a) Spieltyp + Spielnummer
    const spielinfoLabel = anzahlS
      ? `${spieltypLabel}  ·  Spiel ${e.spielNummer}/${anzahlS}`
      : `${spieltypLabel}  ·  Spiel ${e.spielNummer}`;
    const spielinfoTxt = this.szene.add.text(cx, y, spielinfoLabel, {
      fontSize: fs(9), color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(spielinfoTxt);
    y += p(20);

    // (b) Sieger-Text
    const siegerFarbe = e.siegerPartei === PARTEI.RE ? C_GOLD : C_KONTRA_F;
    const gewinner = e.siegerPartei === PARTEI.RE ? '★  RE GEWINNT  ★' : '★  KONTRA GEWINNT  ★';
    const siegerTxt = this.szene.add.text(cx, y, gewinner, {
      fontSize: fs(20), color: siegerFarbe, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(siegerTxt);
    y += p(38);

    // Count-up Spielwert
    const swTxtObj = this.szene.add.text(cx, y, 'Spielwert: 0', {
      fontSize: fs(14), color: siegerFarbe, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(swTxtObj);
    this.starteCountUpTween([{ wert: e.spielwert, label: 'Spielwert', textObj: swTxtObj }]);
    y += p(28);

    const t1 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.rundenEndeObjekte.push(t1);
    y += p(12);

    // (c) Zwei Spalten Re/Kontra
    const reLabel = this.szene.add.text(reSpalteX, y, 'RE', {
      fontSize: fs(12), color: C_GOLD, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(reLabel);

    const kontraLabel = this.szene.add.text(kontraSpalteX, y, 'KONTRA', {
      fontSize: fs(12), color: C_KONTRA_F, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(kontraLabel);
    y += p(20);

    const reAugenTxt = this.szene.add.text(reSpalteX, y, `${e.augenRe} Augen`, {
      fontSize: fs(16), color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(reAugenTxt);

    const kontraAugenTxt = this.szene.add.text(kontraSpalteX, y, `${e.augenKontra} Augen`, {
      fontSize: fs(16), color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(kontraAugenTxt);
    y += p(28);

    let reSY = y;
    if (e.sonderpunkteRe.length === 0) {
      const txt = this.szene.add.text(reSpalteX, reSY, '(keine)', {
        fontSize: fs(8), color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
      reSY += p(14);
    } else {
      e.sonderpunkteRe.forEach((sp) => {
        const txt = this.szene.add.text(reSpalteX, reSY, formatiereSonderpunkt(sp, sNMap), {
          fontSize: fs(8), color: C_GOLD, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
        this.rundenEndeObjekte.push(txt);
        reSY += p(14);
      });
    }

    let kontraSY = y;
    if (e.sonderpunkteKontra.length === 0) {
      const txt = this.szene.add.text(kontraSpalteX, kontraSY, '(keine)', {
        fontSize: fs(8), color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
      kontraSY += p(14);
    } else {
      e.sonderpunkteKontra.forEach((sp) => {
        const txt = this.szene.add.text(kontraSpalteX, kontraSY, formatiereSonderpunkt(sp, sNMap), {
          fontSize: fs(8), color: C_KONTRA_F, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
        this.rundenEndeObjekte.push(txt);
        kontraSY += p(14);
      });
    }
    y = Math.max(reSY, kontraSY) + p(8);

    // (d) Berechnungszeile mittig
    const aufschl = this.erstelleAufschluesselung(e);
    const berechnTeile = aufschl.map((a) => `${a.label} ${a.punkte > 0 ? '+' : ''}${a.punkte}`);
    const berechnZeile = berechnTeile.join(' · ') + `  →  Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`;
    const berechnTxt = this.szene.add.text(cx, y, berechnZeile, {
      fontSize: fs(8), color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(berechnTxt);
    y += p(18);

    const t2 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.rundenEndeObjekte.push(t2);
    y += p(10);

    // (e) Spielerpunkte nach Partei (Re links, Kontra rechts)
    const reSpieler = m.spieler.filter((s) => s.partei === PARTEI.RE);
    const kontraSpieler = m.spieler.filter((s) => s.partei === PARTEI.KONTRA);
    const maxSpielerZeilen = Math.max(reSpieler.length, kontraSpieler.length, 1);
    const spielerZeileH = p(18);

    reSpieler.forEach((spieler, idx) => {
      const sp = e.spielpunkte.find((pp) => pp.position === spieler.position);
      if (!sp) return;
      const istSelbst = spieler.istSelbst;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(reSpalteX, y + idx * spielerZeileH,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: fs(9), color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
    });

    kontraSpieler.forEach((spieler, idx) => {
      const sp = e.spielpunkte.find((pp) => pp.position === spieler.position);
      if (!sp) return;
      const istSelbst = spieler.istSelbst;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(kontraSpalteX, y + idx * spielerZeileH,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: fs(9), color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
    });
    y += maxSpielerZeilen * spielerZeileH + p(10);

    // (f) Trennlinie + Überschrift
    const t3 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.rundenEndeObjekte.push(t3);
    y += p(12);

    const verlaufsTitel = this.szene.add.text(cx, y, 'Bisherige Spiele', {
      fontSize: fs(10), color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(verlaufsTitel);
    y += p(18);

    // Tabellen-Header
    const spielerNamen = m.spieler.map((s) => s.name.slice(0, 6).padEnd(8));
    const headerZeile = `Nr.  Typ         Sieger    ${spielerNamen.join('  ')}`;
    const headerTxt = this.szene.add.text(lo.tabelleX, y, headerZeile, {
      fontSize: fs(8), color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(headerTxt);
    y += lo.zeilenHoehe;

    // (g) Scrollbare Verlaufstabelle
    const tabelleTop = y;

    this.tabellenMaskeGfx = this.szene.add.graphics();
    this.tabellenMaskeGfx.fillStyle(0xffffff, 1);
    this.tabellenMaskeGfx.fillRect(lo.tabelleX, tabelleTop, lo.tabelleBreite, lo.maxZeilen * lo.zeilenHoehe);
    this.tabellenMaskeGfx.setDepth(200);
    this.tabellenMaske = new Phaser.Display.Masks.GeometryMask(this.szene, this.tabellenMaskeGfx);

    this.tabellenContainer = this.szene.add.container(lo.tabelleX, tabelleTop);
    this.tabellenContainer.setDepth(200);
    // Container.setMask() wird in Phaser 3 WebGL nicht unterstützt — Maske auf einzelne Objekte in zeichneTabelle()
    this.rundenEndeObjekte.push(this.tabellenContainer);
    this.rundenEndeObjekte.push(this.tabellenMaskeGfx);

    this.zeichneTabelle();
    y += lo.maxZeilen * lo.zeilenHoehe + p(8);

    // (h) Σ-Zeile (Gesamtstand, scrollt nicht mit)
    const sigmaTeile = m.gesamtpunktestand.map((gs) => `${gs.name}: ${gs.punkte}`);
    const sigmaTxt = this.szene.add.text(cx, y, `Σ  ${sigmaTeile.join('  |  ')}`, {
      fontSize: fs(9), color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(sigmaTxt);
    y += p(26);

    // (i) Weiter-Button
    const weiterBtn = this.erstelleButton(cx, y + p(16), 'Weiter  →', () => this.schliesseRundenEndeModal());
    this.rundenEndeObjekte.push(weiterBtn);

    // Sentinel-Feld (Kompatibilität mit TischSzene und Tests)
    this.phaserRundenEndeModal = { destroy: () => { /* sentinel */ } } as unknown as PhaserModal;

    // Wheel-Event für Tabellen-Scroll
    this.wheelHandler = (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number
    ) => {
      const maxScroll = Math.max(0, this.spielverlaufSnapshot.length - MAX_SICHTBARE_ZEILEN);
      this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollOffset + (deltaY > 0 ? 1 : -1)));
      this.zeichneTabelle();
    };
    this.szene.input.on('wheel', this.wheelHandler);
  }

  schliesseRundenEndeModal(): void {
    if (this.wheelHandler) {
      this.szene.input.off('wheel', this.wheelHandler);
      this.wheelHandler = undefined;
    }
    this.tweenCountUp?.remove();
    this.tweenCountUp = undefined;
    this.yoyoTweens.forEach((t) => t.remove());
    this.yoyoTweens = [];
    this.tabellenZeilen.forEach((o) => o.destroy());
    this.tabellenZeilen = [];
    this.tabellenContainer = undefined;
    this.tabellenMaske = undefined;
    this.tabellenMaskeGfx = undefined;
    this.rundenEndeObjekte.forEach((o) => o.destroy());
    this.rundenEndeObjekte = [];
    this.phaserRundenEndeModal?.destroy();
    this.phaserRundenEndeModal = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy());
    this.rundenauswertungObjekte = [];
    appStore.setzeQueueFort();
  }

  private erstelleBerechungsZeilen(e: LetztesSpielergebnisAnsicht, sNMap: Map<string, string>): string[] {
    const zeilen: string[] = [`Grundwert: +${e.grundwert}`];
    if (e.absagePunkte !== 0) zeilen.push(`Ansagen: ${e.absagePunkte > 0 ? '+' : ''}${e.absagePunkte}`);
    if (e.gegenDieAltenPunkte > 0) zeilen.push(`Gegen die Alten: +${e.gegenDieAltenPunkte}`);
    if (e.soloMultiplikator > 1) zeilen.push(`Solo-Multiplikator: ×${e.soloMultiplikator}`);
    const sp = [
      ...e.sonderpunkteRe.map((s) => `Re: ${formatiereSonderpunkt(s, sNMap)}`),
      ...e.sonderpunkteKontra.map((s) => `Kontra: ${formatiereSonderpunkt(s, sNMap)}`)
    ];
    if (sp.length > 0) zeilen.push(`Sonderpunkte: ${sp.join(', ')}`);
    return zeilen;
  }

  zeigePartieEndeModal(m: TischAnsichtModell): void {
    const e = m.letztesSpielergebnis;
    if (!e) {
      Logger.szene('zeigePartieEndeModal: kein Spielergebnis — Queue wird fortgesetzt');
      appStore.setzeQueueFort();
      return;
    }

    const anzahlS = this.getLetzterZustand()?.aktuellerTisch?.konfiguration?.anzahlSpiele;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
    const siegerFarbe = e.siegerPartei === PARTEI.RE ? C_GOLD : C_KONTRA_F;

    const { width: bw, height: bh } = this.szene.scale.gameSize;
    const cx = bw / 2;
    const lo = this.lo(bw, bh);
    const { p, fs } = lo;

    const bg = this.szene.add.graphics();
    bg.fillStyle(BG_COL, BG_ALPHA);
    bg.fillRect(0, 0, bw, bh);
    bg.setDepth(199);
    this.partieEndeObjekte.push(bg);

    let y = p(28);

    const titelTxt = this.szene.add.text(cx, y, 'Partie beendet', {
      fontSize: fs(18), color: C_WEISS, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(titelTxt);
    y += p(32);

    // (a) Spieltyp + Spielnummer
    const infoTxt = this.szene.add.text(cx, y,
      anzahlS ? `${spieltypLabel}  ·  Spiel ${e.spielNummer}/${anzahlS}` : `${spieltypLabel}  ·  Spiel ${e.spielNummer}`, {
        fontSize: fs(9), color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(infoTxt);
    y += p(20);

    // (b) Sieger
    const siegerTxt = this.szene.add.text(cx, y,
      e.siegerPartei === PARTEI.RE ? '★  RE GEWINNT  ★' : '★  KONTRA GEWINNT  ★', {
        fontSize: fs(18), color: siegerFarbe, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(siegerTxt);
    y += p(34);

    const swTxt = this.szene.add.text(cx, y, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: fs(12), color: siegerFarbe, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(swTxt);
    y += p(22);

    const t1 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.partieEndeObjekte.push(t1);
    y += p(12);

    this.erstelleBerechungsZeilen(e, sNMap).forEach((zeile) => {
      const txt = this.szene.add.text(lo.linksX, y, zeile, {
        fontSize: fs(9), color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += p(16);
    });
    y += p(8);

    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(lo.linksX, y,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: fs(9), color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += p(16);
    });
    y += p(8);

    const t2 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.partieEndeObjekte.push(t2);
    y += p(12);

    const gsTitel = this.szene.add.text(cx, y, 'Gesamtstand', {
      fontSize: fs(12), color: C_GOLD, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(gsTitel);
    y += p(22);

    const sortedGs = [...m.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte);
    const maxPkt = sortedGs.length > 0 ? sortedGs[0].punkte : 0;
    sortedGs.forEach((ei) => {
      const istVorne = ei.punkte === maxPkt && maxPkt > 0;
      const txt = this.szene.add.text(lo.linksX, y, `${istVorne ? '★ ' : '  '}${ei.name}: ${ei.punkte}`, {
        fontSize: fs(10), color: istVorne ? C_GOLD : C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += p(18);
    });
    y += p(14);

    const t3 = this.erstelleTrenner(y, lo.trennerBreite, 200, cx);
    this.partieEndeObjekte.push(t3);
    y += p(16);

    // Countdown-Text
    const countdownTxt = this.szene.add.text(cx, y, '', {
      fontSize: fs(9), color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(countdownTxt);
    y += p(20);

    // Buttons: Neue Partie + Tisch verlassen
    const btnNeue = this.erstelleButton(cx - p(120), y + p(16), 'Neue Partie', () => {
      this.schliessePartieEndeModal();
      void appStore.starteNeuePartie();
    });
    this.partieEndeObjekte.push(btnNeue);

    const btnVerlassen = this.erstelleButton(cx + p(120), y + p(16), 'Tisch verlassen', () => {
      this.schliessePartieEndeModal();
      void appStore.verlasseAktuellenTisch();
    }, true);
    this.partieEndeObjekte.push(btnVerlassen);

    // Sentinel-Feld (Kompatibilität mit TischSzene und Tests)
    this.phaserPartieEndeModal = { destroy: () => { /* sentinel */ } } as unknown as PhaserModal;

    const updateCountdown = () => {
      const aktuellerCountdown = appStore.snapshot().countdownSekunden ?? 0;
      countdownTxt.setText(formatiereCountdownText(aktuellerCountdown));
      if (aktuellerCountdown <= 0 && this.partieCountdownInterval !== undefined) {
        this.schliessePartieEndeModal();
        void appStore.starteNeuePartie();
      }
    };
    updateCountdown();
    this.partieCountdownInterval = window.setInterval(updateCountdown, 1000);

    const br = (window as { __locodoko?: { _partieEndeModalGezeigt?: number } }).__locodoko;
    if (br) {
      br._partieEndeModalGezeigt = (br._partieEndeModalGezeigt ?? 0) + 1;
    }
  }

  schliessePartieEndeModal(): void {
    if (this.partieCountdownInterval !== undefined) {
      clearInterval(this.partieCountdownInterval);
      this.partieCountdownInterval = undefined;
    }
    this.partieEndeObjekte.forEach((o) => o.destroy());
    this.partieEndeObjekte = [];
    this.phaserPartieEndeModal?.destroy();
    this.phaserPartieEndeModal = undefined;
    appStore.setzeQueueFort();
  }

  aufraeumen(): void {
    if (this.wheelHandler) {
      this.szene.input.off('wheel', this.wheelHandler);
      this.wheelHandler = undefined;
    }
    this.tweenCountUp?.remove();
    this.tweenCountUp = undefined;
    this.yoyoTweens.forEach((t) => t.remove());
    this.yoyoTweens = [];
    if (this.partieCountdownInterval !== undefined) {
      clearInterval(this.partieCountdownInterval);
      this.partieCountdownInterval = undefined;
    }
    this.tabellenZeilen.forEach((o) => o.destroy());
    this.tabellenZeilen = [];
    this.rundenEndeObjekte.forEach((o) => o.destroy());
    this.rundenEndeObjekte = [];
    this.partieEndeObjekte.forEach((o) => o.destroy());
    this.partieEndeObjekte = [];
    this.phaserRundenEndeModal?.destroy();
    this.phaserRundenEndeModal = undefined;
    this.rundenauswertungObjekte.forEach((o) => o.destroy());
    this.rundenauswertungObjekte = [];
    this.phaserPartieEndeModal?.destroy();
    this.phaserPartieEndeModal = undefined;
  }
}
