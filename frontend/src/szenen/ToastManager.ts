import type Phaser from 'phaser';

export interface ToastOptionen {
  text: string;
  typ: 'info' | 'fehler';
  dauer?: number;
}

/**
 * Verwaltet flüchtige Benachrichtigungen (Toasts) direkt in der Phaser-Szene.
 */
export class ToastManager {
  private toasts: Phaser.GameObjects.Container[] = [];

  constructor(private scene: Phaser.Scene) {}

  zeige(optionen: ToastOptionen): void {
    const { text, typ, dauer = 4000 } = optionen;
    const breite = this.scene.scale.gameSize.width;
    const toastBreite = 400;
    const rechterRand = 16;

    // Oben rechts: rechte Kante mit 16px Abstand zum Rand
    const startX = breite - rechterRand - toastBreite / 2;
    const container = this.scene.add.container(startX, -100);
    container.setDepth(2000); // Sehr weit oben

    const bgFarbe = typ === 'fehler' ? 0xff4444 : 0x444444;
    const hintergrund = this.scene.add.rectangle(0, 0, toastBreite, 60, bgFarbe, 0.9);
    hintergrund.setStrokeStyle(2, 0xffffff, 1);

    const textObj = this.scene.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: '"Space Grotesk", Arial, sans-serif',
      align: 'center',
      wordWrap: { width: toastBreite - 20 }
    });
    textObj.setOrigin(0.5);

    container.add([hintergrund, textObj]);
    this.toasts.push(container);

    // Animation: Einfliegen und Ausblenden
    this.ordneToastsAn(breite);

    this.scene.time.delayedCall(dauer, () => {
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.toasts = this.toasts.filter(t => t !== container);
          container.destroy();
          this.ordneToastsAn();
        }
      });
    });
  }

  private ordneToastsAn(breite?: number): void {
    const abstand = 70;
    const startY = 50;
    const aktuelleBreite = breite ?? this.scene.scale.gameSize.width;
    const toastBreite = 400;
    const rechterRand = 16;
    const targetX = aktuelleBreite - rechterRand - toastBreite / 2;

    this.toasts.forEach((toast, index) => {
      this.scene.tweens.add({
        targets: toast,
        x: targetX,
        y: startY + (index * abstand),
        duration: 300,
        ease: 'Power2'
      });
    });
  }
}
