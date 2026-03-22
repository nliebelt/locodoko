# Frontend: UI-Logik

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet      |
| Priorität      | Hoch                                        |
| Abhängigkeiten | frontend-tischansicht.md, websocket-kommunikation.md, stichlogik.md, ansagen.md |

## Beschreibung

Die UI-Logik bestimmt, welche Interaktionen dem Spieler wann zur Verfügung stehen. Dazu gehört insbesondere, welche Karten anklickbar sind (basierend auf Backend-Regeln wie Bedienpflicht), wann Ansage-Buttons erscheinen und wie der Spieler mit Sonderspiel-Phasen interagiert.

## Anforderungen

### Spielbare Karten

1. **Nur spielbare Karten** sind anklickbar/interagierbar.
2. Welche Karten spielbar sind, wird vom **Backend** bestimmt (Bedienpflicht, Trumpfzwang).
3. Das Backend sendet mit jedem Zustandsupdate die **Liste der spielbaren Karten** für den aktuellen Spieler.
4. **Nicht spielbare Karten** werden visuell **ausgegraut** oder gedimmt dargestellt.
5. Wenn der Spieler **nicht am Zug** ist, sind alle Karten nicht interagierbar.
6. Beim **Hovern** über eine spielbare Karte wird diese leicht angehoben (visuelles Feedback).
7. Beim **Klicken** auf eine spielbare Karte wird das `KarteGespielt`-Event an das Backend gesendet.

### Ansage-Buttons

8. **Ansage-Buttons** (Re, Kontra, Keine 90, etc.) erscheinen nur, wenn eine Ansage **regelkonform möglich** ist.
9. Das Backend informiert den Spieler über **verfügbare Ansagen** im Zustandsupdate.
10. Ansage-Buttons werden in einem **separaten UI-Bereich** angezeigt (nicht auf dem Spielfeld).
11. Nach einer Ansage verschwindet der Button für diese Stufe.
12. Die Buttons zeigen den **Ansagetext** an (z.B. „Re", „Keine 90").

### Vorbehalt-Phase

13. In der Vorbehalt-Phase zeigt das UI dem Spieler seine **Optionen** an:
    - „Gesund" (kein Vorbehalt)
    - Liste der verfügbaren Sonderspiele (Solo-Typen, Hochzeit, Armut)
14. Der Spieler wählt eine Option aus, die als `SonderspielAngemeldet`-Event gesendet wird.
15. Nur **erlaubte Sonderspiele** (gemäß Tischkonfiguration und Hand) werden angezeigt.

### Armut-Interaktion

16. Wenn eine Armut angeboten wird, sieht der angesprochene Spieler einen **Dialog** mit „Annehmen" / „Ablehnen".
17. Bei Annahme erscheint eine **Kartenauswahl**, um die zurückzugebenden Karten auszuwählen.
18. Der Dialog zeigt die Anzahl der zu tauschenden Karten an.

### Allgemeine UI-Elemente

19. Ein **Punktestand-Overlay** zeigt den aktuellen Partie-Gesamtstand an.
20. Ein **Letzte-Stiche-Button** ermöglicht das Betrachten der letzten gespielten Stiche.
21. Fehlermeldungen vom Backend werden als **Toast/Notification** angezeigt.
22. Der **Spielstatus** (Phase, wer ist dran, Spieltyp) ist jederzeit sichtbar.

## Akzeptanzkriterien

- Nur spielbare Karten sind anklickbar; nicht spielbare Karten sind ausgegraut.
- Ansage-Buttons erscheinen nur, wenn eine Ansage möglich ist.
- Die Vorbehalt-Phase zeigt die korrekten Optionen an.
- Der Armut-Dialog funktioniert korrekt (Annehmen/Ablehnen, Kartenauswahl).
- Der Punktestand wird korrekt angezeigt und aktualisiert.
- Fehlermeldungen werden dem Spieler angezeigt.
- Der Spielstatus ist jederzeit erkennbar.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Karten-Interaktion (Hover, Klick, Grayout) implementiert und getestet
- [x] Ansage-Buttons implementiert und getestet
- [x] Vorbehalt-Dialog implementiert und getestet
- [x] Armut-Dialog implementiert und getestet
- [x] Punktestand-Overlay implementiert
- [x] Frontend-Tests geschrieben und bestanden
- [x] Visuelles Review / Plausibilitätsprüfung

## Technische Hinweise

- **Technologie**: TypeScript + Phaser 3
- Spielbare Karten: `setInteractive()` / `disableInteractive()` basierend auf Backend-Daten
- Karten-Grayout: Alpha-Wert reduzieren (z.B. 0.5) oder Tint setzen
- Hover-Effekt: `pointerover`/`pointerout`-Events mit Y-Verschiebung
- Ansage-Buttons als Phaser UI-Elemente oder HTML-Overlay über dem Canvas
- Dialoge (Vorbehalt, Armut) als modale Overlays
- Zustandsmanagement im Frontend: Ein zentraler `SpielZustandManager`, der WebSocket-Events verarbeitet und das UI aktualisiert
- Die Liste der spielbaren Karten kommt vom Backend im `SpielbrettAktualisiert`-Event
