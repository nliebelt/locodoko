# Frontend: Animationen

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                      |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md |

## Beschreibung

Animationen machen das Spielerlebnis lebendig und geben visuelles Feedback zu Spielaktionen. Diese Spec definiert alle Animationen, die im Spiel auftreten: Karten ausspielen, Stiche einziehen, Karten austeilen, Ansagen und Sonderpunkt-Anzeigen.

## Bekannte Bugs / Offene Punkte

- **Bug (2026-04-15) — Timing-Versatz:** Karten liegen bereits auf dem Tisch bevor die Ausspielen-Animation startet. Die Animation "holt nach" statt vorzülaufen. Ursache: WebSocket-Update aktualisiert `AppStore` sofort, `TischSzene.update()`-Loop rendert den neuen Zustand bevor der `AnimationenService` die Tween-Sequenz startet. Lösung: Karte erst nach Abschluss der Animations-Promise in den Zustand übernehmen, oder Render-Update für diese Karte sperren bis Animation fertig.
- **Bug (2026-04-15) — Animations-Queue-Aufstauung:** Bei schnellen KI-Zügen stauen sich Animationen auf — plötzlich werden zwei Stiche gleichzeitig dargestellt. `AnimationenService` braucht eine serielle Queue (FIFO) die sicherstellt dass `spieleKarteAus` und `zieheStichEin` immer in Reihe ablaufen, nicht parallel.
- **Bug (2026-04-15) — Reload-State:** Browser-Reload (`Strg+R`) zeigt Animationen und Overlays des vorherigen Spiels (z.B. Rundenauswertungs-Screen). AppStore und TischSzene müssen beim Snapshot-Load vollständig zurückgesetzt werden — kein Animation-State darf über WebSocket-Reconnect hinaus bestehen bleiben. Siehe auch `verbindungsabbruch.md`.

## Anforderungen

### Karte ausspielen

1. Wenn eine Karte gespielt wird, **gleitet** sie vom Kartenfächer des Spielers zur **Tischmitte**.
2. Die Animation dauert ca. **300–500ms**.
3. Eigene Karten gleiten von unten nach oben, gegnerische Karten von ihrer jeweiligen Position zur Mitte.
4. Die Karte wird dabei **umgedreht** (verdeckt → offen), wenn sie von einem Gegner gespielt wird.

### Stich einziehen

5. Wenn ein Stich abgeschlossen ist (4 Karten liegen), werden alle 4 Karten **gebündelt zum Stichgewinner** geschoben.
6. Die Animation dauert ca. **500–700ms** (nach einer kurzen Pause von ca. 1 Sekunde, damit alle Karten sichtbar sind).
7. Die Karten landen auf dem **Stich-Stapel** des Gewinners (rechts neben seinen Karten) und vergrößern den sichtbaren Stapel.
8. Beim Stichgewinner erscheint kurz ein **Gewinn-Flash** (Nameplate leuchtet kurz in der Akzentfarbe auf, ca. 400ms) — macht den Stichgewinn unmissverständlich erkennbar.

### Stich-Stapel und letzter Stich umdrehen

9. Der **Stich-Stapel** jedes Spielers ist als kleiner Kartenfächer sichtbar und wächst mit jedem gewonnenen Stich.
10. **Letzter Stich umdrehen**: Klick auf **jeden Stapel** (eigener oder gegnerischer) deckt die 4 Karten des zuletzt gewonnenen Stichs kurz auf — wie im echten Doppelkopf erlaubt. Nach kurzer Zeit oder erneutem Klick werden sie wieder verdeckt.
11. Alle vier Stich-Stapel sind umklappbar (nicht nur der eigene).

### Karten austeilen

8. Beim Spielstart werden die Karten **nacheinander** an die Spielerpositionen verteilt.
9. Die Karten kommen aus der **Tischmitte** (Kartenstapel) und gleiten zur jeweiligen Position.
10. Pro Spieler und Karte dauert die Animation ca. **50–100ms** (insgesamt flüssig, nicht zu langsam).
11. Eigene Karten werden **aufgedeckt**, gegnerische bleiben **verdeckt**.

### Ansage-Animation

12. Wenn eine **Ansage** (Re, Kontra, etc.) getätigt wird, erscheint ein **Banner/Label** am Bildschirm.
13. Das Banner zeigt den Ansagetext (z.B. „RE!" oder „KONTRA!") und den Spielernamen.
14. Das Banner **blendet sich ein**, bleibt ca. **1,5 Sekunden** sichtbar und **blendet sich wieder aus**.

### Spielansage-Flash (Spieltyp-Wechsel)

