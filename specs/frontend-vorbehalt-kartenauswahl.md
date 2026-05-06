# Frontend: Vorbehalt-Kartenauswahl

| Feld           | Wert                                                                         |
|----------------|------------------------------------------------------------------------------|
| Status         | In Bearbeitung                                                               |
| Priorität      | Mittel                                                                       |
| Abhängigkeiten | frontend-tischansicht.md, frontend-tastatursteuerung.md, trumpfhierarchie.md |

## Beschreibung

Die klassische Vorbehalt-Dialogbox (Buttons in einem Overlay-Fenster) wird durch eine
**kartenbasierte Auswahl** ersetzt. Die Handkarten des Spielers werden selbst zum Menü:
Beim Navigieren mit ←/→ sortieren sie sich gemäß der Trumpfhierarchie des aktuell
ausgewählten Vorbehalts neu, und die spieltyp-relevanten Karten ragen nach oben heraus.
Über der Hand erscheint der Name des Vorbehalts als großer Text.

Das Feature ist ein **reines Client-Gimmick** — keine Backend-Änderungen, keine neuen
WebSocket-Nachrichten. Die Auswahl selbst (`appStore.meldeVorbehalt()`) bleibt unverändert.

---

## Visuelles Konzept

### Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              ◄  Damensolo  ►   (2 von 5)               │  ← Label-Zeile
│                                                         │
│     ┌───┐ ┌───┐           ┌───┐ ┌───┐                  │
│     │K♣ │ │K♠ │ ┌───┐     │D♣ │ │D♠ │  ← Damen oben  │  ← Karten-Reihe
│     └───┘ └───┘ │ … │     └───┘ └───┘                  │
│                 └───┘                                   │
│         (restliche Karten auf Grundlinie)               │
└─────────────────────────────────────────────────────────┘
```

### Label-Zeile

- Zentriert über der Hand, ca. 20–25 px über dem oberen Kartenrand
- Großer Text: Vorbehalt-Name (z.B. „Damensolo", „Gesund", „Hochzeit")
- Links/rechts davon: `◄` / `►` als Navigationspfeile (immer sichtbar, wrapping)
- Rechts davon: Position-Indikator `(2 von 5)` in kleiner Schrift
- Beim Wechsel: kurzer Fade-Out → Fade-In des Textes (~100 ms)

### Karten-Elevation

Spieltyp-relevante Karten ragen **25 px nach oben** aus der normalen Hand-Grundlinie heraus.
Die Zuordnung richtet sich nach dem aktuell ausgewählten Vorbehalt:

| Vorbehalt             | Hervorgehobene Karten                                     |
|-----------------------|-----------------------------------------------------------|
| `GESUND`              | Alle Normalspiel-Trümpfe (Damen, Buben, Karo, H-Zehn)    |
| `HOCHZEIT`            | Die beiden Kreuz-Damen                                     |
| `ARMUT`               | Alle Normalspiel-Trümpfe (wenige — das ist der Punkt)     |
| `SOLO_DAME`           | Alle vier Damen                                           |
| `SOLO_BUBE`           | Alle vier Buben                                           |
| `SOLO_FLEISCHLOS`     | Keine Karte (flache Hand — kein Trumpf)                   |
| `SOLO_TRUMPF`         | Alle Normalspiel-Trümpfe                                  |
| `SOLO_TRUMPF_HERZ`    | Damen + Buben + alle Herz-Karten                         |
| `SOLO_TRUMPF_PIK`     | Damen + Buben + alle Pik-Karten                          |
| `SOLO_TRUMPF_KREUZ`   | Damen + Buben + alle Kreuz-Karten                        |
| `SCHMEISSEN_*`        | Keine Karte (Schmeißen = alle wegwerfen)                  |

### Karten-Sortierung (Preview-Sort)

Die Karten in der Hand werden gemäß der Trumpfhierarchie des ausgewählten Vorbehalts
**client-seitig umsortiert**. Diese Sortierung ist temporär — sie gilt nur während der
Vorbehalt-Phase und wird beim ersten echten Snapshot überschrieben.

Mapping `VorbehaltAnsage` → `Spieltyp` für die Sortierlogik:

| VorbehaltAnsage            | Spieltyp für Sortierung |
|----------------------------|-------------------------|
| `GESUND`, `HOCHZEIT`, `ARMUT`, `SCHMEISSEN_*` | `NORMALSPIEL` |
| `SOLO_DAME`                | `SOLO_DAME`             |
| `SOLO_BUBE`                | `SOLO_BUBE`             |
| `SOLO_FLEISCHLOS`          | `SOLO_FLEISCHLOS`       |
| `SOLO_TRUMPF`              | `SOLO_TRUMPF`           |
| `SOLO_TRUMPF_HERZ`         | `SOLO_TRUMPF_HERZ`      |
| `SOLO_TRUMPF_PIK`          | `SOLO_TRUMPF_PIK`       |
| `SOLO_TRUMPF_KREUZ`        | `SOLO_TRUMPF_KREUZ`     |

---

## Interaktion

### Navigation

| Taste          | Aktion                                             |
|----------------|----------------------------------------------------|
| `←` / `↑`     | Vorherige Option (wrapping)                        |
| `→` / `↓` / `Tab` | Nächste Option (wrapping)                      |
| `Enter` / `Space` | Aktuelle Option bestätigen → `meldeVorbehalt()` |
| `1`–`9`        | Direkte Auswahl per Index (Power-User-Shortcut)   |

Kein Klick auf einzelne Karten — die gesamte Hand-Fläche fungiert als „Bestätigungs-Fläche"
(Klick auf eine beliebige Karte = aktuelle Auswahl bestätigen).

### Vorbelegung (Smart Default)

`tastaturVorbehaltIndex` startet auf dem Index von `GESUND` in `moeglicheVorbehalte`,
oder 0 wenn `GESUND` nicht in der Liste ist. So kann der Spieler direkt Enter drücken
(Slot-Maschinen-Verhalten: Standard ist immer sinnvoll).

---

## Technische Umsetzung

### Neue / geänderte Funktionen

#### `TischAnsichtModell.ts` (neue Exports)

```typescript
/**
 * Gibt den Spieltyp zurück, der für die Preview-Sortierung im Vorbehalt-Modus
 * zu einer VorbehaltAnsage gehört. HOCHZEIT/ARMUT/SCHMEISSEN sortieren wie NORMALSPIEL.
 */
