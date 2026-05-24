# Frontend: Tastatursteuerung

| Feld           | Wert                                                       |
|----------------|------------------------------------------------------------|
| Status         | Stabil — Vollständig nach FE-5 (Task 80) Plan-Run 2026-05-22 |
| Priorität      | Mittel                                                     |
| Abhängigkeiten | frontend-tischansicht.md, frontend-ui-logik.md, e2e-tests.md |

## Beschreibung

Das gesamte Spiel ist vollständig per Tastatur spielbar. Die Tastatursteuerung ist kein Accessibility-Add-on, sondern ein gleichwertiger Eingabekanal. Sie vereinfacht zudem die E2E-Testautomatisierung erheblich: Playwright kann Tastatureingaben zuverlässig an den Browser senden, ohne auf Phaser-Canvas-Hit-Testing angewiesen zu sein.

## Shortcuts im Überblick

```text
SPIELFELD
─────────────────────────────────────────────────
ArrowLeft / ArrowRight   Karte im Fächer auswählen (navigiert durch spielbare Karten)
Enter / Space            Ausgewählte Karte spielen
Escape                   Aktuelle Karte abwählen (Auswahl aufheben)

ANSAGEN (nur sichtbar wenn möglich)
─────────────────────────────────────────────────
R                        Re ansagen
K                        Kontra ansagen
1 … 6                    Ansage nach Nummerierung der sichtbaren Buttons
                         (1=Re/Kontra, 2=Keine 90, 3=Keine 60, 4=Keine 30, 5=Schwarz)

VORBEHALT-PHASE (kein Dialog — Karten in der Hand, Auswahl per Label + Pfeile)
─────────────────────────────────────────────────
1 … N                    Vorbehalt N direkt bestätigen (1=Gesund, 2=erste Sonderspiel-Option, …)
ArrowLeft / ArrowRight   Zum vorherigen / nächsten Vorbehalt wechseln
ArrowUp / ArrowDown      Alternativ: vorheriger / nächster Vorbehalt
Enter / Space            Aktuell angezeigten Vorbehalt bestätigen

OVERLAYS / MODALS (wenn offen)
─────────────────────────────────────────────────
Enter                    Primär-Button bestätigen (Weiter, Erstellen, Annehmen)
Escape                   Modal schließen (außer Vorbehalt und Armut-Entscheidung)

NAVIGATION
─────────────────────────────────────────────────
Tab                      Zwischen fokussierbaren Elementen wechseln
I                        Seitenlade [≡] öffnen/schließen
S                        Einstellungs-Modal [⚙] öffnen/schließen
```

## Anforderungen

### Karten-Navigation

1. Bei Eintritt in den Spielzug-Modus (Backend: Spieler ist am Zug) wird **automatisch die erste spielbare Karte** fokussiert/ausgewählt.
2. `ArrowRight` bewegt die Auswahl zur nächsten spielbaren Karte (rechts im Fächer), `ArrowLeft` zur vorherigen.
3. Die Navigation **überspringt nicht spielbare Karten** — nur spielbare Karten sind per Tastatur erreichbar.
4. Die ausgewählte Karte wird visuell hervorgehoben (weißer Rahmen, leichter Y-Versatz — siehe `frontend-visuelles-design.md`).
5. `Enter` oder `Space` spielt die ausgewählte Karte.
6. `Escape` hebt die Auswahl auf (keine Karte ausgewählt).
7. Wenn der Spieler **nicht am Zug** ist, ist die Kartennavigation deaktiviert.

### Ansagen

1. Wenn Ansage-Buttons sichtbar sind, können sie per Buchstabenkürzel ausgelöst werden:
   - `R` für Re
   - `K` für Kontra
   - `1`–`5` für die numerierten Buttons in Reihenfolge ihrer Anzeige
2. Diese Shortcuts sind **nur aktiv wenn die Floating Action Bar sichtbar** ist.
3. Nach einer Ansage verschwindet der Button — der Shortcut ist dann nicht mehr aktiv.

### Vorbehalt-Phase

