import Phaser from 'phaser';
import { erstelleStandardTischAnsicht, type SpielerPosition } from '../model/TischAnsichtModell';

const POSITIONEN: Record<SpielerPosition, { x: number; y: number }> = {
  SUED: { x: 640, y: 620 },
  WEST: { x: 180, y: 360 },
  NORD: { x: 640, y: 120 },
  OST: { x: 1100, y: 360 }
};

export class TischSzene extends Phaser.Scene {
  constructor() {
    super('TischSzene');
  }

  create(): void {
    const modell = erstelleStandardTischAnsicht('Du');

    this.add.rectangle(640, 360, 960, 520, 0x1d6b43, 1).setStrokeStyle(6, 0xd8f3dc);
    this.add.text(640, 40, modell.titel, {
      color: '#f8f9fa',
      fontSize: '32px',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(640, 360, 'Aktueller Stich', {
      color: '#f8f9fa',
      fontSize: '24px'
    }).setOrigin(0.5);

    modell.spieler.forEach((spieler) => {
      const position = POSITIONEN[spieler.position];

      this.add.circle(position.x, position.y, 60, spieler.istMensch ? 0xffe082 : 0xadb5bd, 0.9);
      this.add.text(position.x, position.y - 12, spieler.name, {
        color: '#212529',
        fontSize: '20px',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(position.x, position.y + 18, `${spieler.verbleibendeKarten} Karten · ${spieler.stiche} Stiche`, {
        color: '#212529',
        fontSize: '14px'
      }).setOrigin(0.5);
    });

    for (let index = 0; index < 12; index += 1) {
      this.add.rectangle(360 + index * 28, 640, 90, 132, 0xf8f9fa, 1)
        .setStrokeStyle(2, 0x343a40)
        .setAngle(-12 + index * 2);
    }
  }
}
