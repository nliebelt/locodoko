# Nameplate Variante C — Claude Code Prompt

## Fertiger Prompt für Claude Code

Einfach diesen Text in Claude Code einfügen (mit dem ZIP als Anhang oder dem HTML als Referenz):

---

```
Ich baue ein Doppelkopf-Spiel in Phaser 3 und brauche ein Nameplate-System für die 4 Spieler.

## Ziel-Design: "HUD Bar" Style (Variante C)
Referenz: Doppelkopf Nameplates.html im Anhang — bitte die Variante C nachbauen.

## Design-Tokens
Font:       'Press Start 2P', monospace (Google Fonts — als BitmapFont in Phaser laden)
Background: #120e1a
Card BG:    #1c1428  (aktiver Spieler)
Border:     #3d2860  (inaktiv)  /  Teamfarbe (aktiv)
RE-Team:    #ffd700  (Gold)   — Shadow: #7a5000
Kontra-Team:#ff4455  (Rot)    — Shadow: #880022
KI-Label:   #33ffee  (Cyan)
Vorbehalt:  #44aaff  (Blau)

## Nameplate Aufbau (Variante C — HUD Bar)
Breite: ~200px, Höhe: ~44px
Besteht aus:
  1. Linker Farbbalken (5px breit, volle Höhe, Teamfarbe, mit Glow)
  2. Haupt-Bar (Background, Border rechts/oben/unten, BorderRadius rechts)
     - Links: Spielername (Press Start 2P, 9px) + KI-Icon (klein, subtle)
     - Rechts: optionales Geber-Icon + RE/KONTRA Badge

## States
DEFAULT:    Border #3d2860, Background #120e1a, kein Glow
AM ZUG:     Border = Teamfarbe, Background #1c1428,
            Glow-Animation (0 0 8px → 0 0 20px, loop 1.6s),
            Spielername blinkt (alpha 1→0.4, loop 1.2s),
            Pulse-Ring außen (scale 1→1.6, opacity 1→0, loop 1.5s)
RE/KONTRA:  Badge erscheint mit Bounce-Animation (scale 0→1.2→1, 500ms, Back.Out)
            Badge bleibt dann permanent sichtbar
GEBER:      Krone-Icon über dem Nameplate, floating animation (translateY 0→-3px, loop 2s)
VORBEHALT:  Sub-Label "VORBEHALT?" in Blau, pulse animation (opacity 0.5→1, loop 0.9s)

## Phaser 3 Implementierung

Bitte als Phaser 3 Container implementieren:

class Nameplate extends Phaser.GameObjects.Container {
  constructor(scene, x, y, playerData) { ... }
  
  setState(state) { ... }  // 'default' | 'active' | 'geber'
  showAnsage(type) { ... } // 're' | 'kontra' — mit Badge-Animation
  showVorbehalt() { ... }
  clearVorbehalt() { ... }
}

## Positionierung der 4 Spieler
Bottom (ich):  x=center, y=bottom-80
Top (oben):    x=center, y=top+80
Left:          x=left+80, y=center
Right:         x=right-80, y=center

Für Left/Right: Container um 90° rotieren ODER separate horizontale Darstellung —
bitte beide Optionen zeigen und den saubereren Weg wählen.

## Event-Integration (bestehende Events)
NaechsterSpielerErwartet → nameplate.setState('active') für aktuellen Spieler
VorbehaltErwartet        → nameplate.showVorbehalt()
SpielGestartet           → alle Nameplates reset, Geber setzen
FuchsGefangen/Karlchen   → kurzer Shake auf dem Nameplate des Täters
  (this.scene.tweens.add({ targets: nameplate, x: x+4, yoyo: true, repeat: 3, duration: 50 }))

## RE/KONTRA Badge Animation (Phaser Tween)
// Beim Einblenden:
badge.setScale(0).setAlpha(0);
this.scene.tweens.add({
  targets: badge,
  scaleX: [0, 1.2, 1],
  scaleY: [0, 1.2, 1],
  alpha: { from: 0, to: 1 },
  ease: 'Back.Out',
  duration: 500,
});

## Glow-Tween (Am-Zug-State)
// Phaser 3.60+ PostFX oder via Graphics:
this.scene.tweens.add({
  targets: borderGraphics,
  alpha: { from: 0.4, to: 1 },
  yoyo: true, repeat: -1, duration: 800,
});

## Wichtige Hinweise
- BitmapFont für Press Start 2P vorher laden (this.load.bitmapFont)
- Oder: dynamischer Text mit this.add.text und setFontFamily
- KI-Indikator: nur ein kleines "KI" Label oder Chip-Icon, sehr subtle
- Krone für Geber: einfaches ImageObject oder Graphics-Polygon
- Alle Tweens beim Destroy der Scene stoppen (tweens.killTweensOf)
```

---

## Referenz-Dateien

| Datei | Inhalt |
|---|---|
| `Doppelkopf Nameplates.html` | Interaktive Referenz — Variante C live spielbar |
| `Doppelkopf Flash Text v3.html` | Flash-Text-Animationen (gleicher Stil) |

## Design-Entscheidungen (bereits getroffen)

- **Font:** Press Start 2P (Balatro-Style, bereits entschieden)
- **RE-Team:** Gold (#ffd700)
- **Kontra-Team:** Rot (#ff4455)  
- **RE/KONTRA Badge:** animiert einblenden, dann permanent
- **Geber:** Krone floating
- **KI:** subtle Chip-Icon in Cyan
- **Am-Zug:** Glow + Blink + Pulse-Ring
