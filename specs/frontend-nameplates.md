# Frontend: Nameplates (Spieler-HUD)

| Feld           | Wert                                                                  |
|----------------|-----------------------------------------------------------------------|
| Status         | Abgeschlossen                                                         |
| Priorität      | Hoch                                                                  |
| Abhängigkeiten | frontend-visuelles-design.md, websocket-kommunikation.md, frontend-tischansicht.md |

## Beschreibung

Ein `Nameplate`-System (Variante C — HUD-Bar-Style nach Design-Handoff) zeigt für jeden der vier Spieler eine kompakte Statusleiste. Jedes Nameplate reagiert dynamisch auf Spielereignisse: wer am Zug ist, wer Geber ist, RE/KONTRA-Ansagen, Vorbehalt. Das Design folgt dem Balatro-Arcade-Stil aus dem Design-Handoff.

Design-Referenz: `design_handoff/Doppelkopf Nameplates.html` (Variante C) und `design_handoff/Nameplate_C_Prompt.md`.

## Anforderungen

### Klassen-Architektur

1. `Nameplate extends Phaser.GameObjects.Container` in `frontend/src/ui/Nameplate.ts`.
2. Konstruktor-Parameter: `(scene: Phaser.Scene, x: number, y: number, spielerDaten: NameplateDaten)`.
3. `NameplateDaten`: `{ name: string, position: SpielerPosition, istKI: boolean }`.
4. Öffentliche Methoden:
   - `setState(zustand: 'default' | 'amZug' | 'geber'): void`
   - `showAnsage(typ: 're' | 'kontra'): void` — Badge einblenden (permanent)
   - `showVorbehalt(): void` / `clearVorbehalt(): void`
   - `shake(): void` — kurzer Wackel-Effekt (Fuchs/Karlchen-Feedback)
   - `destroy(): void` — stoppt alle Tweens

### Layout (Variante C — HUD Bar)

5. Breite: ~200px, Höhe: ~44px.
6. Aufbau von links nach rechts:
   - **Farbbalken** (5px breit, volle Höhe, Teamfarbe, mit Glow-Effekt)
   - **Haupt-Bar** (Background, Border rechts/oben/unten, BorderRadius rechts):
     - Links: Spielername (`Press Start 2P`, 9px) + KI-Label (`KI`, Cyan, sehr klein und subtil)
     - Rechts: optionales Geber-Krone-Icon + RE/KONTRA-Badge

### States und Animationen

7. **DEFAULT**: Border `#3d2860`, Background `#120e1a`, kein Glow.
8. **AM ZUG** (`setState('amZug')`):
   - Border = Teamfarbe (Gold für RE, Rot für KONTRA), Background `#1c1428`
   - Glow-Animation auf Border: `alpha 0.4 → 1, yoyo, repeat -1, duration 800ms`
   - Spielername blinkt: `alpha 1 → 0.4, yoyo, repeat -1, duration 1200ms`
   - Pulse-Ring außen: `scale 1 → 1.6, alpha 1 → 0, repeat -1, duration 1500ms`
9. **GEBER** (`setState('geber')`):
   - Krone-Icon über dem Nameplate, floating Animation: `y +0 → -3px, yoyo, repeat -1, duration 2000ms`
10. **VORBEHALT** (`showVorbehalt()`):
    - Sub-Label `VORBEHALT?` in Blau (`#44aaff`), Pulse: `alpha 0.5 → 1, yoyo, repeat -1, duration 900ms`
    - `clearVorbehalt()` entfernt das Label und stoppt den Tween.
11. Beim Wechsel von einem State in einen anderen: alle vorigen State-Tweens stoppen, neue starten.

### RE/KONTRA Badge

12. Badge erscheint mit Bounce-Animation beim Aufruf von `showAnsage()`:
    ```typescript
    badge.setScale(0).setAlpha(0);
    scene.tweens.add({ targets: badge, scaleX: [0, 1.2, 1], scaleY: [0, 1.2, 1], alpha: { from: 0, to: 1 }, ease: 'Back.Out', duration: 500 });
    ```
13. Badge bleibt **permanent sichtbar** — es gibt keine `hideAnsage()`-Methode (Ansagen sind nicht rücknehmbar).
14. RE-Badge: Text `RE`, Hintergrund Gold (`#ffd700`), Textschatten `#7a5000`.
15. KONTRA-Badge: Text `KT`, Hintergrund Rot (`#ff4455`), Textschatten `#880022`.