export function vorbehaltZuSpieltypFuerSortierung(v: VorbehaltAnsage): Spieltyp

/**
 * Gibt true zurück wenn die Karte im Kontext des Vorbehalts visuell hervorgehoben
 * werden soll (nach oben ragen). Reine Darstellungslogik.
 */
export function istHervorgehobeneKarteImVorbehalt(karte: KarteAntwort, vorbehalt: VorbehaltAnsage): boolean

/**
 * Sortiert Karten für die temporäre Vorbehalt-Preview.
 * Nutzt bestehende vergleicheKarten()-Logik mit gemapptem Spieltyp.
 */
export function sortiereKartenFuerVorbehalt(karten: KarteAntwort[], vorbehalt: VorbehaltAnsage): KarteAntwort[]
```

#### `TischSzene.ts`

- **`renderVorbehaltDialog()`** wird gelöscht (ersetzt durch neue Darstellung in `renderHand`)
- **`renderHand()`**: Im Vorbehalt-Modus
  1. Preview-Sort auf `sichtbareHandkarten` anwenden
  2. Elevation-Flag pro Karte berechnen → Y-Offset `-25px`
  3. Neue `renderVorbehaltLabel()`-Methode aufrufen (Text + Pfeile über der Hand)
- **`renderVorbehaltLabel()`**: Neuer privater Renderer für Label, Pfeile und Positions-Indikator

#### `TischInputHandler.ts`

Keine Änderungen nötig — Left/Right und Enter sind bereits korrekt implementiert.

### Render-Sicherheit

Die Preview-Sortierung findet in `renderHand()` statt und liest nur `this.tastaturVorbehaltIndex`.
Wenn ein WebSocket-Update `renderTisch()` triggert, werden die Karten neu gerendert —
mit dem aktuellen `tastaturVorbehaltIndex`.

---

## Ausbaustufe: Animierter Vorbehalt-Wechsel

Beim Wechsel zwischen Vorbehalten (←/→) sollen die Karten **animiert** in ihre neue Position gleiten — sowohl die Elevation (Y-Achse) als auch die Sortierung (X-Achse). Das ergibt ein hochwertiges, spielerisches Feedback: der Spieler sieht welche Karten für den gewählten Spieltyp relevant sind.

### Anforderung

```gherkin
Given
  - Spieler ist in Vorbehalt-Phase
  - Karten sind in der Hand dargestellt

