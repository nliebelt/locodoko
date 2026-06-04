import { PARTEI } from '../modelle/SpielverwaltungDto';
import type { Partei } from '../modelle/SpielverwaltungDto';
import { FONT_FAMILY } from '../ui/designTokens';
import { Logger } from '../logger';
import type { Punkt } from './AnimationenPrimitiven';
import type { AnimationenPrimitiven } from './AnimationenPrimitiven';

export interface RundenauswertungDaten {
  spieltypLabel: string;
  spielNummerText: string;
  siegerPartei: Partei;
  spielwert: number;
  reSpielerNamen: string;
  kontraSpielerNamen: string;
  augenRe: number;
  augenKontra: number;
  /** Vorformatierte Berechnungszeilen, z.B. "Grundwert: +1", "Solo-Multiplikator: ×3" */
  berechnungZeilen: string[];
  spielpunkte: { name: string; punkte: number; istSelbst: boolean }[];
  gesamtstand: { name: string; punkte: number }[];
}

/** Animiert Spieleffekte: Banner, Ankündigungen, Gewinner-Flash, Bockrunden, Rundenauswertung. */
export class SpieleffektAnimationen {
  constructor(private readonly p: AnimationenPrimitiven) {}

  async animiereAnsageBanner(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500,
    textFarbe = '#ffffff'
  ): Promise<void> {
    Logger.szene('Starte animiereAnsageBanner', { text });
    const bannerobjekt = this.p.szene.add
      .text(position.x, position.y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: textFarbe,
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setAlpha(0);
    try {
      await this.p.tweenAlpha(bannerobjekt, 1, 300);
      await this.p.warte(sichtbarkeitsdauer);
      await this.p.tweenAlpha(bannerobjekt, 0, 300);
    } finally {
      bannerobjekt.destroy();
      Logger.szene('Beende animiereAnsageBanner');
    }
  }

  async animiereSoloAnkuendigung(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500
  ): Promise<void> {
    Logger.szene('Starte animiereSoloAnkuendigung', { text });
    const startY = position.y - 160;
    const bannerobjekt = this.p.szene.add
      .text(position.x, startY, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        color: '#f8f9fa',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(110)
      .setAlpha(0);
    try {
      await Promise.all([
        this.p.tweenZu([bannerobjekt], position, 400),
        this.p.tweenAlpha(bannerobjekt, 1, 300)
      ]);
      await this.p.warte(sichtbarkeitsdauer);
      await Promise.all([
        this.p.tweenZu([bannerobjekt], { x: position.x, y: startY }, 400),
        this.p.tweenAlpha(bannerobjekt, 0, 300)
      ]);
    } finally {
      bannerobjekt.destroy();
      Logger.szene('Beende animiereSoloAnkuendigung');
    }
  }

  async animiereGewinnerFlash(
    parteiText: string,
    namenText: string,
    punkteText: string,
    farbe: string,
    position: Punkt,
    sichtbarkeitsdauer = 2500
  ): Promise<void> {
    Logger.szene('Starte animiereGewinnerFlash', { parteiText });
    const startY = position.y - 200;
    const parteiLabel = this.p.szene.add
      .text(position.x, startY, parteiText, {
        fontFamily: FONT_FAMILY, fontSize: '42px', color: farbe,
        stroke: '#000000', strokeThickness: 8, align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(115).setAlpha(0);
    const namenLabel = this.p.szene.add
      .text(position.x, startY + 68, namenText, {
        fontFamily: FONT_FAMILY, fontSize: '18px', color: '#f8f9fa',
        stroke: '#000000', strokeThickness: 5, align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(115).setAlpha(0);
    const punkteLabel = this.p.szene.add
      .text(position.x, startY + 108, punkteText, {
        fontFamily: FONT_FAMILY, fontSize: '24px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 6, align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(115).setAlpha(0);
    const zielPartei = { x: position.x, y: position.y - 54 };
    const zielNamen = { x: position.x, y: position.y + 14 };
    const zielPunkte = { x: position.x, y: position.y + 54 };
    try {
      await Promise.all([
        this.p.tweenZu([parteiLabel], zielPartei, 400),
        this.p.tweenZu([namenLabel], zielNamen, 400),
        this.p.tweenZu([punkteLabel], zielPunkte, 400),
        this.p.tweenAlpha(parteiLabel, 1, 300),
        this.p.tweenAlpha(namenLabel, 1, 300),
        this.p.tweenAlpha(punkteLabel, 1, 300)
      ]);
      await this.p.warte(sichtbarkeitsdauer);
      await Promise.all([
        this.p.tweenZu([parteiLabel], { x: position.x, y: startY }, 400),
        this.p.tweenZu([namenLabel], { x: position.x, y: startY + 68 }, 400),
        this.p.tweenZu([punkteLabel], { x: position.x, y: startY + 108 }, 400),
        this.p.tweenAlpha(parteiLabel, 0, 300),
        this.p.tweenAlpha(namenLabel, 0, 300),
        this.p.tweenAlpha(punkteLabel, 0, 300)
      ]);
    } finally {
      Logger.szene('Beende animiereGewinnerFlash');
      parteiLabel.destroy();
      namenLabel.destroy();
      punkteLabel.destroy();
    }
  }

  async animiereBockrunde(anzahl: number, position: Punkt, sichtbarkeitsdauer = 2500): Promise<void> {
    Logger.szene('Starte animiereBockrunde', { anzahl });
    const emojiText = anzahl === 1 ? '🐑' : anzahl === 2 ? '🐑🐑' : `🐑×${anzahl}`;
    const labelText = anzahl === 1 ? 'Bockrunde!' : anzahl === 2 ? 'Doppelbock!' : `Bockrunde ×${anzahl}`;
    const startY = position.y - 200;
    const schaf = this.p.szene.add
      .text(position.x, startY, emojiText, {
        fontFamily: FONT_FAMILY, fontSize: '48px', align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(115).setAlpha(0);
    const titel = this.p.szene.add
      .text(position.x, startY + 90, labelText, {
        fontFamily: FONT_FAMILY, fontSize: '38px', color: '#ff6b35',
        stroke: '#000000', strokeThickness: 8, align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(115).setAlpha(0);
    try {
      await Promise.all([
        this.p.tweenZu([schaf], { x: position.x, y: position.y - 40 }, 400),
        this.p.tweenZu([titel], { x: position.x, y: position.y + 50 }, 400),
        this.p.tweenAlpha(schaf, 1, 300),
        this.p.tweenAlpha(titel, 1, 300)
      ]);
      await this.p.warte(sichtbarkeitsdauer);
      await Promise.all([
        this.p.tweenZu([schaf], { x: position.x, y: startY - 40 }, 400),
        this.p.tweenZu([titel], { x: position.x, y: startY + 50 }, 400),
        this.p.tweenAlpha(schaf, 0, 300),
        this.p.tweenAlpha(titel, 0, 300)
      ]);
    } finally {
      Logger.szene('Beende animiereBockrunde');
      schaf.destroy();
      titel.destroy();
    }
  }

  async animiereSonderpunktFeedback(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 2000
  ): Promise<void> {
    Logger.szene('Starte animiereSonderpunktFeedback', { text });
    const feedbackobjekt = this.p.szene.add
      .text(position.x, position.y, text, {
        fontFamily: FONT_FAMILY, fontSize: '22px', color: '#ffd700',
        stroke: '#000000', strokeThickness: 5, align: 'center'
      })
      .setOrigin(0.5, 0.5).setDepth(100).setAlpha(0);
    try {
      await this.p.tweenAlpha(feedbackobjekt, 1, 200);
      await this.p.warte(sichtbarkeitsdauer);
      await this.p.tweenAlpha(feedbackobjekt, 0, 200);
    } finally {
      feedbackobjekt.destroy();
      Logger.szene('Beende animiereSonderpunktFeedback');
    }
  }

  /**
   * Animiert die Rundenauswertung vollständig in Phaser:
   * dunkles Overlay, Sieger-Banner (Bounce), Punkte-Berechnung,
   * Flipper-Zähler pro Spieler und Gesamtstand.
   * Gibt alle erstellten GameObjects zurück — der Aufrufer ist für die Zerstörung zuständig.
   */
  async animiereRundenauswertung(
    daten: RundenauswertungDaten,
    breite: number,
    hoehe: number
  ): Promise<Phaser.GameObjects.GameObject[]> {
    Logger.szene('Starte animiereRundenauswertung', { spieltypLabel: daten.spieltypLabel });
    const objekte: Phaser.GameObjects.GameObject[] = [];
    const cx = breite / 2;
    const TIEFE = 300;
    const FARBE_RE = '#ffd166';
    const FARBE_KONTRA = '#90caf9';
    const siegerFarbe = daten.siegerPartei === PARTEI.RE ? FARBE_RE : FARBE_KONTRA;
    const FONT = FONT_FAMILY;

    const fuege = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      objekte.push(obj);
      return obj;
    };

    // ── 1. Dunkles Overlay ────────────────────────────────────────────────
    const bg = fuege(
      this.p.szene.add.rectangle(cx, hoehe / 2, breite, hoehe, 0x050a10, 0.93)
        .setDepth(TIEFE).setAlpha(0)
    );
    await this.p.tweenAlpha(bg, 1, 300);

    let y = Math.round(hoehe * 0.08);

    // ── 2. Spieltyp + Nummer ──────────────────────────────────────────────
    const kopf = fuege(
      this.p.szene.add.text(cx, y, `${daten.spieltypLabel}  ·  ${daten.spielNummerText}`, {
        fontFamily: FONT, fontSize: '16px', color: '#b0bec5',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(kopf, 1, 250);
    y += 48;

    // ── 3. Sieger-Banner (Scale-Bounce) ───────────────────────────────────
    const sieger = fuege(
      this.p.szene.add.text(cx, y, `${daten.siegerPartei} gewinnt!`, {
        fontFamily: FONT, fontSize: '48px', color: siegerFarbe,
        stroke: '#000000', strokeThickness: 7,
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0).setScale(0.5)
    );
    await Promise.all([
      this.p.tweenAlpha(sieger, 1, 280),
      this.p.tweenScale(sieger, 1.1, 320),
    ]);
    await this.p.tweenScale(sieger, 1.0, 140);
    y += 84;

    // ── 4. Parteien: Spielernamen + Augen ─────────────────────────────────
    const reZeile = `RE: ${daten.reSpielerNamen}  (${daten.augenRe} Augen)`;
    const kontraZeile = `KONTRA: ${daten.kontraSpielerNamen}  (${daten.augenKontra} Augen)`;
    const parteien = fuege(
      this.p.szene.add.text(cx, y, `${reZeile}    ·    ${kontraZeile}`, {
        fontFamily: FONT, fontSize: '14px', color: '#ccddef', align: 'center',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(parteien, 1, 220);
    y += 38;

    // ── Trennlinie ────────────────────────────────────────────────────────
    const linie1 = fuege(
      this.p.szene.add.rectangle(cx, y + 6, Math.min(breite * 0.62, 500), 1, 0x334455)
        .setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(linie1, 0.45, 180);
    y += 24;

    // ── 5. Punkte-Berechnung: Zeilen nacheinander ─────────────────────────
    const berLabel = fuege(
      this.p.szene.add.text(cx, y, 'Punkte-Berechnung', {
        fontFamily: FONT, fontSize: '12px', color: '#7ba08c',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(berLabel, 1, 130);
    y += 24;

    for (const zeile of daten.berechnungZeilen) {
      const zobj = fuege(
        this.p.szene.add.text(cx, y, zeile, {
          fontFamily: FONT, fontSize: '16px', color: '#ddeeff',
        }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      await this.p.tweenAlpha(zobj, 1, 120);
      y += 28;
    }

    await this.p.warte(80);

    // ── 6. Gesamt-Flipper ─────────────────────────────────────────────────
    const gesamtObj = fuege(
      this.p.szene.add.text(cx, y, 'Gesamt:  +0', {
        fontFamily: FONT, fontSize: '24px', color: '#f0f8f0',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(gesamtObj, 1, 150);
    await this.p.flipperZaehler(gesamtObj, daten.spielwert, 'Gesamt:  +', 650);
    y += 48;

    // ── Trennlinie 2 ──────────────────────────────────────────────────────
    const linie2 = fuege(
      this.p.szene.add.rectangle(cx, y + 6, Math.min(breite * 0.62, 500), 1, 0x334455)
        .setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(linie2, 0.45, 180);
    y += 24;

    // ── 7. Spielpunkte pro Spieler mit Flipper ────────────────────────────
    const spLabel = fuege(
      this.p.szene.add.text(cx, y, 'Spielpunkte', {
        fontFamily: FONT, fontSize: '12px', color: '#7ba08c',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(spLabel, 1, 130);
    y += 24;

    const panelW = Math.min(breite * 0.58, 440);
    const linkX = cx - panelW / 2;
    const rechtsX = cx + panelW / 2;

    for (const eintrag of daten.spielpunkte) {
      const nameObj = fuege(
        this.p.szene.add.text(linkX, y, eintrag.istSelbst ? `▸ ${eintrag.name}` : eintrag.name, {
          fontFamily: FONT, fontSize: '16px',
          color: eintrag.istSelbst ? '#ffffff' : '#b3cddf',
        }).setOrigin(0, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      const pfx = eintrag.punkte >= 0 ? '+' : '';
      const punkteObj = fuege(
        this.p.szene.add.text(rechtsX, y, `${pfx}0`, {
          fontFamily: FONT, fontSize: '16px',
          color: eintrag.punkte >= 0 ? '#7edd94' : '#ff8877',
        }).setOrigin(1, 0).setDepth(TIEFE + 1).setAlpha(0)
      );
      await Promise.all([
        this.p.tweenAlpha(nameObj, 1, 120),
        this.p.tweenAlpha(punkteObj, 1, 120),
      ]);
      await this.p.flipperZaehler(punkteObj, eintrag.punkte, pfx, 480);
      y += 34;
    }

    y += 12;

    // ── 8. Gesamtstand kompakt ────────────────────────────────────────────
    const gsText = daten.gesamtstand
      .slice().sort((a, b) => b.punkte - a.punkte)
      .map((e) => `${e.name} ${e.punkte}`)
      .join('  ·  ');
    const gsObj = fuege(
      this.p.szene.add.text(cx, y, `Gesamtstand: ${gsText}`, {
        fontFamily: FONT, fontSize: '13px', color: '#88aa99',
      }).setOrigin(0.5, 0).setDepth(TIEFE + 1).setAlpha(0)
    );
    await this.p.tweenAlpha(gsObj, 1, 200);

    Logger.szene('Beende animiereRundenauswertung');
    return objekte;
  }
}
