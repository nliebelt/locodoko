import type Phaser from 'phaser';
import {
  FARBE_CYAN, FARBE_CYAN_CSS,
  FARBE_BLAU, FARBE_BLAU_CSS,
  FARBE_GRUEN, FARBE_GRUEN_CSS,
  FARBE_PINK, FARBE_PINK_CSS,
  FARBE_ORANGE, FARBE_ORANGE_CSS,
  FARBE_GOLD, FARBE_GOLD_CSS,
  TEXT_GEDAEMPFT_CSS,
  FONT_FAMILY_FALLBACK,
  FONT_XS, FONT_SM, FONT_MD, FONT_LG, FONT_XL,
} from './designTokens';
import {
  skalierteDauer, istAktiv,
  konfetti as konfettiEff,
  shockwaveRing as shockwaveEff,
  screenShake as screenShakeEff,
  cameraFlash as cameraFlashEff,
  foilShimmer as foilShimmerEff,
  verwalteMitTimeout as verwalteMitTimeoutEff,
  verwalteMitFoilTimeout,
} from './FlashTextPrimitiven';
import { erstelleKartenContainer, cx as mitteX, cy as mitteY } from './FlashTextContainer';

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
      if (istAktiv(obj)) {
        this.szene.tweens.killTweensOf(obj);
        obj.destroy();
      }
    }
    this.verwalteteObjekte.length = 0;
    for (const timer of this.verwalteteTimers) {
      if (timer) timer.remove(false);
    }
    this.verwalteteTimers.length = 0;
  }

  // ── Hilfsmethoden ──

  private cx(): number { return mitteX(this.szene); }
  private cy(): number { return mitteY(this.szene); }

  konfetti(x: number, y: number, menge: number, farben = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833]): void {
    konfettiEff(this.szene, this.geschwindigkeitsfaktor, x, y, menge, farben);
  }

  shockwaveRing(x: number, y: number, farbe: number, verzoegerung = 0): void {
    shockwaveEff(this.szene, this.geschwindigkeitsfaktor, x, y, farbe, verzoegerung);
  }

  screenShake(): void { screenShakeEff(this.szene, this.geschwindigkeitsfaktor); }

  cameraFlash(r: number, g: number, b: number, dauer: number): void {
    cameraFlashEff(this.szene, this.geschwindigkeitsfaktor, r, g, b, dauer);
  }

  private verwalteMitTimeout(obj: Phaser.GameObjects.GameObject, ms: number): Promise<void> {
    return verwalteMitTimeoutEff(this.szene, this.geschwindigkeitsfaktor, obj, ms, this.verwalteteObjekte, this.verwalteteTimers);
  }

  private foilShimmer(text: Phaser.GameObjects.Text): Phaser.Time.TimerEvent {
    return foilShimmerEff(this.szene, this.geschwindigkeitsfaktor, text, this.verwalteteTimers);
  }

  // ── 9 Events ──

  private async spielGestartet(): Promise<void> {
    const container = erstelleKartenContainer(this.szene, this.cx(), this.cy(), FARBE_CYAN, 260, 105);
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
    this.szene.tweens.add({ targets: container, scaleX: 1, ease: 'Back.Out', duration: skalierteDauer(380, this.geschwindigkeitsfaktor) });
    await this.verwalteMitTimeout(container, 2500);
  }

  private async naechsterSpielerErwartet(spielerName: string): Promise<void> {
    const container = erstelleKartenContainer(this.szene, this.cx(), this.cy() * 0.38, FARBE_BLAU, 270, 80);
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
      duration: skalierteDauer(400, this.geschwindigkeitsfaktor),
    });
    await this.verwalteMitTimeout(container, 2000);
  }

  private async vorbehaltErwartet(): Promise<void> {
    this.stoppeVorbehaltAnimation();
    const container = erstelleKartenContainer(this.szene, this.cx(), this.cy() * 0.35, FARBE_BLAU, 280, 82);
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
    this.szene.tweens.add({ targets: container, scaleX: 1, alpha: 1, duration: skalierteDauer(450, this.geschwindigkeitsfaktor), ease: 'Sine.Out' });
    this.vorbehaltBlinkTween = this.szene.tweens.add({
      targets: t1, alpha: { from: 1, to: 0.5 }, yoyo: true, repeat: -1,
      duration: skalierteDauer(650, this.geschwindigkeitsfaktor),
      ease: 'Sine.InOut', delay: skalierteDauer(500, this.geschwindigkeitsfaktor),
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

    const skalierteDauerMain = skalierteDauer(360, this.geschwindigkeitsfaktor);
    if (skalierteDauerMain <= 0) {
      if (istAktiv(text)) text.destroy();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const complete = () => {
        if (resolved) return;
        resolved = true;
        if (istAktiv(text)) text.destroy();
        resolve();
      };

      const fadeDauer = skalierteDauer(300, this.geschwindigkeitsfaktor);
      const delay = skalierteDauer(800, this.geschwindigkeitsfaktor);

      this.szene.tweens.add({
        targets: text,
        y: posY - 60,
        scaleX: [0.6, 1.15, 1], scaleY: [0.6, 1.15, 1],
        alpha: { from: 0, to: 1 }, ease: 'Back.Out', duration: skalierteDauerMain,
        onComplete: () => {
          this.szene.tweens.add({ targets: text, alpha: 0, delay, duration: fadeDauer, onComplete: complete });
        },
      });
      this.verwalteteObjekte.push(text);
      const timer = this.szene.time.delayedCall(skalierteDauerMain + delay + fadeDauer + 1000, complete);
      this.verwalteteTimers.push(timer);
    });
  }

  private async schweinchenGemeldet(spielerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = erstelleKartenContainer(this.szene, posX, posY, FARBE_PINK, 290, 115);
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
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: skalierteDauer(600, this.geschwindigkeitsfaktor),
    });
    this.shockwaveRing(posX, posY, FARBE_PINK, 0);
    this.shockwaveRing(posX, posY, FARBE_PINK, 100);
    this.screenShake();
    await this.verwalteMitTimeout(container, 2500);
  }

  private async fuchsGefangen(spielerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = erstelleKartenContainer(this.szene, posX, posY, FARBE_ORANGE, 330, 100);
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
      const timer = this.szene.time.delayedCall(skalierteDauer(i * 70, this.geschwindigkeitsfaktor), () => {
        if (!istAktiv(l)) return;
        this.szene.tweens.add({ targets: l, y: -22, alpha: 1, angle: 0, duration: skalierteDauer(280, this.geschwindigkeitsfaktor), ease: 'Back.Out' });
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
    const container = erstelleKartenContainer(this.szene, posX, posY, FARBE_GOLD, 290, 105);
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
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: skalierteDauer(600, this.geschwindigkeitsfaktor),
    });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 100);
    this.screenShake();
    await this.verwalteMitTimeout(container, 2500);
  }

  private async doppelkopfGestochen(x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = erstelleKartenContainer(this.szene, posX, posY, FARBE_GOLD, 270, 136);
    const hauptText = this.szene.add.text(0, -22, 'DOPPEL-\nKOPF', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XL}px`, color: FARBE_GOLD_CSS,
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    const subText = this.szene.add.text(0, 50, 'GESTOCHEN · +2', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_GOLD_CSS,
    }).setOrigin(0.5);
    container.add([hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(5, 5);
    container.setAlpha(0);
    this.szene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, alpha: 1, ease: 'Expo.Out', duration: skalierteDauer(580, this.geschwindigkeitsfaktor) });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 100);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 200);
    this.konfetti(posX, posY, 70, [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0xffffff]);
    this.cameraFlash(255, 215, 0, 300);
    this.screenShake();
    await verwalteMitFoilTimeout(this.szene, this.geschwindigkeitsfaktor, container, foilTimer, 3500, 200, this.verwalteteObjekte, this.verwalteteTimers);
  }

  private async hochzeitPartnerGefunden(partnerName?: string, x?: number, y?: number): Promise<void> {
    const posX = x ?? this.cx(), posY = y ?? this.cy();
    const container = erstelleKartenContainer(this.szene, posX, posY, FARBE_GOLD, 290, 144);
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
    container.add([emoji, hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(0, 0);
    this.szene.tweens.add({
      targets: container,
      scaleX: [0, 1.25, 0.9, 1.08, 1], scaleY: [0, 1.25, 0.9, 1.08, 1],
      angle: [-30, 10, -4, 2, 0], ease: 'Back.Out', duration: skalierteDauer(600, this.geschwindigkeitsfaktor),
    });
    this.shockwaveRing(posX, posY, FARBE_GOLD, 0);
    this.shockwaveRing(posX, posY, FARBE_GOLD, 150);
    this.konfetti(posX, posY, 60, [0xffd700, 0xffaacc, 0xffffff, 0xff88ff]);
    this.cameraFlash(255, 215, 0, 200);
    await verwalteMitFoilTimeout(this.szene, this.geschwindigkeitsfaktor, container, foilTimer, 3000, 200, this.verwalteteObjekte, this.verwalteteTimers);
  }

  private async spielBeendet(): Promise<void> {
    const cx = this.cx(), cy = this.cy();
    const container = erstelleKartenContainer(this.szene, cx, cy, FARBE_GRUEN, 270, 116);
    const hauptText = this.szene.add.text(0, -18, 'GEWONNEN', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XL}px`, color: FARBE_GRUEN_CSS,
    }).setOrigin(0.5);
    const subText = this.szene.add.text(0, 24, 'SPIEL BEENDET', {
      fontFamily: FONT_FAMILY_FALLBACK, fontSize: `${FONT_XS}px`, color: FARBE_GRUEN_CSS,
    }).setOrigin(0.5);
    container.add([hauptText, subText]);
    const foilTimer = this.foilShimmer(hauptText);
    container.setScale(5, 5);
    container.setAlpha(0);
    this.szene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, alpha: 1, ease: 'Expo.Out', duration: skalierteDauer(540, this.geschwindigkeitsfaktor) });
    this.shockwaveRing(cx, cy, FARBE_GRUEN, 0);
    this.shockwaveRing(cx, cy, FARBE_GRUEN, 100);
    this.konfetti(cx, cy, 150, [0x44ff88, 0xffd700, 0xffffff, 0x44ffee, 0xff88ff]);
    this.cameraFlash(100, 255, 150, 400);
    this.screenShake();
    await verwalteMitFoilTimeout(this.szene, this.geschwindigkeitsfaktor, container, foilTimer, 4000, 200, this.verwalteteObjekte, this.verwalteteTimers);
  }
}
