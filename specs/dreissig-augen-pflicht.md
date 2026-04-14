# Dreißig-Augen-Pflicht (30er-Zwangsansage)

| Feld           | Wert                                                      |
|----------------|-----------------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                                      |
| Abhängigkeiten | ansagen.md, stichlogik.md, spielablauf.md                 |

## Beschreibung

Wenn ein Team im **ersten oder zweiten Stich** mehr als **30 Augen** in einem einzelnen
Stich gewinnt, ist es zur sofortigen Grundansage (Re bzw. Kontra) verpflichtet. Die Ansage
muss erfolgen, bevor die nächste Karte gespielt wird.

## Anforderungen

1. Nach jedem vollständig abgeschlossenen Stich wird geprüft, ob der Stich der **erste oder
   zweite** des Spiels war **und** ob die gewinnende Partei **> 30 Augen** aus diesem
   einzelnen Stich geholt hat (`stich.augen() > 30`).
2. Ist diese Bedingung erfüllt und die gewinnende Partei hat noch keine Grundansage
   (Re bzw. Kontra) gemacht, ist eine **Pflichtansage** fällig.
3. Im Zustand „Pflichtansage ausstehend" ist das Ausspielen weiterer Karten
   **gesperrt**, bis die Grundansage der betroffenen Partei vorliegt.
4. Die Pflichtansage ist **ohne Mindestkartengrenze** möglich — die normalen
   Ansage-Zeitfenster aus `Spielregeln` gelten für diese Zwangsansage nicht.
5. Die Regel gilt **nicht** für Solo-Spiele; nur Normalspiel und Hochzeit sind betroffen.
6. Die Regel ist über die Tischkonfiguration **aktivierbar/deaktivierbar**.

## Akzeptanzkriterien

- Stich 1 oder 2, gewinnende Partei > 30 Augen, kein Re/Kontra: nächster Zug wird blockiert.
- Stich 1 oder 2, gewinnende Partei > 30 Augen, Re/Kontra bereits gemacht: kein Block.
- Stich 1 oder 2, gewinnende Partei ≤ 30 Augen: kein Block.
- Stich 3 oder später: Regel greift nie.
- Pflichtansage ist ohne Mindestkartenanzahl möglich.
- Im Solo-Spiel greift die Regel nicht.
- Deaktivierbar per `Spielregeln.dreissigAugenPflichtAktiv`.

## Definition of Done

- [ ] Prüfung nach vollständigem 1. und 2. Stich in `Spiel.spieleKarte()`
- [ ] `Spiel`-Zustand enthält Marker für ausstehende Pflichtansage (z. B. `Set<Partei>`)
- [ ] Blockierungslogik in `spieleKarte()` implementiert
- [ ] Pflichtansage ohne Mindestkartengrenze in `Ansagen.kannAnsagen()` möglich
- [ ] Solo-Ausschluss getestet
- [ ] `Spielregeln` enthält `dreissigAugenPflichtAktiv: boolean`
- [ ] Unit-Tests für Blockierung und Entsperrung
- [ ] Integrationstests für vollständigen Spielablauf mit Pflichtansage

## Technische Hinweise

- **Bounded Context**: Partie / Spiel
- Prüfung in `Spiel.spieleKarte()` nach vollständigem Stich:
  `if (neueAbgeschlosseneStiche.size() <= 2 && gespielterStich.augen() > 30)`.
- Gewinnende Partei aus `parteien.parteiVon(gespielterStich.gewinner(trumpfOrdnung).spieler())`.
- Mögliche Modellierung: Feld `pflichtansageAusstehend: Set<Partei>` in `Spiel`
  (leer = kein Block; nicht-leer = Ansage fällig für diese Parteien).
- `Ansagen.kannAnsagen()` benötigt separaten Pfad für Pflichtansagen
  (Mindestkartenanzahl ignorieren, nur Parteizugehörigkeit prüfen).
- Blockierung greift in `spieleKarte()` am Beginn: wenn `pflichtansageAusstehend` nicht
  leer ist und die betroffene Partei noch kein Re/Kontra hat, Exception werfen.
