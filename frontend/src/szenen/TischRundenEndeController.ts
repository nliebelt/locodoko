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

    const daten = this.spielverlaufSnapshot;
    const sichtbar = Math.min(MAX_SICHTBARE_ZEILEN, Math.max(0, daten.length - this.scrollOffset));

    for (let i = 0; i < sichtbar; i++) {
      const eintrag = daten[this.scrollOffset + i];
      if (!eintrag) break;

      const istAktuell = eintrag.spielNummer === this.aktuellesSpielNr;

      if (istAktuell) {
        const zeilenBg = this.szene.add.graphics();
        zeilenBg.fillStyle(0x1a4a2a, 0.8);
        zeilenBg.fillRect(0, i * ZEILEN_HOEHE, 880, ZEILEN_HOEHE);
        this.tabellenContainer.add(zeilenBg);
        this.tabellenZeilen.push(zeilenBg);
      }

      const pfeil = istAktuell ? '▶' : ' ';
      const farbe = istAktuell ? C_WEISS : C_GRAUGRUEN;
      const siegerFarbe = eintrag.siegerPartei === PARTEI.RE ? C_GOLD : C_KONTRA_F;
      const typLabel = (formatiereVorbehalt(eintrag.spieltyp as VorbehaltAnsage) ?? eintrag.spieltyp).slice(0, 10);

      const nrTxt = this.szene.add.text(4, i * ZEILEN_HOEHE + 3, `${pfeil}${String(eintrag.spielNummer).padStart(2)}`, {
        fontSize: '8px', color: farbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      this.tabellenContainer.add(nrTxt);
      this.tabellenZeilen.push(nrTxt);

      const typTxt = this.szene.add.text(54, i * ZEILEN_HOEHE + 3, typLabel, {
        fontSize: '8px', color: farbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      this.tabellenContainer.add(typTxt);
      this.tabellenZeilen.push(typTxt);

      const siegerTxt = this.szene.add.text(160, i * ZEILEN_HOEHE + 3, eintrag.siegerPartei, {
        fontSize: '8px', color: siegerFarbe, fontFamily: SCHRIFT
      }).setOrigin(0, 0);
      this.tabellenContainer.add(siegerTxt);
      this.tabellenZeilen.push(siegerTxt);

      eintrag.spielpunkte.forEach((sp, idx) => {
        const xPos = 240 + idx * 160;
        const pFarbe = sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV;
        const pTxt = this.szene.add.text(xPos, i * ZEILEN_HOEHE + 3,
          `${sp.name.slice(0, 6)}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
            fontSize: '8px', color: pFarbe, fontFamily: SCHRIFT
          }).setOrigin(0, 0);
        this.tabellenContainer!.add(pTxt);
        this.tabellenZeilen.push(pTxt);
      });
    }
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
    const spieltypLabel = formatiereVorbehalt(e.spieltyp as VorbehaltAnsage) ?? e.spieltyp;
    const sNMap = new Map(m.spieler.map((s) => [s.position, s.name] as const));

    this.spielverlaufSnapshot = m.spielverlauf ?? [];
    this.aktuellesSpielNr = e.spielNummer;
    this.scrollOffset = Math.max(0, this.spielverlaufSnapshot.length - MAX_SICHTBARE_ZEILEN);

    const bg = this.szene.add.graphics();
    bg.fillStyle(BG_COL, BG_ALPHA);
    bg.fillRect(0, 0, bw, bh);
    bg.setDepth(199);
    this.rundenEndeObjekte.push(bg);

    let y = 22;

    // (a) Spieltyp + Spielnummer
    const spielinfoLabel = anzahlS
      ? `${spieltypLabel}  ·  Spiel ${e.spielNummer}/${anzahlS}`
      : `${spieltypLabel}  ·  Spiel ${e.spielNummer}`;
    const spielinfoTxt = this.szene.add.text(cx, y, spielinfoLabel, {
      fontSize: '9px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(spielinfoTxt);
    y += 20;

    // (b) Sieger-Text
    const siegerFarbe = e.siegerPartei === PARTEI.RE ? C_GOLD : C_KONTRA_F;
    const gewinner = e.siegerPartei === PARTEI.RE ? '★  RE GEWINNT  ★' : '★  KONTRA GEWINNT  ★';
    const siegerTxt = this.szene.add.text(cx, y, gewinner, {
      fontSize: '20px', color: siegerFarbe, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(siegerTxt);
    y += 38;

    // Count-up Spielwert
    const swTxtObj = this.szene.add.text(cx, y, 'Spielwert: 0', {
      fontSize: '14px', color: siegerFarbe, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(swTxtObj);
    this.starteCountUpTween([{ wert: e.spielwert, label: 'Spielwert', textObj: swTxtObj }]);
    y += 28;

    const t1 = this.erstelleTrenner(y, 900, 200, cx);
    this.rundenEndeObjekte.push(t1);
    y += 12;

    // (c) Zwei Spalten Re/Kontra
    const reSpalteX = cx - 350;
    const kontraSpalteX = cx + 50;

    const reLabel = this.szene.add.text(reSpalteX, y, 'RE', {
      fontSize: '12px', color: C_GOLD, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(reLabel);

    const kontraLabel = this.szene.add.text(kontraSpalteX, y, 'KONTRA', {
      fontSize: '12px', color: C_KONTRA_F, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(kontraLabel);
    y += 20;

    const reAugenTxt = this.szene.add.text(reSpalteX, y, `${e.augenRe} Augen`, {
      fontSize: '16px', color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(reAugenTxt);

    const kontraAugenTxt = this.szene.add.text(kontraSpalteX, y, `${e.augenKontra} Augen`, {
      fontSize: '16px', color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(kontraAugenTxt);
    y += 28;

    let reSY = y;
    if (e.sonderpunkteRe.length === 0) {
      const txt = this.szene.add.text(reSpalteX, reSY, '(keine)', {
        fontSize: '8px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
      reSY += 14;
    } else {
      e.sonderpunkteRe.forEach((sp) => {
        const txt = this.szene.add.text(reSpalteX, reSY, formatiereSonderpunkt(sp, sNMap), {
          fontSize: '8px', color: C_GOLD, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
        this.rundenEndeObjekte.push(txt);
        reSY += 14;
      });
    }

    let kontraSY = y;
    if (e.sonderpunkteKontra.length === 0) {
      const txt = this.szene.add.text(kontraSpalteX, kontraSY, '(keine)', {
        fontSize: '8px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
      kontraSY += 14;
    } else {
      e.sonderpunkteKontra.forEach((sp) => {
        const txt = this.szene.add.text(kontraSpalteX, kontraSY, formatiereSonderpunkt(sp, sNMap), {
          fontSize: '8px', color: C_KONTRA_F, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
        this.rundenEndeObjekte.push(txt);
        kontraSY += 14;
      });
    }
    y = Math.max(reSY, kontraSY) + 8;

    // (d) Berechnungszeile mittig
    const aufschl = this.erstelleAufschluesselung(e);
    const berechnTeile = aufschl.map((a) => `${a.label} ${a.punkte > 0 ? '+' : ''}${a.punkte}`);
    const berechnZeile = berechnTeile.join(' · ') + `  →  Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`;
    const berechnTxt = this.szene.add.text(cx, y, berechnZeile, {
      fontSize: '8px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(berechnTxt);
    y += 18;

    const t2 = this.erstelleTrenner(y, 900, 200, cx);
    this.rundenEndeObjekte.push(t2);
    y += 10;

    // (e) Spielerpunkte nach Partei (Re links, Kontra rechts)
    const reSpieler = m.spieler.filter((s) => s.partei === PARTEI.RE);
    const kontraSpieler = m.spieler.filter((s) => s.partei === PARTEI.KONTRA);
    const maxSpielerZeilen = Math.max(reSpieler.length, kontraSpieler.length, 1);

    reSpieler.forEach((spieler, idx) => {
      const sp = e.spielpunkte.find((p) => p.position === spieler.position);
      if (!sp) return;
      const istSelbst = spieler.istSelbst;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(reSpalteX, y + idx * 18,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: '9px', color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
    });

    kontraSpieler.forEach((spieler, idx) => {
      const sp = e.spielpunkte.find((p) => p.position === spieler.position);
      if (!sp) return;
      const istSelbst = spieler.istSelbst;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(kontraSpalteX, y + idx * 18,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: '9px', color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.rundenEndeObjekte.push(txt);
    });
    y += maxSpielerZeilen * 18 + 10;

    // (f) Trennlinie + Überschrift
    const t3 = this.erstelleTrenner(y, 900, 200, cx);
    this.rundenEndeObjekte.push(t3);
    y += 12;

    const verlaufsTitel = this.szene.add.text(cx, y, 'Bisherige Spiele', {
      fontSize: '10px', color: C_WEISS, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(verlaufsTitel);
    y += 18;

    // Tabellen-Header
    const spielerNamen = m.spieler.map((s) => s.name.slice(0, 6).padEnd(8));
    const headerZeile = `Nr.  Typ         Sieger    ${spielerNamen.join('  ')}`;
    const headerTxt = this.szene.add.text(cx - 440, y, headerZeile, {
      fontSize: '8px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0, 0).setDepth(200);
    this.rundenEndeObjekte.push(headerTxt);
    y += ZEILEN_HOEHE;

    // (g) Scrollbare Verlaufstabelle
    const tabelleTop = y;
    const tabelleBreite = 880;

    this.tabellenMaskeGfx = this.szene.add.graphics();
    this.tabellenMaskeGfx.fillStyle(0xffffff, 1);
    this.tabellenMaskeGfx.fillRect(cx - 440, tabelleTop, tabelleBreite, MAX_SICHTBARE_ZEILEN * ZEILEN_HOEHE);
    this.tabellenMaskeGfx.setDepth(200);
    const maske = new Phaser.Display.Masks.GeometryMask(this.szene, this.tabellenMaskeGfx);

    this.tabellenContainer = this.szene.add.container(cx - 440, tabelleTop);
    this.tabellenContainer.setDepth(200);
    this.tabellenContainer.setMask(maske);
    this.rundenEndeObjekte.push(this.tabellenContainer);
    this.rundenEndeObjekte.push(this.tabellenMaskeGfx);

    this.zeichneTabelle();
    y += MAX_SICHTBARE_ZEILEN * ZEILEN_HOEHE + 8;

    // (h) Σ-Zeile (Gesamtstand, scrollt nicht mit)
    const sigmaTeile = m.gesamtpunktestand.map((gs) => `${gs.name}: ${gs.punkte}`);
    const sigmaTxt = this.szene.add.text(cx, y, `Σ  ${sigmaTeile.join('  |  ')}`, {
      fontSize: '9px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.rundenEndeObjekte.push(sigmaTxt);
    y += 26;

    // (i) Weiter-Button
    const weiterBtn = this.erstelleButton(cx, y + 16, 'Weiter  →', () => this.schliesseRundenEndeModal());
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

    const bg = this.szene.add.graphics();
    bg.fillStyle(BG_COL, BG_ALPHA);
    bg.fillRect(0, 0, bw, bh);
    bg.setDepth(199);
    this.partieEndeObjekte.push(bg);

    let y = 28;

    const titelTxt = this.szene.add.text(cx, y, 'Partie beendet', {
      fontSize: '18px', color: C_WEISS, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(titelTxt);
    y += 32;

    // (a) Spieltyp + Spielnummer
    const infoTxt = this.szene.add.text(cx, y,
      anzahlS ? `${spieltypLabel}  ·  Spiel ${e.spielNummer}/${anzahlS}` : `${spieltypLabel}  ·  Spiel ${e.spielNummer}`, {
        fontSize: '9px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(infoTxt);
    y += 20;

    // (b) Sieger
    const siegerTxt = this.szene.add.text(cx, y,
      e.siegerPartei === PARTEI.RE ? '★  RE GEWINNT  ★' : '★  KONTRA GEWINNT  ★', {
        fontSize: '18px', color: siegerFarbe, fontFamily: SCHRIFT, stroke: '#000', strokeThickness: 3
      }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(siegerTxt);
    y += 34;

    const swTxt = this.szene.add.text(cx, y, `Spielwert: ${e.spielwert > 0 ? '+' : ''}${e.spielwert}`, {
      fontSize: '12px', color: siegerFarbe, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(swTxt);
    y += 22;

    const t1 = this.erstelleTrenner(y, 800, 200, cx);
    this.partieEndeObjekte.push(t1);
    y += 12;

    this.erstelleBerechungsZeilen(e, sNMap).forEach((zeile) => {
      const txt = this.szene.add.text(cx - 380, y, zeile, {
        fontSize: '9px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += 16;
    });
    y += 8;

    e.spielpunkte.forEach((sp) => {
      const istSelbst = sp.position === SPIELER_POSITION.SUED;
      const farbe = istSelbst ? C_GOLD : (sp.punkte >= 0 ? C_GRAUGRUEN : C_NEGATIV);
      const txt = this.szene.add.text(cx - 380, y,
        `${sp.name}${istSelbst ? ' ◀' : ''}: ${sp.punkte > 0 ? '+' : ''}${sp.punkte}`, {
          fontSize: '9px', color: farbe, fontFamily: SCHRIFT
        }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += 16;
    });
    y += 8;

    const t2 = this.erstelleTrenner(y, 800, 200, cx);
    this.partieEndeObjekte.push(t2);
    y += 12;

    const gsTitel = this.szene.add.text(cx, y, 'Gesamtstand', {
      fontSize: '12px', color: C_GOLD, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(gsTitel);
    y += 22;

    const sortedGs = [...m.gesamtpunktestand].sort((a, b) => b.punkte - a.punkte);
    const maxPkt = sortedGs.length > 0 ? sortedGs[0].punkte : 0;
    sortedGs.forEach((ei) => {
      const istVorne = ei.punkte === maxPkt && maxPkt > 0;
      const txt = this.szene.add.text(cx - 380, y, `${istVorne ? '★ ' : '  '}${ei.name}: ${ei.punkte}`, {
        fontSize: '10px', color: istVorne ? C_GOLD : C_GRAUGRUEN, fontFamily: SCHRIFT
      }).setOrigin(0, 0).setDepth(200);
      this.partieEndeObjekte.push(txt);
      y += 18;
    });
    y += 14;

    const t3 = this.erstelleTrenner(y, 800, 200, cx);
    this.partieEndeObjekte.push(t3);
    y += 16;

    // Countdown-Text
    const countdownTxt = this.szene.add.text(cx, y, '', {
      fontSize: '9px', color: C_GRAUGRUEN, fontFamily: SCHRIFT
    }).setOrigin(0.5, 0).setDepth(200);
    this.partieEndeObjekte.push(countdownTxt);
    y += 20;

    // Buttons: Neue Partie + Tisch verlassen
    const btnNeue = this.erstelleButton(cx - 120, y + 16, 'Neue Partie', () => {
      this.schliessePartieEndeModal();
      void appStore.starteNeuePartie();
    });
    this.partieEndeObjekte.push(btnNeue);

    const btnVerlassen = this.erstelleButton(cx + 120, y + 16, 'Tisch verlassen', () => {
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
