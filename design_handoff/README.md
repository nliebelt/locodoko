# Handoff: Doppelkopf Flash Text Animations

## Overview

Dieses Paket enthält High-Fidelity Design-Referenzen für das Flash-Text-Animationssystem eines Doppelkopf-Spiels, das in **Phaser 3** implementiert wird. Es umfasst:

- Animationsvorschläge für alle 9 Spiel-Events
- Balatro-Style visuals: Press Start 2P font, Foil-Shimmer, Screen Shake, Card Flip, Shockwave Rings
- Eine vollständige SVG-Icon-Palette für Doppelkopf-spezifische Symbole
- 6 Blink/Flicker-Varianten für anhaltende Statusanzeigen (Absagen, Vorbehalt)

## About the Design Files

Die HTML-Dateien in diesem Paket sind **Design-Referenzen** — keine Produktionscode. Sie zeigen das beabsichtigte Aussehen und Verhalten. Die Aufgabe ist es, diese Designs in der bestehenden **Phaser 3**-Spielumgebung mit deren Patterns und Libraries (Tweens, Particles, PostFX) zu recreaten.

**Nicht** die HTML-Dateien direkt ins Spiel übernehmen — stattdessen die Phaser 3 Code-Snippets in jedem Event-Card verwenden, die direkt unter jeder Animation angezeigt werden.

## Fidelity

**High-Fidelity** — Pixel-genaue Mockups mit finalen Farben, Typografie, Timing und Interaktionen. Der Entwickler soll die UI pixel-genau in Phaser 3 nachbauen.

---

## Screens / Views

### 1. Flash Text Animations (v3 — Balatro Style)
**Datei:** `Doppelkopf Flash Text v3.html`

Jedes Spiel-Event hat eine eigene Animation:

| Event | Animation | Timing |
|---|---|---|
| `SpielGestartet` | Card Flip → Slide-In Banner | 380ms |
| `NaechsterSpielerErwartet` | Card Flip + Scale Punch | 400ms |
| `VorbehaltErwartet` | Card Flip + Neon Blink (loop) | 450ms |
| `StichAbgeschlossen` | Card Flip + Score Fly-Up | 360ms |
| `SchweinchenGemeldet` | Card Flip + Wobble + Screen Shake | 600ms |
| `FuchsGefangen` | Letter Drop (per Buchstabe, 70ms Delay) + Konfetti + Shake | ~350ms + 5×70ms |
| `KarlchenGespielt` | Card Flip + Bounce Spin + 2× Shockwave Ring | 560ms |
| `DoppelkopfGestochen` | **FOIL TEXT** + Zoom Blur + 3× Ring + Konfetti + Camera Flash | 580ms |
| `SpielBeendet` | **FOIL TEXT** + Zoom Blur + 2× Ring + Mega-Konfetti + Camera Flash | 540ms |

---

## Design Tokens

### Farben
```
Background:    #1a1020
Card BG:       #221530
Card BG Dark:  #2d1d40
Border:        #4a2d6a
Text:          #f0e6ff
Muted:         #7a5a9a

Gold:          #ffd700  (Doppelkopf, Karlchen, Re)
Red:           #ff4455  (Kontra, Verloren)
Blue:          #44aaff  (Vorbehalt, Absagen)
Green:         #44ff88  (Gewonnen, Stich)
Fox Orange:    #ff8833  (Fuchs)
Pink:          #ff55cc  (Schweinchen)
Cyan:          #33ffee  (SpielGestartet)
```

### Typografie
```
Font:          'Press Start 2P', monospace  (Google Fonts)
Größen (Phaser):
  XL:          28px  → Haupttext bei Doppelkopf/Gewonnen
  LG:          20px  → Karlchen, Fuchs
  MD:          14px  → Vorbehalt, Neben-Events
  SM:          10px  → Sub-Labels
  XS:          8px   → Event-Namen, Chips

Text-Shadow (Hard Pixel Style):
  Gold:   4px 4px 0 #7a5000, 0 0 20px #ffd700
  Fox:    4px 4px 0 #884400, 0 0 20px #ff8833
  Green:  4px 4px 0 #006633, 0 0 20px #44ff88
  Pink:   4px 4px 0 #880066, 0 0 20px #ff55cc
  Cyan:   4px 4px 0 #006655, 0 0 20px #33ffee
```

### Spacing & Borders
```
Card Border:   3px solid #4a2d6a
Border Radius: 8px
Card Padding:  14px 16px
Box Shadow:    4px 4px 0 rgba(0,0,0,0.8)
```

---

## Interactions & Animationen

### Card Flip (alle Events)
```javascript
// Phaser 3 — custom tween via timeline
this.tweens.add({
  targets: card,
  // rotateY via custom pipeline or container trick:
  scaleX: [0, 1],         // simulates Y-flip
  alpha: { from: 0, to: 1 },
  ease: 'Back.Out',
  duration: 550,
});
```

### Scale Punch
```javascript
this.tweens.add({
  targets: text,
  scaleX: [0.05, 1.22, 0.92, 1.06, 1],
  scaleY: [0.05, 1.22, 0.92, 1.06, 1],
  alpha: { from: 0, to: 1 },
  ease: 'Back.Out',
  duration: 500,
});
```

