# Sonderspiel: Farbsolo (Herz-, Pik-, Kreuz-Solo)

| Feld           | Wert                                                              |
|----------------|-------------------------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                                            |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, spielablauf.md, ki-strategie.md |

## Beschreibung

Beim Farbsolo wählt der Solo-Spieler eine Nicht-Karo-Farbe (Herz, Pik oder Kreuz) als Trumpffarbe. Diese ersetzt Karo als die Farbgruppe der unteren Trümpfe. Dame und Bube aller vier Farben bleiben Trumpf (wie im Normalspiel). Der Solo-Spieler spielt alleine gegen die anderen drei Spieler.

## Trumpfhierarchie im Farbsolo

Die Hierarchie entspricht dem Normalspiel, jedoch mit der gewählten Farbe statt Karo als Farbtrümpfe:

1. **Herz-Zehn** (Dulle) — NICHT Dulle im Herzsolo! Herz-Zehn ist im Herzsolo eine normale Farbtrumpfkarte.
2. Kreuz-Dame, Pik-Dame, Herz-Dame, Karo-Dame (in dieser Reihenfolge)
3. Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube
4. Farbtrümpfe der gewählten Farbe (Ass, Zehn, König, Neun — absteigend)
5. Karo-Karten sind **keine Trümpfe** (außer Karo-Dame und Karo-Bube, die immer Trumpf sind)

> Hinweis: Im Herzsolo gibt es keine Dulle (Herz-Zehn ist regulärer Farbtrumpf). In Pik- und Kreuz-Solo bleibt die Herz-Zehn ein normaler Herz-Fehlstich.

## Anforderungen

1. Jeder Spieler darf in der Vorbehalt-Phase ein **Herzsolo**, **Piksolo** oder **Kreuzsolo** anmelden.
2. Alle drei Farbsolos haben **Vorbehalt-Priorität 3** (gleichrangig mit anderen Soli).
3. Der Solo-Spieler bildet die **Re-Partei** (alleine).
4. Die anderen drei Spieler bilden die **Kontra-Partei**.
5. Die Farbsolos können über die Tischkonfiguration **deaktiviert** werden (zusammen mit SOLO_TRUMPF über `soloTrumpfAktiv()`).

## KI-Verhalten

Die KI (Standard- und SchwerKiStrategie) bewertet alle drei Farbsolos in der Vorbehaltphase:

- **Bewertungsformel**: `farbsoloTrumpfAnzahl × 4 + fehlAsse × 2 + damen × 2 + buben × 2`
  - `farbsoloTrumpfAnzahl`: Karten die Dame, Bube oder gewählte Farbe sind
  - `fehlAsse`: Asse der Nicht-Trumpf-Farben (sichern Fehlstiche)
  - `damen`/`buben`: Bonuspunkte (sind bereits in `farbsoloTrumpfAnzahl` enthalten, aber strategisch besonders wertvoll)
- **Meldeschwelle**: 46 Punkte (entspricht ~9 Farbtrümpfen mit guten Begleitkarten)
- Die KI wählt das beste Farbsolo (höchster Wert) und meldet es nur wenn die Schwelle erreicht wird.

## Akzeptanzkriterien

- Die gewählte Farbe (Herz, Pik oder Kreuz) und alle Damen/Buben sind Trümpfe.
- Karo-Karten (außer Karo-Dame und Karo-Bube) sind Fehlkarten.
- Im Herzsolo ist Herz-Zehn kein Sondertrumpf (keine Dulle-Funktion).
- Solo-Spieler = Re-Partei, Rest = Kontra-Partei.
- KI meldet Farbsolo bei hinreichend starker Handkarte.

## Definition of Done

- [x] `VariableTrumpfsoloTrumpfOrdnung` implementiert Trumpfordnung für beliebige Nicht-Karo-Farbe
- [x] `VorbehaltAnsage.SOLO_TRUMPF_HERZ/PIK/KREUZ` mit Priorität 3 und `soloTrumpfAktiv()`-Validierung
- [x] `Spiel.java` erzeugt korrekte `VariableTrumpfsoloTrumpfOrdnung` je nach Spieltyp
- [x] KI bewertet und meldet Farbsolos (`StandardKiStrategie.waehleVorbehalt()`)
- [x] Unit-Tests für KI-Farbsolo-Erkennung

## Technische Hinweise

- **Bounded Context**: `karten` (Trumpfordnung), `partie` (KI, Spieltyp)
- `VariableTrumpfsoloTrumpfOrdnung(Farbe trumpfFarbe, Spielregeln spielregeln)` — Parameter bestimmt die Trumpffarbe
- Im Gegensatz zu Normalspiel und Trumpfsolo gibt es im Farbsolo **keine Dulle** (Herz-Zehn verliert ihre Sonderfunktion wenn Herz Trumpffarbe ist; in Pik/Kreuz-Solo ist sie ohnehin kein Sondertrumpf)
