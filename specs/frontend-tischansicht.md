# Frontend: Tischansicht

| Feld           | Wert                                                                    |
|----------------|-------------------------------------------------------------------------|
| Status         | Implementiert |
| Priorität      | Hoch                                                                    |
| Abhängigkeiten | kartendeck.md, websocket-kommunikation.md, frontend-visuelles-design.md |

## Beschreibung

Die Tischansicht ist das zentrale Spielfeld. Sie nutzt die **volle Canvas-Fläche** (1280×720px) ohne seitliche Panels. Das Zielbild ist eine vollständig in Phaser gerenderte Tisch-UI: HUD, Seitenlade, Einstellungen, Overlays und Spielaktionen gehören zur Szene und werden nicht als separate HTML-Schicht über den Tisch gelegt. Der menschliche Spieler sitzt unten (Süd), die anderen Spieler an West, Nord und Ost.

## Layout-Übersicht

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Stich 4/12          Trumpfsolo · Spiel 3/12              [≡]  [⚙]  [🐛]   │ ← HUD Top-Bar (40px)
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│              [🂠][🂠][🂠][🂠][🂠][🂠][🂠]                                 │
│              Friedhelm · KI · RE · 2 Stiche · [G]                          │  ← Nord
│                                                                             │
│  [🂠][🂠][🂠]                                    [🂠][🂠][🂠]              │
│  Berta · KI · KONTRA · 1 Stich             Carlo · KI · RE · 3 Stiche     │  ← West / Ost
│                                                                             │
│                      ┌─────────────────┐                                   │
│                      │  K♦  D♥         │                                   │
│                      │     10♣  A♠     │                                   │
│                      └─────────────────┘                                   │
│                                                                             │
│                   [ Re ansagen ]  [ Keine 90 ]                             │  ← Floating Actions
├─────────────────────────────────────── Du · RE · 4 Stiche ─────────────────┤
│   [K♦] [D♥] [B♣] [10♠] [A♦] [9♣] [K♥] [D♠] [B♦] [10♣] [K♣] [9♦]     │  ← Eigene Karten
└─────────────────────────────────────────────────────────────────────────────┘
```

## Anforderungen

### HUD Top-Bar

1. Die Top-Bar ist **40px hoch** und überspannt die volle Breite.
2. **Links**: Stichzähler im Format `Stich X/12`.
3. **Mitte**: Spieltyp (z.B. `Trumpfsolo`, `Hochzeit`, `Normales Spiel`) und Partie-Fortschritt (`Spiel 3/12`). Spieltyp wird angezeigt sobald bekannt (nach Vorbehalt-Phase), davor `Vorbehalt läuft…`.
4. **Rechts**: Icon-Buttons — `[≡]` öffnet Seitenlade, `[⚙]` öffnet Einstellungs-Modal, `[🐛]` togglet Debug-Modus.
5. Die Top-Bar ist **immer sichtbar** und überlagert nie Spielinhalte.

### Spielerpositionen

1. Jeder Spieler wird als **Nameplate** direkt bei seinen Kartenrücken dargestellt — **keine Kreise oder Avatare**.
2. Das Nameplate zeigt in einer Zeile: `Name · [KI/Mensch] · [RE/KONTRA] · X Stiche · [G]`
   - `[RE]` / `[KONTRA]` erscheint sobald die Partei bekannt ist (nach Vorbehalt oder nach erster Ansage).
   - `[G]` (Geber-Marker) ist immer sichtbar wenn der Spieler Geber ist.
   - Stichzähler ist **für alle vier Spieler gleich** sichtbar, einschließlich Süd.
3. Der **aktive Spieler** (aktuell am Zug) wird visuell hervorgehoben — Nameplate leuchtet auf (Akzentfarbe, siehe `frontend-visuelles-design.md`). **Kein separater "Am Zug: X"-Text im Canvas** — das Nameplate-Highlight ist die einzige Anzeige.
4. **Nameplate-Position relativ zu den Karten** (nicht darunter/darüber):
   - **SUED**: Nameplate **rechts** neben dem Kartenfächer
   - **NORD**: Nameplate **rechts** neben dem Kartenfächer
   - **WEST**: Nameplate **unterhalb** des Kartenstapels
   - **OST**: Nameplate **oberhalb** des Kartenstapels
5. Spielerpositionen als feste Koordinaten relativ zur Canvas-Größe:
   - **SUED**: unten, `y: 85%`, Karten bei `y: 89%`
   - **NORD**: oben, `y: 15%`, Karten bei `y: 11%`
   - **WEST**: links, `x: 14%`, Karten bei `x: 10%`
   - **OST**: rechts, `x: 86%`, Karten bei `x: 90%`
6. Die seitlichen Spieler (OST/WEST) müssen vollständig **innerhalb des Canvas** bleiben — Kartenabstände und Nameplates dürfen nicht überlappen oder abgeschnitten werden.

### Kartendarstellung

1. Kartengröße: **110×165px** (vorher 82×124px). Skaliert proportional bei kleineren Viewports.
2. Eigene Karten (Süd): aufgefächert, alle sichtbar, sortiert (Trümpfe links, Fehlfarben rechts).
3. Gegnerische Karten: **Kartenrücken-Fächer** — kein Kreis, kein Avatar, nur die Karten selbst.
4. Karten verwenden das **vectorized-playing-cards**-Set von Chris Aguilar (Public Domain). Kein programmatisches Zeichnen mehr für Kartenvorderseiten.
5. **Karten-Hintergrund**: Jede Karte hat einen weißen Hintergrund — die PNG-Assets sind transparent und müssen auf dem dunklen Tisch lesbar sein.
6. Kartenrücken: einheitliches Design gemäß `frontend-visuelles-design.md`.
7. Im **Debug-Modus** werden alle gegnerischen Karten aufgedeckt (vectorized-playing-cards).
8. **Duplikat-Texte entfernen**: Kein großer Titeltext (`„von Spieler X · Spieltyp · Phase"`) im Canvas-Bereich — diese Infos stehen bereits in der HUD Top-Bar. Kein „Noch keine Karte im laufenden Stich"-Placeholder — leerer Canvas ist korrekt.

