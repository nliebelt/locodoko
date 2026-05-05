import Phaser from 'phaser';
import {
  FARBE_GOLD,
  FARBE_ROT,
  RE_FARBE_OVERLAY,
  KONTRA_FARBE_OVERLAY,
  FONT_FAMILY,
  FONT_SM,
} from './designTokens';
import type { SpielerPosition } from '../modelle/TischAnsichtModell';

export interface NameplateDaten {
  name: string;
  position: SpielerPosition;
  istKI: boolean;
}

const BREITE = 200;
const HOEHE = 44;
const BALKEN_B = 5;

const BORDER_DEFAULT = 0x3d2860;
const BG_DEFAULT = 0x120e1a;
const BG_AM_ZUG = 0x1c1428;

export class Nameplate extends Phaser.GameObjects.Container {
  private readonly szene: Phaser.Scene;
  private readonly hauptBar: Phaser.GameObjects.Graphics;
  private readonly farbBalken: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private kronenIcon?: Phaser.GameObjects.Text;
  private pulseRing?: Phaser.GameObjects.Graphics;
  private ansageBadge?: Phaser.GameObjects.Container;
  private vorbehaltLabel?: Phaser.GameObjects.Text;
  private teamfarbe: number = BORDER_DEFAULT;
  private aktiveTweens: Phaser.Tweens.Tween[] = [];
  private vorbehaltTween?: Phaser.Tweens.Tween;
  private kronenTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, daten: NameplateDaten) {
    super(scene, x, y);
    this.szene = scene;
    scene.add.existing(this);
    this.setDepth(5);

    // Kinder direkt ueber Konstruktoren erstellen (nicht scene.add.*),
    // damit sie nicht doppelt in der Scene DisplayList landen → verhindert Double-Destroy-Crash
    this.farbBalken = scene.make.graphics();
    this.zeichneBalken(BORDER_DEFAULT);
    this.add(this.farbBalken);

    this.hauptBar = scene.make.graphics();
    this.zeichneHauptBar(BORDER_DEFAULT, BG_DEFAULT);
    this.add(this.hauptBar);

    this.nameText = new Phaser.GameObjects.Text(
      scene,
      -BREITE / 2 + BALKEN_B + 8,
      -5,
      daten.name,
      { fontSize: `${FONT_SM}px`, fontFamily: FONT_FAMILY, color: '#f0e6ff' }
    ).setOrigin(0, 0.5);
    this.add(this.nameText);

    if (daten.istKI) {
      const kiBadge = new Phaser.GameObjects.Container(scene, BREITE / 2 - 16, 8);
      const bg = scene.make.graphics();
      bg.fillStyle(0x0a3333, 1);
      bg.fillRoundedRect(-8, -5, 16, 10, 2);
      kiBadge.add(bg);
      const kiLabel = new Phaser.GameObjects.Text(
        scene,
        0, 0,
        'KI',
        { fontSize: '6px', fontFamily: FONT_FAMILY, color: '#33ffee' }
      ).setOrigin(0.5, 0.5);
      kiBadge.add(kiLabel);
      this.add(kiBadge);
    }
  }

  private zeichneHauptBar(borderFarbe: number, bgFarbe: number): void {
    const g = this.hauptBar;
    g.clear();
    g.fillStyle(bgFarbe, 0.9);
    g.fillRoundedRect(-BREITE / 2 + BALKEN_B, -HOEHE / 2, BREITE - BALKEN_B, HOEHE, { tl: 0, tr: 4, bl: 0, br: 4 });
    g.lineStyle(2, borderFarbe, 1);
    g.strokeRoundedRect(-BREITE / 2 + BALKEN_B, -HOEHE / 2, BREITE - BALKEN_B, HOEHE, { tl: 0, tr: 4, bl: 0, br: 4 });
  }

  private zeichneBalken(farbe: number): void {
    this.farbBalken.clear();
    this.farbBalken.fillStyle(farbe, 1);
    this.farbBalken.fillRoundedRect(-BREITE / 2, -HOEHE / 2, BALKEN_B, HOEHE, { tl: 4, tr: 0, bl: 4, br: 0 });
  }

  private stoppeAktiveTweens(): void {
    this.aktiveTweens.forEach(t => t.stop());
    this.aktiveTweens = [];
    this.nameText.setAlpha(1);
    this.hauptBar.setAlpha(1);
    this.pulseRing?.destroy();
    this.pulseRing = undefined;
    this.kronenTween?.stop();
    this.kronenTween = undefined;
    this.kronenIcon?.destroy();
    this.kronenIcon = undefined;
  }

  setZustand(zustand: 'default' | 'amZug' | 'geber'): void {
    this.stoppeAktiveTweens();
    const farbe = this.teamfarbe !== BORDER_DEFAULT ? this.teamfarbe : BORDER_DEFAULT;

    if (zustand === 'default') {
      this.zeichneBalken(farbe);
      this.zeichneHauptBar(farbe, BG_DEFAULT);
      return;
    }

    if (zustand === 'amZug') {
      const aktivFarbe = this.teamfarbe !== BORDER_DEFAULT ? this.teamfarbe : FARBE_GOLD;
      this.zeichneBalken(aktivFarbe);
      this.zeichneHauptBar(aktivFarbe, BG_AM_ZUG);

      this.hauptBar.setAlpha(0.4);
      const glowTween = this.szene.tweens.add({
        targets: this.hauptBar,
        alpha: { from: 0.4, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 800,
      });
      this.aktiveTweens.push(glowTween);

      const nameTween = this.szene.tweens.add({
        targets: this.nameText,
        alpha: { from: 1, to: 0.4 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
      });
      this.aktiveTweens.push(nameTween);

      this.pulseRing = this.szene.make.graphics();
      this.pulseRing.lineStyle(2, aktivFarbe, 1);
      this.pulseRing.strokeRoundedRect(-BREITE / 2 - 3, -HOEHE / 2 - 3, BREITE + 6, HOEHE + 6, 6);
      this.add(this.pulseRing);
      const ringTween = this.szene.tweens.add({
        targets: this.pulseRing,
        scaleX: 1.6,
        scaleY: 1.6,
        alpha: { from: 1, to: 0 },
        repeat: -1,
        duration: 1500,
      });
      this.aktiveTweens.push(ringTween);
      return;
    }

    if (zustand === 'geber') {
      this.zeichneBalken(farbe);
      this.zeichneHauptBar(farbe, BG_DEFAULT);

      this.kronenIcon = this.szene.add.text(
        0, -HOEHE / 2 - 10,
        '♛',
        { fontSize: '14px', fontFamily: FONT_FAMILY, color: '#ffd700' }
      ).setOrigin(0.5, 0.5);
      this.add(this.kronenIcon);
      this.kronenTween = this.szene.tweens.add({
        targets: this.kronenIcon,
        y: -HOEHE / 2 - 13,
        yoyo: true,
        repeat: -1,
        duration: 2000,
      });
    }
  }

  setTeamfarbe(partei: 're' | 'kontra'): void {
    this.teamfarbe = partei === 're' ? RE_FARBE_OVERLAY : KONTRA_FARBE_OVERLAY;
    this.zeichneBalken(this.teamfarbe);
  }

  showAnsage(typ: 're' | 'kontra'): void {
    this.ansageBadge?.destroy();

    const badge = this.szene.add.container(BREITE / 2 - 22, 0);
    const bg = this.szene.add.graphics();
    const farbe = typ === 're' ? FARBE_GOLD : FARBE_ROT;
    bg.fillStyle(farbe, 1);
    bg.fillRoundedRect(-12, -9, 24, 18, 3);
    badge.add(bg);

    const txt = this.szene.add.text(
      0, 0,
      typ === 're' ? 'RE' : 'KT',
      { fontSize: '7px', fontFamily: FONT_FAMILY, color: typ === 're' ? '#7a5000' : '#880022' }
    ).setOrigin(0.5, 0.5);
    badge.add(txt);
    this.add(badge);
    this.ansageBadge = badge;

    badge.setScale(0).setAlpha(0);
    this.szene.tweens.add({
      targets: badge,
      scaleX: { from: 0, to: 1 },
      scaleY: { from: 0, to: 1 },
      alpha: { from: 0, to: 1 },
      ease: 'Back.Out',
      duration: 500,
    });
  }

  showVorbehalt(): void {
    if (this.vorbehaltLabel) return;
    this.vorbehaltLabel = this.szene.add.text(
      -BREITE / 2 + BALKEN_B + 8,
      12,
      'VORBEHALT?',
      { fontSize: '6px', fontFamily: FONT_FAMILY, color: '#44aaff' }
    ).setOrigin(0, 0.5);
    this.add(this.vorbehaltLabel);

    this.vorbehaltTween = this.szene.tweens.add({
      targets: this.vorbehaltLabel,
      alpha: { from: 0.5, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 450,
    });
  }

  clearVorbehalt(): void {
    this.vorbehaltTween?.stop();
    this.vorbehaltTween = undefined;
    this.vorbehaltLabel?.destroy();
    this.vorbehaltLabel = undefined;
  }

  shake(): void {
    const startX = this.x;
    this.szene.tweens.add({
      targets: this,
      x: startX + 4,
      yoyo: true,
      repeat: 3,
      duration: 50,
      onComplete: () => { this.x = startX; },
    });
  }

  destroy(fromScene?: boolean): void {
    this.stoppeAktiveTweens();
    this.clearVorbehalt();
    super.destroy(fromScene);
  }
}

// --- Unit-testbare Hilfsfunktionen ---

export function teamfarbeVonPartei(partei: 're' | 'kontra'): number {
  return partei === 're' ? RE_FARBE_OVERLAY : KONTRA_FARBE_OVERLAY;
}

export function ansageBadgeTyp(ansage: string): 're' | 'kontra' | null {
  if (['RE', 'RE_KEINE_90', 'RE_KEINE_60', 'RE_KEINE_30', 'RE_SCHWARZ'].includes(ansage)) return 're';
  if (['KONTRA', 'KONTRA_KEINE_90', 'KONTRA_KEINE_60', 'KONTRA_KEINE_30', 'KONTRA_SCHWARZ'].includes(ansage)) return 'kontra';
  return null;
}