When
  - Spieler drückt ← oder → und wechselt den Vorbehalt

Then
  - Karten gleiten animiert in ihre neue Y-Position (Elevation hoch/runter)
  - Karten gleiten animiert in ihre neue X-Position (Reihenfolge gemäß neuem Spieltyp)
  - Animation dauert ~150–200 ms, danach ist die Hand im neuen Zustand stabil
  - Läuft ein WebSocket-Update während der Animation ein, wird die Animation abgebrochen
    und der neue Zustand sofort gerendert (kein Tween-Konflikt)
```

### Technische Voraussetzung: Reconciliation-Pattern für Karten-Objekte

Der aktuelle Render-Ansatz (`renderTisch()` zerstört und recreates alle Karten-Objekte)
macht positionsbasierte Tweens unmöglich — es gibt kein altes Objekt mehr, von dem aus
animiert werden könnte.

**Nötiges Refactoring:** `renderHand()` wechselt von destroy/recreate auf ein
**Reconciliation-Modell**:

```
Given  - existierendes Karten-Objekt mit Karte-ID X an Position (x1, y1)
When   - neuer Render-State platziert Karte X an Position (x2, y2)
Then   - Objekt wird NICHT zerstört, sondern per Tween von (x1,y1) → (x2,y2) animiert
```

- Jede Karte braucht eine stabile Referenz (Map `karteId → PhaserObject`)
- Karten die aus der Hand verschwinden (gespielt) werden nach dem Tween destroyed
- Neue Karten (z.B. nach Armut-Tausch) erscheinen mit kurzer Fade-In-Animation
- Laufende Tweens müssen beim Scene-Destroy sauber abgebrochen werden

Dieses Refactoring betrifft nur `renderHand()` innerhalb von `TischSzene.ts` — andere
Render-Methoden bleiben unverändert.

---

## Akzeptanzkriterien

- Im Vorbehalt-Modus erscheint **kein Dialog-Fenster** mehr — stattdessen Label + Kartenelevation
- Links/Rechts wechselt den Vorbehalt, die Karten sortieren und elevieren sich entsprechend
- Beim Wechsel gleiten Karten animiert in ihre neue Position (Elevation + Sortierung)
- Label zeigt Vorbehalt-Name, Pfeile und Position-Indikator korrekt an
- Enter bestätigt die aktuelle Auswahl korrekt
- Standard-Vorbelegung ist `GESUND` (oder Index 0)
- Klick auf eine Karte bestätigt die aktuelle Auswahl (nicht: wählt diese Karte aus)
- Alle Vorbehalt-Typen zeigen die korrekte Elevation (Tabelle oben)
- Kein JS-Fehler wenn `moeglicheVorbehalte` leer ist (kein Vorbehalt-Modus aktiv)
- Kein Tween-Konflikt bei WebSocket-Updates während der Animation
- `npm run build` und `npm test` grün

## Definition of Done

- [x] `vorbehaltZuSpieltypFuerSortierung()` in `TischAnsichtModell.ts` implementiert und getestet
- [x] `istHervorgehobeneKarteImVorbehalt()` in `TischAnsichtModell.ts` implementiert und getestet
- [x] `sortiereKartenFuerVorbehalt()` in `TischAnsichtModell.ts` implementiert und testbar
- [x] `renderVorbehaltDialog()` aus `TischSzene.ts` entfernt
- [x] `renderHand()` unterstützt Preview-Sort und Kartenelevation
- [x] `renderVorbehaltLabel()` implementiert (Text, Pfeile, Positions-Indikator)
- [x] Klick auf Karte im Vorbehalt-Modus bestätigt die aktuelle Auswahl
- [x] Vorbelegung auf `GESUND`-Index korrekt
- [ ] `specs/frontend-tastatursteuerung.md` aktualisiert (Vorbehalt-Sektion)
- [ ] `renderHand()` auf Reconciliation-Pattern umgestellt (stabile Karten-Referenzen)
- [ ] Animierter Vorbehalt-Wechsel implementiert (Y + X Tweens, ~150–200 ms)
- [ ] Tween-Abbruch bei WebSocket-Update während Animation
- [ ] Vision Loop (Playwright headed) bestätigt korrektes visuelles Ergebnis
