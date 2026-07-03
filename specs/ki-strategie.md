# KI-Strategie

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Implementiert |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, stichlogik.md, ansagen.md, sonderpunkte.md |

## Beschreibung

KI-Spieler ersetzen menschliche Spieler und treffen regelbasierte, strategische Entscheidungen. Die KI soll kein zufälliges Verhalten zeigen, sondern nachvollziehbare Strategien anwenden, die auf Doppelkopf-Grundlagen basieren.

## Anforderungen

### Kartenwahl

1. Die KI wählt aus den **gültigen (spielbaren) Karten** eine Karte basierend auf strategischen Kriterien.
2. Die KI soll **niemals** eine ungültige Karte spielen (Bedienpflicht wird immer eingehalten).
3. Die KI-Entscheidung muss **deterministisch nachvollziehbar** sein (keine rein zufällige Auswahl).

### Trumpfmanagement

4. Die KI setzt **starke Trümpfe gezielt** ein, um Stiche zu gewinnen.
5. Die KI versucht, mit niedrigen Trümpfen **fremde Trümpfe herauszulocken** (Trumpf ziehen).
6. Die KI spart **hohe Trümpfe** (Dullen, Kreuz-Dame) für entscheidende Stiche auf.

### Partnerunterstützung

7. Die KI erkennt ihren **Partner** (über Kreuz-Dame oder Spieltyp).
8. Die KI gibt **Augen** in Partner-Stiche (schmiert), wenn der Partner den Stich voraussichtlich gewinnt.
9. Die KI versucht, **Partner-Stiche** zu unterstützen, statt sie zu überstechen.

### Ansage-Strategie

10. Die KI sagt **„Re"** oder **„Kontra"** basierend auf der **Handstärke** an:
    - Anzahl und Qualität der Trümpfe
    - Anzahl der Asse (Augengaranten)
    - Position (Aufspieler-Vorteil)
11. Die KI sagt **Verschärfungen** nur bei sehr starken Händen an.

### Sonderpunkt-Bewusstsein

12. Die KI versucht, den eigenen **Fuchs** (Karo-As) zu schützen (in eigenen Stichen spielen).
13. Die KI versucht, den **gegnerischen Fuchs** zu fangen (Gegner-Karo-As in eigenem Stich gewinnen).
14. Die KI berücksichtigt **Karlchen** im letzten Stich (Kreuz-Bube aufsparen, wenn sinnvoll).

### Sonderspiel-Entscheidungen

15. Die KI entscheidet in der Vorbehalt-Phase, ob sie ein **Solo** anmelden soll (basierend auf Handstärke).
16. Die KI entscheidet bei **Armut**, ob sie die Karten aufnehmen möchte (basierend auf eigenen Trümpfen).
17. Die KI verarbeitet die **Hochzeit** korrekt (als Partner oder Gegner).

## Akzeptanzkriterien

- Die KI spielt immer regelkonforme Züge (keine ungültigen Karten).
- Die KI trifft nachvollziehbare Entscheidungen (keine rein zufällige Kartenwahl).
- Die KI nutzt Trumpfmanagement-Strategien (hohe Trümpfe aufsparen, niedrige zum Ziehen).
- Die KI erkennt ihren Partner und unterstützt ihn.
- Die KI sagt Re/Kontra basierend auf Handstärke an.
- Die KI berücksichtigt Sonderpunkte (Fuchs, Karlchen).

## KI-Timing (UX)

18. KI-Karten sollen in der **STICHPHASE nicht sofort** erscheinen, wenn ein menschlicher Spieler am Tisch sitzt — eine Verzögerung von **800ms** zwischen KI-Zügen macht das Spielgeschehen für den Menschen nachvollziehbar. Die Verzögerung liegt **exklusiv im Frontend** — das Backend antwortet immer sofort.
19. Bei rein-KI-Tischen (kein menschlicher Mitspieler) wird **keine** Animationsverzögerung angewandt — das Frontend animiert ohne Delay.
20. Technisch (Backend): `KiTischOrchestrator.automatisiereTisch` spielt alle KI-Züge synchron in einer Schleife durch und sendet für jeden Zug ein individuelles `KARTE_GESPIELT`-Event. Kein `Thread.sleep`, keine künstliche Pause — das Backend antwortet immer sofort nach DB-Commit.
21. Technisch (Frontend): Der `AppStore` verarbeitet eingehende Events in einer Queue. Falls mehrere `KARTE_GESPIELT`-Events von KI-Spielern schnell hintereinander eintreffen, sorgt der Store für einen zeitlichen Abstand von **800ms** (nur wenn Menschen am Tisch sitzen), damit die Animationen für den Nutzer nachvollziehbar bleiben.

