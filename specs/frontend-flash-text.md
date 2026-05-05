# Frontend: Flash-Text-Animationssystem

| Feld           | Wert                                                                         |
|----------------|------------------------------------------------------------------------------|
| Status         | Noch nicht begonnen                                                          |
| Priorität      | Hoch                                                                         |
| Abhängigkeiten | frontend-visuelles-design.md, websocket-kommunikation.md, frontend-tischansicht.md |

## Beschreibung

Ein `FlashTextManager` visualisiert neun Spiel-Events mit Balatro-Style-Animationen (v3, pixel-genau nach Design-Handoff). Das System ersetzt die bisherigen Ad-hoc-Sonderpunkt-Toasts in `TischSzene.ts` durch ein einheitliches, spektakuläres Feedback-System. Alle Animationen laufen in Phaser 3 — kein DOM, kein CSS.

Design-Referenz: `design_handoff/Doppelkopf Flash Text v3.html` (enthält direkt verwendbare Phaser-Code-Snippets pro Event).

## Anforderungen

### Klassen-Architektur

1. `FlashTextManager` als eigenständige Klasse in `frontend/src/ui/FlashTextManager.ts`.
2. Konstruktor erhält die aktive Phaser-Szene (`Phaser.Scene`) als Abhängigkeit.
3. Öffentliche Methoden:
   - `zeigeSpielevent(event: SpieleventTyp, payload: SpieleventPayload): void`
   - `destroy(): void` — stoppt alle laufenden Tweens (`tweens.killTweensOf`)
4. Interne Hilfsmethoden für wiederverwendbare Effekte: `konfetti(x, y)`, `shockwaveRing(x, y, farbe)`, `screenShake()`, `cameraFlash(farbe)`.

### Events und Animationen

5. Alle neun Events werden animiert. Timings und Animationstypen exakt nach Design-Handoff:

   | Event                    | Animation                                              | Dauer     |
   |--------------------------|--------------------------------------------------------|-----------|
   | `SpielGestartet`         | Card Flip → Slide-In Banner                            | 380ms     |
   | `NaechsterSpielerErwartet` | Card Flip + Scale Punch                              | 400ms     |
   | `VorbehaltErwartet`      | Card Flip + Neon Blink (loop, bis Event-Ende)          | 450ms     |
   | `StichAbgeschlossen`     | Card Flip + Score Fly-Up                               | 360ms     |
   | `SchweinchenGemeldet`    | Card Flip + Wobble + Screen Shake                      | 600ms     |
   | `FuchsGefangen`          | Letter Drop (70ms Delay pro Buchstabe) + Konfetti + Shake | ~700ms |
   | `KarlchenGespielt`       | Card Flip + Bounce Spin + 2× Shockwave Ring            | 560ms     |
   | `DoppelkopfGestochen`    | **Foil Text** + Zoom Blur + 3× Ring + Konfetti + Camera Flash | 580ms |
   | `SpielBeendet`           | **Foil Text** + Zoom Blur + 2× Ring + Mega-Konfetti + Camera Flash | 540ms |

### Foil-Shimmer (DoppelkopfGestochen + SpielBeendet)

6. Foil-Shimmer via tint-cycling auf einem `Phaser.GameObjects.Text`-Objekt:
   ```typescript
   const colors = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0x44aaff];
   let ci = 0;
   scene.time.addEvent({ delay: 80, repeat: -1, callback: () => text.setTint(colors[ci++ % colors.length]) });
   ```
7. Foil-Shimmer stoppt automatisch nach der Animations-Dauer des Events.

### Konfetti-Emitter

8. Konfetti als `Phaser.GameObjects.Particles.ParticleEmitter`:
   - Asset: `'pixel'` (1×1-Pixel-Textur, muss in PreloadSzene geladen werden falls nicht vorhanden)
   - Farben: `[0xffd700, 0xff88ff, 0x44ffee, 0xff8833]`
   - Geschwindigkeit: min 80, max 200; Gravitation Y: 300; Lebensdauer: 1200ms
   - Standard-Menge: 70 Partikel; `SpielBeendet` (`Mega-Konfetti`): 150 Partikel
   - Aufruf: `emitter.explode(menge)` (keine Loop-Emission)

### Shockwave Ring

