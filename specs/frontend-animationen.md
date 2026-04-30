# Frontend: Animationen

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                      |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md |

## Beschreibung

Animationen machen das Spielerlebnis lebendig und geben visuelles Feedback zu Spielaktionen. Diese Spec definiert alle Animationen, die im Spiel auftreten: Karten ausspielen, Stiche einziehen, Karten austeilen, Ansagen und Sonderpunkt-Anzeigen.

## Anforderungen

### Karte ausspielen

1. Wenn ein `KARTE_GESPIELT`-Event empfangen wird, **gleitet** die Karte vom Kartenfächer zur **Tischmitte**.
2. Die Animation dauert ca. **300–500ms**.
3. Eigene Karten gleiten von unten nach oben, gegnerische Karten von ihrer jeweiligen Position zur Mitte.
4. Die Karte nutzt die `karteId` aus dem Event, um die korrekte Vorderseite anzuzeigen.

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

8. Beim `SPIEL_GESTARTET`-Event werden die Karten **nacheinander** an die Spielerpositionen verteilt.
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
30. Animationen müssen über den **Sequential Processing Pattern** (siehe `architektur-domain-events.md`) mit dem Zustands-Update synchronisiert sein. Der `partieStand` darf erst nach Abschluss der visuellen Bewegung im Store aktiviert werden.

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
- [x] Visuelles Review nach 4.16

## Technische Hinweise

- **Technologie**: Phaser 3 Tweens und Timeline
- `Phaser.Tweens.add()` für Bewegungsanimationen (Karten gleiten)
- `Phaser.GameObjects.Text` oder `BitmapText` für Ansage-Banner
- Sprites für Sonderpunkt-Icons (Fuchs, Kreuz-Bube, Stern)
- Animations-Queue: Animationen nacheinander abspielen, um Überlappungen zu vermeiden
- Die Animations-Geschwindigkeit als globaler Multiplikator (1x, 2x, sofort)
- **KI-Timing (UX):** KI-Aktionen im Frontend werden mit einer variablen Verzögerung (`kiVerzoegerungMs`) abgearbeitet. Standardmäßig 800ms für Menschen, 0ms für E2E-Tests. Der Store steuert dies über die serielle Queue.
