# Punkteberechnung

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Implementiert |
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

### Sonderregeln: Gegen die Alten

12. Gewinnt die Kontra-Partei gegen die Re-Partei (die "Alten"), erhält sie **immer +1 Sonderpunkt**. 
    - Dies gilt unabhängig davon, ob "Re" oder "Kontra" angesagt wurde.
    - Begründung: Belohnung für den Sieg gegen die stärkeren Kreuz-Damen.

### Sonderpunkte-Integration

13. Die Sonderpunkte aus `sonderpunkte.md` (Fuchs, Karlchen, Doppelkopf) werden zum Spielergebnis **addiert**.

### Solo-Bewertung

14. Im Solo-Spiel werden die Spielpunkte für den Solo-Spieler mit **3 multipliziert** (da er alleine spielt, zählt es dreifach).
15. Die drei Kontra-Spieler erhalten jeweils den einfachen Punkt (positiv oder negativ).

### Transparenz und Herkunft (Point Provenance)

16. Das Backend muss für jeden vergebenen Punkt die **Quelle explizit ausweisen** (z.B. "Grundwert: 1", "Gegen die Alten: 1", "Fuchs gefangen: 1").
17. Diese Aufschlüsselung muss Teil des `Spielergebnis`-DTOs sein: `punkteAufschluesselung: { label: string, wert: number }[]`. Das Frontend nutzt diese Liste, um die Rundenauswertung ohne eigene Logik darzustellen.

### Gesamtstand

18. Die Spielpunkte werden am Ende jedes Spiels zum **Partie-Gesamtstand** addiert.
19. Die Gewinner-Partei erhält positive Punkte, die Verlierer-Partei negative Punkte.
20. Das Spiel ist ein **Nullsummenspiel**: Die Summe aller Spielpunkte aller Spieler ist immer 0.

## Akzeptanzkriterien

- Re mit 121+ Augen gewinnt, Kontra mit 120+ Augen gewinnt.
- Der Grundwert ist 1 Spielpunkt.
- Kontra erhält immer +1 Punkt bei Sieg ("Gegen die Alten").
- Re-Ansage verdoppelt, Kontra-Ansage verdoppelt, beides vervierfacht.
- Verschärfungspunkte werden nur bei tatsächlicher Ansage vergeben.
- Sonderpunkte werden korrekt addiert.
- Solo-Punkte werden dreifach für den Solo-Spieler berechnet.
- Die Summe aller Spielerpunkte ist 0 (Nullsumme).
- Jeder Punkt ist mit seiner Herkunft (Label) versehen.

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
- `PunkteRechner` mit Methode `berechneNormalspielErgebnis(stiche, parteien, trumpfOrdnung, ansagen, spielregeln)` → `Spielergebnis` (reine Funktion, kein `Spiel`-Parameter).
- `Spielergebnis` (Record) enthält: Augen pro Partei, Sieger-Partei, Spielwert, Grundwert, Absage-Punkte, Gegen-die-Alten-Punkte, Spielpunkte pro Spieler und Sonderpunkte pro Partei.
- Die nutzerlesbare **Point-Provenance-Liste** (`punkteAufschluesselung: { label, wert }[]`, Anf. 16–17) wird aus diesen Komponenten im Wire-DTO `PartieStandAntwort` (`PunkteKomponenteAntwort[]`) erzeugt — nicht im Domänen-Record.
- Die Berechnung ist eine reine Funktion ohne Seiteneffekte (leicht testbar)
- Partiestand als Aggregate oder Value Object, das nach jedem Spiel aktualisiert wird
