# Schweinchen

| Feld           | Wert                                                      |
|----------------|-----------------------------------------------------------|
| Status         | Implementiert |
| Priorität      | Mittel                                                    |
| Abhängigkeiten | trumpfhierarchie.md, spielablauf.md                       |

## Beschreibung

Wenn ein Spieler **beide Karo-Asse** auf der Hand hält, werden diese für das laufende Spiel zu
den **stärksten Trümpfen** befördert — sie übertrumpfen sogar die Dullen. Diese Regel gilt im
Normalspiel und im Trumpfsolo (`SOLO_TRUMPF`). Alle anderen Spieltypen (Hochzeit, Armut,
Damen-/Buben-/Farb-/Fleischlos-Solo) sind ausgeschlossen.

## Anforderungen

1. Nach dem Austeilen der Karten wird geprüft, ob ein Spieler beide Karo-Asse auf der Hand hält.
2. Ist das der Fall und ist die Regel aktiv (s. Punkt 6), werden für dieses Spiel die beiden
   Karo-Asse zur **höchsten Trumpfposition** befördert (Rang > Dulle).
3. Trumpfrangfolge mit Schweinchen (absteigend):
   zweites Schweinchen > erstes Schweinchen > Dulle (Herz-Zehn) > Kreuz-Dame > ...
4. Das **zweite** gespielte Karo-As schlägt das erste, wenn beide im selben Stich liegen
   (analog zur Dulle-Regel mit `zweiteDulleSticht`).
5. Schweinchen gilt im **Normalspiel** (`Spieltyp.NORMALSPIEL`) und im **Trumpfsolo**
   (`Spieltyp.SOLO_TRUMPF`). Bei allen anderen Solo-Spieltypen (`SOLO_DAME`, `SOLO_BUBE`,
   `SOLO_TRUMPF_HERZ`, `SOLO_TRUMPF_PIK`, `SOLO_TRUMPF_KREUZ`, `SOLO_FLEISCHLOS`) sowie
   bei `HOCHZEIT` und `ARMUT` greift die Regel nicht.
6. Schweinchen ist über die Tischkonfiguration **aktivierbar/deaktivierbar** (`schweinchenAktiv`).

## Akzeptanzkriterien

- Spieler mit beiden Karo-Assen, Regel aktiv: Karo-Asse erhalten höheren Rang als die Dulle.
- Kein Spieler hält beide Karo-Asse: normale Trumpfreihenfolge bleibt unverändert.
- Zweites Schweinchen im selben Stich schlägt das erste.
- Schweinchen greift nicht in `SOLO_DAME`, `SOLO_BUBE`, `SOLO_FLEISCHLOS`, `SOLO_TRUMPF_HERZ`,
  `SOLO_TRUMPF_PIK`, `SOLO_TRUMPF_KREUZ`, `HOCHZEIT` und `ARMUT`.
- Schweinchen greift im `SOLO_TRUMPF` wenn ein Spieler beide Karo-Asse hält.
- Regel deaktivierbar per `Spielregeln.schweinchenAktiv = false`.

## Definition of Done

- [x] Schweinchen-Erkennung nach `teileKartenAus()` in `Spiel` (oder nach `loeseVorbehalteAuf()`)
- [x] `NormaleTrumpfOrdnung` unterstützt erhöhte Karo-As-Ränge (Unterklasse oder Konstruktor-Parameter)
- [x] `spaetereGleicheKarteGewinnt(Karte)` gibt `true` für Karo-As zurück wenn Schweinchen aktiv
- [x] `Spielregeln` enthält `schweinchenAktiv: boolean`
- [x] Solo-Ausschluss (`SOLO_DAME`, `SOLO_BUBE`, `SOLO_FLEISCHLOS`, Farbsoli) getestet
- [x] SOLO_TRUMPF-Einschluss getestet
- [x] HOCHZEIT/ARMUT-Ausschluss getestet
- [x] Unit-Tests für Trumpfrangvergleich mit und ohne Schweinchen
- [x] Stichgewinner-Test (KARO_AS_2 schlägt KARO_AS_1 schlägt Dulle)
- [x] Deaktivierung per Konfiguration getestet

## Technische Hinweise

- **Bounded Context**: Spiel / Karten
- Schweinchen-Erkennung in `Spiel.teileKartenAus()`:
  Prüfen ob ein Spieler beide Karo-Asse (`Farbe.KARO, Kartenwert.AS`, exemplarIndex 1 und 2)
  auf der Hand hält.
- Falls ja, Spieltyp ist NORMALSPIEL oder SOLO_TRUMPF, und `spielregeln.schweinchenAktiv()`:
  `trumpfOrdnung` durch `SchweinchenTrumpfOrdnung` (Decorator oder Unterklasse von
  `NormaleTrumpfOrdnung`) ersetzen.
- `SchweinchenTrumpfOrdnung.trumpfRang(Karte)`:
  - Karo-As exemplarIndex 1 → Rang 14
  - Karo-As exemplarIndex 2 → Rang 15
  - Alle anderen Karten: Delegation an `NormaleTrumpfOrdnung`
- `spaetereGleicheKarteGewinnt(Karte)`: `true` für Karo-As (zweites Schweinchen schlägt erstes).
- Die `trumpfOrdnung` wird im `Spiel`-Feld gespeichert und an alle Stich-Operationen
  weitergegeben — kein weiterer Anpassungsbedarf in `Stich` oder `PunkteRechner`.
- `trumpfOrdnungFuer(HOCHZEIT/ARMUT)` → immer `NormaleTrumpfOrdnung` (kein Schweinchen).
- `nimmArmutAn()` → immer `NormaleTrumpfOrdnung` nach Kartentausch (kein Schweinchen in Armut).
