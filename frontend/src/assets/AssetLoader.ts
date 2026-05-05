import type Phaser from 'phaser';

export const TEXTUR_FILZ = 'filz-hintergrund';
export const TEXTUR_HOLZ_DUNKEL = 'holz-dunkel-hintergrund';
export const TEXTUR_BLAU_GRAFIK = 'blau-grafik-hintergrund';
export const TEXTUR_BILD_RECHTECK_1 = 'hintergrund-rechteck-1';
export const TEXTUR_BILD_RECHTECK_2 = 'hintergrund-rechteck-2';
export const TEXTUR_BILD_OVAL_1 = 'hintergrund-oval-1';
export const TEXTUR_BILD_OVAL_2 = 'hintergrund-oval-2';
export const TEXTUR_BILD_RUND_1 = 'hintergrund-rund-1';
export const TEXTUR_KARTE_OFFEN = 'karte-offen';
export const TEXTUR_KARTE_VERDECKT = 'karte-verdeckt';
export const TEXTUR_KARTE_RUECKSEITE = 'card_back';
export const TEXTUR_PIXEL = 'pixel';

/**
 * Mapping von Doppelkopf-Farbbezeichnungen auf englische PNG-Dateinamen-Bestandteile.
 * Entspricht den heruntergeladenen vectorized-playing-cards in /public/assets/cards/.
 */
const FARBEN_MAPPING: Record<string, string> = {
  KREUZ: 'clubs',
  PIK: 'spades',
  HERZ: 'hearts',
  KARO: 'diamonds'
};

/** Mapping von Doppelkopf-Wertbezeichnungen auf englische PNG-Dateinamen-Bestandteile. */
const WERT_MAPPING: Record<string, string> = {
  AS: 'ace',
  ZEHN: '10',
  KOENIG: 'king',
  DAME: 'queen',
  BUBE: 'jack',
  NEUN: '9'
};

/**
 * Erzeugt den Dateinamen fuer eine Karte gemaess der Konvention {wert}_{farbe}.png.
 * Beispiel: karteZuDateiname('KREUZ', 'AS') → 'ace_clubs.png'
 */
export function karteZuDateiname(farbe: string, wert: string): string {
  const englischFarbe = FARBEN_MAPPING[farbe] ?? farbe.toLowerCase();
  const englischWert = WERT_MAPPING[wert] ?? wert.toLowerCase();
  return `${englischWert}_${englischFarbe}.png`;
}

export function texturSchluesselFuerKarte(farbe: string, wert: string): string {
  return `karte-offen-${farbe.toUpperCase()}-${wert.toUpperCase()}`;
}

export function istBildHintergrund(bg: string): boolean {
  return /^(RECHTECK|OVAL|RUND)_\d+$/.test(bg);
}

/**
 * Laedt alle 24 Karten-PNG-Dateien in den Phaser-Preloader.
 * Muss in der preload()-Methode der Szene aufgerufen werden, bevor create() laeuft.
 * Wenn eine PNG-Datei nicht gefunden wird, faellt registriereKartenSpriteTexturen() auf
 * prozedurale Generierung zurueck (idempotent durch textures.exists()-Pruefung).
 * PNG-Pfad: /assets/cards/{wert}_{farbe}.png (aus /public/assets/cards/).
 */
export function ladeKartenBilderVorab(szene: Phaser.Scene): void {
  const farben = ['KREUZ', 'PIK', 'HERZ', 'KARO'];
  const werte = ['AS', 'ZEHN', 'KOENIG', 'DAME', 'BUBE', 'NEUN'];
  for (const farbe of farben) {
    for (const wert of werte) {
      const schluessel = texturSchluesselFuerKarte(farbe, wert);
      if (!szene.textures.exists(schluessel)) {
        const dateiname = karteZuDateiname(farbe, wert);
        szene.load.image(schluessel, `/assets/cards/${dateiname}`);
      }
    }
  }
  // Kartenrücken als separates JPG laden
  if (!szene.textures.exists(TEXTUR_KARTE_RUECKSEITE)) {
    szene.load.image(TEXTUR_KARTE_RUECKSEITE, '/assets/cards/card_back3.png');
  }
}

/**
 * Laedt alle 5 Foto-Hintergrundbilder aus /assets/backgrounds/ in den Phaser-Preloader.
 * Muss in der preload()-Methode der Szene aufgerufen werden.
 */
