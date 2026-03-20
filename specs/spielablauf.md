# Spielablauf

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | kartendeck.md, stichlogik.md, trumpfhierarchie.md |

## Beschreibung

Definition des gesamten Spielablaufs einer Doppelkopf-Partie. Eine Partie besteht aus mehreren Spielen, jedes Spiel durchläuft definierte Phasen. Diese Spec beschreibt die Rundenstruktur, die Phasenabfolge innerhalb eines Spiels, die Geberrotation und die Partiesteuerung.

## Anforderungen

### Partiestruktur

1. Eine **Partie** besteht aus einer konfigurierbaren Anzahl von **Spielen** (Standard: 24, DKV-Empfehlung).
2. Über die gesamte Partie wird ein **Gesamtpunktestand** pro Spieler geführt.
3. Nach dem letzten Spiel ist die Partie beendet, und die Endauswertung wird angezeigt.

### Geberrotation

4. Zu Beginn der Partie wird ein **erster Geber** bestimmt (zufällig oder nach Position).
5. Der Geber **rotiert nach jedem Spiel im Uhrzeigersinn** zum nächsten Spieler.
6. Der Spieler **links vom Geber** beginnt das Spiel (erster Aufspieler im ersten Stich).

### Phasen eines Spiels

7. Jedes Spiel durchläuft folgende Phasen in dieser Reihenfolge:

   | Phase | Name                        | Beschreibung |
   |-------|-----------------------------|--------------|
   | 1     | **Karten austeilen**        | Karten werden gemischt und gleichmäßig verteilt |
   | 2     | **Vorbehalt-Ansage**        | Jeder Spieler gibt reihum an, ob er einen Vorbehalt hat (Solo, Hochzeit, Armut) oder „gesund" ist |
   | 3     | **Vorbehalt-Auflösung**     | Falls Vorbehalte existieren: Höchster Vorbehalt wird aufgelöst (Solo > Hochzeit > Armut). Falls kein Vorbehalt: Normalspiel |
   | 4     | **Armut-Tausch** (optional) | Falls Armut angemeldet: Kartentausch wird durchgeführt |
   | 5     | **Stichphase**              | 12 (bzw. 10) Stiche werden nacheinander gespielt |
   | 6     | **Auswertung**              | Augen zählen, Sonderpunkte berechnen, Spielpunkte vergeben |
   | 7     | **Gesamtstand aktualisieren** | Spielpunkte zum Partiestand hinzufügen |

8. Die **Vorbehalt-Reihenfolge** beginnt beim Spieler links vom Geber und geht im Uhrzeigersinn.
9. **Vorbehalt-Priorität** (absteigend): Solo > Hochzeit > Armut. Bei **mehreren Soli** entscheidet die **Sitzreihenfolge**: Der Spieler, der in der Reihenfolge (links vom Geber ausgehend) zuerst dran ist, darf sein Solo spielen. Es gibt keine Rangfolge zwischen den Solo-Typen.
10. Wenn kein Spieler einen Vorbehalt hat, wird ein **Normalspiel** gespielt.

### Parteibildung

11. Im **Normalspiel** bilden die beiden Spieler, die jeweils eine **Kreuz-Dame** besitzen, die **Re-Partei** („die Alten"). Die anderen beiden Spieler bilden die **Kontra-Partei**.
12. Die Parteizugehörigkeit ist zu Beginn des Spiels **geheim** — jeder Spieler kennt nur seine eigene Partei (ob er eine Kreuz-Dame hat oder nicht).
13. Die Parteien werden im Laufe des Spiels durch Ansagen, Spielverhalten oder das Ausspielen der Kreuz-Dame offenbart.

### Zustandsverwaltung

14. Der aktuelle Spielzustand muss jederzeit abfragbar sein (welche Phase, wer ist dran, welche Karten liegen).
15. Zustandsübergänge sind nur in der definierten Reihenfolge möglich (keine Phase kann übersprungen werden).
16. Ungültige Zustandsübergänge müssen abgelehnt werden.

## Akzeptanzkriterien

- Eine neue Partie startet korrekt mit der konfigurierten Anzahl Spiele.
- Der Geber rotiert nach jedem Spiel im Uhrzeigersinn.
- Der Spieler links vom Geber startet jedes Spiel als Aufspieler.
- Alle 7 Phasen werden in korrekter Reihenfolge durchlaufen.
- Die Vorbehalt-Phase wird korrekt abgearbeitet (alle Spieler gefragt, Priorität beachtet).
- Bei mehreren Soli gewinnt der Spieler, der in der Sitzreihenfolge zuerst dran ist.
- Die Parteibildung im Normalspiel ist korrekt (Kreuz-Damen = Re, Rest = Kontra).
- Die Parteizugehörigkeit ist zu Beginn geheim.
- Ein Normalspiel startet, wenn alle Spieler „gesund" melden.
- Nach dem letzten Spiel wird die Partie korrekt beendet.
- Ungültige Zustandsübergänge werden mit Fehler abgelehnt.
- Der Gesamtpunktestand wird über alle Spiele korrekt akkumuliert.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Unit-Tests für Phasenablauf geschrieben und bestanden
- [ ] Geberrotation getestet
- [ ] Vorbehalt-Priorisierung getestet
- [ ] Zustandsmaschine getestet (gültige und ungültige Übergänge)
- [ ] Integrationstests für vollständiges Spiel bestanden
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielverwaltung
- Spring Statemachine für den Spielzustand verwenden
- Zustände gemäß PRD: `WARTEN_AUF_SPIELER → SONDERSPIEL_ANSAGE → (ARMUT_TAUSCH) → STICH_PHASE → (NAECHSTER_STICH) → SPIELENDE → NAECHSTES_SPIEL → PARTIEENDE`
- `Partie`-Aggregate-Root mit Liste von `Spiel`-Entities
- `Spiel`-Entity enthält Phase, Geber, aktuelle Stiche, Ergebnis
- Events bei Phasenübergängen auslösen (für Frontend-Benachrichtigung)
