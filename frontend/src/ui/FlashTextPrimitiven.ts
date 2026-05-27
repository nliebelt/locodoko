import type Phaser from 'phaser';

/** Skaliert eine Dauer auf den aktuellen Geschwindigkeitsfaktor. */
export function skalierteDauer(dauer: number, faktor: number): number {
  return Math.max(0, Math.round(dauer / faktor));
}

/** Prüft ob ein Phaser-GameObject noch aktiv ist. */
export function istAktiv(obj: Phaser.GameObjects.GameObject): boolean {
  return (obj as unknown as { active: boolean }).active;
}

export function konfetti(
  szene: Phaser.Scene,
  faktor: number,
  x: number,
  y: number,
  menge: number,
  farben = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833],
): void {
  if (!szene.textures.exists('pixel')) return;
  const emitter = szene.add.particles(x, y, 'pixel', {
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: 360 },
    gravityY: 300,
    lifespan: skalierteDauer(1200, faktor),
    tint: farben,
    scale: { start: 4, end: 2 },
    quantity: 0,
    alpha: { start: 1, end: 0 },
  });
  emitter.setDepth(52);
  emitter.explode(menge);
  szene.time.delayedCall(skalierteDauer(1400, faktor), () => emitter.destroy());
}

export function shockwaveRing(
  szene: Phaser.Scene,
  faktor: number,
  x: number,
  y: number,
  farbe: number,
  verzoegerung = 0,
): void {
  const skalierteVerz = skalierteDauer(verzoegerung, faktor);
  const ring = szene.add.circle(x, y, 30, 0, 0);
  ring.setStrokeStyle(4, farbe, 1);
  ring.setDepth(51);
  szene.time.delayedCall(skalierteVerz, () => {
    szene.tweens.add({
      targets: ring, scaleX: 5, scaleY: 5, alpha: 0, ease: 'Sine.Out',
      duration: skalierteDauer(550, faktor),
      onComplete: () => ring.destroy(),
    });
  });
}

export function screenShake(szene: Phaser.Scene, faktor: number): void {
  if (faktor > 10) return;
  szene.cameras.main.shake(350, 0.007);
}

export function cameraFlash(
  szene: Phaser.Scene, faktor: number,
  r: number, g: number, b: number, dauer: number,
): void {
  if (faktor > 10) return;
  szene.cameras.main.flash(skalierteDauer(dauer, faktor), r, g, b);
}

export function foilShimmer(
  szene: Phaser.Scene,
  faktor: number,
  text: Phaser.GameObjects.Text,
  timers: Phaser.Time.TimerEvent[],
): Phaser.Time.TimerEvent {
  const farben = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0x44aaff];
  let ci = 0;
  const timer = szene.time.addEvent({
    delay: skalierteDauer(80, faktor),
    repeat: -1,
    callback: () => { if (istAktiv(text)) text.setTint(farben[ci++ % farben.length]); },
  });
  timers.push(timer);
  return timer;
}

export async function verwalteMitTimeout(
  szene: Phaser.Scene,
  faktor: number,
  obj: Phaser.GameObjects.GameObject,
  ms: number,
  objekte: Phaser.GameObjects.GameObject[],
  timers: Phaser.Time.TimerEvent[],
): Promise<void> {
  const skalierteMs = skalierteDauer(ms, faktor);
  if (skalierteMs <= 0) {
    if (istAktiv(obj)) (obj as unknown as { destroy: (children?: boolean) => void }).destroy(true);
    return Promise.resolve();
  }
  objekte.push(obj);
  return new Promise((resolve) => {
    let resolved = false;
    const complete = () => {
      if (resolved) return;
      resolved = true;
      if (istAktiv(obj)) (obj as unknown as { destroy: (children?: boolean) => void }).destroy(true);
      resolve();
    };
    const fadeDauer = skalierteDauer(200, faktor);
    const timer = szene.time.delayedCall(skalierteMs, () => {
      if (!istAktiv(obj)) { complete(); return; }
      szene.tweens.add({ targets: obj, alpha: 0, duration: fadeDauer, onComplete: complete });
      const idx = objekte.indexOf(obj);
      if (idx !== -1) objekte.splice(idx, 1);
    });
    timers.push(timer);
    window.setTimeout(complete, skalierteMs + fadeDauer + 1000);
  });
}

export async function verwalteMitFoilTimeout(
  szene: Phaser.Scene,
  faktor: number,
  obj: Phaser.GameObjects.Container,
  foilTimer: Phaser.Time.TimerEvent,
  wartezeitMs: number,
  fadeDauerMs: number,
  objekte: Phaser.GameObjects.GameObject[],
  timers: Phaser.Time.TimerEvent[],
): Promise<void> {
  const skalierteWartezeit = skalierteDauer(wartezeitMs, faktor);
  const fadeDauer = skalierteDauer(fadeDauerMs, faktor);
  if (skalierteWartezeit <= 0) {
    foilTimer.remove(false);
    if (istAktiv(obj)) obj.destroy(true);
    return Promise.resolve();
  }
  objekte.push(obj);
  return new Promise((resolve) => {
    let resolved = false;
    const complete = () => {
      if (resolved) return;
      resolved = true;
      foilTimer.remove(false);
      if (istAktiv(obj)) obj.destroy(true);
      resolve();
    };
    const destroyTimer = szene.time.delayedCall(skalierteWartezeit, () => {
      szene.tweens.add({ targets: obj, alpha: 0, duration: fadeDauer, onComplete: complete });
    });
    timers.push(destroyTimer);
    window.setTimeout(complete, skalierteWartezeit + fadeDauer + 1000);
  });
}
