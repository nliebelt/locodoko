# Spielablauf

| Feld           | Wert                                              |
|----------------|---------------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                              |
| Abhängigkeiten | kartendeck.md, stichlogik.md, trumpfhierarchie.md |

## Beschreibung

Definition des gesamten Spielablaufs einer Doppelkopf-Partie. Eine Partie besteht aus mehreren Spielen, jedes Spiel durchläuft definierte Phasen. Diese Spec beschreibt die Rundenstruktur, die Phasenabfolge innerhalb eines Spiels, die Geberrotation und die Partiesteuerung.

## Anforderungen

### Partiestruktur

1. Eine **Partie** besteht aus einer konfigurierbaren Anzahl von **Spielen** (Standard: 24, DKV-Empfehlung).
2. Über die gesamte Partie wird ein **Gesamtpunktestand** pro Spieler geführt.
3. Nach dem letzten Spiel ist die Partie beendet, und die Endauswertung wird angezeigt.

### Geberrotation

1. Zu Beginn der Partie wird ein **erster Geber** bestimmt (zufällig oder nach Position).
2. Der Geber **rotiert nach jedem Normalspiel im Uhrzeigersinn** zum nächsten Spieler.
3. Der Spieler **links vom Geber** beginnt das Spiel (erster Aufspieler im ersten Stich).

### Phasen eines Spiels

1. Jedes Spiel durchläuft folgende Phasen in dieser Reihenfolge:

   | Phase | Name | Beschreibung |
   | ----- | ---- | ------------ |
   | 1 | **Karten austeilen** | Karten werden gemischt und gleichmaessig verteilt |
   | 2 | **Vorbehalt-Ansage** | Jeder Spieler gibt reihum an, ob er einen Vorbehalt hat (Solo, Hochzeit, Armut, Schmeißen) oder „gesund" ist |
   | 3 | **Vorbehalt-Auflösung** | Hoechster Vorbehalt aufgeloest (Schmeißen > Solo > Hochzeit > Armut); kein Vorbehalt: Normalspiel |
   | 4 | **Armut-Tausch** (optional) | Falls Armut angemeldet: Kartentausch wird durchgefuehrt |
   | 5 | **Stichphase** | 12 (bzw. 10) Stiche werden nacheinander gespielt |
   | 6 | **Auswertung** | Augen zaehlen, Sonderpunkte berechnen, Spielpunkte vergeben |
   | 7 | **Gesamtstand aktualisieren** | Spielpunkte zum Partiestand hinzufuegen |

2. Die **Vorbehalt-Reihenfolge** beginnt beim Spieler links vom Geber und geht im Uhrzeigersinn.
3. **Vorbehalt-Priorität** (absteigend): Schmeißen > Solo > Hochzeit > Armut. Bei **mehreren Soli** entscheidet die **Sitzreihenfolge**: Der Spieler, der in der Reihenfolge (links vom Geber ausgehend) zuerst dran ist, darf sein Solo spielen. Es gibt keine Rangfolge zwischen den Solo-Typen.
4. Wenn kein Spieler einen Vorbehalt hat, wird ein **Normalspiel** gespielt.

### Parteibildung