### Foil-Shimmer (DoppelkopfGestochen + SpielBeendet)
```javascript
// Phaser 3.60+ — RenderTexture + tint cycling
// Alternativ: BitmapText mit animiertem tint
const colors = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0x44aaff];
let ci = 0;
this.time.addEvent({
  delay: 80, repeat: -1,
  callback: () => { text.setTint(colors[ci++ % colors.length]); }
});
```

### Shockwave Ring
```javascript
const ring = this.add.circle(x, y, 30, 0, 0).setStrokeStyle(4, 0xffd700);
this.tweens.add({
  targets: ring,
  scaleX: 5, scaleY: 5, alpha: 0,
  ease: 'Sine.Out', duration: 550,
  onComplete: () => ring.destroy()
});
```

### Konfetti (Particle Emitter)
```javascript
const emitter = this.add.particles(x, y, 'pixel', {
  speed: { min: 80, max: 200 },
  angle: { min: 0, max: 360 },
  scale: { start: 1, end: 0 },
  lifespan: 1200,
  quantity: 70,
  tint: [0xffd700, 0xff88ff, 0x44ffee, 0xff8833],
  gravityY: 300,
  emitting: false,
});
emitter.explode(70);
```

### Screen Shake
```javascript
this.cameras.main.shake(350, 0.007);
```

### Camera Flash
```javascript
// Gold flash für DoppelkopfGestochen
this.cameras.main.flash(300, 255, 215, 0);
// Green flash für SpielBeendet
this.cameras.main.flash(400, 100, 255, 150);
```

### Blink-Varianten (VorbehaltErwartet / Absagen)
```javascript
// Neon Flicker
this.tweens.add({
  targets: text,
  alpha: { from: 0.4, to: 1 },
  yoyo: true, repeat: -1, duration: 650,
  ease: 'Stepped'
});

// Letter-versetzt
'KEINE 9'.split('').forEach((ch, i) => {
  this.tweens.add({
    targets: letters[i],
    alpha: { from: 0.1, to: 1 },
    yoyo: true, repeat: -1,
    duration: 600, delay: i * 120,
  });
});
```

---

## Assets

### Icons (siehe `Doppelkopf Icon Palette.html`)
SVG-Icons für:
- Kartenfarben: ♣ Kreuz, ♠ Pik, ♥ Herz, ♦ Karo
- Sonderkarten: Fuchs (♦A), Karlchen (♣J), Dulle (♥10), Schweinchen (♦J)
- Spielstatus: RE, KONTRA, Ansage-Badges
- UI: Score, Timer, Spieler-Tokens

Alle Icons als inline SVG exportierbar — `data:image/svg+xml` für Phaser `this.load.svg()`.

---

## Event Payloads (Referenz)

```typescript
SpielGestartet:           { tischId: string }
SpielBeendet:             { tischId, tischName, spielNummer, spielerDaten, partieBeendet }
NaechsterSpielerErwartet: { tischId: string }
VorbehaltErwartet:        { tischId: string }
StichAbgeschlossen:       { tischId: string }
SchweinchenGemeldet:      { tischId: string, spielerPosition: number }
FuchsGefangen:            { tischId: string, taeter: string, opfer: string }
KarlchenGespielt:         { tischId: string, taeter: string }
DoppelkopfGestochen:      { tischId: string, gewinner: string }
```

---

## Files in diesem Paket

| Datei | Inhalt |
|---|---|
| `Doppelkopf Flash Text v3.html` | Haupt-Referenz: Balatro-Style, alle 9 Events, Phaser-Code-Snippets |
| `Doppelkopf Flash Text v2.html` | Sauberere Version ohne Balatro-Style (Fallback) |
| `Doppelkopf Flash Text.html` | Erste Version — alle Animationstypen als Übersicht |
| `Doppelkopf Font Vergleich.html` | Font-Entscheidung: 7 Fonts, 6 Blink-Varianten |
| `Doppelkopf Icon Palette.html` | SVG-Icons für alle Doppelkopf-Symbole |

---

## Empfohlener Implementierungs-Prompt für Claude Code

```
Ich habe ein Doppelkopf-Spiel in Phaser 3 und möchte ein Flash-Text-Animationssystem
implementieren. Im Anhang ist ein Design-Handoff-Paket mit HTML-Referenzen.

Bitte implementiere:
1. Eine FlashTextManager-Klasse in Phaser 3, die alle Events aus dem README abdeckt
2. Press Start 2P als BitmapFont (oder dynamischer Font)
3. Alle Animationen exakt wie in den Code-Snippets im README beschrieben
4. Foil-Shimmer für DoppelkopfGestochen + SpielBeendet via tint-cycling
5. Konfetti-Partikel-Emitter als reusable Methode
6. Screen Shake + Camera Flash als reusable Methoden

Design-Token-Farben und alle Timings stehen im README.
Die HTML-Dateien im Paket zeigen das genaue Ziel-Aussehen.
Verwende Phaser 3.60+ APIs (PostFX Pipeline für Glow wenn möglich).
```
