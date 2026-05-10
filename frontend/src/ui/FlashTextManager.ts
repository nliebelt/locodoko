import type Phaser from 'phaser';
import {
  FARBE_CYAN, FARBE_CYAN_CSS,
  FARBE_BLAU, FARBE_BLAU_CSS,
  FARBE_GRUEN, FARBE_GRUEN_CSS,
  FARBE_PINK, FARBE_PINK_CSS,
  FARBE_ORANGE, FARBE_ORANGE_CSS,
  FARBE_GOLD, FARBE_GOLD_CSS,
  CARD_BG_DARK,
  TEXT_GEDAEMPFT_CSS,
  FONT_FAMILY_FALLBACK,
  FONT_XS, FONT_SM, FONT_MD, FONT_LG, FONT_XL,
} from './designTokens';

export type SpieleventTyp =
  | 'SpielGestartet'
  | 'NaechsterSpielerErwartet'
  | 'VorbehaltErwartet'
  | 'StichAbgeschlossen'
  | 'SchweinchenGemeldet'
  | 'FuchsGefangen'
  | 'KarlchenGespielt'
  | 'DoppelkopfGestochen'
  | 'HochzeitPartnerGefunden'
  | 'SpielBeendet';

export interface SpieleventPayload {
  spielerName?: string;
  punkte?: number;
  x?: number;
  y?: number;
}

export class FlashTextManager {
  private readonly szene: Phaser.Scene;
  private readonly verwalteteObjekte: Phaser.GameObjects.GameObject[] = [];
  private readonly verwalteteTimers: Phaser.Time.TimerEvent[] = [];
  private vorbehaltContainer?: Phaser.GameObjects.Container;
  private vorbehaltBlinkTween?: Phaser.Tweens.Tween;

  private geschwindigkeitsfaktor = 1;

  constructor(szene: Phaser.Scene) {
    this.szene = szene;
  }

  setzeGeschwindigkeitsfaktor(faktor: number): void {
    this.geschwindigkeitsfaktor = Math.max(0.01, faktor);
  }

  private skalierteDauer(dauer: number): number {
    return Math.max(0, Math.round(dauer / this.geschwindigkeitsfaktor));
  }

  async zeigeSpielevent(event: SpieleventTyp, payload: SpieleventPayload = {}): Promise<void> {
    switch (event) {
      case 'SpielGestartet':            await this.spielGestartet(); break;
      case 'NaechsterSpielerErwartet':  await this.naechsterSpielerErwartet(payload.spielerName ?? ''); break;
      case 'VorbehaltErwartet':         await this.vorbehaltErwartet(); break;
      case 'StichAbgeschlossen':        await this.stichAbgeschlossen(payload.punkte ?? 1, payload.x, payload.y); break;
      case 'SchweinchenGemeldet':       await this.schweinchenGemeldet(payload.spielerName, payload.x, payload.y); break;
      case 'FuchsGefangen':             await this.fuchsGefangen(payload.spielerName, payload.x, payload.y); break;
      case 'KarlchenGespielt':          await this.karlchenGespielt(payload.spielerName, payload.x, payload.y); break;
      case 'DoppelkopfGestochen':       await this.doppelkopfGestochen(payload.x, payload.y); break;
      case 'HochzeitPartnerGefunden':   await this.hochzeitPartnerGefunden(payload.spielerName, payload.x, payload.y); break;
      case 'SpielBeendet':              await this.spielBeendet(); break;
    }
  }

  stoppeVorbehaltAnimation(): void {
    this.vorbehaltBlinkTween?.stop();
    this.vorbehaltBlinkTween = undefined;
    if (this.vorbehaltContainer?.active) {
      this.szene.tweens.killTweensOf(this.vorbehaltContainer);
      this.vorbehaltContainer.destroy(true);
    }
    this.vorbehaltContainer = undefined;
  }

  destroy(): void {
    this.stoppeVorbehaltAnimation();
    for (const obj of this.verwalteteObjekte) {
      if ((obj as unknown as { active: boolean }).active) {
        this.szene.tweens.killTweensOf(obj);
        (obj as unknown as { destroy: () => void }).destroy();
      }
    }
    this.verwalteteObjekte.length = 0;
    for (const timer of this.verwalteteTimers) {
      if (timer) timer.remove(false);
    }
    this.verwalteteTimers.length = 0;
  }

  // ── Hilfsmethoden ──

  private cx(): number { return this.szene.scale.gameSize.width / 2; }
  private cy(): number { return this.szene.scale.gameSize.height / 2; }

