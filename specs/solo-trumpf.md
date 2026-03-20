# Sonderspiel: Trumpfsolo

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, spielablauf.md |

## Beschreibung

Beim Trumpfsolo gelten die gleichen Trümpfe wie im Normalspiel, aber der Solo-Spieler spielt alleine gegen die anderen drei Spieler. Die Trumpfhierarchie bleibt identisch zum Normalspiel — der Unterschied zum Normalspiel liegt ausschließlich in der Parteibildung.

## Anforderungen

1. Jeder Spieler darf in der Vorbehalt-Phase ein **Trumpfsolo** anmelden.
2. Das Trumpfsolo hat die **höchste Vorbehalt-Priorität** (wie alle Soli).
3. Die Trumpfhierarchie beim Trumpfsolo entspricht dem **Normalspiel**:
   - Herz-Zehn (Dulle) ist der höchste Trumpf
   - Damen und Buben sind Trumpf (in der üblichen Reihenfolge)
   - Karo-Karten sind Trumpf
4. Der Solo-Spieler bildet die **Re-Partei** (alleine).
5. Die anderen drei Spieler bilden die **Kontra-Partei**.
6. Die Partei-Zugehörigkeit ist **von Anfang an klar** (anders als bei der Hochzeit).
7. Das Trumpfsolo kann über die Tischkonfiguration **deaktiviert** werden.

## Akzeptanzkriterien

- Die Trumpfhierarchie ist identisch zum Normalspiel.
- Der Solo-Spieler steht alleine gegen die anderen drei.
- Die Partei-Zugehörigkeiten sind korrekt (Solo-Spieler = Re, Rest = Kontra).
- Alle Trumpf- und Fehlkarten werden korrekt erkannt.
- Die Bedienpflicht funktioniert wie im Normalspiel.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Unit-Tests für Partei-Zugehörigkeit geschrieben und bestanden
- [ ] Integration in Vorbehalt-Phase getestet
- [ ] Wiederverwendung der Normal-TrumpfOrdnung nachgewiesen
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Das Trumpfsolo kann die gleiche `TrumpfOrdnung` wie das Normalspiel verwenden
- Der einzige Unterschied zum Normalspiel ist die Parteibildung: Die Partei wird nicht über Kreuz-Damen bestimmt, sondern der Solo-Spieler steht alleine
- Daher primär ein eigener `Spieltyp` mit entsprechender Partei-Logik, aber gemeinsamer Trumpfordnung
