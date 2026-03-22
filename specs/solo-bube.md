# Sonderspiel: Bubensolo

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet                         |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, spielablauf.md |

## Beschreibung

Beim Bubensolo sind ausschließlich die Buben Trumpf. Alle anderen Karten (einschließlich der Damen und Karo-Karten) gehören zu ihrer jeweiligen Farbe. Der Solo-Spieler spielt alleine gegen die anderen drei Spieler.

## Anforderungen

1. Jeder Spieler darf in der Vorbehalt-Phase ein **Bubensolo** anmelden.
2. Das Bubensolo hat die **höchste Vorbehalt-Priorität** (wie alle Soli).
3. Beim Bubensolo gelten **nur Buben als Trumpf**, in absteigender Rangfolge:

   | Rang | Karte       |
   |------|-------------|
   | 1    | Kreuz-Bube  |
   | 2    | Pik-Bube    |
   | 3    | Herz-Bube   |
   | 4    | Karo-Bube   |

4. Alle anderen Karten sind **Fehlkarten** und gehören zu ihrer jeweiligen Farbe (Kreuz, Pik, Herz, Karo).
5. Die **Herz-Zehn** (Dulle) ist beim Bubensolo **kein Trumpf** — sie ist eine Herz-Fehlkarte.
6. Innerhalb jeder Fehlfarbe gilt die Rangfolge: As > Zehn > König > Dame > Neun.
7. Der Solo-Spieler bildet die **Re-Partei** (alleine).
8. Die anderen drei Spieler bilden die **Kontra-Partei**.
9. Das Bubensolo kann über die Tischkonfiguration **deaktiviert** werden.

## Akzeptanzkriterien

- Nur Buben werden als Trumpf erkannt.
- Damen, Karo-Karten und Herz-Zehn werden korrekt als Fehlkarten erkannt.
- Die Trumpf-Rangfolge der Buben ist korrekt (Kreuz > Pik > Herz > Karo).
- Innerhalb der Fehlfarben (inkl. Karo) gilt: As > Zehn > König > Dame > Neun.
- Der Solo-Spieler steht alleine gegen die anderen drei.
- Die Partei-Zugehörigkeit ist korrekt gesetzt.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Eigene TrumpfOrdnung für Bubensolo implementiert und getestet
- [x] Unit-Tests für Trumpferkennung und Rangfolge geschrieben und bestanden
- [x] Integration in Vorbehalt-Phase getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Eigene Implementierung des `TrumpfOrdnung`-Interfaces für Bubensolo
- Analog zum Damensolo: 4 vollständige Fehlfarben, nur Buben als Trumpf
- Damen werden bei der Fehlfarben-Rangfolge eingeordnet (As > Zehn > König > Dame > Neun)