  private erstelleKartenContainer(x: number, y: number, randfarbe: number, breite = 240, hoehe = 90): Phaser.GameObjects.Container {
    const container = this.szene.add.container(x, y);
    container.setDepth(50);
    const bg = this.szene.add.graphics();
    bg.fillStyle(CARD_BG_DARK, 0.95);
    bg.fillRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 8);
    bg.lineStyle(3, randfarbe, 1);
    bg.strokeRoundedRect(-breite / 2, -hoehe / 2, breite, hoehe, 8);
    container.add(bg);
    return container;
  }

  private async verwalteMitTimeout(obj: Phaser.GameObjects.GameObject, ms: number): Promise<void> {
    const skalierteMs = this.skalierteDauer(ms);
    if (skalierteMs <= 0) {
      if ((obj as unknown as { active: boolean }).active) {
        (obj as unknown as { destroy: (children?: boolean) => void }).destroy(true);
      }
      return Promise.resolve();
    }

    this.verwalteteObjekte.push(obj);
    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        if ((obj as unknown as { active: boolean }).active) {
          (obj as unknown as { destroy: (children?: boolean) => void }).destroy(true);
        }
        resolve();
      };
      
      const fadeDauer = this.skalierteDauer(200);
      const timer = this.szene.time.delayedCall(skalierteMs, () => {
        if (!(obj as unknown as { active: boolean }).active) {
          complete();
          return;
        }
        this.szene.tweens.add({
          targets: obj,
          alpha: 0,
          duration: fadeDauer,
          onComplete: complete,
        });
        const idx = this.verwalteteObjekte.indexOf(obj);
        if (idx !== -1) this.verwalteteObjekte.splice(idx, 1);
      });
      this.verwalteteTimers.push(timer);
      
      // Fallback-Timeout unabhaengig vom Phaser-Game-Loop
      window.setTimeout(complete, skalierteMs + fadeDauer + 1000);
    });
  }

  konfetti(x: number, y: number, menge: number, farben = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833]): void {
    if (!this.szene.textures.exists('pixel')) return;
    const emitter = this.szene.add.particles(x, y, 'pixel', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      gravityY: 300,
      lifespan: this.skalierteDauer(1200),
      tint: farben,
      scale: { start: 4, end: 2 },
      quantity: 0,
      alpha: { start: 1, end: 0 },
    });
    emitter.setDepth(52);
    emitter.explode(menge);
    this.szene.time.delayedCall(this.skalierteDauer(1400), () => emitter.destroy());
  }

  shockwaveRing(x: number, y: number, farbe: number, verzoegerung = 0): void {
    const skalierteVerz = this.skalierteDauer(verzoegerung);
    const ring = this.szene.add.circle(x, y, 30, 0, 0);
    ring.setStrokeStyle(4, farbe, 1);
    ring.setDepth(51);
    this.szene.time.delayedCall(skalierteVerz, () => {
      this.szene.tweens.add({
        targets: ring,
        scaleX: 5,
        scaleY: 5,
        alpha: 0,
        ease: 'Sine.Out',
        duration: this.skalierteDauer(550),
        onComplete: () => ring.destroy(),
      });
    });
  }

  screenShake(): void {
    if (this.geschwindigkeitsfaktor > 10) return; // Kein Shake im Turbo-Modus
    this.szene.cameras.main.shake(350, 0.007);
  }

  cameraFlash(r: number, g: number, b: number, dauer: number): void {
    if (this.geschwindigkeitsfaktor > 10) return; // Kein Flash im Turbo-Modus
    this.szene.cameras.main.flash(this.skalierteDauer(dauer), r, g, b);
  }

  private foilShimmer(text: Phaser.GameObjects.Text): Phaser.Time.TimerEvent {
    const farben = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0x44aaff];
    let ci = 0;
    const timer = this.szene.time.addEvent({
      delay: this.skalierteDauer(80),
      repeat: -1,
      callback: () => {
        if ((text as unknown as { active: boolean }).active) text.setTint(farben[ci++ % farben.length]);
      },
    });
    this.verwalteteTimers.push(timer);
    return timer;
  }

  // ── 9 Events ──

  private async spielGestartet(): Promise<void> {
    const container = this.erstelleKartenContainer(this.cx(), this.cy(), FARBE_CYAN, 260, 105);
    const t1 = this.szene.add.text(0, -28, 'SPIEL', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_CYAN_CSS,
    }).setOrigin(0.5);
    const t2 = this.szene.add.text(0, -2, 'STARTET', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_MD}px`, color: FARBE_CYAN_CSS,
    }).setOrigin(0.5);
    const t3 = this.szene.add.text(0, 34, 'TISCH BEREIT', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
    }).setOrigin(0.5);
    container.add([t1, t2, t3]);
    container.setScale(0, 1);
    this.szene.tweens.add({ targets: container, scaleX: 1, ease: 'Back.Out', duration: this.skalierteDauer(380) });
    await this.verwalteMitTimeout(container, 2500);
  }

  private async naechsterSpielerErwartet(spielerName: string): Promise<void> {
    const container = this.erstelleKartenContainer(this.cx(), this.cy() * 0.38, FARBE_BLAU, 270, 80);
    const t1 = this.szene.add.text(0, -15, 'AM ZUG', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
    }).setOrigin(0.5);
    const t2 = this.szene.add.text(0, 12, spielerName.toUpperCase().slice(0, 18), {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_SM}px`, color: FARBE_BLAU_CSS,
    }).setOrigin(0.5);
    container.add([t1, t2]);
    container.setScale(0.05, 1);
    this.szene.tweens.add({
      targets: container,
      scaleX: [0.05, 1.22, 0.92, 1.06, 1],
      ease: 'Back.Out',
      duration: this.skalierteDauer(400),
    });
    await this.verwalteMitTimeout(container, 2000);
  }

  private async vorbehaltErwartet(): Promise<void> {
    this.stoppeVorbehaltAnimation();
    const container = this.erstelleKartenContainer(this.cx(), this.cy() * 0.35, FARBE_BLAU, 280, 82);
    const t1 = this.szene.add.text(0, -12, 'VORBEHALT?', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_SM}px`, color: FARBE_BLAU_CSS,
      stroke: '#005599', strokeThickness: 3,
    }).setOrigin(0.5);
    const t2 = this.szene.add.text(0, 18, 'SPIELER AM ZUG', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
    }).setOrigin(0.5);
    container.add([t1, t2]);
    container.setScale(0.7, 1);
    container.setAlpha(0);
    this.szene.tweens.add({ targets: container, scaleX: 1, alpha: 1, duration: this.skalierteDauer(450), ease: 'Sine.Out' });
    this.vorbehaltBlinkTween = this.szene.tweens.add({
      targets: t1, alpha: { from: 1, to: 0.5 }, yoyo: true, repeat: -1, duration: this.skalierteDauer(650),
      ease: 'Sine.InOut', delay: this.skalierteDauer(500),
    });
    this.vorbehaltContainer = container;
    return Promise.resolve();
  }

  private async stichAbgeschlossen(punkte: number, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx();
    const posY = y ?? this.cy() + 20;
    const text = this.szene.add.text(posX, posY, `+${punkte}`, {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XL}px`, color: FARBE_GRUEN_CSS,
      stroke: '#006633', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(51).setAlpha(0).setScale(0.6);
    
    const skalierteDauerMain = this.skalierteDauer(360);
    if (skalierteDauerMain <= 0) {
      if ((text as unknown as { active: boolean }).active) text.destroy();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        if ((text as unknown as { active: boolean }).active) text.destroy();
        resolve();
      };
      
      const fadeDauer = this.skalierteDauer(300);
      const delay = this.skalierteDauer(800);

      this.szene.tweens.add({
        targets: text,
        y: posY - 60,
        scaleX: [0.6, 1.15, 1], scaleY: [0.6, 1.15, 1],
        alpha: { from: 0, to: 1 }, ease: 'Back.Out', duration: skalierteDauerMain,
        onComplete: () => {
          this.szene.tweens.add({
            targets: text, alpha: 0, delay: delay, duration: fadeDauer,
            onComplete: complete,
          });
        },
      });
      this.verwalteteObjekte.push(text);
      
      window.setTimeout(complete, skalierteDauerMain + delay + fadeDauer + 1000);
    });
  }

  private async schweinchenGemeldet(spielerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = this.erstelleKartenContainer(posX, posY, FARBE_PINK, 290, 115);
    const emoji = this.szene.add.text(0, -32, '🐷', { fontSize: '34px' }).setOrigin(0.5);
    const t1 = this.szene.add.text(0, 14, 'SCHWEINCHEN!', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_SM}px`, color: FARBE_PINK_CSS,
    }).setOrigin(0.5);
    container.add([emoji, t1]);
    if (spielerName) {
      const sub = this.szene.add.text(0, 42, spielerName.toUpperCase().slice(0, 16), {
        fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
      }).setOrigin(0.5);
      container.add(sub);
    }
    container.setScale(0, 0);
    this.szene.tweens.add({
      targets: container,
      scaleX: [0, 1.25, 0.9, 1.08, 1], scaleY: [0, 1.25, 0.9, 1.08, 1],
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: this.skalierteDauer(600),
    });
    this.shockwaveRing(posX, posY, FARBE_PINK, 0);
    this.shockwaveRing(posX, posY, FARBE_PINK, 100);
    this.screenShake();
    await this.verwalteMitTimeout(container, 2500);
  }

  private async fuchsGefangen(spielerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = this.erstelleKartenContainer(posX, posY, FARBE_ORANGE, 330, 100);
    const buchstaben = 'FUCHS'.split('');
    const letterBreite = 38;
    const startX = -(buchstaben.length - 1) * letterBreite / 2;
    buchstaben.forEach((ch, i) => {
      const l = this.szene.add.text(startX + i * letterBreite, -22, ch, {
        fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_LG}px`, color: FARBE_ORANGE_CSS,
        stroke: '#884400', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0);
      l.setY(-60);
      l.setAngle(-20);
      container.add(l);
      const timer = this.szene.time.delayedCall(this.skalierteDauer(i * 70), () => {
        if (!(l as unknown as { active: boolean }).active) return;
        this.szene.tweens.add({ targets: l, y: -22, alpha: 1, angle: 0, duration: this.skalierteDauer(280), ease: 'Back.Out' });
      });
      this.verwalteteTimers.push(timer);
    });
    const subText = spielerName
      ? `GEFANGEN · ${spielerName.toUpperCase().slice(0, 12)}`
      : 'GEFANGEN · +1';
    const sub = this.szene.add.text(0, 30, subText, {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
    }).setOrigin(0.5);
    container.add(sub);
    this.konfetti(posX, posY, 40, [0xff8833, 0xffd700, 0xffffff, 0xff5500]);
    this.screenShake();
    await this.verwalteMitTimeout(container, 2500);
  }

  private async karlchenGespielt(spielerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = this.erstelleKartenContainer(posX, posY, FARBE_GOLD, 290, 105);
    const t1 = this.szene.add.text(0, -20, 'KARLCHEN', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_LG}px`, color: FARBE_GOLD_CSS,
      stroke: '#7a5000', strokeThickness: 4,
    }).setOrigin(0.5);
    const subText = spielerName ? `${spielerName.toUpperCase().slice(0, 12)} · +1` : 'LETZTER STICH · +1';
    const t2 = this.szene.add.text(0, 22, subText, {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: TEXT_GEDAEMPFT_CSS,
    }).setOrigin(0.5);
    container.add([t1, t2]);
    container.setScale(0, 0);
    this.szene.tweens.add({
      targets: container,
      scaleX: [0, 1.25, 0.9, 1.08, 1], scaleY: [0, 1.25, 0.9, 1.08, 1],
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: this.skalierteDauer(600),
    });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 100);
    this.screenShake();
    await this.verwalteMitTimeout(container, 2500);
  }

  private async doppelkopfGestochen(x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = this.szene.add.container(posX, posY);
    container.setDepth(50);
    const bg = this.szene.add.graphics();
    bg.fillStyle(CARD_BG_DARK, 0.95);
    bg.fillRoundedRect(-135, -68, 270, 136, 8);
    bg.lineStyle(3, FARBE_GOLD, 1);
    bg.strokeRoundedRect(-135, -68, 270, 136, 8);
    const hauptText = this.szene.add.text(0, -22, 'DOPPEL-\nKOPF', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XL}px`, color: FARBE_GOLD_CSS,
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    const subText = this.szene.add.text(0, 50, 'GESTOCHEN · +2', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_GOLD_CSS,
    }).setOrigin(0.5);
    container.add([bg, hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(5, 5);
    container.setAlpha(0);
    this.szene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, alpha: 1, ease: 'Expo.Out', duration: this.skalierteDauer(580) });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 100);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 200);
    this.konfetti(posX, posY, 70, [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0xffffff]);
    this.cameraFlash(255, 215, 0, 300);
    this.screenShake();
    this.verwalteteObjekte.push(container);

    const skalierteWartezeit = this.skalierteDauer(3500);
    const fadeDauer = this.skalierteDauer(200);
    
    if (skalierteWartezeit <= 0) {
      foilTimer.remove(false);
      if ((container as unknown as { active: boolean }).active) container.destroy(true);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        foilTimer.remove(false);
        if ((container as unknown as { active: boolean }).active) container.destroy(true);
        resolve();
      };

      const destroyTimer = this.szene.time.delayedCall(skalierteWartezeit, () => {
        this.szene.tweens.add({
          targets: container, alpha: 0, duration: fadeDauer,
          onComplete: complete,
        });
      });
      this.verwalteteTimers.push(destroyTimer);
      
      window.setTimeout(complete, skalierteWartezeit + fadeDauer + 1000);
    });
  }

  private async hochzeitPartnerGefunden(partnerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = this.szene.add.container(posX, posY);
    container.setDepth(50);
    const bg = this.szene.add.graphics();
    bg.fillStyle(CARD_BG_DARK, 0.95);
    bg.fillRoundedRect(-145, -72, 290, 144, 8);
    bg.lineStyle(3, FARBE_GOLD, 1);
    bg.strokeRoundedRect(-145, -72, 290, 144, 8);
    const emoji = this.szene.add.text(0, -50, '💍', { fontSize: '26px' }).setOrigin(0.5);
    const hauptText = this.szene.add.text(0, -16, 'HOCHZEIT!', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_LG}px`, color: FARBE_GOLD_CSS,
      stroke: '#7a5000', strokeThickness: 4,
    }).setOrigin(0.5);
    const subLabel = partnerName
      ? `PARTNER: ${partnerName.toUpperCase().slice(0, 12)}`
      : 'PARTNER GEFUNDEN';
    const subText = this.szene.add.text(0, 30, subLabel, {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_GOLD_CSS,
    }).setOrigin(0.5);
    container.add([bg, emoji, hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(0, 0);
    this.szene.tweens.add({
      targets: container,
      scaleX: [0, 1.25, 0.9, 1.08, 1], scaleY: [0, 1.25, 0.9, 1.08, 1],
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: this.skalierteDauer(600),
    });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 150);
    this.konfetti(posX, posY, 60, [0xffd700, 0xffaacc, 0xffffff, 0xff88ff]);
    this.cameraFlash(255, 215, 0, 200);
    this.verwalteteObjekte.push(container);

    const skalierteWartezeit = this.skalierteDauer(3000);
    const fadeDauer = this.skalierteDauer(200);
    
    if (skalierteWartezeit <= 0) {
      foilTimer.remove(false);
      if ((container as unknown as { active: boolean }).active) container.destroy(true);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        foilTimer.remove(false);
        if ((container as unknown as { active: boolean }).active) container.destroy(true);
        resolve();
      };

      const destroyTimer = this.szene.time.delayedCall(skalierteWartezeit, () => {
        this.szene.tweens.add({
          targets: container, alpha: 0, duration: fadeDauer,
          onComplete: complete,
        });
      });
      this.verwalteteTimers.push(destroyTimer);
      
      window.setTimeout(complete, skalierteWartezeit + fadeDauer + 1000);
    });
  }

  private async spielBeendet(): Promise<void> {
    const cx = this.cx(), cy = this.cy();
    const container = this.szene.add.container(cx, cy);
    container.setDepth(50);
    const bg = this.szene.add.graphics();
    bg.fillStyle(CARD_BG_DARK, 0.95);
    bg.fillRoundedRect(-135, -58, 270, 116, 8);
    bg.lineStyle(3, FARBE_GRUEN, 1);
    bg.strokeRoundedRect(-135, -58, 270, 116, 8);
    const hauptText = this.szene.add.text(0, -18, 'GEWONNEN', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XL}px`, color: FARBE_GRUEN_CSS,
    }).setOrigin(0.5);
    const subText = this.szene.add.text(0, 24, 'SPIEL BEENDET', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_GRUEN_CSS,
    }).setOrigin(0.5);
    container.add([bg, hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(5, 5);
    container.setAlpha(0);
    this.szene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, alpha: 1, ease: 'Expo.Out', duration: this.skalierteDauer(540) });
    this.shockwaveRing(cx, cy, FARBE_GRUEN, 0);
    this.shockwaveRing(cx, cy, FARBE_GRUEN, 100);
    this.konfetti(cx, cy, 150, [0x44ff88, 0xffd700, 0xffffff, 0x44ffee, 0xff88ff]);
    this.cameraFlash(100, 255, 150, 400);
    this.screenShake();
    this.verwalteteObjekte.push(container);

    const skalierteWartezeit = this.skalierteDauer(4000);
    const fadeDauer = this.skalierteDauer(200);
    
    if (skalierteWartezeit <= 0) {
      foilTimer.remove(false);
      if ((container as unknown as { active: boolean }).active) container.destroy(true);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        foilTimer.remove(false);
        if ((container as unknown as { active: boolean }).active) container.destroy(true);
        resolve();
      };

      const destroyTimer = this.szene.time.delayedCall(skalierteWartezeit, () => {
        this.szene.tweens.add({
          targets: container, alpha: 0, duration: fadeDauer,
          onComplete: complete,
        });
      });
      this.verwalteteTimers.push(destroyTimer);
      
      window.setTimeout(complete, skalierteWartezeit + fadeDauer + 1000);
    });
  }
}