9. Shockwave-Ring als `Phaser.GameObjects.Arc` ohne Fill, mit `setStrokeStyle`:
   ```typescript
   const ring = scene.add.circle(x, y, 30, 0, 0).setStrokeStyle(4, farbe);
   scene.tweens.add({ targets: ring, scaleX: 5, scaleY: 5, alpha: 0, ease: 'Sine.Out', duration: 550, onComplete: () => ring.destroy() });
   ```
10. Mehrere Ringe werden zeitversetzt gestartet (Delay: +100ms pro Ring).

### Screen Shake & Camera Flash

11. Screen Shake: `scene.cameras.main.shake(350, 0.007)`
12. Camera Flash Gold (DoppelkopfGestochen): `scene.cameras.main.flash(300, 255, 215, 0)`
13. Camera Flash Grün (SpielBeendet): `scene.cameras.main.flash(400, 100, 255, 150)`

### Typografie

14. Alle Flash-Texte verwenden `Press Start 2P` (BitmapFont, lokal geladen).
15. Schriftgrößen nach Design-Handoff:
    - XL 28px: Haupttext bei `DoppelkopfGestochen` / `SpielBeendet`
    - LG 20px: `KarlchenGespielt`, `FuchsGefangen`
    - MD 14px: `VorbehaltErwartet`, Neben-Events
    - SM 10px / XS 8px: Sub-Labels, Event-Chips
16. Text-Shadow (Hard Pixel Style) per Event-Farbe gemäß Design-Tokens in `frontend-visuelles-design.md`.

### Integration

17. `FlashTextManager` wird in `TischSzene.ts` instanziiert und erhält WebSocket-Events über den bestehenden Event-Dispatching-Mechanismus.
18. Der Manager ersetzt die bisherigen Toast-Aufrufe für Sonderpunkt-Feedback (Fuchs, Karlchen, Doppelkopf) in `TischSzene.ts`.
19. `VorbehaltErwartet`-Blink-Animation läuft in einer Loop und wird explizit gestoppt sobald der Vorbehalt abgeschlossen ist.

### Lifecycle

20. `destroy()` muss in der `shutdown`-Methode der Szene aufgerufen werden um Memory-Leaks durch laufende `time.addEvent`-Callbacks zu vermeiden.

## Akzeptanzkriterien

- Alle 9 Events zeigen eine Animation.
- Timings und Farben entsprechen der v3-Referenz (`design_handoff/Doppelkopf Flash Text v3.html`).
- Foil-Shimmer aktiv bei `DoppelkopfGestochen` und `SpielBeendet`.
- Konfetti, Screen Shake und Camera Flash funktionieren als eigenständige Hilfsmethoden.
- Kein DOM-Code, kein CSS.
- Beim Destroy der Szene werden alle Tweens und Time-Events gestoppt.

## Definition of Done

- [ ] `FlashTextManager`-Klasse vollständig implementiert
- [ ] Alle 9 Event-Animationen
- [ ] Foil-Shimmer-Effekt
- [ ] Konfetti-Emitter (Standard + Mega)
- [ ] Shockwave-Ringe (1–3×, zeitversetzt)
- [ ] Screen Shake + Camera Flash
- [ ] Integration in `TischSzene.ts` (ersetzt Toast-Aufrufe)
- [ ] `destroy()`-Lifecycle korrekt implementiert
- [ ] Unit-Tests für Manager-Logik (Event-Routing)
- [ ] Visuelles Review via Vision Loop

## Technische Hinweise

- **Phaser-Version**: Phaser 3.60+ wird vorausgesetzt (ParticleEmitter-API-Kompatibilität).
- **Pixel-Asset**: Falls `'pixel'`-Textur nicht vorhanden, in PreloadSzene als 1×1-weißes `Graphics`-Objekt generieren und als Textur registrieren (`scene.add.graphics().fillRect(0,0,1,1).generateTexture('pixel', 1, 1)`).
- **BitmapFont vs. WebFont**: `Press Start 2P` wird als BitmapFont (`this.load.bitmapFont`) geladen — schneller als WebFontLoader während Gameplay.
- **Event-Payloads**: Referenz `design_handoff/README.md` Abschnitt "Event Payloads".
- **Bestehender Code**: `ToastManager.ts` bleibt für System-Toasts (Verbindungsfehler etc.) erhalten; `FlashTextManager` ist ausschließlich für Spiel-Events zuständig.
