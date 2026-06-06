import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen, ladeHintergrundbilder } from '../assets/AssetLoader';
import { PhaserButton } from './PhaserButton';
import { FONT_FAMILY } from '../ui/designTokens';

type HilfeTab = 'trumpf' | 'ansagen' | 'sonderspiele' | 'punkte';

const TABS: { key: HilfeTab; label: string }[] = [
  { key: 'trumpf', label: 'Trumpfhierarchie' },
  { key: 'ansagen', label: 'Ansagen' },
  { key: 'sonderspiele', label: 'Sonderspiele' },
  { key: 'punkte', label: 'Punktesystem' },
];

const GOLD = '#f8c94e';
const HELL = '#f8f9fa';
const GRUEN = '#a3c4a8';
const ORANGE = '#ffd166';

/**
 * Phaser-Szene: In-App-Spielregeln / Hilfe.
 * Erreichbar aus Lobby (Button) und Tisch (H-Taste / TopBar-Icon).
 * modus='overlay': scene.stop() kehrt zur laufenden Szene zurück.
 * modus='vollbild': scene.start(herkunft) navigiert zur Herkunfts-Szene.
 */
export class HilfeSzene extends Phaser.Scene {
  private aktiveTab: HilfeTab = 'trumpf';
  private inhaltElemente: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: PhaserButton[] = [];
  private modus: 'overlay' | 'vollbild' = 'vollbild';
  private herkunft = 'SpielverwaltungsSzene';

  constructor() {
    super('HilfeSzene');
  }

  init(data: Record<string, unknown>): void {
    this.modus = data['modus'] === 'overlay' ? 'overlay' : 'vollbild';
    this.herkunft = typeof data['herkunft'] === 'string' ? data['herkunft'] : 'SpielverwaltungsSzene';
    this.aktiveTab = 'trumpf';
  }

  preload(): void {
    ladeHintergrundbilder(this);
  }

  create(): void {
    registriereBasisTexturen(this);
    this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ).setAlpha(0.97);