Es gibt kein separates Vorbehalt-Overlay mehr. Die Auswahl findet direkt in der Hand-Ansicht statt: Ein Label über den Karten zeigt den aktuell gewählten Vorbehalt, Navigationspfeile ◄/► und ein Positions-Indikator ergänzen es. Spieltyp-relevante Karten werden angehoben (Y-Elevation), die gesamte Hand neu sortiert.

1. `ArrowLeft`/`ArrowRight` oder `ArrowUp`/`ArrowDown` navigiert durch die möglichen Vorbehalte. Die Karten gleiten animiert in ihre neue Position (Elevation + Reihenfolge, ~150 ms).
2. Zifferntasten (`1`=Gesund, `2`=erste Sonderspiel-Option etc.) bestätigen einen Vorbehalt direkt — kein separates Enter nötig.
3. `Enter` oder `Space` bestätigt den aktuell angezeigten Vorbehalt.
4. `Escape` ist in der Vorbehalt-Phase nicht aktiv — eine Auswahl ist zwingend.

### Armut-Interaktion

1. Im Armut-Overlay: `A` für „Annehmen", `N` für „Ablehnen" (Nein).
2. Bei Kartenauswahl für Rückgabe: `ArrowLeft`/`ArrowRight` navigiert durch die eigenen Karten, `Space` markiert/demarkiert eine Karte, `Enter` bestätigt.
3. Das Overlay kann **nicht per Escape** verlassen werden.

### Seitenlade und Einstellungen

1. `I` (Info) öffnet und schließt die Seitenlade `[≡]`.
2. `S` (Settings) öffnet und schließt das Einstellungs-Modal `[⚙]`.
3. `Escape` schließt beide, falls geöffnet.

### Fokus-Management

1. Wenn ein Modal oder Overlay geöffnet wird, liegt der Fokus **automatisch auf dem ersten interaktiven Element** darin (Focus Trap).
2. `Tab` zirkuliert innerhalb des geöffneten Modals — kein Verlassen des Modals per Tab.
3. Wenn ein Modal geschlossen wird, kehrt der Fokus zum auslösenden Element zurück.

## E2E-Testbarkeit

Die Tastatursteuerung ist bewusst so gestaltet, dass Playwright-Tests ohne Canvas-Interaktion auskommen:

1. **Karte spielen**: `await page.keyboard.press('ArrowRight')` + `await page.keyboard.press('Enter')`.
2. **Vorbehalt (Gesund)**: `await page.keyboard.press('1')` + `await page.keyboard.press('Enter')`.
3. **Re ansagen**: `await page.keyboard.press('r')`.
4. Tests können prüfen ob Keyboard-Shortcuts die richtigen `appStore`-Methoden aufrufen.
5. Der globale `appStore` bleibt im E2E-Test über `window.appStore` zugänglich (wie bisher).

## Akzeptanzkriterien

- Eine vollständige Partie kann ohne Mausklick gespielt werden.
- Karten-Navigation mit Pfeiltasten funktioniert und überspringt nicht spielbare Karten.
- Vorbehalt-Auswahl per Zifferntaste und Enter.
- Ansagen per R/K auslösbar.
- Modals öffnen/schließen per Tastatur.
- E2E-Tests können auf Canvas-Klicks verzichten und stattdessen Tastatureingaben nutzen.

## Definition of Done

- [x] Karten-Navigation (ArrowLeft/Right, Enter/Space) implementiert
- [x] Auto-Fokus auf erste spielbare Karte bei Spielzug-Beginn
- [x] Ansage-Shortcuts (R, K, 1–5) implementiert
- [x] Vorbehalt-Navigation (Ziffern, ArrowLeft/Right, ArrowUp/Down, Enter/Space) implementiert
- [x] Armut-Shortcuts (A, N) implementiert
- [x] Seitenlade (I) und Einstellungen (S) per Tastatur
- [x] Focus-Trap in Modals implementiert
- [ ] E2E-Tests auf Tastatureingaben umgestellt (kein Canvas-Klick mehr nötig)
- [ ] Manuelle Test-Durchlauf: Partie vollständig per Tastatur gespielt