1. Im **Normalspiel** bilden die beiden Spieler, die jeweils eine **Kreuz-Dame** besitzen, die **Re-Partei** („die Alten"). Die anderen beiden Spieler bilden die **Kontra-Partei**.
2. Die Parteizugehörigkeit ist zu Beginn des Spiels **geheim** — jeder Spieler kennt nur seine eigene Partei (ob er eine Kreuz-Dame hat or nicht).
3. Die Parteien werden im Laufe des Spiels durch Ansagen, Spielverhalten oder das Ausspielen der Kreuz-Dame offenbart.

### Schmeißen (Neuauflage)

Ein Spieler darf das Spiel **neu auflegen** (schmeißen) wenn er eine der folgenden Sonderkonstellationen auf der Hand hat. Alle Karten kommen zurück, werden neu gemischt und neu ausgeteilt — der Geber bleibt gleich. Ein Schmeißen wird als Vorbehalt angemeldet.

| Regel | Bedingung | Status |
|-------|-----------|--------|
| **Fünf Könige** | Spieler hat 5 oder mehr Könige auf der Hand. | Implementiert |
| **Fünf Neunen** | Spieler hat 5 oder mehr Neunen auf der Hand. (Bei 40er Blatt: 4 oder mehr). | Implementiert |
| **Wenig Trumpf** | Spieler hat weniger als 2 Trümpfe auf der Hand. | Implementiert |

1. Der Vorbehalt "Schmeißen" gilt als höchster Vorbehalt. Wenn ein Spieler schmeißt, wird sofort neu ausgeteilt ohne die anderen Vorbehalte aufzulösen.
2. Jeder Spieler hat **genau ein Schmeißen-Recht** pro Spiel (nicht pro Partie).
3. Die Schmeißen-Regel ist nicht Teil des DKV-Turnier-Regelsets, aber Teil des Loco-Blatt-Presets.
4. Die Schmeißen-Optionen sind in den **Tisch-Einstellungen einzeln konfigurierbar**.

### Geberrotation bei Solo (Nachgeben)

1. Wenn das abgeschlossene Spiel ein **Solo** war, bleibt der **Geber identisch** mit dem Geber
   des beendeten Spiels — der Geber rotiert in diesem Fall nicht.
2. Im nächsten Spiel nach einem Solo erhält der **Solist automatisch das Anspielrecht** (er spielt
   die erste Karte des ersten Stichs), unabhängig von seiner Position relativ zum Geber.

### Zustandsverwaltung

1. Der aktuelle Spielzustand muss jederzeit abfragbar sein (welche Phase, wer ist dran, welche Karten liegen).
2. Zustandsübergänge sind nur in der definierten Reihenfolge möglich (keine Phase kann übersprungen werden).
3. Ungültige Zustandsübergänge müssen abgelehnt werden.

## Akzeptanzkriterien

- Eine neue Partie startet korrekt mit der konfigurierten Anzahl Spiele.
- Der Geber rotiert nach jedem Normalspiel im Uhrzeigersinn.
- Nach einem Solo bleibt der Geber gleich (kein Weiterrotieren).
- Nach einem Solo spielt der Solist die erste Karte des nächsten Spiels.
- Der Spieler links vom Geber startet jedes Normalspiel als Aufspieler.
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

- [x] Alle Anforderungen (Normalspiel) implementiert
- [x] Unit-Tests für Phasenablauf geschrieben und bestanden
- [x] Geberrotation (Normalspiel) getestet
- [x] Vorbehalt-Priorisierung getestet
- [x] Zustandsmaschine getestet (gültige und ungültige Übergänge)
- [x] Integrationstests für vollständiges Spiel bestanden
- [x] Code-Review / Plausibilitätsprüfung
- [x] Solo-Nachgeben: Geber bleibt nach Solo gleich (`Partie.schliesseAktuellesSpielAb`)
- [x] Solo-Nachgeben: Solist erhält Anspielrecht im Folge-Spiel
- [x] Schmeißen: Fünf Könige implementiert und getestet
- [x] Schmeißen: Fünf Neunen implementiert (VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN, ohneNeunen-Schwelle)
- [x] Schmeißen: Wenig Trumpf implementiert (VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF, NormaleTrumpfOrdnung)

## Technische Hinweise

- **Bounded Context**: Spielverwaltung
- Spielzustand als `sealed interface SpielPhase` — kein externes State-Machine-Framework; Phasenübergänge sind atomare DB-Schreiboperationen, die die `@Version` erhöhen.
- Phasen gemäß PRD: `KartenAusteilen → VorbehaltAnsagen → VorbehaltAufloesung → (ArmutTausch) → Stichphase → Auswertung → GesamtstandAktualisieren`
- `Partie`-Aggregate-Root mit Liste von `Spiel`-Entities
- `Spiel`-Entity enthält Phase, Geber, aktuelle Stiche, Ergebnis
- Events bei Phasenübergängen auslösen (für Frontend-Benachrichtigung)
- Solo-Nachgeben: `parteien.spielerVon(RE).size() == 1` prüfen; bei Solo `naechsterGeber = spiel.geber()` statt `spiel.geber().naechsteImUhrzeigersinn()`. Anspielrecht des Solisten: `Stich.neu(solistPosition)` statt `geber.naechsteImUhrzeigersinn()`.
