import type Phaser from 'phaser';

export const TEXTUR_FILZ = 'filz-hintergrund';
export const TEXTUR_KARTE_OFFEN = 'karte-offen';
export const TEXTUR_KARTE_VERDECKT = 'karte-verdeckt';

export function registriereBasisTexturen(szene: Phaser.Scene): void {
  registriereFilz(szene);
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
