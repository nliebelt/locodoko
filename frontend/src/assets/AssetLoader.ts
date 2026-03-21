import type Phaser from 'phaser';

export const TEXTUR_FILZ = 'filz-hintergrund';
export const TEXTUR_HOLZ_DUNKEL = 'holz-dunkel-hintergrund';
export const TEXTUR_BLAU_GRAFIK = 'blau-grafik-hintergrund';
export const TEXTUR_KARTE_OFFEN = 'karte-offen';
export const TEXTUR_KARTE_VERDECKT = 'karte-verdeckt';

export function registriereBasisTexturen(szene: Phaser.Scene): void {
  registriereFilz(szene);
  registriereHolzDunkel(szene);
  registriereBlauGrafik(szene);
  registriereKarteOffen(szene);
  registriereKarteVerdeckt(szene);
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