export function ladeHintergrundbilder(szene: Phaser.Scene): void {
  const bilder: [string, string][] = [
    [TEXTUR_BILD_RECHTECK_1, 'background_rectangle1.png'],
    [TEXTUR_BILD_RECHTECK_2, 'background_rectangle2.png'],
    [TEXTUR_BILD_OVAL_1, 'background_oval1.png'],
    [TEXTUR_BILD_OVAL_2, 'background_oval2.png'],
    [TEXTUR_BILD_RUND_1, 'background_round1.png'],
  ];
  for (const [schluessel, dateiname] of bilder) {
    if (!szene.textures.exists(schluessel)) {
      szene.load.image(schluessel, `/assets/backgrounds/${dateiname}`);
    }
  }
}

export function registriereBasisTexturen(szene: Phaser.Scene): void {
  registriereFilz(szene);
  registriereHolzDunkel(szene);
  registriereBlauGrafik(szene);
  registriereKarteOffen(szene);
  registriereKarteVerdeckt(szene);
  registrierePixelTextur(szene);
}

export function registrierePixelTextur(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_PIXEL)) return;
  const g = szene.add.graphics();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture(TEXTUR_PIXEL, 4, 4);
  g.destroy();
}

/**
 * Erzeugt fuer alle 24 Karten des Doppelkopf-Decks je eine individuelle Textur
 * mit Farbsymbol und Wertkuerzel im Stil eines franzoesischen Blattes.
 * Wird idempotent aufgerufen (existierende Texturen werden uebersprungen).
 */
export function registriereKartenSpriteTexturen(szene: Phaser.Scene): void {
  const farben = ['KREUZ', 'PIK', 'HERZ', 'KARO'];
  const werte = ['AS', 'ZEHN', 'KOENIG', 'DAME', 'BUBE', 'NEUN'];
  for (const farbe of farben) {
    for (const wert of werte) {
      erzeugeKartenTextur(szene, farbe, wert);
    }
  }
}

function registriereFilz(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_FILZ)) {
    return;
  }

  const grafik = szene.add.graphics({ x: 0, y: 0 });
  grafik.fillStyle(0x0b3d24, 1);
  grafik.fillRect(0, 0, 256, 256);
  grafik.fillStyle(0x14532d, 0.18);
  for (let x = 0; x < 256; x += 16) {
    grafik.fillRect(x, 0, 8, 256);
  }
  grafik.generateTexture(TEXTUR_FILZ, 256, 256);
  grafik.destroy();
}

function registriereHolzDunkel(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_HOLZ_DUNKEL)) {
    return;
  }

  const grafik = szene.add.graphics({ x: 0, y: 0 });
  grafik.fillStyle(0x4e342e, 1);
  grafik.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 22) {
    grafik.fillStyle(y % 44 === 0 ? 0x6d4c41 : 0x5d4037, 0.32);
    grafik.fillRect(0, y, 256, 12);
  }
  for (let x = 12; x < 256; x += 36) {
    grafik.lineStyle(3, 0x3e2723, 0.25);
    grafik.lineBetween(x, 0, x - 18, 256);
  }
  grafik.generateTexture(TEXTUR_HOLZ_DUNKEL, 256, 256);
  grafik.destroy();
}

function registriereBlauGrafik(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_BLAU_GRAFIK)) {
    return;
  }

  const grafik = szene.add.graphics({ x: 0, y: 0 });
  grafik.fillStyle(0x10304a, 1);
  grafik.fillRect(0, 0, 256, 256);
  grafik.lineStyle(2, 0x90caf9, 0.22);
  for (let index = 0; index < 256; index += 18) {
    grafik.lineBetween(index, 0, 256, index);
    grafik.lineBetween(0, index, index, 256);
  }
  grafik.fillStyle(0x1976d2, 0.16);
  for (let x = 28; x < 256; x += 56) {
    for (let y = 28; y < 256; y += 56) {
      grafik.fillCircle(x, y, 10);
    }
  }
  grafik.generateTexture(TEXTUR_BLAU_GRAFIK, 256, 256);
  grafik.destroy();
}