### Stichmitte

1. Die vier Stich-Slots sind **proportional zur Spielgröße** positioniert (relativ zur Mitte).
2. Gespielte Karten sind klar dem Spieler zugeordnet (Position im Slot entspricht Spielerposition): SUED-Karte unten, NORD-Karte oben, WEST-Karte links, OST-Karte rechts.
3. Die Karten liegen **leicht überlappend und minimal rotiert** (je nach Position) — wie auf einem echten Tisch, nicht exakt ausgerichtet.
4. **Keine Spielernamen** an den Stich-Karten — die Position im Slot macht die Zuordnung deutlich.
5. Wenn kein Stich läuft: leerer Bereich, kein Platzhaltertext.

### Stich-Stapel beim Gewinner

1. Gewonnene Stiche werden als **kleiner gestapelter Fächer rechts neben dem Kartenfächer** des Gewinners angezeigt.
2. Bei SUED: Stapel rechts neben der eigenen Hand. Bei den Gegnern: analog zu ihrer Kartenposition.
3. Der Stapel wächst mit jedem gewonnenen Stich — sichtbarer Fortschritt.
4. **Letzten Stich umdrehen**: Klick auf **jeden** Stapel (eigenen oder gegnerischen) oder dedizierte Taste deckt die 4 Karten des letzten gewonnenen Stichs dieses Spielers kurz auf — wie im echten Doppelkopf erlaubt. Nach kurzer Zeit oder erneutem Klick werden sie wieder verdeckt.

### Floating Action Bar

