# Ansagen

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, spielablauf.md, stichlogik.md |

## Beschreibung

Ansagen sind aktive Deklarationen während der ersten Stiche, mit denen ein Spieler die eigene Partei ansagt oder Gewinnziele verschärft. Die Grundansagen sind „Re" und „Kontra", gefolgt von Verschärfungen (Absagen) wie „Keine 90", „Keine 60", „Keine 30" und „Schwarz". Ansagen beeinflussen die Punkteberechnung erheblich. Ansagen finden **während der Stichphase** statt — es gibt keine separate Ansage-Phase. Ein Spieler kann eine Ansage tätigen, bevor er seine Karte in einem Stich spielt, solange die Mindestkartenanzahl erfüllt ist.

## Anforderungen

### Grundansagen

1. Ein Spieler der **Re-Partei** darf **„Re"** ansagen.
2. Ein Spieler der **Kontra-Partei** darf **„Kontra"** ansagen.
3. Durch die Re-Ansage offenbart der Spieler seine Partei-Zugehörigkeit.
4. Im Normalspiel erkennt ein Spieler seine Partei daran, ob er eine **Kreuz-Dame** hat (Re) oder nicht (Kontra).

### Verschärfungen

5. Nach einer Re- oder Kontra-Ansage kann die jeweilige Partei **Verschärfungen** ansagen:
   - **Keine 90**: Die Gegenpartei wird keine 90 Augen erreichen.
   - **Keine 60**: Die Gegenpartei wird keine 60 Augen erreichen.
   - **Keine 30**: Die Gegenpartei wird keine 30 Augen erreichen.
   - **Schwarz**: Die Gegenpartei wird keinen einzigen Stich gewinnen.
6. Verschärfungen müssen in **aufsteigender Reihenfolge** getätigt werden (keine 90 vor keine 60 usw.).
7. Eine Verschärfung setzt die vorherige Stufe voraus (z.B. „Keine 60" nur nach „Keine 90").

### Zeitliche Beschränkung (DKV-Turnierspielregeln)

8. Ansagen sind nur möglich, solange der ansagende Spieler noch **eine Mindestanzahl Karten auf der Hand** hat.
9. Die Mindestkartenanzahl für jede Ansagestufe (verifiziert nach DKV-Turnierspielregeln):

   | Ansage     | Mindestkartenanzahl | Bedeutung                        |
   |------------|---------------------|----------------------------------|
   | Re/Kontra  | 11                  | Vor dem Ausspielen der 1. Karte  |
   | Keine 90   | 10                  | Vor dem Ausspielen der 2. Karte  |
   | Keine 60   | 9                   | Vor dem Ausspielen der 3. Karte  |
   | Keine 30   | 8                   | Vor dem Ausspielen der 4. Karte  |
   | Schwarz    | 7                   | Vor dem Ausspielen der 5. Karte  |

10. Sobald die Mindestkartenanzahl unterschritten wird, ist die Ansage nicht mehr möglich.
11. Bei Spiel **ohne Neunen** (10 Karten) verschieben sich die Grenzen entsprechend um 2 nach unten (Re/Kontra: 9, Keine 90: 8, etc.).
12. Die Mindestkartenanzahlen sind pro Tisch **konfigurierbar** — die obigen Werte sind die Standardwerte.

### Auswirkungen

13. Ansagen **erhöhen** die Spielpunkte (Details in `punkteberechnung.md`).
14. Verschärfungen erzeugen **nur dann zusätzliche Spielpunkte**, wenn sie auch tatsächlich **angesagt** wurden (nur Ansage zählt).
15. Eine Ansage kann nicht zurückgenommen werden.

### Parteibildung und Ansagen

16. Im **Normalspiel** bilden die beiden Spieler mit je einer **Kreuz-Dame** die **Re-Partei**, die anderen beiden die **Kontra-Partei**.
17. Die Parteizugehörigkeit ist zu Beginn **geheim** — kein Spieler weiß sicher, wer sein Partner ist.
18. Durch eine Re- oder Kontra-Ansage **offenbart** ein Spieler seine Partei-Zugehörigkeit.

## Akzeptanzkriterien

- Ein Re-Spieler kann „Re" ansagen, ein Kontra-Spieler kann „Kontra" ansagen.
- Ein Re-Spieler kann kein „Kontra" ansagen und umgekehrt.
- Verschärfungen sind nur in der korrekten Reihenfolge möglich.
- Ansagen werden blockiert, wenn die Mindestkartenanzahl unterschritten ist.
- Nach einer Ansage kann diese nicht zurückgenommen werden.
- Das UI zeigt Ansage-Möglichkeiten nur an, wenn sie regelkonform sind.
- Die Ansage wird allen Spielern mitgeteilt.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Unit-Tests für alle Ansagetypen geschrieben und bestanden
- [ ] Unit-Tests für zeitliche Beschränkung geschrieben und bestanden
- [ ] Unit-Tests für ungültige Ansagen (falsche Partei, falsche Reihenfolge) geschrieben und bestanden
- [ ] Integration mit Punkteberechnung vorbereitet
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Ansagen als eigenes Value Object oder Enum modellieren
- Ansage-Möglichkeit prüfen: `kannAnsagen(Spieler, AnsageTyp, aktuelleKartenanzahl, Tischkonfiguration)` → boolean
- Ansage-Event über WebSocket an alle Spieler senden
- Die Mindestkartenanzahlen sind Teil der `Tischkonfiguration`
- Im Solo-Spiel: Solo-Spieler = Re, andere = Kontra