function registriereKarteOffen(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_KARTE_OFFEN)) {
    return;
  }

  const grafik = szene.add.graphics({ x: 0, y: 0 });
  grafik.fillStyle(0xf8f9fa, 1);
  grafik.fillRoundedRect(0, 0, 96, 144, 14);
  grafik.lineStyle(4, 0xced4da, 1);
  grafik.strokeRoundedRect(2, 2, 92, 140, 12);
  grafik.fillStyle(0x0f5132, 0.08);
  grafik.fillRoundedRect(10, 10, 76, 124, 10);
  grafik.generateTexture(TEXTUR_KARTE_OFFEN, 96, 144);
  grafik.destroy();
}

function registriereKarteVerdeckt(szene: Phaser.Scene): void {
  if (szene.textures.exists(TEXTUR_KARTE_VERDECKT)) {
    return;
  }

  const grafik = szene.add.graphics({ x: 0, y: 0 });
  grafik.fillStyle(0x123524, 1);
  grafik.fillRoundedRect(0, 0, 96, 144, 14);
  grafik.lineStyle(4, 0xd8f3dc, 1);
  grafik.strokeRoundedRect(2, 2, 92, 140, 12);
  grafik.lineStyle(2, 0xd8f3dc, 0.55);
  for (let index = -40; index < 150; index += 14) {
    grafik.lineBetween(index, 0, index + 110, 144);
    grafik.lineBetween(0, index, 96, index + 96);
  }
  grafik.generateTexture(TEXTUR_KARTE_VERDECKT, 96, 144);
  grafik.destroy();
}

/**
 * Erzeugt eine realistische Spielkarten-Textur mit HTML Canvas 2D.
 * Das Ergebnis zeigt Farbsymbol (♣ ♠ ♥ ♦) und Wertkuerzel (A/10/K/D/B/9)
 * in den Ecken sowie ein grosses Symbol in der Mitte — wie ein franzoesisches Blatt.
 */
function erzeugeKartenTextur(szene: Phaser.Scene, farbe: string, wert: string): void {
  const schluessel = texturSchluesselFuerKarte(farbe, wert);
  if (szene.textures.exists(schluessel)) {
    return;
  }

  const BREITE = 96;
  const HOEHE = 144;
  const canvas = document.createElement('canvas');
  canvas.width = BREITE;
  canvas.height = HOEHE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const istRot = farbe === 'HERZ' || farbe === 'KARO';
  // Schwarz fuer Kreuz/Pik, Rot fuer Herz/Karo
  const farbwert = istRot ? '#c0392b' : '#1a1a1a';
  const symbole: Record<string, string> = { KREUZ: '\u2663', PIK: '\u2660', HERZ: '\u2665', KARO: '\u2666' };
  const kuerzel: Record<string, string> = { AS: 'A', ZEHN: '10', KOENIG: 'K', DAME: 'D', BUBE: 'B', NEUN: '9' };
  const symbol = symbole[farbe] ?? '?';
  const wertText = kuerzel[wert] ?? wert.slice(0, 2);

  // Weißer Kartenuntergrund mit abgerundeten Ecken
  ctx.fillStyle = 'white';
  kartenRundRect(ctx, 0, 0, BREITE, HOEHE, 8);
  ctx.fill();

  // Grauer Rahmen
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1.5;
  kartenRundRect(ctx, 0.75, 0.75, BREITE - 1.5, HOEHE - 1.5, 7.5);
  ctx.stroke();

  ctx.fillStyle = farbwert;

  // Wert oben links
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(wertText, 6, 5);

  // Farbsymbol unter dem Wert oben links
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(symbol, 6, 22);

  // Grosses Farbsymbol in der Kartenmitte
  ctx.font = '44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, BREITE / 2, HOEHE / 2);

  // Wert und Symbol unten rechts (um 180 Grad gedreht — klassisches Blatt)
  ctx.save();
  ctx.translate(BREITE, HOEHE);
  ctx.rotate(Math.PI);
  ctx.fillStyle = farbwert;
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(wertText, 6, 5);
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText(symbol, 6, 22);
  ctx.restore();

  // Canvas als Phaser-Textur registrieren
  szene.textures.addCanvas(schluessel, canvas);
}

// Zeichnet ein abgerundetes Rechteck auf den 2D-Kontext (Pfad, nicht gestrichen/gefuellt).
function kartenRundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
