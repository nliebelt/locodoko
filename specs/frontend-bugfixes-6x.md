# Frontend UI Bugfixes — 6.x

Spezifikation für bekannte UI-Defekte, erfasst am 2026-04-04.
Referenz für Ralph beim Abarbeiten der Einträge 6.1–6.8 im IMPLEMENTATION_PLAN.

---

## 6.1 — Karten fehlen beim ersten Start

**Problem:** Beim allerersten Seitenaufruf werden die Karten nicht gerendert. Ein Browser-Reload behebt es.

**Ursache-Hypothese:** Race Condition — `renderTisch()` wird aufgerufen bevor Phaser die Szene und Texturen vollständig initialisiert hat. Der AppStore liefert bereits den ersten Zustand, aber Phaser ist noch nicht `ready`.

**Soll:** Karten werden beim ersten Aufruf korrekt gerendert, ohne Browser-Reload.

**Fix-Ansatz:**
- `TischSzene.ts`: Sicherstellen dass `renderTisch()` erst nach vollständigem Phaser-`create()` aufgerufen wird.
- AppStore-Listener erst in `create()` registrieren (nicht im Konstruktor).
- Falls nötig: initialen Zustand einmalig in `create()` nachziehen (`appStore.snapshot()` aufrufen und direkt rendern).

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Neue Seite öffnen (kein Reload), Spiel starten — Karten müssen sofort sichtbar sein.

---

## 6.2 — Karten-Spielanimation für andere Spieler fehlt

**Problem:** Karten von Mitspielern erscheinen ohne Animation plötzlich in der Stichmitte. Die eigene Karte hat eine Gleit-Animation (300–500ms), fremde Karten nicht.

**Soll:** Alle Karten — eigene und fremde — gleiten animiert vom Kartenfächer zur Stichmitte. Fremde Karten werden dabei umgedreht (verdeckt → offen).

**Fix-Ansatz:**
- `TischSzene.ts`: Bei eingehendem `KarteGespielt`-Event für fremde Spieler:
  1. Karte als verdecktes Objekt an der Fächer-Position des Gegners erstellen.
  2. `AnimationenService.animiereKarteAusspielen()` aufrufen (Startposition = Fächerposition des Gegners).
  3. Während oder nach dem Gleiten: Karte aufdecken (verdeckt → offen) mit Flip-Tween oder direktem Texturwechsel.
- `AnimationenService.animiereKarteAusspielen()` muss Startposition als Parameter akzeptieren (oder bereits so ausgelegt sein).

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

**Verifikation:** Vision Loop — Karte eines KI-Spielers erscheint animiert in der Stichmitte.

---

## 6.3 — Stichanimation: Punkte anzeigen + richtiger Stapel

**Problem 1:** Animation zeigt "+1 Stich" statt die echte Augenzahl des Stichs.

**Problem 2:** Karten fliegen beim Sticheinziehen nicht zum Stich-Stapel des Gewinners, sondern zu einer generischen Position.

**Soll:**
- Popup-Text zeigt "+X Augen" (z.B. "+14 Augen").
- Karten fliegen zum Stich-Stapel des jeweiligen Stichgewinners (Position des Stapels neben seinem Kartenfächer).
- Stich-Stapel wächst sichtbar (jede eintreffende Karte vergrößert den sichtbaren Fächer).

**Fix-Ansatz:**
- `AnimationenService.animiereStichEinziehen()`: Parameter `augenzahl: number` ergänzen; Popup-Text auf `+${augenzahl} Augen` ändern.
- `TischSzene.ts`: Aufruf von `animiereStichEinziehen()` mit korrekter Augenzahl (aus `stich.augen` oder äquivalentem Feld aus dem Backend-Zustand).
- Zielposition: `stichStapelPositionFuer(gewinnerSitzplatz)` — Stapel-Position des Gewinners.

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

**Verifikation:** Stich gewinnen — Popup zeigt korrekte Augenzahl, Karten landen auf richtigem Stapel.

---

## 6.4 — Kartenfächer-Ausrichtung (Nord/Süd + Ost/West)

**Problem:** Nord- und Süd-Fächer werden "gedreht" dargestellt (falsche Rotation). Ost- und West-Karten liegen nebeneinander statt als Fächer.

**Soll (aus frontend-tischansicht.md):**
- SUED/NORD: horizontaler Fächer (Karten nebeneinander, leicht rotiert wie ein Handfächer).
- WEST/OST: vertikaler Fächer (Karten übereinander, leicht rotiert um 90°).
- Winkel SUED: -12° + index * 3° | NORD: 12° - index * 3° | WEST/OST: 90° Basis + leichte Variation.

**Fix-Ansatz:**
- `TischSzene.ts renderKartenFaecher()`: Winkel und Offset-Berechnung für alle 4 Sitzpositionen prüfen.
- WEST/OST: Karten vertikal gestapelt mit leichtem Winkelversatz — nicht horizontal nebeneinander.
- NORD: Fächer-Rotation korrekt (Karten zeigen in Richtung Spielmitte, nicht verdreht).

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Vision Loop — alle 4 Spieler-Fächer visuell korrekt.