### Shake-Effekt

16. `shake()` für Fuchs/Karlchen-Feedback:
    ```typescript
    scene.tweens.add({ targets: this, x: this.x + 4, yoyo: true, repeat: 3, duration: 50 });
    ```

### Positionierung der 4 Nameplates

17. Positionen relativ zur Canvas-Größe (aus `layout.ts`-Funktion `nameplatePositionFuer`):
    - **SUED (ich)**: x=76%, y=88% (rechts neben den Kartenfächern unten)
    - **NORD (oben)**: x=24%, y=15% (links neben den Kartenfächern oben)
    - **WEST (links)**: x=14%, y=50% (auf gleicher Höhe wie die Kartenfächer)
    - **OST (rechts)**: x=86%, y=50% (auf gleicher Höhe wie die Kartenfächer)
18. Für WEST und OST: Container um 90° rotieren (`setAngle(-90)` bzw. `+90`).

### Teamfarbe

19. Die Teamfarbe (RE = Gold `#ffd700`, KONTRA = Rot `#ff4455`) wird gesetzt sobald die Partei-Zuordnung bekannt ist (nach Vorbehalt-Phase).
20. Vor Bekanntgabe der Partei: Farbbalken in neutralem Lila `#3d2860`.

### Integration

21. `TischSzene.ts` instanziiert vier `Nameplate`-Objekte.
22. Event-Mapping:
    - `NaechsterSpielerErwartet` → `setState('amZug')` für aktiven Spieler, alle anderen `setState('default')`
    - `VorbehaltErwartet` → `showVorbehalt()` auf dem wartenden Spieler
    - `SpielGestartet` → alle Nameplates reset, Geber via `setState('geber')` setzen
    - `ANSAGE_ERFOLGT` → `showAnsage('re')` oder `showAnsage('kontra')` auf dem ansagenden Spieler
    - `FuchsGefangen` / `KarlchenGespielt` → `shake()` auf dem Täter-Nameplate

## Akzeptanzkriterien

- Alle 4 Spieler haben ein Nameplate an der korrekten Position.
- Am-Zug-State zeigt Glow, Namens-Blink und Pulse-Ring.
- RE/KONTRA-Badges blenden mit Bounce-Animation ein und bleiben sichtbar.
- Geber-Krone floating animiert.
- Vorbehalt-Label pulst und verschwindet nach Abschluss.
- Shake-Effekt bei Fuchs/Karlchen.
- Kein DOM, kein CSS.
- Alle Tweens beim Destroy gestoppt.

## Definition of Done

- [x] `Nameplate`-Klasse vollständig implementiert
- [x] Alle 4 States (`default`, `amZug`, `geber`, implizit via `showVorbehalt`)
- [x] RE/KONTRA-Badge mit Bounce-Animation
- [x] Geber-Krone mit Floating-Animation
- [x] Vorbehalt-Label mit Pulse
- [x] Shake-Effekt
- [x] Teamfarbe dynamisch setzbar
- [x] 4 Nameplates in `TischSzene.ts` integriert
- [x] Event-Mapping vollständig
- [x] `destroy()`-Lifecycle korrekt
- [x] Unit-Tests für State-Logik
- [ ] Visuelles Review via Vision Loop

## Technische Hinweise

- **Referenz**: `design_handoff/Nameplate_C_Prompt.md` enthält fertigen Phaser-Implementierungs-Prompt mit exakten Tween-Werten.
- **Krone-Icon**: Einfaches `Phaser.GameObjects.Graphics`-Polygon oder Text-Symbol `♛`.
- **KI-Label**: Kleines `KI`-Text-Objekt (`Press Start 2P`, 6px, Cyan `#33ffee`), Alpha 0.6.
- **BitmapFont**: `Press Start 2P` muss in der PreloadSzene geladen sein bevor `Nameplate` instanziiert wird.
- **Teamfarbe**: Wird erst nach dem Vorbehalt via `setTeamfarbe(partei: 're' | 'kontra')` gesetzt — bis dahin neutraler Balken.
- **Bestehende Positionsfunktion**: `layout.ts#nameplatePositionFuer()` liefert bereits korrekte x/y-Koordinaten — übernehmen.
