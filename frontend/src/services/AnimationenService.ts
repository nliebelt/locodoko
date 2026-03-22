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

  // Globaler Multiplikator fuer alle Animationsdauern: 1 = normal, 2 = doppelt, Infinity = sofort
  private geschwindigkeitsfaktor: number;

  constructor(
    private readonly szene: Phaser.Scene,
    geschwindigkeitsfaktor = 1
  ) {
    this.geschwindigkeitsfaktor = geschwindigkeitsfaktor;
  }

  // Setzt den globalen Geschwindigkeitsmultiplikator; wirkt auf alle nachfolgenden Animationen.
  // 1 = normal, 2 = doppelt schnell, Infinity = sofort (kein Tween, kein Warten).
  setzeGeschwindigkeitsfaktor(faktor: number): void {
    this.geschwindigkeitsfaktor = faktor;
  }

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

  // Blendet ein Banner mit Spielername und Ansagetext in der Mitte der Szene ein (Fade-In),
  // haelt es 1,5 Sekunden sichtbar und blendet es wieder aus (Fade-Out).
  async animiereAnsageBanner(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 1500
  ): Promise<void> {
    const bannerobjekt = this.szene.add
      .text(position.x, position.y, text, {
        fontSize: '40px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setAlpha(0);
    try {
      await this.tweenAlpha(bannerobjekt, 1, 300);
      await this.warte(sichtbarkeitsdauer);
      await this.tweenAlpha(bannerobjekt, 0, 300);
    } finally {
      bannerobjekt.destroy();
    }
  }

  // Zeigt kurzes visuelles Feedback (1-2s) bei einem Sonderpunkt (Fuchs gefangen, Karlchen, Doppelkopf);
  // goldener Text mit Fade-In/Out, nicht blockierend — setzt keine Spielaktion aus.
  async animiereSonderpunktFeedback(
    text: string,
    position: Punkt,
    sichtbarkeitsdauer = 1000
  ): Promise<void> {
    const feedbackobjekt = this.szene.add
      .text(position.x, position.y, text, {
        fontSize: '32px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setAlpha(0);
    try {
      await this.tweenAlpha(feedbackobjekt, 1, 200);
      await this.warte(sichtbarkeitsdauer);
      await this.tweenAlpha(feedbackobjekt, 0, 200);
    } finally {
      feedbackobjekt.destroy();
    }
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

  // Animiert die Transparenz eines Phaser-Objekts auf einen Zielwert (0=unsichtbar, 1=sichtbar)
  private tweenAlpha(
    ziel: Phaser.GameObjects.GameObject,
    alpha: number,
    dauer: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const tweenReferenz: { wert?: Phaser.Tweens.Tween } = {};
      let abgeschlossen = false;
      const tween = this.szene.tweens.add({
        targets: [ziel],
        alpha,
        duration: this.skalierteDauer(dauer),
        ease: 'Linear',
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