1. Ansage-Buttons (Re, Kontra, Keine 90 etc.) erscheinen als **kompakte Floating-Bar** zwischen Stichmitte und eigenen Karten.
2. Die Bar ist **nur sichtbar wenn eine Aktion möglich ist** — sie erscheint und verschwindet kontextuell.
3. Vorbehalt-Optionen erscheinen **nicht** als Floating-Bar, sondern als **modales Overlay** (siehe `frontend-ui-logik.md`).

### Seitenlade `[≡]`

1. Öffnet sich von links als Overlay-Panel (nicht verdrängend).
2. Inhalt: Spieler am Tisch (mit Partei-Info), Gesamtpunktestand, Ansagehistorie der laufenden Runde, Letzte-Stiche-Liste.
3. Klick außerhalb oder erneuter `[≡]`-Klick schließt die Lade.
4. Die Seitenlade ist Teil der Phaser-Szene, nicht der HTML-DOM-Schicht.

### Einstellungs-Modal `[⚙]`

1. Öffnet zentriertes Modal.
2. Inhalt: Tischhintergrund (Auswahl), KI-Schwierigkeit (Auswahl), Animationsgeschwindigkeit (1x/2x/sofort), Button „Tisch verlassen", Button „Zur Lobby".
3. Tischkonfiguration nur veränderbar wenn Tischersteller und Status WARTEND.
4. Das Einstellungs-Modal ist Teil der Phaser-Szene, nicht der HTML-DOM-Schicht.

## Akzeptanzkriterien

- Keine HTML-Panels blockieren die Spielfläche (West, Ost, Stichmitte, Karten).
- Alle vier Spieler sind gleichzeitig ohne Überlappung sichtbar.
- Re/Kontra-Zuordnung ist bei allen Spielern lesbar sobald bekannt.
- Stich X/12 steht oben links, Spieltyp oben Mitte.
- Karten sind mit vectorized-playing-cards dargestellt und deutlich größer als bisher.
- Floating Action Bar erscheint nur wenn eine Aktion möglich ist.
- Seitenlade und Einstellungs-Modal öffnen korrekt und blockieren nicht dauerhaft das Spielfeld.

## Definition of Done

- [x] HUD Top-Bar implementiert (Stichzähler links, Spieltyp Mitte, Icons rechts)
- [x] Spieler-Nameplates statt Kreise implementiert
- [x] Nameplate-Position: SUED/NORD rechts neben Karten, WEST unterhalb, OST oberhalb
- [x] vectorized-playing-cards integriert (Laden, Mapping auf Doppelkopf-Karten)
- [x] Weißer Karten-Hintergrund hinter jedem Karten-Sprite
- [x] Kartengröße auf 110×165px erhöht
- [x] Duplikat-Texte und Placeholder-Texte entfernt (kein „Am Zug", kein „Noch keine Karte", kein Titeltext)
- [x] OST/WEST vollständig innerhalb des Canvas (kein Overflow)
- [x] Stich-Karten gestampelt in Stichmitte (Position nach Spielerrichtung, keine Namen)
- [x] Stich-Stapel beim Gewinner sichtbar
- [x] Letzten Stich umdrehen funktioniert
- [x] Floating Action Bar implementiert
- [x] Seitenlade implementiert
- [x] Einstellungs-Modal implementiert
- [x] Alle vier Spieler ohne Panel-Überlappung sichtbar
- [x] Debug-Modus mit aufgedeckten Karten funktioniert
- [x] Visuelles Review / Plausibilitätsprüfung

## Technische Hinweise

- **vectorized-playing-cards**: PNGs als Einzeldateien in `frontend/public/assets/cards/`. Mapping-Konvention: `{farbe}_{wert}.png` → z.B. `kreuz_dame.png`, `herz_10.png`.
- Canvas skaliert mit `Phaser.Scale.FIT`, Koordinaten bleiben relativ zur Spielgröße.
- Seitenlade, Modals und andere Overlays als Phaser-Layer bzw. Phaser-Container über dem Spielfeld.
- Floating Action Bar als Phaser-UI, an untere Kanten des Canvas gebunden.
