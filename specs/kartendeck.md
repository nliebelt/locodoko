# Kartendeck

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet      |
| Priorität      | Hoch                                        |
| Abhängigkeiten | Keine                                       |

## Beschreibung

Definition des Kartendecks für Doppelkopf. Das Spiel verwendet ein französisches Blatt mit 48 Karten (24 Kartenpaare). Optional kann ohne Neunen gespielt werden (40 Karten). Diese Spec definiert alle Kartentypen, ihre Farben, Werte (Augen) und die Tatsache, dass jede Karte doppelt vorhanden ist.

## Anforderungen

1. Das Kartendeck basiert auf dem **französischen Blatt** mit den Farben Kreuz (♣), Pik (♠), Herz (♥) und Karo (♦).
2. Jede Farbe enthält folgende Kartenwerte: Neun, Bube, Dame, König, Zehn, As.
3. Jede Karte existiert **exakt zweimal** im Deck (24 Paare = 48 Karten).
4. Optional (konfigurierbar pro Tisch): Spiel **ohne Neunen** — dann enthält das Deck nur 40 Karten (20 Paare).
5. Jede Karte hat einen **Augenwert**:

   | Kartenwert | Augen |
   |------------|-------|
   | As         | 11    |
   | Zehn       | 10    |
   | König      | 4     |
   | Dame       | 3     |
   | Bube       | 2     |
   | Neun       | 0     |

6. Die Gesamtaugenzahl im Deck beträgt **240 Augen** (unabhängig davon, ob mit oder ohne Neunen gespielt wird).
7. Eine Karte wird durch die Kombination aus **Farbe** und **Wert** identifiziert. Da jede Karte doppelt existiert, muss intern eine Unterscheidung möglich sein (z.B. über eine Instanz-Nummer). Für die **Serialisierung** (WebSocket-Events, API) reicht `{farbe, wert}` — die interne Unterscheidung ist nur serverseitig relevant.
8. Das Deck muss **mischbar** sein (zufällige Reihenfolge).
9. Nach dem Mischen werden die Karten gleichmäßig auf 4 Spieler verteilt (je 12 Karten bzw. 10 ohne Neunen).

## Akzeptanzkriterien

- Ein neu erstelltes Deck enthält exakt 48 Karten (bzw. 40 ohne Neunen).
- Jede der 24 (bzw. 20) Kartenkombinationen ist exakt zweimal vorhanden.
- Die Summe aller Augenwerte im Deck ergibt 240.
- Nach dem Mischen sind die Karten in nicht-deterministischer Reihenfolge.
- Nach dem Verteilen hat jeder Spieler exakt 12 (bzw. 10) Karten.
- Zwei identische Karten (gleiche Farbe + Wert) sind intern unterscheidbar.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests geschrieben und bestanden
- [x] Augenwert-Berechnung korrekt getestet
- [x] Deck-Erzeugung mit und ohne Neunen getestet
- [x] Mischen und Verteilen getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kartenverwaltung
- Karte als **Value Object** modellieren (unveränderlich, Identität über Farbe+Wert)
- Für die interne Unterscheidung der zwei identischen Karten eine technische ID oder Index verwenden
- Enum für `Farbe` (KREUZ, PIK, HERZ, KARO) und `Kartenwert` (NEUN, BUBE, DAME, KOENIG, ZEHN, AS)
- Die Augenwerte können direkt im `Kartenwert`-Enum gespeichert werden
- `Kartendeck`-Klasse als Factory zum Erzeugen und Mischen eines vollständigen Decks
