import Phaser from 'phaser';
import { FONT_FAMILY } from '../ui/designTokens';
import { TEXTUR_KARTE_RUECKSEITE, texturSchluesselFuerKarte } from './AssetLoader';

type Karteninhalt =
  | { typ: 'offen'; farbe: string; wert: string }
  | { typ: 'textur'; textur: string }
  | { typ: 'leer' };

interface KartenansichtOptionen {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  inhalt: Karteninhalt;
}

export class Kartenansicht extends Phaser.GameObjects.Container {
  readonly typ = 'kartenansicht';

  textur?: string;

  tint?: number;

  private readonly schatten: Phaser.GameObjects.Graphics;

  private readonly hintergrund: Phaser.GameObjects.Graphics;

  private readonly markierung: Phaser.GameObjects.Graphics;

  private bild?: Phaser.GameObjects.Image;

  private breite: number;

  private hoehe: number;

  public get bildObjekt(): Phaser.GameObjects.Image | undefined {
    return this.bild;
  }

  constructor(szene: Phaser.Scene, optionen: KartenansichtOptionen) {
    super(szene, optionen.x, optionen.y);

    this.breite = optionen.breite;
    this.hoehe = optionen.hoehe;

    (szene.add as Phaser.Scene['add'] & { existing?: (objekt: Phaser.GameObjects.GameObject) => void }).existing?.(this);

    const radius = Math.max(8, Math.round(optionen.breite * 0.08));
    const schattenVersatz = Math.max(3, Math.round(optionen.breite * 0.035));
    const aussenRahmen = Math.max(2, Math.round(optionen.breite * 0.028));
    const innenRand = Math.max(2, Math.round(optionen.breite * 0.03));

    this.schatten = szene.add.graphics();
    this.schatten.fillStyle(0x000000, 0.78);
    this.schatten.fillRoundedRect(
      -optionen.breite / 2 + schattenVersatz,
      -optionen.hoehe / 2 + schattenVersatz,
      optionen.breite,
      optionen.hoehe,
      radius
    );
    this.add(this.schatten);

    this.hintergrund = szene.add.graphics();
    this.hintergrund.fillStyle(0xffffff, 1);
    this.hintergrund.fillRoundedRect(-optionen.breite / 2, -optionen.hoehe / 2, optionen.breite, optionen.hoehe, radius);
    this.hintergrund.lineStyle(aussenRahmen, 0x111111, 1);
    this.hintergrund.strokeRoundedRect(-optionen.breite / 2, -optionen.hoehe / 2, optionen.breite, optionen.hoehe, radius);
    this.hintergrund.lineStyle(1, 0xe5e7eb, 0.95);
    this.hintergrund.strokeRoundedRect(
      -optionen.breite / 2 + innenRand,
      -optionen.hoehe / 2 + innenRand,
      optionen.breite - innenRand * 2,
      optionen.hoehe - innenRand * 2,
      Math.max(4, radius - innenRand)
    );
    this.add(this.hintergrund);

    this.markierung = szene.add.graphics().setAlpha(0);
    this.add(this.markierung);

    const textur = aufloesenKartenTextur(optionen.inhalt);
    this.textur = textur;
    if (textur && szene.textures.exists(textur)) {
      this.bild = szene.add.image(0, 0, textur)
        .setDisplaySize(Math.round(optionen.breite * 0.84), Math.round(optionen.hoehe * 0.84));
      this.add(this.bild);
    } else {
      if (textur) {
        console.warn(`Textur ${textur} nicht gefunden! Nutze Fallback.`, optionen.inhalt);
      }
      this.renderFallback(szene, optionen.inhalt);
    }

    this.setSize(optionen.breite, optionen.hoehe);
  }

  static offen(
    szene: Phaser.Scene,
    x: number,
    y: number,
    farbe: string,
    wert: string,
    breite: number,
    hoehe: number
  ): Kartenansicht {
    return new Kartenansicht(szene, {
      x,
      y,
      breite,
      hoehe,
      inhalt: { typ: 'offen', farbe, wert }
    });
  }

  static verdeckt(
    szene: Phaser.Scene,
    x: number,
    y: number,
    breite: number,
    hoehe: number,
    textur = TEXTUR_KARTE_RUECKSEITE
  ): Kartenansicht {
    return new Kartenansicht(szene, {
      x,
      y,
      breite,
      hoehe,
      inhalt: { typ: 'textur', textur }
    });
  }

  static leer(
    szene: Phaser.Scene,
    x: number,
    y: number,
    breite: number,
    hoehe: number
  ): Kartenansicht {
    return new Kartenansicht(szene, {
      x,
      y,
      breite,
      hoehe,
      inhalt: { typ: 'leer' }
    });
  }

  markiereAuswahl(): this {
    this.tint = 0xffe082;
    this.zeichneMarkierung(0xffe082);
    return this;
  }

