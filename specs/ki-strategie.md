# KI-Strategie

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Vollständig implementiert und getestet                         |
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
- Die KI trifft sinnvolle Sonderspiel-Entscheidungen.
- Ein komplettes Spiel gegen 3 KI-Spieler kann ohne Fehler durchgespielt werden.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Kartenwahl-Strategien geschrieben und bestanden
- [x] Unit-Tests für Ansage-Logik geschrieben und bestanden
- [x] Unit-Tests für Sonderpunkt-Bewusstsein geschrieben und bestanden
- [x] Integrationstests: vollständiges Spiel 4× KI durchspielbar
- [x] Code-Review / Plausibilitätsprüfung

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