- Die KI trifft sinnvolle Sonderspiel-Entscheidungen.
- Ein komplettes Spiel gegen 3 KI-Spieler kann ohne Fehler durchgespielt werden.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Kartenwahl-Strategien geschrieben und bestanden
- [x] Unit-Tests für Ansage-Logik geschrieben und bestanden
- [x] Unit-Tests für Sonderpunkt-Bewusstsein geschrieben und bestanden
- [x] Integrationstests: vollständiges Spiel 4× KI durchspielbar
- [x] Code-Review / Plausibilitätsprüfung

## Kalibrierung: Solo-Schwellenwerte

Die KI bewertet jede Hand mit einem Punktescore und meldet ein Solo nur an, wenn der Score die Schwelle erreicht. Die Formeln und Schwellen sind auf eine durchschnittliche Doppelkopf-Hand kalibriert (48 Karten, 12 pro Spieler, Ø 6,5 Trümpfe, Ø 2 Damen, Ø 2 Buben, Ø 2 Asse).

### SOLO_TRUMPF

**Formel:** `trumpfAnzahl × 4 + asse × 2 + damen × 2 + buben × 2`

Damen und Buben sind im Normalspiel bereits Trümpfe und werden in `trumpfAnzahl` mitgezählt. Die zusätzlichen `× 2`-Boni modellieren, dass sie hochrangige Trümpfe sind (nicht Doppelzählung, sondern Qualitätsbewertung).

**Schwelle: 46**

Kalibrierungsbeispiele:
- Durchschnittshand (6,5 Trümpfe, 2 Damen, 2 Buben, 2 Asse): 6,5×4 + 2×2 + 2×2 + 2×2 = **38** → kein Solo
- Starke Hand (8 Trümpfe, 3 Damen, 2 Buben, 2 Asse): 8×4 + 2×2 + 3×2 + 2×2 = **46** → Solo

Hintergrund: Vor der Kalibrierung lag die Schwelle bei 34, was dazu führte, dass bereits Durchschnittshände SOLO_TRUMPF triggerten.

> **Sonderregel-Malus:** Bei aktivem Schweinchen oder 30-Augen-Pflicht werden Hände relativ zum Normalspiel ausgeglichener. Der KI-Basiswert wird mit **1.38** multipliziert (Aufschlag 38 %). Effektive Schwellen: Nur Sonderregeln → `ceil(46 × 1.38) = 64`; Loco-Blatt (ohneNeunen + Sonderregeln) → `ceil(51 × 1.38) = 71`.

### SOLO_DAME / SOLO_BUBE

**Formel:** `damen × 8 + asse × 2 + hoheFehlkarten` (analog für Buben)

`hoheFehlkarten` = nicht-trumpf Asse + nicht-trumpf Zehner. Nicht-trumpf-Asse sind leicht doppelt gewichtet (`asse × 2` + `hoheFehlkarten`), was ihre besondere Bedeutung im Dame/Buben-Solo (sichere Fehlstiche) korrekt abbildet.

**Schwelle: 28**

Kalibrierungsbeispiele:
- Durchschnittshand (2 Damen, 2 Asse, 2,5 hohe Fehlkarten): 2×8 + 2×2 + 2,5 = **22,5** → kein Solo
- Grenzfall (3 Damen, 2 Asse, 1 hohe Fehlkarte): 3×8 + 2×2 + 1 = **29** → Solo (3 von 8 Trümpfen + 2 Asse ist spielbar)
- Starke Hand (4 Damen, 0 Asse): 4×8 = **32** → Solo

### SOLO_FLEISCHLOS

**Formel:** `asse × 6 + hoheFehlkarten × 2 - trumpfAnzahl`

Trümpfe sind im Fleischlos wertlos und verkleinern die Fehlfarbenstruktur — daher negativer Koeffizient.

**Schwelle: 30**

Kalibrierungsbeispiele:
- Durchschnittshand (2 Asse, 2,5 hohe Fehlkarten, 6,5 Trümpfe): 2×6 + 2,5×2 − 6,5 = **10,5** → kein Solo
- Gute Hand (3 Fehl-Asse, 3 Zehner, 0 Trümpfe): 3×6 + 6×2 − 0 = **30** → Solo (6 potenzielle Stichgewinner ohne Trumpf ist das Minimum)

## Technische Hinweise

- **Bounded Context**: KI-Strategie
- KI-Strategie als **Strategy-Pattern** implementieren, um verschiedene Schwierigkeitsgrade zu ermöglichen (Zukunft)
- Interface `KiStrategie` mit Methoden:
  - `waehleKarte(Hand, Stich, Spielzustand)` → `Karte`
  - `sollAnsagen(Hand, AnsageTyp, Spielzustand)` → `boolean`
  - `sollSoloAnmelden(Hand)` → `Optional<Spieltyp>`
  - `sollArmutAufnehmen(Hand, angeboteneKarten)` → `boolean`
- Default-Implementierung: `StandardKiStrategie` mit regelbasierter Logik
- Die KI hat Zugriff auf: eigene Hand, aktuellen Stich, gespielte Karten (Gedächtnis), Ansagen-Status
- Die KI hat **keinen** Zugriff auf: gegnerische Hände (kein Cheating)
