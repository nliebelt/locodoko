# Sonderspiel: Fleischlos

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, spielablauf.md               |

## Beschreibung

Beim Fleischlos-Solo gibt es keinen Trumpf. Alle Karten gehören zu ihrer jeweiligen Farbe. Der Solo-Spieler spielt alleine gegen die anderen drei Spieler. Da es keinen Trumpf gibt, kann nicht „gestochen" werden — nur die angefragte Farbe gewinnt.

## Anforderungen

1. Jeder Spieler darf in der Vorbehalt-Phase ein **Fleischlos** anmelden.
2. Fleischlos hat die **höchste Vorbehalt-Priorität** (wie alle Soli).
3. Beim Fleischlos gibt es **keinen Trumpf**. Alle Karten sind Fehlkarten.
4. Es gibt **4 vollständige Fehlfarben**: Kreuz, Pik, Herz, Karo.
5. Innerhalb jeder Farbe gilt die Rangfolge: As > Zehn > König > Dame > Bube > Neun.
6. Die **Bedienpflicht** gilt wie üblich: Die angefragte Farbe muss bedient werden.
7. Kann ein Spieler nicht bedienen, muss er eine beliebige Karte abwerfen, kann aber **nicht stechen** (da kein Trumpf existiert).
8. Es gewinnt immer die **höchste Karte der angefragten Farbe** — egal was andere Spieler abwerfen.
9. Der Solo-Spieler bildet die **Re-Partei** (alleine).
10. Die anderen drei Spieler bilden die **Kontra-Partei**.
11. Fleischlos kann über die Tischkonfiguration **deaktiviert** werden.

## Akzeptanzkriterien

- Keine Karte wird als Trumpf erkannt.
- Alle Karten gehören zu ihrer natürlichen Farbe (Kreuz, Pik, Herz, Karo).
- Die Rangfolge innerhalb jeder Farbe ist korrekt (As > Zehn > König > Dame > Bube > Neun).
- Ein abgeworfene Karte (andere Farbe) kann den Stich nicht gewinnen.
- Die Bedienpflicht funktioniert korrekt.
- Der Solo-Spieler steht alleine gegen die anderen drei.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Eigene TrumpfOrdnung für Fleischlos implementiert und getestet
- [x] Unit-Tests für Stichgewinner bei reinem Farbstich geschrieben und bestanden
- [x] Szenario „Abwerfen ohne Stechen" getestet
- [x] Integration in Vorbehalt-Phase getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Eigene Implementierung des `TrumpfOrdnung`-Interfaces, bei der `istTrumpf()` immer `false` zurückgibt
- Die Stichlogik muss diesen Fall korrekt behandeln: Kein Trumpf bedeutet, dass nur die angefragte Farbe den Stich gewinnen kann
- Besonderheit: Damen und Buben gehören hier zu ihrer Farbe und stehen in der normalen Rangfolge