---

## 6.5 — Ansagen überdecken manchmal Karten (Z-Index/Depth)

**Problem:** Ansage-Banner (Re, Kontra, Keine 90 etc.) rendern über dem Kartenfächer des eigenen Spielers und verdecken die Karten.

**Soll:** Ansage-Banner erscheinen über dem HUD-Bereich oder in der Tischmitte — niemals über den spielbaren Karten des eigenen Spielers.

**Fix-Ansatz:**
- `AnimationenService.animiereAnsageBanner()`: Depth-Wert prüfen. Banner sollte Depth < Kartenfächer-Depth haben, oder Banner-Position so wählen dass keine Überlappung möglich ist (z.B. direkt unter der Top-Bar).
- Alternative: Banner-Position fest im oberen Drittel des Canvas (y < 200px) platzieren.

**Betroffene Dateien:** `frontend/src/services/AnimationenService.ts`, `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Vision Loop während Ansage-Phase — Banner überdeckt keine Handkarten.

---

## 6.6 — Falsche Alpha für nicht-spielbare Karten

**Problem:** Nicht-spielbare Karten haben manchmal falsches Alpha (zu dunkel oder zu hell), besonders in Randfällen.

**Soll (aus frontend-visuelles-design.md):** Nicht spielbare Karten: Alpha 0.45.

**Ist (TischSzene.ts ~Zeile 1245):**
```typescript
const alphaWert = this.austeilenAktiv
  ? 0
  : (offen ? (hatInteraktion && karte && !istInteraktiv ? 0.5 : 1) : 0.92);
```

**Fix-Ansatz:**
- Alpha von `0.5` auf `0.45` korrigieren.
- Edge-Case prüfen: wenn `hatInteraktion` false ist (kein Spielzug möglich), sollten alle Karten Alpha 1.0 haben (keine Karte ist "nicht spielbar" wenn es keinen Spielzug gibt).
- Edge-Case prüfen: während Austeilen (`austeilenAktiv`) bleiben Karten bei Alpha 0 bis Animation endet.

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Vision Loop — korrekte Alpha-Abstufung zwischen spielbaren und nicht-spielbaren Karten.

---

## 6.7 — Nameplates: Positionen und Größen überarbeiten

**Problem:** Nameplate-Positionen und -Größen entsprechen nicht der Spec. Besonders WEST/OST-Nameplates zu klein (80×80px) für den Inhalt.

**Soll (aus frontend-tischansicht.md):**
- SUED: y = 85% der Canvas-Höhe, rechts neben Kartenfächer
- NORD: y = 15%, rechts neben Kartenfächer
- WEST: x = 14%, unterhalb Kartenfächer
- OST: x = 86%, oberhalb Kartenfächer
- Format: `Name · [KI/Mensch] · [RE/KONTRA] · X Stiche · [G]`
- Aktiver Spieler: Nameplate leuchtet in Akzentfarbe auf (Gold `#ffd166`)

**Fix-Ansatz:**
- `TischSzene.ts nameplatePositionFuer()`: Koordinaten mit Prozent-Werten aus Spec normieren (bezogen auf Canvas-Größe 1280×720).
- SUED: `{ x: ..., y: 612 }` (85% von 720), NORD: `{ x: ..., y: 108 }` (15% von 720).
- WEST: `{ x: 179, y: ... }` (14% von 1280), OST: `{ x: 1101, y: ... }` (86% von 1280).
- Größen für WEST/OST auf mindestens 120×54px erhöhen (gleich wie SUED/NORD).

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Vision Loop — alle 4 Nameplates sichtbar, korrekt positioniert, nicht abgeschnitten.

---

## 6.8 — Laufende Ansagen dauerhaft anzeigen

**Problem:** Welche Ansagen in der aktuellen Runde gelten (Re, Kontra, Keine 90, Keine 60, Schwarz), ist nicht dauerhaft sichtbar. Spieler müssen sich merken was angesagt wurde.

**Soll:** Aktive Ansagen werden dauerhaft im Nameplate des ansagenden Spielers als Badge angezeigt.

**Fix-Ansatz:**
- `TischSzene.ts renderTisch()` / Nameplate-Rendering: Pro Spieler prüfen ob er eine aktive Ansage hat (aus Backend-Zustand `laufendesSpiel.ansagen`).
- Badge `[RE]`, `[KONTRA]`, `[K90]`, `[K60]`, `[S]` neben Partei-Anzeige im Nameplate.
- Farbe: Re → Gold (`#ffd166`), Kontra → Blau (`#90caf9`), verschärfte Ansagen → Orange/Rot.

**Betroffene Dateien:** `frontend/src/szenen/TischSzene.ts`

**Verifikation:** Vision Loop nach einer Ansage — Badge sichtbar im Nameplate des ansagenden Spielers.
