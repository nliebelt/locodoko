import type Phaser from 'phaser';

export interface AnimierbareKartenobjekte {
  bild: Phaser.GameObjects.Image;
  beschriftung?: Phaser.GameObjects.Text;
}

export interface Punkt {
  x: number;
  y: number;
}

function istVorhanden<T>(wert: T | undefined): wert is T {
  return wert !== undefined;
}

export class AnimationenService {
  private readonly laufendeTweens = new Set<Phaser.Tweens.Tween>();

  private readonly laufendenTimer = new Set<number>();

  constructor(
    private readonly szene: Phaser.Scene,
    private readonly geschwindigkeitsfaktor = 1
  ) {}

  async animiereKarteAusspielen(
    kartenobjekte: AnimierbareKartenobjekte,
    ziel: Punkt,
    dauer = 400
  ): Promise<void> {
    await this.tweenZu([kartenobjekte.bild, kartenobjekte.beschriftung].filter(istVorhanden), ziel, dauer);
  }

  async animiereKartenAusteilen(
    pakete: Array<{ kartenobjekte: AnimierbareKartenobjekte; ziel: Punkt }>,
    verzoegerungProKarte = 75,
    dauerProKarte = 75
  ): Promise<void> {
    if (pakete.length === 0) {
      return;
    }
    // Karten gestaffelt animieren: jede Karte startet mit leichter Verzoegerung nach der vorherigen
    const animationen = pakete.map(async (paket, index) => {
      await this.warte(index * verzoegerungProKarte);
      await this.tweenZu(
        [paket.kartenobjekte.bild, paket.kartenobjekte.beschriftung].filter(istVorhanden),
        paket.ziel,
        dauerProKarte
      );
    });
    await Promise.all(animationen);
  }

  async animiereStichEinziehen(
    kartenobjekte: AnimierbareKartenobjekte[],
    ziel: Punkt,
    wartezeit = 1000,
    dauer = 600
  ): Promise<void> {
    if (kartenobjekte.length === 0) {
      return;
    }
    await this.warte(wartezeit);
    await this.tweenZu(
      kartenobjekte.flatMap((kartenobjekt) => [kartenobjekt.bild, kartenobjekt.beschriftung].filter(istVorhanden)),
      ziel,
      dauer
    );
  }

  abbrechen(): void {
    this.laufendeTweens.forEach((tween) => tween.stop());
    this.laufendeTweens.clear();
    this.laufendenTimer.forEach((timer) => window.clearTimeout(timer));
    this.laufendenTimer.clear();
  }

  private tweenZu(
    ziele: Phaser.GameObjects.GameObject[],
    ziel: Punkt,
    dauer: number
  ): Promise<void> {
    if (ziele.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const tweenReferenz: { wert?: Phaser.Tweens.Tween } = {};
      let abgeschlossen = false;
      const tween = this.szene.tweens.add({
        targets: ziele,
        x: ziel.x,
        y: ziel.y,
        duration: this.skalierteDauer(dauer),
        ease: 'Cubic.Out',
        onComplete: () => {
          abgeschlossen = true;
          if (tweenReferenz.wert) {
            this.laufendeTweens.delete(tweenReferenz.wert);
          }
          resolve();
        }
      });
      tweenReferenz.wert = tween;
      if (!abgeschlossen) {
        this.laufendeTweens.add(tween);
      }
    });
  }

  private warte(wartezeit: number): Promise<void> {
    const skalierteWartezeit = this.skalierteDauer(wartezeit);
    if (skalierteWartezeit <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.laufendenTimer.delete(timer);
        resolve();
      }, skalierteWartezeit);
      this.laufendenTimer.add(timer);
    });
  }

  private skalierteDauer(dauer: number): number {
    return Math.max(0, Math.round(dauer / Math.max(this.geschwindigkeitsfaktor, 0.01)));
  }
}
