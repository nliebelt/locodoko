# Frontend: Rundenauswertung

| Feld           | Wert                                              |
|----------------|---------------------------------------------------|
| Status         | Zu prüfen |
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

- [x] Rundenende-Overlay implementiert
- [x] Kopfzeile mit Spieltyp und Spielnummer
- [x] Ergebnis-Zeile mit Gewinner und Punkten
- [x] Parteien-Übersicht mit Augenzahl
- [x] Punkte-Berechnung vollständig aufgelistet
- [x] Sonderpunkte-Sektion (bedingt)
- [x] Gesamtstand-Zeile
- [x] Partie-Ende-Overlay mit Gesamtauswertung
- [x] Countdown für Neustart
- [x] Keyboard-Support (Enter zum Schließen)
- [ ] Visuelles Review

## Spielprotokoll (DKV-Scorecard)

### Beschreibung

Ein laufendes Spielprotokoll im DKV-Stil zeigt alle Runden der aktuellen Partie als wachsende Tabelle. Es ist über einen Button in der `TischSzene` als Overlay aufrufbar (kein Pflicht-Modal). Das Protokoll wird **ausschließlich im Frontend akkumuliert** — kein eigener Backend-Endpunkt.

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│  SPIELPROTOKOLL                                                 │
│  ──────────────────────────────────────────────────────────── │
│  Nr. │ G │ Typ       │ Bock │ Alice     │ Bob       │ ...      │
│       │   │           │      │ Pkt (Std) │ Pkt (Std) │          │
│  ─── │ ─ │ ─────────│ ─── │ ─────────│ ─────────│          │
│   1   │ N │ Normal    │      │ +2 (+2)   │ -2 (-2)   │ ...      │
│   2   │ O │ Solo      │      │ -3 (-1)   │ +9 (+11)  │ ...      │
│   3   │ S │ Normal    │ ✗    │ +4 (+3)   │ -4 (+7)   │ ...      │
│   4   │ W │ Hochzeit  │ ✗    │ -2 (+1)   │ +2 (+9)   │ ...      │
│  ...                                                            │
│                                              [ Schließen ]      │
└────────────────────────────────────────────────────────────────┘
```

### Anforderungen

1. Jede Zeile entspricht einem abgeschlossenen Spiel innerhalb der Partie.
2. Spalten: `Nr.` (laufende Nummer), `G` (Geber-Kürzel: N/O/S/W), `Typ` (Spieltyp), `Bock` (✗ wenn Bock-Runde), pro Spieler: `Pkt` (Punkte der Runde) und `(Stand)` (kumulativer Partiepunktestand).
3. Neuer Eintrag wird **pro `SpielBeendet`-Event** hinzugefügt.
4. Datenquelle aus `SpielBeendet`-Event:
   - `spielNummer` → Nr.
   - `spieltyp` → Typ
   - `SpielerSpielDaten.spielpunkte` → Pkt pro Spieler
   - `SpielerSpielDaten.kumulativePartiePunkte` → Stand pro Spieler
   - `bockrundeAktiv` → Bock-Marker (falls im Event vorhanden, sonst aus `bockrundenZaehler > 0` ableiten)
   - Geber: wird frontend-seitig aus der Rotation N→O→S→W abgeleitet (Spielnummer mod 4)
5. Scrollen: Die Tabelle ist scrollbar wenn mehr als ~8 Einträge vorhanden sind (via `PhaserList` oder Masking).
6. Font: `Press Start 2P` für Werte, kleinste zulässige Größe XS (8px) für Stand-Spalten.
7. Aktuelle Runde (letzte Zeile) wird farblich hervorgehoben.
8. Das Protokoll bleibt über die gesamte Partie im Speicher und überlebt Szenen-Wechsel via AppStore.

### Akzeptanzkriterien

- Tabelle wächst nach jeder Runde um eine Zeile.
- Kumulativer Stand ist korrekt berechnet.
- Bock-Marker erscheint wenn in einer Bock-Runde gespielt wurde.
- Protokoll überlebt Verbindungsunterbrüche (da im AppStore gespeichert).

### Definition of Done Spielprotokoll

- [ ] `SpielpritkollStore` oder Protokoll-State im AppStore
- [ ] Protokoll-Overlay (Button + Tabellenansicht) in `TischSzene.ts`
- [ ] Korrekte Akkumulation via `SpielBeendet`-Events
- [ ] Scrollen bei mehr als 8 Einträgen
- [ ] Visuelles Review

## Technische Hinweise

- Datenbasis: `LetztesSpielergebnisAnsicht` aus `TischAnsichtModell` — dort alle nötigen Felder ergänzen falls noch nicht vorhanden.
- Die Ansicht ist auch in Phaser umgesetzt.
- Das bestehende `rundenEndeModal` und `partieEndeModal` in `TischSzene.ts` werden durch diese Spec ersetzt und inhaltlich erweitert.
- Punkte-Berechnung muss vom Backend vollständig übertragen werden (alle Einzelschritte).
- **Spielprotokoll-Persistenz**: Der Protokoll-State lebt im AppStore (kein eigener Backend-Endpunkt). Bei Verbindungsabbruch und Reconnect wird der State aus dem laufenden `partieStand` rekonstruiert soweit möglich.
