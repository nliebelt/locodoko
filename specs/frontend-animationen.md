# Frontend: Animationen

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Mittel                                      |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md |

## Beschreibung

Animationen machen das Spielerlebnis lebendig und geben visuelles Feedback zu Spielaktionen. Diese Spec definiert alle Animationen, die im Spiel auftreten: Karten ausspielen, Stiche einziehen, Karten austeilen, Ansagen und Sonderpunkt-Anzeigen.

## Anforderungen

### Karte ausspielen

1. Wenn eine Karte gespielt wird, **gleitet** sie vom Kartenfächer des Spielers zur **Tischmitte**.
2. Die Animation dauert ca. **300–500ms**.
3. Eigene Karten gleiten von unten nach oben, gegnerische Karten von ihrer jeweiligen Position zur Mitte.
4. Die Karte wird dabei **umgedreht** (verdeckt → offen), wenn sie von einem Gegner gespielt wird.

### Stich einziehen

5. Wenn ein Stich abgeschlossen ist (4 Karten liegen), werden alle 4 Karten **gebündelt zum Stichgewinner** geschoben.
6. Die Animation dauert ca. **500–700ms** (nach einer kurzen Pause von ca. 1 Sekunde, damit alle Karten sichtbar sind).
7. Die Karten verschwinden beim Stichgewinner und der **Stichzähler** wird erhöht.

### Karten austeilen

8. Beim Spielstart werden die Karten **nacheinander** an die Spielerpositionen verteilt.
9. Die Karten kommen aus der **Tischmitte** (Kartenstapel) und gleiten zur jeweiligen Position.
10. Pro Spieler und Karte dauert die Animation ca. **50–100ms** (insgesamt flüssig, nicht zu langsam).
11. Eigene Karten werden **aufgedeckt**, gegnerische bleiben **verdeckt**.

### Ansage-Animation

12. Wenn eine **Ansage** (Re, Kontra, etc.) getätigt wird, erscheint ein **Banner/Label** am Bildschirm.
13. Das Banner zeigt den Ansagetext (z.B. „RE!" oder „KONTRA!") und den Spielernamen.
14. Das Banner **blendet sich ein**, bleibt ca. **1,5 Sekunden** sichtbar und **blendet sich wieder aus**.

### Rundenende

15. Am Ende eines Spiels wird eine **Punkteübersicht** eingeblendet.
16. Die Übersicht zeigt: Augen pro Partei, Spielpunkte, Sonderpunkte-Aufschlüsselung.
17. Die Übersicht bleibt sichtbar, bis der Spieler sie **explizit schließt** oder das nächste Spiel bestätigt.

### Sonderpunkt-Anzeige

18. Wenn ein **Sonderpunkt** erzielt wird (Fuchs, Karlchen, Doppelkopf), erscheint ein **kurzes visuelles Feedback**.
19. Dies kann ein **Icon** sein, das kurz aufblitzt, oder ein Text-Label.
20. Die Anzeige dauert ca. **1–2 Sekunden** und verschwindet dann.

### Allgemein

21. Alle Animationen sind **nicht blockierend** — der Spielfluss wird nicht unterbrochen (außer bei notwendigen Pausen wie Stich-Einziehen).
22. Animationen können über eine Einstellung **beschleunigt** oder **übersprungen** werden (für erfahrene Spieler).
23. Animationen müssen mit dem **WebSocket-Eventfluss** synchronisiert sein.

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

- [ ] Alle Anforderungen implementiert
- [ ] Alle 6 Animationstypen implementiert und visuell geprüft
- [ ] Geschwindigkeitseinstellung implementiert
- [ ] Synchronisation mit WebSocket-Events nachgewiesen
- [ ] Performance-Test: keine Frame-Drops bei Animationen
- [ ] Visuelles Review / Plausibilitätsprüfung

## Technische Hinweise

- **Technologie**: Phaser 3 Tweens und Timeline
- `Phaser.Tweens.add()` für Bewegungsanimationen (Karten gleiten)
- `Phaser.GameObjects.Text` oder `BitmapText` für Ansage-Banner
- Sprites für Sonderpunkt-Icons (Fuchs, Kreuz-Bube, Stern)
- Animations-Queue: Animationen nacheinander abspielen, um Überlappungen zu vermeiden
- Die Animations-Geschwindigkeit als globaler Multiplikator (1x, 2x, sofort)
- WebSocket-Events in eine Queue legen und nach Animations-Ende verarbeiten
