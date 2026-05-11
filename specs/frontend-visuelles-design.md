# Frontend: Visuelles Design

| Feld           | Wert                                      |
|----------------|-------------------------------------------|
| Status         | Aktive Vorgabe |
| Priorität      | Hoch                                      |
| Abhängigkeiten | frontend-tischansicht.md, frontend-animationen.md |

## Beschreibung

Dieses Dokument definiert die visuelle Sprache von Loco Doko. Die Basis ist **Neo-Brutalism**: klare Strukturen, harte Kontraste, bold. Überlagert werden **Balatro-Momente**: kurze, dramatische Animationen und Lichteffekte für besondere Spielereignisse. Im Ruhezustand ist die UI lesbar und ruhig — sie explodiert nur wenn es spielerisch relevant ist.

Das Design ist **dunkel und technisch**, nicht weich oder verspielt. Karten sind das Herzstück — alles andere dient ihnen.

## Farbpalette

```text
Hintergrund (Tisch):    #0d1f12   sehr dunkles Grün — fast schwarz, lebt durch Textur
Surface (Panels):       #1a3a24   dunkles Grün für Karten-Rücken, Modals, Nameplates
Border (Standard):      #2d5a3d   gedämpftes Grün für Trennlinien
Border (Akzent):        #f8f9fa   Weiß für Neo-Brutalist-Rahmen wo gewünscht
Text (Primär):          #f8f9fa   fast Weiß
Text (Sekundär):        #a3c4a8   gedämpftes Grün-Weiß für Labels und Hints
Akzent Gold:            #ffd166   Re-Partei, Dulle, Fuchs, aktiver Spieler
Akzent Blau:            #90caf9   Kontra-Partei
Akzent Rot:             #ef4444   Fehler, Danger-Actions
Akzent Grün:            #4ade80   Bestätigungen, erfolgreiche Aktionen
```

## Typografie

**Eine Schriftart für das gesamte Spiel:**

**`Press Start 2P`** (Pixel-Arcade-Font, lokal gebundelt unter `frontend/public/assets/fonts/`):
- Rollen: alle UI-Elemente — Nameplates, Flash-Text, Modal-Titel, Badges (RE/KONTRA), Spielergebnis-Überschriften, Spielprotokoll, Buttons.
- Wird als Phaser `BitmapFont` geladen (`this.load.bitmapFont`) für performantes Gameplay-Rendering.
- Fallback: `monospace`.
- Größen (px, Phaser-Einheiten): XL 28 · LG 20 · MD 14 · SM 10 · XS 8. Minimum: 8px.
- Lizenz: SIL Open Font License (Google Fonts).

## Karten

### Kartenvorderseiten

1. Karten verwenden das **vectorized-playing-cards**-Set von Chris Aguilar (Public Domain, GitHub: `notpeter/playingcards`).
2. Die PNGs werden in `frontend/public/assets/cards/` abgelegt.
3. Dateiname-Konvention: `{wert}_{farbe}.png` — z.B. `queen_of_clubs.png`, `10_of_hearts.png`.
4. Mapping auf Doppelkopf-Begriffe:

   | Doppelkopf | Englisch (Dateiname) |
   |------------|----------------------|
   | KREUZ      | clubs                |
   | PIK        | spades               |
   | HERZ       | hearts               |
   | KARO       | diamonds             |
   | AS         | ace                  |
   | ZEHN       | 10                   |
   | KOENIG     | king                 |
   | DAME       | queen                |
   | BUBE       | jack                 |
   | NEUN       | 9                    |

5. Kartengröße im Spiel: **110×165px**, skaliert proportional.
6. Karten haben einen **harten Schlagschatten** (Neo-Brutalism, nicht weich): `4px 4px 0 rgba(0,0,0,0.8)`.

### Kartenrücken

1. Einheitliches Muster: dunkles Grün (`#123524`) mit diagonalem Linienmuster in `#d8f3dc` (Opazität 0.55).
2. Gleicher harter Schlagschatten wie Vorderseiten.
3. Abgerundete Ecken: `8px`.

### Karten-Highlighting

1. **Spielbare Karte (hover)**: Y-Versatz -10px, kein Glow.
2. **Ausgewählte Karte (Tastatur)**: Weißer Rahmen `2px solid #f8f9fa`, Y-Versatz -6px.
3. **Nicht spielbare Karte**: Alpha `0.45`, kein Hover-Effekt.
4. **Keine Karten-Glows im Normalbetrieb** — Trümpfe sind nicht anders markiert als Fehlfarben (wie beim echten Spiel: man muss selbst wissen was Trumpf ist).

## Neo-Brutalism Grundprinzipien

1. **Harte Ränder**: Modals, Panels und Buttons haben `border: 2px solid #f8f9fa` — kein `border-radius` über 4px außer bei Karten.
2. **Offset-Schatten**: Interaktive Elemente haben `box-shadow: 4px 4px 0 #000` (hart, nicht weich/blur).
3. **Kein backdrop-filter blur** im Spielbetrieb — nur in Modals erlaubt.
4. **Hoher Kontrast**: Text auf dunklem Grund ist immer `#f8f9fa`, niemals gedimmt unter 70% Opazität.
5. **Bold-first**: Überschriften und Labels sind immer mindestens `font-weight: 600`.