    this.add.text(this.scale.width / 2, 45, 'SPIELREGELN', {
      fontFamily: FONT_FAMILY,
      fontSize: '48px',
      color: HELL,
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    new PhaserButton(this, {
      x: 100, y: 45, text: '← Zurück', typ: 'secondary', breite: 160,
      testId: 'btn-hilfe-zurueck',
      callback: () => this.zurueck(),
    });

    this.input.keyboard?.on('keydown-ESC', () => this.zurueck());

    this.baueTabs();
    this.zeigeTab();
    this.events.once('shutdown', () => this.raeumAb());
  }

  private zurueck(): void {
    if (this.modus === 'overlay') {
      this.scene.stop();
    } else {
      this.scene.start(this.herkunft);
    }
  }

  private baueTabs(): void {
    this.tabButtons.forEach(b => b.destroy());
    this.tabButtons = [];
    TABS.forEach((tab, i) => {
      const btn = new PhaserButton(this, {
        x: 285 + i * 185, y: 105,
        text: tab.label,
        breite: 170,
        typ: tab.key === this.aktiveTab ? 'primary' : 'secondary',
        testId: `btn-tab-${tab.key}`,
        callback: () => {
          if (this.aktiveTab !== tab.key) {
            this.aktiveTab = tab.key;
            this.baueTabs();
            this.zeigeTab();
          }
        },
      });
      this.tabButtons.push(btn);
    });
  }

  private raeumInhaltAb(): void {
    this.inhaltElemente.forEach(e => e.destroy());
    this.inhaltElemente = [];
  }

  private raeumAb(): void {
    this.raeumInhaltAb();
    this.tabButtons.forEach(b => b.destroy());
    this.tabButtons = [];
  }

  private txt(x: number, y: number, inhalt: string, farbe: string, groesse: number, fett = false): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, inhalt, {
      fontFamily: FONT_FAMILY,
      fontSize: `${groesse}px`,
      color: farbe,
      fontStyle: fett ? 'bold' : 'normal',
    });
    this.inhaltElemente.push(t);
    return t;
  }

  private sep(y: number, x1 = 50, x2 = 1230): void {
    const s = this.add.rectangle((x1 + x2) / 2, y, x2 - x1, 1, 0x4a7c59);
    this.inhaltElemente.push(s);
  }

  private zeigeTab(): void {
    this.raeumInhaltAb();
    switch (this.aktiveTab) {
      case 'trumpf':       this.zeigeTrumpf(); break;
      case 'ansagen':      this.zeigeAnsagen(); break;
      case 'sonderspiele': this.zeigeSonderspiele(); break;
      case 'punkte':       this.zeigePunkte(); break;
    }
  }

  private zeigeTrumpf(): void {
    let y = 150;
    const LX = 80;
    const RX = 700;
    const ZA = 30;

    this.txt(LX, y, 'TRUMPFKARTEN (höchster zuerst)', GOLD, 14, true);
    this.txt(RX, y, 'FEHLKARTEN', GOLD, 14, true);
    y += 24; this.sep(y); y += 12;

    const karten = [
      ['♥10', 'Dulle (stärkster Trumpf; 2. Dulle sticht 1.)', ORANGE],
      ['♣D', 'Kreuz-Dame', '#a8e6cf'],
      ['♠D', 'Pik-Dame', '#a8e6cf'],
      ['♥D', 'Herz-Dame  → Re-Partei (Kreuz-Dame-Besitzer)', '#a8e6cf'],
      ['♦D', 'Karo-Dame', '#a8e6cf'],
      ['♣B', 'Kreuz-Bube', '#dda0dd'],
      ['♠B', 'Pik-Bube', '#dda0dd'],
      ['♥B', 'Herz-Bube', '#dda0dd'],
      ['♦B', 'Karo-Bube', '#dda0dd'],
      ['♦A', 'Karo-As (11 Augen)', GRUEN],
      ['♦10', 'Karo-Zehn (10 Augen)', GRUEN],
      ['♦K', 'Karo-König (4 Augen)', GRUEN],
      ['♦9', 'Karo-Neun (0 Augen)', GRUEN],
    ] as const;

    karten.forEach(([karte, info, farbe]) => {
      this.txt(LX, y, karte, farbe, 13, true);
      this.txt(LX + 60, y, info, HELL, 13);
      y += ZA;
    });

    // Rechte Spalte
    let ry = 186;
    this.txt(RX, ry, 'Bedienung: Farbe des Ausspielers', GRUEN, 13); ry += ZA;
    this.txt(RX, ry, 'Kein Trumpf? Frei auspielen', GRUEN, 13); ry += ZA + 8;
    this.txt(RX, ry, 'Rangfolge je Fehlfarbe:', HELL, 13, true); ry += ZA - 5;
    this.txt(RX, ry, 'As (11) > 10 (10) > König (4) > 9 (0)', GRUEN, 13); ry += ZA + 8;
    this.txt(RX, ry, 'Fehlfarben (kein Trumpf):', HELL, 13, true); ry += ZA - 5;
    ['♣ Kreuz', '♠ Pik', '♥ Herz'].forEach(ff => {
      this.txt(RX, ry, ff, GRUEN, 13); ry += ZA - 5;
    });
    ry += 10;
    this.txt(RX, ry, 'Augenwerte:', HELL, 13, true); ry += ZA - 5;
    [
      'As = 11  ·  10 = 10',
      'König = 4  ·  Dame = 3',
      'Bube = 2  ·  9 = 0',
    ].forEach(z => {
      this.txt(RX, ry, z, GRUEN, 13); ry += ZA - 5;
    });
    ry += 8;
    this.txt(RX, ry, '→ Gesamt: 240 Augen im Spiel', GOLD, 13, true);
  }

  private zeigeAnsagen(): void {
    let y = 150;
    const LX = 80;
    const ZA = 32;

    this.txt(LX, y, 'GRUNDANSAGEN', GOLD, 14, true); y += 24;
    this.sep(y); y += 14;

    this.txt(LX, y, 'Re', ORANGE, 14, true);
    this.txt(LX + 60, y, '— Spieler hat eine ♣D oder ist Hochzeits-Partner', HELL, 13); y += ZA;
    this.txt(LX, y, 'Kontra', ORANGE, 14, true);
    this.txt(LX + 80, y, '— Gegenpartei', HELL, 13); y += ZA;
    this.txt(LX, y, '→ Grundansage verdoppelt den Spielwert (×2)', GRUEN, 13); y += ZA - 6;
    this.txt(LX, y, '→ Re + Kontra zusammen: ×4', GRUEN, 13); y += ZA - 6;
    this.txt(LX, y, '→ Ansage-Frist: bis zur 5. gespielten Karte', GRUEN, 13); y += ZA + 10;

    this.sep(y, LX, 1200); y += 18;
    this.txt(LX, y, 'VERSCHÄRFUNGEN (zusätzlich je +1 Punkt wenn erreicht)', GOLD, 14, true); y += 28;

    const verschaerfungen = [
      ['Keine 90', 'Gegner bleibt unter 90 Augen', 'bis 10. Karte'],
      ['Keine 60', 'Gegner bleibt unter 60 Augen', 'bis 9. Karte'],
      ['Keine 30', 'Gegner bleibt unter 30 Augen', 'bis 8. Karte'],
      ['Schwarz', 'Gegner bekommt keinen Stich', 'bis 7. Karte'],
    ] as const;

    verschaerfungen.forEach(([name, beschreibung, frist]) => {
      this.txt(LX, y, name, ORANGE, 14, true);
      this.txt(LX + 130, y, `— ${beschreibung}`, HELL, 13);
      this.txt(LX + 130, y + 18, `Ansage: ${frist}`, GRUEN, 12); y += ZA + 12;
    });

    y += 10;
    this.sep(y, LX, 1200); y += 18;
    this.txt(LX, y, 'SONDERPUNKT', GOLD, 14, true); y += ZA - 6;
    this.txt(LX, y, 'Gegen die Alten: Kontra gewinnt gegen Re-Partei → +1 Punkt', GRUEN, 13);
  }

  private zeigeSonderspiele(): void {
    let y = 150;
    const LX = 80;
    const RX = 700;
    const ZA = 26;

    this.txt(LX, y, 'SONDERSPIELE', GOLD, 14, true); y += 24;
    this.sep(y); y += 14;

    // Hochzeit + Armut nebeneinander
    this.txt(LX, y, 'HOCHZEIT', ORANGE, 14, true);
    this.txt(RX, y, 'ARMUT', ORANGE, 14, true); y += ZA;
    [
      ['Spieler hat beide ♣D', 'Spieler hat ≤ 3 Trümpfe'],
      ['Partner: wer Stich 1–3 gewinnt', 'Tausch verdeckter Karten mit Partner'],
      ['Kein Partner: stilles Solo (×3)', 'Kein Nehmer: Spiel eingeworfen'],
    ].forEach(([links, rechts]) => {
      this.txt(LX, y, links, GRUEN, 13);
      this.txt(RX, y, rechts, GRUEN, 13); y += ZA;
    });
    y += 14;

    this.sep(y, LX, 1200); y += 18;
    this.txt(LX, y, 'SOLI — Solo-Spieler 1 gegen 3, Wertung ×3', GOLD, 14, true); y += 28;

    // 2×2 Raster
    const soli = [
      ['DAME-SOLO', 'Nur ♣♠♥♦D Trumpf (Kreuz > ... > Karo)', ORANGE],
      ['BUBEN-SOLO', 'Nur ♣♠♥♦B Trumpf (Kreuz > ... > Karo)', ORANGE],
      ['TRUMPF-SOLO', 'Normale Trumpfhierarchie, Solo-Spieler allein', ORANGE],
      ['FLEISCHLOS', 'Kein Trumpf, nur Farbbedienung zählt', ORANGE],
    ] as const;

    [[0, 1], [2, 3]].forEach(([li, re]) => {
      this.txt(LX, y, soli[li][0], soli[li][2], 14, true);
      this.txt(RX, y, soli[re][0], soli[re][2], 14, true); y += ZA - 4;
      this.txt(LX, y, soli[li][1], GRUEN, 13);
      this.txt(RX, y, soli[re][1], GRUEN, 13); y += ZA + 10;
    });

    y += 10;
    this.sep(y, LX, 1200); y += 16;
    this.txt(LX, y, 'Punkte bei Solo: Solo-Spieler ×3, jeder Kontra-Spieler ×1', GRUEN, 13);
  }

  private zeigePunkte(): void {
    let y = 150;
    const LX = 80;
    const RX = 660;
    const ZA = 28;

    this.txt(LX, y, 'PUNKTESYSTEM', GOLD, 14, true); y += 24;
    this.sep(y); y += 14;

    this.txt(LX, y, 'GEWINNBEDINGUNG', GOLD, 14, true); y += ZA - 4;
    this.txt(LX, y, 'Re-Partei gewinnt mit ≥ 121 Augen (von 240)', HELL, 13); y += ZA - 6;
    this.txt(LX, y, 'Kontra-Partei gewinnt mit ≥ 120 Augen', HELL, 13); y += ZA + 8;

    this.sep(y, LX, 1200); y += 18;
    this.txt(LX, y, 'SPIELWERT (2-Spalten)', GOLD, 14, true); y += ZA - 4;

    const links = [
      ['Grundpunkt:', '1 Punkt für den Sieg'],
      ['Re angesagt:', 'Spielwert ×2'],
      ['Kontra angesagt:', 'Spielwert nochmals ×2 (= ×4)'],
      ['Keine 90 erreicht:', '+1 Punkt'],
      ['Keine 60 erreicht:', '+1 Punkt'],
    ] as const;

    const rechts = [
      ['Keine 30 erreicht:', '+1 Punkt'],
      ['Schwarz erzielt:', '+1 Punkt'],
      ['Gegen die Alten:', '+1 Punkt'],
      ['Solo:', '×3 für Solo-Spieler'],
      ['', '×1 für jeden Kontra-Spieler'],
    ] as const;

    const startY = y;
    links.forEach(([label, wert]) => {
      this.txt(LX, y, label, ORANGE, 13, true);
      this.txt(LX + 200, y, wert, HELL, 13); y += ZA - 4;
    });
    y = startY;
    rechts.forEach(([label, wert]) => {
      this.txt(RX, y, label, ORANGE, 13, true);
      this.txt(RX + 200, y, wert, HELL, 13); y += ZA - 4;
    });

    y = startY + links.length * (ZA - 4) + 18;
    this.sep(y, LX, 1200); y += 18;
    this.txt(LX, y, 'BEISPIEL', GOLD, 14, true); y += ZA - 4;
    this.txt(LX, y, 'Re + Kontra + Keine-90 → 1 Grundpunkt × 4 + 1 Sonderpunkt = 5 Punkte', GRUEN, 13); y += ZA - 6;
    this.txt(LX, y, 'Kontra-Spieler je +5 Punkte · Re-Spieler je −5 Punkte (Nullsumme)', GRUEN, 13);
  }
}
