import type Phaser from 'phaser';

export interface AnimierbareKartenobjekte {
  wurzel: Phaser.GameObjects.Container;
  bild?: Phaser.GameObjects.Image;
  beschriftung?: Phaser.GameObjects.Text;
}

export interface Punkt {
  x: number;
  y: number;
}

/**
 * Interne Basis-Klasse: kapselt Phaser-Tween-Primitiven, Timer-Verwaltung und den
 * Geschwindigkeitsfaktor. Wird von KartenAnimationen und SpieleffektAnimationen genutzt.
 */
export class AnimationenPrimitiven {
  constructor(
    readonly szene: Phaser.Scene,
    private readonly laufendeTweens: Set<Phaser.Tweens.Tween>,
    private readonly laufendenTimer: Set<number>,
    public geschwindigkeitsfaktor: number
  ) {}

  // Zentraler Promise-Wrapper für alle Phaser-Tweens.
  // Sicherheits-Timeout: Falls onComplete im Headless-Modus nicht feuert (zerstörtes Target,
  // GPU-Rendering deaktiviert), löst die Promise nach maxDauer*3+2000ms auf.
  animiereTween(
    konfiguration: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'duration' | 'onComplete'> & { duration: number }
  ): Promise<void> {
    // Sofort auflösen wenn skalierte Dauer 0 (z.B. geschwindigkeitsfaktor = Infinity):
    // Phaser-Tweens with duration=0 feuern onComplete nicht zuverlässig im Headless-Modus.
    const skalierteDauer = this.skalierteDauer(konfiguration.duration);
    if (skalierteDauer <= 0) {
      const ziele = Array.isArray(konfiguration.targets) ? konfiguration.targets : [konfiguration.targets];
      ziele.forEach((ziel) => {
        if (!ziel) return;
        if (typeof konfiguration.x === 'number') (ziel as Punkt).x = konfiguration.x;
        if (typeof konfiguration.y === 'number') (ziel as Punkt).y = konfiguration.y;
        if (typeof konfiguration.alpha === 'number') (ziel as { alpha: number }).alpha = konfiguration.alpha;
        if (typeof konfiguration.scaleX === 'number') (ziel as { scaleX: number }).scaleX = konfiguration.scaleX;
        if (typeof konfiguration.scaleY === 'number') (ziel as { scaleY: number }).scaleY = konfiguration.scaleY;
      });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const tweenReferenz: { wert?: Phaser.Tweens.Tween } = {};
      let abgeschlossen = false;
      let sicherheitsTimer: number | undefined;
      const fertig = () => {
        if (abgeschlossen) return;
        abgeschlossen = true;
        if (tweenReferenz.wert) {
          this.laufendeTweens.delete(tweenReferenz.wert);
        }
        if (sicherheitsTimer !== undefined) {
          window.clearTimeout(sicherheitsTimer);
          this.laufendenTimer.delete(sicherheitsTimer);
        }
        resolve();
      };
      // Cast nötig: TypeScript verliert beim Spread die targets-Info aus dem Omit-Typ
      const tweenKonfig: Phaser.Types.Tweens.TweenBuilderConfig = {
        ...(konfiguration as Phaser.Types.Tweens.TweenBuilderConfig),
        duration: skalierteDauer,
        onComplete: fertig
      };
      const tween = this.szene.tweens.add(tweenKonfig);
      tweenReferenz.wert = tween;
      if (!abgeschlossen) {
        this.laufendeTweens.add(tween);
        sicherheitsTimer = window.setTimeout(fertig, skalierteDauer * 3 + 2000);
        this.laufendenTimer.add(sicherheitsTimer);
      }
    });
  }

  tweenAlpha(
    ziel: Phaser.GameObjects.GameObject,
    alpha: number,
    dauer: number
  ): Promise<void> {
    return this.animiereTween({ targets: [ziel], alpha, duration: dauer, ease: 'Linear' });
  }

  tweenZu(
    ziele: Phaser.GameObjects.GameObject[],
    zielPunkt: Punkt,
    dauer: number
  ): Promise<void> {
    if (ziele.length === 0) return Promise.resolve();
    return this.animiereTween({ targets: ziele, x: zielPunkt.x, y: zielPunkt.y, duration: dauer, ease: 'Cubic.Out' });
  }

  tweenScale(
    ziel: Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number },
    skala: number,
    dauer: number
  ): Promise<void> {
    return this.animiereTween({ targets: [ziel], scaleX: skala, scaleY: skala, duration: dauer, ease: 'Cubic.Out' });
  }

  warte(wartezeit: number): Promise<void> {
    const skalierteWartezeit = this.skalierteDauer(wartezeit);
    if (skalierteWartezeit <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.laufendenTimer.delete(timer);
        resolve();
      }, skalierteWartezeit);
      this.laufendenTimer.add(timer);
    });
  }

  skalierteDauer(dauer: number): number {
    return Math.max(0, Math.round(dauer / Math.max(this.geschwindigkeitsfaktor, 0.01)));
  }

  /** Flipper-Zähler: animiert Text-Objekt von 0 auf Zielwert (Flipper/Pinball-Stil). */
  async flipperZaehler(
    obj: Phaser.GameObjects.Text,
    ziel: number,
    prefix: string,
    dauer: number
  ): Promise<void> {
    const skalierteDauer = this.skalierteDauer(dauer);
    if (skalierteDauer <= 0) {
      try { obj.setText(`${prefix}${ziel}`); } catch { /* Objekt bereits zerstört */ }
      return;
    }
    const counter = { val: 0 };
    await new Promise<void>((resolve) => {
      const ref: { tween?: Phaser.Tweens.Tween } = {};
      let fertig = false;
      let sicherheitsTimer: number | undefined;
      const abschliessen = () => {
        if (fertig) return;
        fertig = true;
        if (ref.tween) this.laufendeTweens.delete(ref.tween);
        if (sicherheitsTimer !== undefined) {
          window.clearTimeout(sicherheitsTimer);
          this.laufendenTimer.delete(sicherheitsTimer);
        }
        resolve();
      };
      const tween = this.szene.tweens.add({
        targets: counter,
        val: ziel,
        duration: skalierteDauer,
        ease: 'Cubic.Out',
        onUpdate: () => {
          try { obj.setText(`${prefix}${Math.round(counter.val)}`); } catch { /* Objekt bereits zerstört */ }
        },
        onComplete: abschliessen,
      });
      ref.tween = tween;
      if (!fertig) {
        this.laufendeTweens.add(tween);
        sicherheitsTimer = window.setTimeout(abschliessen, skalierteDauer * 3 + 2000);
        this.laufendenTimer.add(sicherheitsTimer);
      }
    });
  }
}