## Balatro-Momente

Diese Effekte treten **kurz und gezielt** auf, dann kehrt die UI zur Ruhe zurück. Keine Dauerzustände.

### Sonderpunkt-Feedback

1. **Fuchs gefangen**: Goldener Schimmer-Burst (200ms) auf der gefangenen Karte + Toast „Fuchs gefangen! +1".
2. **Karlchen** (letzter Stich mit Kreuz-Bube): Kurzes weißes Aufleuchten der Karte + Toast „Karlchen! +1".
3. **Doppelkopf** (Stich ≥ 40 Augen): Stich-Bereich leuchtet kurz golden auf + Toast „Doppelkopf! +1".

### Ansage-Feedback

1. Wenn ein Spieler **Re** oder **Kontra** ansagt: Banner erscheint mittig, 1.2s sichtbar, fährt dann weg.
   - Re: `#ffd166` (gold) auf `#0d1f12`
   - Kontra: `#90caf9` (blau) auf `#0d1f12`
2. Banner-Typografie: sehr groß (`3vw`), `font-weight: 900`, Versalien.

### Solo-Ankündigung

1. Wenn ein **Solo** gespielt wird: einmalige dramatische Einblendung des Spieltyps (1.5s).
2. Text fährt von oben ein, verweilt kurz, fährt wieder heraus.
3. Stil: großer Text (`4vw`), `font-weight: 900`, Farbe `#f8f9fa`, Schatten.

### Stich-Gewinn

1. Stich-Einziehen-Animation: Karten bewegen sich gesammelt zur Gewinner-Position (500–700ms, wie bisher).
2. **Kein extra Glow** beim normalen Stich-Gewinn — nur bei Sonderpunkten.

## Tischhintergrund

1. **Grüner Filz** (Standard): `#0d1f12` mit subtiler Textur (Streifen-Muster aus `AssetLoader`).
2. **Dunkles Holz**: braun-dunkles Holzmuster.
3. **Blaue Grafik**: `#10304a` mit Liniengitter.
4. Hintergrund ist als `TileSprite` implementiert (bestehende Implementierung bleibt).

## Accessibility

1. Alle interaktiven Elemente haben `:focus-visible`-Styles (Outline `2px solid #ffd166`).
2. Farbkodierung (Re/Kontra gold/blau) wird **nie als einziges** Unterscheidungsmerkmal genutzt — es gibt immer auch Text-Labels.
3. Toast-Notifications haben `aria-live="polite"`.

## Balatro-UI-Palette (Overlays, Nameplates, Flash-Text)

Diese Farben gelten ausschließlich für UI-Overlays die über dem Spieltisch liegen (Nameplates, Flash-Text-Cards, Modals). Der Spieltisch selbst bleibt grün.

```
Panel Background:  #1a1020   (sehr dunkles Lila — fast schwarz)
Card BG:           #221530   (Nameplate- und Flash-Card-Hintergrund)
Card BG Dark:      #2d1d40   (aktiver Zustand, hover)
Border Standard:   #4a2d6a   (Lila für Trennlinien)
Text:              #f0e6ff   (helles Lila-Weiß)
Text Muted:        #7a5a9a   (gedämpft für Labels)

Gold:              #ffd700   (RE-Partei, Karlchen, Doppelkopf) — Shadow: 4px 4px 0 #7a5000, 0 0 20px #ffd700
Red:               #ff4455   (KONTRA-Partei, Verloren)          — Shadow: 4px 4px 0 #880022
Blue:              #44aaff   (Vorbehalt, Ansagen-Chip)
Green:             #44ff88   (Gewonnen, Stich)                  — Shadow: 4px 4px 0 #006633, 0 0 20px #44ff88
Fox Orange:        #ff8833   (Fuchs gefangen)                   — Shadow: 4px 4px 0 #884400, 0 0 20px #ff8833
Pink:              #ff55cc   (Schweinchen)                      — Shadow: 4px 4px 0 #880066, 0 0 20px #ff55cc
Cyan:              #33ffee   (SpielGestartet, KI-Label)         — Shadow: 4px 4px 0 #006655, 0 0 20px #33ffee
```

Design-Referenz: `design_handoff/README.md` (Abschnitt "Design Tokens").

## Definition of Done

- [x] Space Grotesk eingebunden (Google Fonts oder self-hosted)
- [x] Farbpalette als CSS Custom Properties definiert (`--farbe-gold`, `--farbe-blau` etc.)
- [x] vectorized-playing-cards heruntergeladen und in `frontend/public/assets/cards/` abgelegt
- [x] Karten-Mapping implementiert (Doppelkopf → Dateiname)
- [x] Harter Schlagschatten auf Karten und Buttons
- [x] Sonderpunkt-Animationen (Fuchs, Karlchen, Doppelkopf)
- [x] Ansage-Banner (Re/Kontra)
- [x] Solo-Ankündigung
- [x] Focus-Styles für Keyboard-Navigation
- [x] Visuelles Review
- [ ] `Press Start 2P` lokal gebundelt und als BitmapFont in PreloadSzene geladen
- [x] Balatro-UI-Palette als Konstanten-Datei `frontend/src/ui/designTokens.ts`
