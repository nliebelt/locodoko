# Frontend: Tischansicht

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, websocket-kommunikation.md   |

## Beschreibung

Die Tischansicht ist das zentrale Spielfeld im Phaser-Frontend. Sie zeigt eine Top-Down-Perspektive eines Doppelkopf-Tisches, an dem der menschliche Spieler unten (Süd) sitzt und die drei KI-Spieler (oder perspektivisch andere menschliche Spieler) an den anderen Positionen (West, Nord, Ost).

## Anforderungen

### Layout

1. Die Ansicht zeigt den **Tisch von oben** (Top-Down-Perspektive).
2. Der menschliche Spieler sitzt an der **Süd-Position** (unten).
3. Die anderen Spieler sitzen an **West** (links), **Nord** (oben) und **Ost** (rechts).
4. In der **Tischmitte** wird der aktuelle Stich angezeigt (gespielten Karten).
5. Jede Position zeigt:
   - Spielername
   - Kartenfächer (eigene Karten sichtbar, gegnerische Karten verdeckt)
   - Anzahl verbleibender Karten
   - Aktuelle Ansagen (Re/Kontra-Symbol)

### Kartendarstellung

6. Die eigenen Karten (Süd) werden als **aufgefächerter Kartenfächer** angezeigt — alle Karten sichtbar.
7. Gegnerische Karten werden als **verdeckte Kartenfächer** angezeigt (Kartenrücken).
8. Karten im Stich (Tischmitte) werden **offen** angezeigt mit Zuordnung zum Spieler.
9. Karten verwenden das **französische Blatt** (Kreuz, Pik, Herz, Karo) als Grafiken.
10. Die eigenen Karten sind **sortiert**: Trümpfe links, Fehlfarben rechts, innerhalb der Gruppen nach Rang.

### Hintergrund

11. Der Tischhintergrund ist ein **konfigurierbares Bild** (über Tischeinstellungen wählbar).
12. Standard-Fallback: **Grüner Filz** (einfache Textur oder Farbfläche).

### Spielerinformationen

13. Jede Position zeigt den **Spielernamen** an.
14. Bei KI-Spielern wird ein **KI-Symbol** neben dem Namen angezeigt.
15. Die **Stichanzahl** (gewonnene Stiche) wird pro Spieler angezeigt.
16. Der aktuelle **Aufspieler** wird visuell hervorgehoben.

### Debug-Modus

17. Im **Debug-Modus** können gegnerische Karten aufgedeckt werden (für Entwicklung/Test).
18. Der Debug-Modus ist standardmäßig **deaktiviert**.

## Akzeptanzkriterien

- Der Tisch wird aus der Top-Down-Perspektive korrekt gerendert.
- Der Spieler sieht seine eigenen Karten aufgefächert und sichtbar.
- Gegnerische Karten sind verdeckt.
- Der aktuelle Stich wird in der Tischmitte angezeigt.
- Spielernamen und Informationen sind sichtbar.
- Der Hintergrund ist konfigurierbar.
- Im Debug-Modus sind gegnerische Karten sichtbar.
- Die Ansicht skaliert bei verschiedenen Fenstergrößen korrekt.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Phaser-Scene für Tischansicht erstellt
- [ ] Kartengrafiken eingebunden (Sprites)
- [ ] Spielerpositionen und Layout korrekt
- [ ] Debug-Modus implementiert
- [ ] Frontend-Tests geschrieben und bestanden
- [ ] Visuelles Review / Plausibilitätsprüfung

## Technische Hinweise

- **Technologie**: TypeScript + Phaser 3
- Phaser `Scene` für die Tischansicht
- Karten als Sprites aus einem **Spritesheet** laden (alle 48 Karten + Kartenrücken)
- Spielerpositionen als feste Koordinaten relativ zur Canvas-Größe
- Responsive: Canvas skaliert mit `Phaser.Scale.FIT` oder ähnlich
- Kartensortierung im Frontend basierend auf den vom Backend erhaltenen Karten + Trumpfordnung
- WebSocket-Events lösen UI-Updates aus (Stich anzeigen, Karten aktualisieren)