15. Wenn in der Vorbehalt-Phase der Spieltyp von `NORMALSPIEL` zu einem Solo, Hochzeit oder Armut wechselt, erscheint ein **Spielansage-Flash-Banner**.
16. Das Banner zeigt Spielernamen und Spieltyp: z.B. „Bob spielt Damensolo", „Alice: Hochzeit", „Kontra: Armut".
17. Die Anzeige nutzt dieselbe `animiereSoloAnkuendigung`-Funktion im `AnimationenService` wie andere Banner; Dauer ca. 1,5–2 Sekunden.
18. Erkennungslogik in `TischSzene.ts` (`ermittleSpielankuendigung`): Wechsel von `NORMALSPIEL` → anderer Spieltyp zwischen zwei aufeinanderfolgenden App-Zuständen.

### Rundenende

22. Am Ende eines Spiels wird eine **Punkteübersicht** eingeblendet.
16. Die Übersicht zeigt: Augen pro Partei, Spielpunkte, Sonderpunkte-Aufschlüsselung.
17. Die Übersicht bleibt sichtbar, bis der Spieler sie **explizit schließt** oder das nächste Spiel bestätigt.

### Sonderpunkt-Anzeige

25. Wenn ein **Sonderpunkt** erzielt wird (Fuchs, Karlchen, Doppelkopf), erscheint ein **kurzes visuelles Feedback**.
26. Dies kann ein **Icon** sein, das kurz aufblitzt, oder ein Text-Label.
27. Die Anzeige dauert ca. **1–2 Sekunden** und verschwindet dann.

### Allgemein

28. Alle Animationen sind **nicht blockierend** — der Spielfluss wird nicht unterbrochen (außer bei notwendigen Pausen wie Stich-Einziehen).
29. Animationen können über eine Einstellung **beschleunigt** oder **übersprungen** werden (für erfahrene Spieler).
30. Animationen müssen mit dem **WebSocket-Eventfluss** synchronisiert sein.

## Akzeptanzkriterien

- Karten gleiten flüssig vom Kartenfächer zur Tischmitte.
- Stiche werden nach kurzer Pause zum Gewinner geschoben.
- Das Austeilen der Karten wird animiert.
- Ansage-Banner erscheinen und verschwinden korrekt.
- Sonderpunkte werden visuell angezeigt.
- Die Punkteübersicht am Rundenende wird korrekt eingeblendet.
- Animationen können beschleunigt/übersprungen werden.
- Animationen verursachen keine UI-Blockaden oder Ruckler.

## Definition of Done

- [x] Karte ausspielen (Gleiten zur Stichmitte)
- [x] Stich einziehen (Karten fliegen zum Gewinner)
- [x] Karten austeilen
- [x] Ansage-Banner
- [x] Sonderpunkt-Feedback
- [x] Geschwindigkeitseinstellung implementiert
- [x] Synchronisation mit WebSocket-Events nachgewiesen
- [x] Performance-Test: keine Frame-Drops bei Animationen
- [x] Gewinn-Flash: Nameplate des Stichgewinners leuchtet kurz auf (4.16)
- [x] Stich-Stapel: Karten landen sichtbar auf Stapel beim Gewinner (4.16)
- [x] Letzter Stich umdrehen: Klick auf eigenen Stapel deckt 4 Karten des letzten Stichs auf (implementiert — Bug #7, `letzterStichOverlay`)
- [x] Spielansage-Flash-Banner: Spieltyp-Wechsel NORMALSPIEL→Solo/Hochzeit/Armut (`ermittleSpielankuendigung` / `animiereSoloAnkuendigung`)
- [ ] Visuelles Review nach 4.16

## Technische Hinweise

- **Technologie**: Phaser 3 Tweens und Timeline
- `Phaser.Tweens.add()` für Bewegungsanimationen (Karten gleiten)
- `Phaser.GameObjects.Text` oder `BitmapText` für Ansage-Banner
- Sprites für Sonderpunkt-Icons (Fuchs, Kreuz-Bube, Stern)
- Animations-Queue: Animationen nacheinander abspielen, um Überlappungen zu vermeiden
- Die Animations-Geschwindigkeit als globaler Multiplikator (1x, 2x, sofort)
- KI-Timing liegt **exklusiv im Frontend**: Bei `KI_ZUG_SEQUENZ`-Events ruft der `AppStore` `expandiereKiSequenz()` auf — dabei werden synthetische Zwischenzustände für jede KI-Karte erzeugt und mit je **800ms** Abstand animiert (nur bei menschlichen Mitspielern). Menschliche Züge (`KARTE_GESPIELT`), Phasenwechsel und `SNAPSHOT`-Events werden immer sofort angewendet. Das Backend sendet keine künstlichen Delays — es antwortet nach jedem DB-Commit sofort.
