# Sonderpunkte

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet      |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, stichlogik.md, trumpfhierarchie.md |

## Beschreibung

Sonderpunkte sind zusätzliche Spielpunkte, die für besondere Ereignisse während eines Spiels vergeben werden. Die drei Standard-Sonderpunkte im Doppelkopf sind „Fuchs gefangen", „Karlchen" und „Doppelkopf". Diese werden am Ende eines Spiels ausgewertet und beeinflussen das Gesamtergebnis.

## Anforderungen

### Fuchs gefangen

1. Als **Fuchs** gelten die beiden **Karo-Asse**.
2. Wenn ein Spieler ein **Karo-As der Gegenpartei** in einem Stich gewinnt, erhält seine Partei den Sonderpunkt **„Fuchs gefangen"**.
3. Jedes gefangene Karo-As zählt als **separater Sonderpunkt** (maximal 2 Füchse fangbar).
4. Ein Fuchs der eigenen Partei kann nicht „gefangen" werden.

### Karlchen

5. **Karlchen** ist der **Kreuz-Bube**.
6. Der Sonderpunkt **„Karlchen"** wird vergeben, wenn ein **Kreuz-Bube den letzten Stich gewinnt** — d.h. der Kreuz-Bube muss die **höchste Karte im letzten Stich** sein (den Stich tatsächlich stechen).
7. Es reicht **nicht**, dass ein Kreuz-Bube lediglich im letzten Stich liegt — er muss den Stich gewinnen.
8. Die Partei des Spielers, der den Kreuz-Buben gespielt hat, erhält den Sonderpunkt.

### Doppelkopf

9. Ein **Doppelkopf** liegt vor, wenn ein Stich **≥ 40 Augen** enthält.
10. Die Partei, die den Doppelkopf-Stich gewinnt, erhält den Sonderpunkt **„Doppelkopf"**.
11. Mehrere Doppelkopf-Stiche in einem Spiel ergeben **jeweils einen Sonderpunkt**.

### Allgemein

12. Sonderpunkte werden **am Ende des Spiels** ausgewertet und zum Spielergebnis addiert.
13. Sonderpunkte können über die Tischkonfiguration **einzeln aktiviert/deaktiviert** werden.
14. Sonderpunkte sind im Solo-Spiel ebenfalls gültig (Solo-Spieler = eigene Partei).

## Akzeptanzkriterien

- Ein gefangenes Karo-As der Gegenpartei wird korrekt als „Fuchs gefangen" erkannt.
- Ein eigenes Karo-As im gewonnenen Stich wird nicht als gefangener Fuchs gewertet.
- Ein Kreuz-Bube, der den letzten Stich gewinnt (höchste Karte), wird als „Karlchen" erkannt.
- Ein Kreuz-Bube im letzten Stich, der nicht die höchste Karte ist, löst keinen Sonderpunkt aus.
- Ein Kreuz-Bube in einem nicht-letzten Stich löst keinen Sonderpunkt aus.
- Ein Stich mit ≥ 40 Augen wird als „Doppelkopf" erkannt.
- Ein Stich mit < 40 Augen ist kein Doppelkopf.
- Jeder Sonderpunkt kann einzeln deaktiviert werden.
- Sonderpunkte werden korrekt einer Partei zugewiesen (nicht einem einzelnen Spieler).

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Fuchs-Erkennung geschrieben und bestanden
- [x] Unit-Tests für Karlchen-Erkennung geschrieben und bestanden
- [x] Unit-Tests für Doppelkopf-Erkennung geschrieben und bestanden
- [x] Sonderpunkte im Solo-Spiel getestet
- [x] Deaktivierung einzelner Sonderpunkte getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Punkteberechnung
- Sonderpunkte als eigene Klasse oder Enum mit Erkennungslogik
- `SonderpunktBewerter`-Service, der nach Spielende alle Stiche analysiert
- Methoden: `pruefeFuchsGefangen(Stich, Parteien)`, `pruefeKarlchen(letzterStich)`, `pruefeDoppelkopf(Stich)`
- Die Ergebnisse werden an die `Punkteberechnung` übergeben
- Der Sonderpunkt „Karlchen" erfordert Wissen über den letzten Stich — dieser muss markiert oder erkennbar sein
