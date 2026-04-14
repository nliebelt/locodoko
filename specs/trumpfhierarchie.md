# Trumpfhierarchie

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md                               |

## Beschreibung

Definition der Trumpfreihenfolge im Standard-Doppelkopfspiel (Normalspiel). Die Trumpfhierarchie bestimmt, welche Karten Trumpf sind und in welcher Rangfolge sie stehen. Im Normalspiel gibt es eine feste Hierarchie, die von Solo-Spielen abweichen kann (siehe separate Solo-Specs).

## Anforderungen

1. Im **Normalspiel** gelten folgende Karten als Trumpf, in absteigender Rangfolge:

   | Rang | Karte(n)                     |
   |------|------------------------------|
   | 1    | Herz-Zehn (Dulle)           |
   | 2    | Kreuz-Dame                   |
   | 3    | Pik-Dame                     |
   | 4    | Herz-Dame                    |
   | 5    | Karo-Dame                    |
   | 6    | Kreuz-Bube                   |
   | 7    | Pik-Bube                     |
   | 8    | Herz-Bube                    |
   | 9    | Karo-Bube                    |
   | 10   | Karo-As                      |
   | 11   | Karo-Zehn                    |
   | 12   | Karo-König                   |
   | 13   | Karo-Neun (nur mit Neunen)   |

2. Die **Herz-Zehn** (Dulle) ist der höchste Trumpf. Sie existiert zweimal im Deck.
3. Wenn zwei Dullen in einem Stich aufeinandertreffen, sticht die **zweite** die erste (konfigurierbar: „Zweite Dulle sticht" an/aus).
4. Alle **Damen** sind Trumpf (quer durch alle Farben), absteigend: Kreuz, Pik, Herz, Karo.
5. Alle **Buben** sind Trumpf (quer durch alle Farben), absteigend: Kreuz, Pik, Herz, Karo.
6. Die restlichen **Karo-Karten** (As, Zehn, König, Neun) sind Trumpf, in der obigen Rangfolge.
7. Alle anderen Karten sind **Fehlkarten** (keine Trümpfe) und gehören zu ihrer jeweiligen Farbe (Kreuz, Pik, Herz).
8. Innerhalb einer Fehlfarbe gilt die Rangfolge: As > Zehn > König > Neun.
9. Die Trumpfhierarchie muss **austauschbar** sein, um Solo-Varianten zu unterstützen.

## Akzeptanzkriterien

- Für jede Karte im Deck kann korrekt bestimmt werden, ob sie Trumpf oder Fehlkarte ist.
- Zwei beliebige Trümpfe können korrekt nach Rang verglichen werden.
- Herz-Zehn wird als höchster Trumpf erkannt.
- Damen und Buben aller Farben werden als Trumpf erkannt.
- Karo-Karten (As, Zehn, König, Neun) werden als Trumpf erkannt.
- Herz-As, Herz-König, Herz-Neun werden als Fehlkarten (Herz) erkannt.
- Die Rangfolge innerhalb der Fehlfarben ist korrekt (As > Zehn > König > Neun).
- Die Hierarchie lässt sich für andere Spieltypen (Soli) austauschen.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Trumpferkennung geschrieben und bestanden
- [x] Unit-Tests für Rangvergleich geschrieben und bestanden
- [x] Fehlfarben-Erkennung getestet
- [x] Austauschbarkeit der Hierarchie nachgewiesen (z.B. Interface/Strategie-Pattern)
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Trumpfhierarchie als **Strategy-Pattern** oder Interface implementieren, um verschiedene Spieltypen (Normal, Damensolo, Bubensolo, etc.) zu unterstützen
- Eine `TrumpfOrdnung`-Klasse/Interface mit Methoden wie `istTrumpf(Karte)`, `vergleiche(Karte, Karte)`, `getRang(Karte)`
- Die Standard-Trumpfordnung für das Normalspiel als Default-Implementierung
- Beachten: Herz ist im Normalspiel keine vollständige Fehlfarbe — Herz-Zehn, Herz-Dame und Herz-Bube sind Trümpfe, nur Herz-As, Herz-König und Herz-Neun sind Fehl
