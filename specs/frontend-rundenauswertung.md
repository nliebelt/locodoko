# Frontend: Rundenauswertung

| Feld           | Wert                                              |
|----------------|---------------------------------------------------|
| Status         | Neu                                               |
| Priorität      | Mittel                                            |
| Abhängigkeiten | punkteberechnung.md, sonderpunkte.md, ansagen.md  |

## Beschreibung

Nach jeder abgeschlossenen Runde (einem einzelnen Spiel innerhalb der Partie) erscheint automatisch ein modales Auswertungs-Overlay. Es zeigt alle relevanten Informationen über das gerade gespielte Spiel: Parteien, Punkte, Sonderpunkte, Ansagen. Das Overlay blockiert das Weiterspielen bis der Spieler es explizit schließt. Am Ende einer vollständigen Partie erscheint eine erweiterte Partie-Auswertung.

## Rundenende-Overlay (nach jedem Spiel)

### Layout-Übersicht

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Trumpfsolo · Spiel 3 von 12                             │  ← Spieltyp + Nummer
│  ──────────────────────────────────────────────────────  │
│                                                          │
│  RE gewinnt  (+2 Punkte)                                 │  ← Ergebnis fett
│                                                          │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │ RE               │    │ KONTRA           │           │
│  │ Friedhelm (Solo) │    │ Berta            │           │
│  │                  │    │ Carlo            │           │
│  │ 78 Augen         │    │ Du               │           │
│  └──────────────────┘    └──────────────────┘           │
│                                                          │
│  Punkte-Berechnung                                       │
│  ─────────────────                                       │
│  Grundwert            +1                                 │
│  Re hat angesagt      +1                                 │
│  Kontra keine 90      +1   (Kontra hat keine 90 nicht    │
│                            erfüllt → Re bekommt Punkt)   │
│  Solo-Multiplikator   ×3                                 │
│  ──────────────────────────────────                      │
│  Gesamt               +6 für RE                          │
│                                                          │
│  Sonderpunkte                                            │
│  ─────────────                                           │
│  Fuchs gefangen (Friedhelm fängt Carlosschen Fuchs) +1   │
│  Doppelkopf (Stich 7)                               +1   │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  Gesamtstand: Friedhelm 14 · Berta 8 · Carlo 2 · Du 6   │
│                                                          │
│              [ Weiter → ]                                │  ← einzige Aktion
└──────────────────────────────────────────────────────────┘
```

### Anforderungen

1. Das Overlay erscheint **automatisch** nach Empfang des Spielergebnis-Events vom Backend.
2. Das Overlay ist **modal** — kein Spielzug möglich bis es geschlossen ist.
3. Es kann **nicht per Escape** geschlossen werden — nur per Button „Weiter →" oder Enter-Taste.
4. Inhalt:

   **Kopfzeile:**
   - Spieltyp (Normales Spiel, Trumpfsolo, Damensolo, Bubensolo, Fleischlos, Hochzeit, Armut)
   - Spielnummer innerhalb der Partie (`Spiel 3 von 12`)

   **Ergebnis-Zeile:**
   - Gewinnende Partei (RE / KONTRA) in Akzentfarbe (Gold für RE, Blau für KONTRA)
   - Anzahl gewonnener Punkte (`+2 Punkte`)

   **Parteien-Übersicht:**
   - Zwei Spalten: RE-Partei links, KONTRA-Partei rechts
   - Jede Spalte listet die Spielernamen, bei Solo-Spieler ist `(Solo)` markiert
   - Augenzahl der jeweiligen Partei

   **Punkte-Berechnung:**
   - Jede Punkteregel einzeln aufgelistet mit Wert
   - Erfüllte Ansagen als Bonus, nicht erfüllte Ansagen als Bonus für die Gegenseite (mit Erklärung)
   - Solo-Multiplikator wenn zutreffend
   - Gesamt-Zeile fett hervorgehoben

   **Sonderpunkte:**
   - Nur sichtbar wenn Sonderpunkte gefallen sind
   - Je ein Eintrag pro Sonderpunkt mit Beschreibung wer gewonnen hat
   - Fuchs gefangen, Karlchen, Doppelkopf

   **Gesamtstand:**
   - Aktueller Partie-Punktestand aller vier Spieler, einzeilig

5. Der Button „Weiter →" schließt das Overlay und startet die nächste Runde.

## Partie-Ende-Overlay (nach dem letzten Spiel)

### Zusätzliche Anforderungen

1. Erscheint **statt** des normalen Rundenende-Overlays nach dem letzten Spiel einer Partie.
2. Zeigt zunächst die **Auswertung des letzten Spiels** (identisch zum Rundenende-Overlay).
3. Dann eine **Partie-Gesamtauswertung**:
   - Abschlusspunktestand aller Spieler (Tabelle: Spieler, Punkte, Spiele gewonnen)
   - Gewinner der Partie hervorgehoben
4. Button: „Neue Partie starten" (startet Countdown) oder „Zur Lobby".
5. Countdown läuft sichtbar ab (z.B. `Neue Partie startet in 10…`), Spieler kann jederzeit manuell bestätigen.

## Akzeptanzkriterien

- Overlay erscheint automatisch nach jedem Spielende.
- Alle Punkte-Bestandteile sind einzeln aufgelistet und korrekt.
- Sonderpunkte erscheinen nur wenn welche gefallen sind.
- Parteien-Zuordnung ist korrekt (besonders bei Hochzeit und Armut).
- „Weiter →" oder Enter schließt das Overlay.
- Partie-Ende-Overlay zeigt Gesamtauswertung und Neustart-Option.

## Definition of Done

- [ ] Rundenende-Overlay implementiert
- [ ] Kopfzeile mit Spieltyp und Spielnummer
- [ ] Ergebnis-Zeile mit Gewinner und Punkten
- [ ] Parteien-Übersicht mit Augenzahl
- [ ] Punkte-Berechnung vollständig aufgelistet
- [ ] Sonderpunkte-Sektion (bedingt)
- [ ] Gesamtstand-Zeile
- [ ] Partie-Ende-Overlay mit Gesamtauswertung
- [ ] Countdown für Neustart
- [ ] Keyboard-Support (Enter zum Schließen)
- [ ] Visuelles Review

## Technische Hinweise

- Datenbasis: `LetztesSpielergebnisAnsicht` aus `TischAnsichtModell` — dort alle nötigen Felder ergänzen falls noch nicht vorhanden.
- Die Ansicht ist auch in Phaser umgesetzt.
- Das bestehende `rundenEndeModal` und `partieEndeModal` in `TischSzene.ts` werden durch diese Spec ersetzt und inhaltlich erweitert.
- Punkte-Berechnung muss vom Backend vollständig übertragen werden (alle Einzelschritte).
