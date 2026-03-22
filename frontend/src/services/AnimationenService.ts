import type Phaser from 'phaser';

/**
 * Phaser-Spielobjekte, die gemeinsam als Karte animiert werden koennen:
 * ein Bild-Sprite und eine optionale Beschriftung.
 */
export interface AnimierbareKartenobjekte {
  bild: Phaser.GameObjects.Image;
  beschriftung?: Phaser.GameObjects.Text;
}

/** Zweidimensionaler Punkt mit x- und y-Koordinate (in Spielpixeln). */
export interface Punkt {
  x: number;
  y: number;
}

function istVorhanden<T>(wert: T | undefined): wert is T {
  return wert !== undefined;
}

/**
 * Verwaltet alle Phaser-Tweens und Timer fuer Kartenanimationen in der TischSzene.
 *
 * Bietet Promise-basierte Animationen fuer Kartenausspielen, Austeilen, Sticheinziehen
 * sowie visuelle Feedback-Banner fuer Ansagen und Sonderpunkte. Alle Animationen
 * beruecksichtigen den konfigurierbaren Geschwindigkeitsfaktor (1x / 2x / sofort).
 *
 * Laufende Tweens und Timer werden intern verwaltet und koennen per `abbrechen()`
 * sofort gestoppt werden (z.B. beim Schliessen der Szene).
 */
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

  /**
   * Setzt den globalen Geschwindigkeitsmultiplikator; wirkt auf alle nachfolgenden Animationen.
   * @param faktor - 1 = normal, 2 = doppelt schnell, Infinity = sofort (kein Tween, kein Warten)
   */
  setzeGeschwindigkeitsfaktor(faktor: number): void {
    this.geschwindigkeitsfaktor = faktor;
  }

  /**
   * Bewegt Karte (Bild + optionale Beschriftung) per Tween zur Zielpositon.
   * @param kartenobjekte - Zu animierende Spielobjekte der Karte
   * @param ziel - Zielposition in Spielpixeln
   * @param dauer - Animationsdauer in Millisekunden (Standard: 400ms)
   */
  async animiereKarteAusspielen(
    kartenobjekte: AnimierbareKartenobjekte,
    ziel: Punkt,
    dauer = 400
  ): Promise<void> {
    await this.tweenZu([kartenobjekte.bild, kartenobjekte.beschriftung].filter(istVorhanden), ziel, dauer);
  }

  /**
   * Teilt Karten gestaffelt aus, indem jede Karte mit leichter Verzoegerung nach der vorherigen animiert wird.
   * Alle Karten-Tweens laufen parallel (Promise.all), aber gestaffelt gestartet.
   * @param pakete - Liste von Karte+Zielposition-Paaren
   * @param verzoegerungProKarte - Startverzoegerung zwischen je zwei Karten in ms (Standard: 75ms)
   * @param dauerProKarte - Tween-Dauer pro Karte in ms (Standard: 75ms)
   */
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

  /**
   * Blendet ein Banner mit weissem Text in der Mitte der Szene ein (Fade-In),
   * haelt es sichtbar und blendet es wieder aus (Fade-Out). Wird fuer Ansagen verwendet.
   * @param text - Anzeigetext des Banners (z.B. "Re" oder "Kontra")
   * @param position - Anzeigeposition in Spielpixeln
   * @param sichtbarkeitsdauer - Haltezeit in ms nach Fade-In (Standard: 1500ms)
   */
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

  /**
   * Zeigt kurzes visuelles Feedback (goldener Text) bei einem Sonderpunkt
   * (Fuchs gefangen, Karlchen, Doppelkopf). Nicht blockierend — setzt keine Spielaktion aus.
   * @param text - Anzeige-Label des Sonderpunkts (z.B. "Fuchs gefangen")
   * @param position - Anzeigeposition in Spielpixeln
   * @param sichtbarkeitsdauer - Haltezeit in ms (Standard: 1000ms)
   */
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

  /**
   * Zieht alle Karten eines abgeschlossenen Stichs zur Gewinner-Position ein.
   * Wartet zuerst eine konfigurierbare Zeit, damit Spieler den Stich sehen koennen.
   * @param kartenobjekte - Alle vier Kartenobjekte des Stichs
   * @param ziel - Zielposition des Stichwinklers (Spielerposition)
   * @param wartezeit - Wartezeit vor dem Einziehen in ms (Standard: 1000ms)
   * @param dauer - Tween-Dauer in ms (Standard: 600ms)
   */
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

  /**
   * Stoppt alle laufenden Tweens und Timer sofort.
   * Wird beim Herunterfahren der Szene aufgerufen, um Memory-Leaks zu verhindern.
   */
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
