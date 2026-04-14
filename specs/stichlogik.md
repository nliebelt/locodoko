# Stichlogik

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md          |

## Beschreibung

Definition der Regeln, die bestimmen, wer einen Stich gewinnt, sowie der Bedienpflicht (Farbzwang). Ein Stich besteht aus genau 4 Karten, die nacheinander von den Spielern ausgespielt werden. Diese Spec regelt die Kernmechanik des Kartenspiels.

## Anforderungen

1. Ein **Stich** besteht aus genau 4 Karten, eine pro Spieler.
2. Der **Aufspieler** (der Spieler, der die erste Karte des Stichs legt) bestimmt die **angefragte Farbe** bzw. ob Trumpf angefragt wird.
3. **Bedienpflicht (Farbzwang)**: Jeder nachfolgende Spieler muss die angefragte Farbe bedienen, sofern er eine Karte dieser Farbe auf der Hand hat.
   - Wird Trumpf angespielt, muss Trumpf bedient werden.
   - Wird eine Fehlfarbe angespielt, muss diese Fehlfarbe bedient werden.
4. Kann ein Spieler die angefragte Farbe **nicht bedienen**, darf er eine beliebige Karte spielen (Trumpf zum Stechen oder Fehlkarte abwerfen).
5. **Stichgewinner** wird wie folgt bestimmt:
   - Wurde mindestens ein Trumpf gespielt, gewinnt der höchste Trumpf (gemäß Trumpfhierarchie).
   - Wurden keine Trümpfe gespielt, gewinnt die höchste Karte der angefragten Farbe.
   - Bei **zwei identischen Karten** (gleiches Paar) im selben Stich gewinnt die **zuerst gespielte** Karte (Ausnahme: Dulle, konfigurierbar).
6. Der Stichgewinner **beginnt den nächsten Stich** (wird Aufspieler).
7. Die **Augen** aller 4 Karten im Stich werden dem Stichgewinner (bzw. dessen Partei) gutgeschrieben.
8. Ein Spiel besteht aus **12 Stichen** (bzw. 10 Stiche bei Spiel ohne Neunen).
9. Die Spielreihenfolge ist **im Uhrzeigersinn**: Aufspieler → links → gegenüber → rechts.

## Akzeptanzkriterien

- Trumpf auf Trumpf: Der höhere Trumpf gewinnt den Stich.
- Fehlfarbe auf Fehlfarbe: Die höchste Karte der angefragten Farbe gewinnt.
- Trumpf auf Fehlfarbe: Der Trumpf gewinnt, auch wenn die Fehlkarte höhere Augen hat.
- Zwei gleiche Karten: Die zuerst gespielte gewinnt (außer konfigurierbare Dulle-Regel).
- Bedienpflicht wird korrekt erzwungen: Ein Spieler, der bedienen kann, muss bedienen.
- Ein Spieler, der nicht bedienen kann, darf beliebig spielen.
- Der Stichgewinner wird korrekt als nächster Aufspieler gesetzt.
- Die Augen des Stichs werden korrekt addiert und zugewiesen.
- Nach 12 (bzw. 10) Stichen ist das Spiel beendet.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für alle Stich-Szenarien geschrieben und bestanden
- [x] Bedienpflicht-Logik getestet (kann bedienen / kann nicht bedienen)
- [x] Stichgewinner-Ermittlung für Trumpf- und Fehlstiche getestet
- [x] Sonderfall gleiche Karten getestet
- [x] Augen-Zuweisung getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kartenverwaltung (Stichbewertung)
- `Stich`-Klasse, die 4 gespielte Karten (mit Spieler-Referenz und Reihenfolge) speichert
- Methode `ermittleGewinner()` nutzt die injizierte `TrumpfOrdnung`
- Methode `berechneAugen()` summiert die Augenwerte aller Karten
- Die Bedienpflicht-Prüfung gehört zur Spielzug-Validierung (wird aufgerufen, bevor eine Karte akzeptiert wird)
- `gueltigeKarten(Hand, angefragteFarbe)` liefert die spielbaren Karten eines Spielers
