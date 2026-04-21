import Phaser from 'phaser';

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
    const { text, typ, dauer = 3000 } = optionen;
    const breite = this.scene.scale.gameSize.width;

    const container = this.scene.add.container(breite / 2, -100);
    container.setDepth(2000); // Sehr weit oben

    const bgFarbe = typ === 'fehler' ? 0xff4444 : 0x444444;
    const hintergrund = this.scene.add.rectangle(0, 0, 400, 60, bgFarbe, 0.9);
    hintergrund.setStrokeStyle(2, 0xffffff, 1);

    const textObj = this.scene.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: 380 }
    });
    textObj.setOrigin(0.5);

    container.add([hintergrund, textObj]);
    this.toasts.push(container);

    // Animation: Einfliegen und Ausblenden
    this.ordneToastsAn();

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

  private ordneToastsAn(): void {
    const abstand = 70;
    const startY = 50;

    this.toasts.forEach((toast, index) => {
      this.scene.tweens.add({
        targets: toast,
        y: startY + (index * abstand),
        duration: 300,
        ease: 'Power2'
      });
    });
  }
}