  markiereTastaturfokus(): this {
    this.tint = 0xf8f9fa;
    this.zeichneMarkierung(0xf8f9fa);
    return this;
  }

  loescheMarkierung(): this {
    this.tint = undefined;
    this.markierung.clear().setAlpha(0);
    return this;
  }

  private zeichneMarkierung(farbe: number): void {
    const breite = this.width;
    const hoehe = this.height;
    const radius = Math.max(8, Math.round(breite * 0.08));
    const inset = Math.max(3, Math.round(breite * 0.035));
    const staerke = Math.max(2, Math.round(breite * 0.024));
    this.markierung.clear();
    this.markierung.lineStyle(staerke, farbe, 1);
    this.markierung.strokeRoundedRect(
      -breite / 2 + inset,
      -hoehe / 2 + inset,
      breite - inset * 2,
      hoehe - inset * 2,
      Math.max(4, radius - inset)
    );
    this.markierung.setAlpha(1);
  }

  private renderFallback(szene: Phaser.Scene, inhalt: Karteninhalt): void {
    if (inhalt.typ === 'offen') {
      this.renderOffeneKarteFallback(szene, inhalt.farbe, inhalt.wert);
      return;
    }
    if (inhalt.typ === 'textur' && inhalt.textur === TEXTUR_KARTE_RUECKSEITE) {
      this.renderRueckseiteFallback(szene);
    }
  }

  private renderOffeneKarteFallback(szene: Phaser.Scene, farbe: string, wert: string): void {
    const istRot = farbe === 'HERZ' || farbe === 'KARO';
    const farbCode = istRot ? '#d62828' : '#111111';
    // Mapping fuer Symbole
    const symbole: Record<string, string> = { KREUZ: '\u2663', PIK: '\u2660', HERZ: '\u2665', KARO: '\u2666' };
    const symbol = symbole[farbe] ?? farbe.slice(0, 1);
    // Mapping fuer Werte
    const kuerzel: Record<string, string> = { AS: 'A', ZEHN: '10', KOENIG: 'K', DAME: 'D', BUBE: 'B', NEUN: '9' };
    const wertText = kuerzel[wert] ?? wert.slice(0, 2);
    
    const randX = -this.breite / 2 + Math.round(this.breite * 0.12);
    const randY = -this.hoehe / 2 + Math.round(this.hoehe * 0.08);
    const eckenStil = {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.max(14, Math.round(this.breite * 0.16))}px`,
      fontStyle: '700',
      color: farbCode
    };
    const symbolStil = {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.max(18, Math.round(this.breite * 0.21))}px`,
      color: farbCode
    };
    const mitteStil = {
      fontFamily: FONT_FAMILY,
      fontSize: `${Math.max(44, Math.round(this.breite * 0.5))}px`,
      color: farbCode
    };

    this.add(szene.add.text(randX, randY, wertText, eckenStil).setOrigin(0, 0));
    this.add(szene.add.text(randX, randY + Math.round(this.hoehe * 0.12), symbol, symbolStil).setOrigin(0, 0));
    this.add(szene.add.text(0, 0, symbol, mitteStil).setOrigin(0.5));

    const untenRechtsWert = szene.add.text(-randX, -randY, wertText, eckenStil)
      .setOrigin(0, 0)
      .setAngle(180);
    const untenRechtsSymbol = szene.add.text(-randX, -(randY + Math.round(this.hoehe * 0.12)), symbol, symbolStil)
      .setOrigin(0, 0)
      .setAngle(180);
    this.add(untenRechtsWert);
    this.add(untenRechtsSymbol);
  }

  private renderRueckseiteFallback(szene: Phaser.Scene): void {
    const grafik = szene.add.graphics();
    const breite = Math.round(this.breite * 0.84);
    const hoehe = Math.round(this.hoehe * 0.84);
    const links = -breite / 2;
    const oben = -hoehe / 2;
    const radius = Math.max(6, Math.round(this.breite * 0.06));
    grafik.fillStyle(0x123524, 1);
    grafik.fillRoundedRect(links, oben, breite, hoehe, radius);
    grafik.lineStyle(2, 0xd8f3dc, 1);
    grafik.strokeRoundedRect(links, oben, breite, hoehe, radius);
    grafik.lineStyle(2, 0xd8f3dc, 0.45);
    for (let index = -Math.round(breite * 0.4); index < hoehe; index += Math.max(10, Math.round(this.breite * 0.09))) {
      grafik.lineBetween(links, oben + index, links + breite, oben + index + breite);
    }
    this.add(grafik);
  }
}

function aufloesenKartenTextur(inhalt: Karteninhalt): string | undefined {
  if (inhalt.typ === 'offen') {
    return texturSchluesselFuerKarte(inhalt.farbe, inhalt.wert);
  }
  if (inhalt.typ === 'textur') {
    return inhalt.textur;
  }
  return undefined;
}