# Sonderspiel: Damensolo

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet                         |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, spielablauf.md |

## Beschreibung

Beim Damensolo sind ausschließlich die Damen Trumpf. Alle anderen Karten (einschließlich der Buben und Karo-Karten) gehören zu ihrer jeweiligen Farbe. Der Solo-Spieler spielt alleine gegen die anderen drei Spieler.

## Anforderungen

1. Jeder Spieler darf in der Vorbehalt-Phase ein **Damensolo** anmelden.
2. Das Damensolo hat die **höchste Vorbehalt-Priorität** (wie alle Soli, zusammen mit Buben-, Fleischlos- und Trumpfsolo).
3. Beim Damensolo gelten **nur Damen als Trumpf**, in absteigender Rangfolge:

   | Rang | Karte       |
   |------|-------------|
   | 1    | Kreuz-Dame  |
   | 2    | Pik-Dame    |
   | 3    | Herz-Dame   |
   | 4    | Karo-Dame   |

4. Alle anderen Karten sind **Fehlkarten** und gehören zu ihrer jeweiligen Farbe (Kreuz, Pik, Herz, Karo).
5. Die **Herz-Zehn** (Dulle) ist beim Damensolo **kein Trumpf** — sie ist eine Herz-Fehlkarte.
6. Innerhalb jeder Fehlfarbe gilt die Rangfolge: As > Zehn > König > Bube > Neun.
7. Der Solo-Spieler bildet die **Re-Partei** (alleine).
8. Die anderen drei Spieler bilden die **Kontra-Partei**.
9. Das Damensolo kann über die Tischkonfiguration **deaktiviert** werden.

## Akzeptanzkriterien

- Nur Damen werden als Trumpf erkannt.
- Buben, Karo-Karten und Herz-Zehn werden korrekt als Fehlkarten erkannt.
- Die Trumpf-Rangfolge der Damen ist korrekt (Kreuz > Pik > Herz > Karo).
- Innerhalb der Fehlfarben (inkl. Karo) gilt: As > Zehn > König > Bube > Neun.
- Der Solo-Spieler steht alleine gegen die anderen drei.
- Die Partei-Zugehörigkeit ist korrekt gesetzt.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Eigene TrumpfOrdnung für Damensolo implementiert und getestet
- [x] Unit-Tests für Trumpferkennung und Rangfolge geschrieben und bestanden
- [x] Integration in Vorbehalt-Phase getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Eigene Implementierung des `TrumpfOrdnung`-Interfaces für Damensolo
- Beim Damensolo gibt es 4 vollständige Fehlfarben (inkl. Karo), da nur Damen Trumpf sind
- Die Bedienpflicht ändert sich: Karo-As, Karo-Zehn etc. sind Karo-Fehl, nicht Trumpf
