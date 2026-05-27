import type Phaser from 'phaser';
import { CARD_BG_DARK } from './designTokens';

export function cx(szene: Phaser.Scene): number {
  return szene.scale.gameSize.width / 2;
}

export function cy(szene: Phaser.Scene): number {
  return szene.scale.gameSize.height / 2;
}

/** Erstellt einen Karten-Container mit gerundeten Ecken und farbigem Rand. */
export function erstelleKartenContainer(
  szene: Phaser.Scene,
  x: number,
  y: number,
  randfarbe: number,
  breite = 240,
  hoehe = 90,
): Phaser.GameObjects.Container {
  const container = szene.add.container(x, y);
  container.setDepth(50);
  const bg = szene.add.graphics();
  bg.fillStyle(CARD_BG_DARK, 0.95);
  bg.fillRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 8);
  bg.lineStyle(3, randfarbe, 1);
  bg.strokeRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 8);
  container.add(bg);
  return container;
}
