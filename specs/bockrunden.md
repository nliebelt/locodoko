# Bockrunden

| Feld           | Wert                                                      |
|----------------|-----------------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                                    |
| Abhängigkeiten | spielablauf.md, punkteberechnung.md, stichlogik.md        |

## Beschreibung

Bockrunden sind partieweit gültige Multiplikationsrunden: In den nächsten _n_ Spielen werden
alle Spielpunkte verdoppelt. Ein **BockrundenZähler** in der `Partie` gibt an, wie viele der
folgenden Spiele noch doppelt gewertet werden. Der Zähler wird durch bestimmte Ereignisse erhöht.

## Anforderungen

### Zählerstruktur

1. Die `Partie` verwaltet einen **BockrundenZähler** (Integer ≥ 0), der die Anzahl der noch
   ausstehenden verdoppelten Spiele angibt.
2. Der Zähler ist am Beginn einer neuen Partie **0**.
3. Mehrere Trigger können den Zähler **aufaddieren** (nicht ersetzen).

### Wertung

4. Wenn beim Abschluss eines Spiels (`schliesseAktuellesSpielAb`) der BockrundenZähler > 0 ist,
   werden **alle Spielpunkte des gerade beendeten Spiels mit Faktor 2 multipliziert**.
5. Nach der Multiplikation wird der Zähler um **1 dekrementiert**.
6. Die Multiplikation wird **nach** der Berechnung des Spielergebnisses durch den `PunkteRechner`
   angewendet. Sie darf **nicht** das `Spielergebnis`-Objekt selbst verändern (dieses validiert intern
   eine Nullsumme). Stattdessen wird in `Partie.schliesseAktuellesSpielAb()` jeder
   `ergebnis.spielpunkteVon(position)`-Wert mit dem Bock-Faktor multipliziert, bevor er zum
   `gesamtpunktestand` addiert wird.

### Trigger

7. **Herz durchgegangen**: Ein Stich, der ausschließlich aus Herz-Farbkarten besteht
   (nur Herz-As oder Herz-König, keine Trümpfe), erhöht den BockrundenZähler nach Abschluss
   des Spiels um 1.
8. **Verlorenes Kontra**: Wenn die Kontra-Partei eine Kontra-Grundansage gemacht, aber verloren
   hat (Spielergebnis: Sieger = RE, Ansage KONTRA vorhanden), erhöht sich der BockrundenZähler
   nach Abschluss des Spiels um 1.
9. Beide Trigger können im selben Spiel ausgelöst werden (Zähler +2).

### Konfiguration

10. Bockrunden können über die Tischkonfiguration global **aktiviert/deaktiviert** werden.

## Akzeptanzkriterien

- BockrundenZähler startet bei 0.
- Herz-durchgegangen-Stich erhöht den Zähler um 1.
- Verlorenes Kontra erhöht den Zähler um 1.
- Beide Trigger im selben Spiel: Zähler +2.
- Bei Zähler > 0 nach `schliesseAktuellesSpielAb()`: Spielpunkte × 2, dann Zähler -1.
- Bei Zähler = 0: keine Verdoppelung.
- Deaktivierbar per `Spielregeln.bockrundenAktiv`.

## Definition of Done

- [x] `Partie` enthält Feld `bockrundenZaehler: int`, übergeben in Konstruktor und allen `neu()`-Methoden
- [x] `Partie.schliesseAktuellesSpielAb()`: Multiplikation und Dekrementierung implementiert
- [x] Trigger-Erkennung „Herz durchgegangen" (Hilfsmethode auf `Stich` oder `Spiel`)
- [x] Trigger-Erkennung „verlorenes Kontra" aus `Spielergebnis` und `Ansagen`
- [x] `Spielregeln` enthält `bockrundenAktiv: boolean`
- [x] Persistenz: `bockrunden_zaehler`-Spalte in `partie`-Tabelle (Liquibase Migration)
- [x] Unit-Tests für Multiplikation und Dekrementierung
- [x] Unit-Tests für beide Trigger (einzeln und kombiniert)
- [x] Deaktivierung per Konfiguration getestet

## Technische Hinweise

- **Bounded Context**: Partie
- `bockrundenZaehler` als Feld in `Partie`; da `Partie` unveränderlich ist, muss der Zähler
  im privaten Konstruktor und in `neu()` mitgeführt werden.
- Ablauf in `schliesseAktuellesSpielAb()`:
  1. Neue Bockrunden-Trigger aus dem abgeschlossenen Spiel erkennen (Zähler erhöhen).
  2. Wenn `bockrundenZaehler > 0`: Spielpunkte × 2 anwenden, Zähler -1.
  3. Aktualisierten Zähler in die neue `Partie`-Instanz übernehmen.
- „Herz durchgegangen" erkennen: alle Stiche des Spiels prüfen;
  ein Stich gilt als Herz-durchgegangen wenn alle 4 Karten Fehlherz sind
  (Herz-As oder Herz-König, kein Trumpf gemäß `TrumpfOrdnung`).
- „Verlorenes Kontra": `ergebnis.siegerPartei() == RE && ansagen.hatGrundansage(KONTRA, parteien)`.
- Persistenz: `bockrunden_zaehler INTEGER NOT NULL DEFAULT 0` in der `partie`-Tabelle.
