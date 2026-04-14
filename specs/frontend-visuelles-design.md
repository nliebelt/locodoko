# Frontend: Visuelles Design

| Feld           | Wert                                      |
|----------------|-------------------------------------------|
| Status         | Zu prüfen |
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

1. **Schriftart**: `Space Grotesk` (Google Fonts, kostenlos, OFL-Lizenz). Fallback: `system-ui, sans-serif`.
2. **Gewicht**: Überschriften `700` (Bold), Nameplates `600` (SemiBold), Fließtext `400` (Regular).
3. **Stil**: technisch, kantig, kein Italic außer für Spielstatus-Hinweise.
4. **Größen** (relativ zur Canvas-Breite, min. Werte für kleine Screens):
   - Spieltyp Top-Bar Mitte: `max(18px, 1.5vw)`
   - Stichzähler Top-Bar links: `max(14px, 1.1vw)`
   - Spieler-Nameplate: `max(13px, 1.0vw)`
   - Karten-Kürzel (Wert/Farbe): `max(15px, 1.1vw)`
   - Modal-Überschriften: `max(22px, 1.8vw)`

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

## Definition of Done

- [ ] Space Grotesk eingebunden (Google Fonts oder self-hosted)
- [ ] Farbpalette als CSS Custom Properties definiert (`--farbe-gold`, `--farbe-blau` etc.)
- [ ] vectorized-playing-cards heruntergeladen und in `frontend/public/assets/cards/` abgelegt
- [ ] Karten-Mapping implementiert (Doppelkopf → Dateiname)
- [ ] Harter Schlagschatten auf Karten und Buttons
- [ ] Sonderpunkt-Animationen (Fuchs, Karlchen, Doppelkopf)
- [ ] Ansage-Banner (Re/Kontra)
- [ ] Solo-Ankündigung
- [ ] Focus-Styles für Keyboard-Navigation
- [ ] Visuelles Review
