# Punkteberechnung

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, stichlogik.md, ansagen.md, sonderpunkte.md |

## Beschreibung

Die Punkteberechnung bestimmt am Ende eines Spiels, welche Partei gewonnen hat und wie viele Spielpunkte vergeben werden. Sie berücksichtigt Augen, Ansagen, Sonderpunkte und die Spielart. Der Gesamtpunktestand wird über alle Spiele einer Partie akkumuliert.

## Anforderungen

### Augen und Grundgewinn

1. Am Ende eines Spiels werden die **Augen** (Kartenwerte) beider Parteien summiert.
2. Die Gesamtaugenzahl beträgt immer **240 Augen** (Re-Augen + Kontra-Augen = 240).
3. Die **Re-Partei** hat gewonnen, wenn sie **mindestens 121 Augen** erreicht hat.
4. Die **Kontra-Partei** hat gewonnen, wenn sie **mindestens 120 Augen** erreicht hat.
5. Der **Grundwert** eines gewonnenen Spiels beträgt **1 Spielpunkt**.

### Ansage-Punkte

6. Wurde **„Re"** angesagt, wird der Spielwert **verdoppelt** (für die Re-Partei bei Gewinn, für die Kontra-Partei bei Re-Verlust).
7. Wurde **„Kontra"** angesagt, wird der Spielwert ebenfalls **verdoppelt**.
8. Bei Re und Kontra ist der Spielwert **vervierfacht**.
9. Verschärfungen erzeugen **zusätzliche Spielpunkte**:

   | Ergebnis                        | Zusätzliche Punkte |
   |---------------------------------|--------------------|
   | Keine 90 erreicht (< 90 Augen) | +1                 |
   | Keine 60 erreicht (< 60 Augen) | +1                 |
   | Keine 30 erreicht (< 30 Augen) | +1                 |
   | Schwarz (0 Stiche)             | +1                 |

10. Verschärfungspunkte werden **nur dann gezählt**, wenn die entsprechende Verschärfung auch tatsächlich **angesagt** wurde (nur Ansage zählt, DKV-konform).
11. Wurde eine Verschärfung **angesagt und nicht erreicht**, erhält die Gegenpartei die Punkte.

### Gegen-die-Ansage-Punkte

12. Gewinnt die Kontra-Partei **gegen eine Re-Ansage**, gibt es **+1 Sonderpunkt** („gegen die Alten").
13. Gewinnt eine Partei gegen eine angesagte Verschärfung, gibt es pro nicht eingetretener Verschärfung **+1 Punkt**.

### Sonderpunkte-Integration

14. Die Sonderpunkte aus `sonderpunkte.md` (Fuchs, Karlchen, Doppelkopf) werden zum Spielergebnis **addiert**.

### Solo-Bewertung

15. Im Solo-Spiel werden die Spielpunkte für den Solo-Spieler mit **3 multipliziert** (da er alleine spielt, zählt es dreifach).
16. Die drei Kontra-Spieler erhalten jeweils den einfachen Punkt (positiv oder negativ).

### Gesamtstand

17. Die Spielpunkte werden am Ende jedes Spiels zum **Partie-Gesamtstand** addiert.
18. Die Gewinner-Partei erhält positive Punkte, die Verlierer-Partei negative Punkte.
19. Das Spiel ist ein **Nullsummenspiel**: Die Summe aller Spielpunkte aller Spieler ist immer 0.

## Akzeptanzkriterien

- Re mit 121+ Augen gewinnt, Kontra mit 120+ Augen gewinnt.
- Der Grundwert ist 1 Spielpunkt.
- Re-Ansage verdoppelt, Kontra-Ansage verdoppelt, beides vervierfacht.
- Verschärfungspunkte werden nur bei tatsächlicher Ansage vergeben.
- Gegen-die-Ansage-Punkte werden korrekt vergeben.
- Sonderpunkte werden korrekt addiert.
- Solo-Punkte werden dreifach für den Solo-Spieler berechnet.
- Die Summe aller Spielerpunkte ist 0 (Nullsumme).
- Der Gesamtstand akkumuliert korrekt über mehrere Spiele.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Grundbewertung geschrieben und bestanden
- [x] Unit-Tests für Ansage-Bewertung geschrieben und bestanden
- [x] Unit-Tests für Verschärfungen geschrieben und bestanden
- [x] Unit-Tests für Solo-Bewertung geschrieben und bestanden
- [x] Unit-Tests für Nullsumme geschrieben und bestanden
- [x] Gesamtstand-Akkumulation getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Punkteberechnung
- `PunkteRechner`-Service mit Methode `berechneErgebnis(Spiel)` → `SpielErgebnis`
- `SpielErgebnis` enthält: Augen pro Partei, Spielpunkte pro Spieler, Sonderpunkte-Aufschlüsselung
- Die Berechnung ist eine reine Funktion ohne Seiteneffekte (leicht testbar)
- Partiestand als Aggregate oder Value Object, das nach jedem Spiel aktualisiert wird
