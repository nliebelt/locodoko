# Sonderspiel: Hochzeit

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, stichlogik.md, spielablauf.md |

## Beschreibung

Die Hochzeit ist ein Sonderspiel im Doppelkopf. Ein Spieler, der beide Kreuz-Damen auf der Hand hat, kann eine Hochzeit anmelden. Der Partner wird durch die Regel „erster Fremder geht mit" bestimmt: Der erste Spieler (außer dem Hochzeits-Spieler selbst), der einen Stich gewinnt, wird sein Partner. Bis dahin spielt der Hochzeits-Spieler alleine als Re-Partei.

## Anforderungen

1. Ein Spieler, der **beide Kreuz-Damen** auf der Hand hat, darf in der Vorbehalt-Phase eine **Hochzeit** anmelden.
2. Die Hochzeit wird als Vorbehalt angemeldet (Priorität: unter Solo, über Armut).
3. Der Hochzeits-Spieler gehört zur **Re-Partei** und spielt zunächst **alleine**.
4. **„Erster Fremder geht mit"**: Der erste andere Spieler, der einen Stich gewinnt (den der Hochzeits-Spieler **nicht** selbst gewonnen hat), wird Partner des Hochzeits-Spielers und gehört ebenfalls zur Re-Partei.
5. Stiche, die der Hochzeits-Spieler selbst gewinnt, bevor ein Partner gefunden ist, zählen zu seinen (Re-Partei-)Augen. Er sammelt diese Augen **alleine**.
6. Es gibt eine **Klarstellungsfrist**: Wird innerhalb der ersten 3 Stiche kein Partner gefunden (d.h. der Hochzeits-Spieler gewinnt alle 3 Stiche selbst), spielt der Hochzeits-Spieler ein **stilles Solo** (Trumpfsolo, alleine gegen die anderen drei).
7. Der Stich, in dem der Partner gefunden wird, heißt **Klärungsstich** — spätestens der 3. Stich.
8. **Vereinfachte Ansage-Regel**: Komplexe DKV-Regeln zu verschobenen Ansagefristen für den neuen Partner werden ignoriert. Es gelten die Standard-Fristen basierend auf der Handkartenanzahl zu Beginn des Stichs.
9. Sobald ein Partner gefunden ist, wird dies allen Spielern mitgeteilt.
10. Die Trumpfhierarchie im Armut-Spiel entspricht dem **Normalspiel**.
11. Die Hochzeit kann über die Tischkonfiguration **deaktiviert** werden.

## Akzeptanzkriterien

- Ein Spieler mit beiden Kreuz-Damen kann eine Hochzeit anmelden.
- Ein Spieler mit nur einer oder keiner Kreuz-Dame kann keine Hochzeit anmelden.
- Der erste andere Spieler, der einen Stich gewinnt, wird korrekt als Partner erkannt.
- Die Re/Kontra-Partei-Zugehörigkeit ist nach Partnerfindung korrekt gesetzt.
- Wenn innerhalb von 3 Stichen kein Partner gefunden wird, wird ein stilles Solo gespielt.
- Die Trumpfhierarchie entspricht dem Normalspiel.
- Bei deaktivierter Hochzeit kann kein Spieler diese anmelden.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Hochzeit-Erkennung geschrieben und bestanden
- [x] Unit-Tests für Partnerfindung geschrieben und bestanden
- [x] Szenario „kein Partner gefunden → stilles Solo" getestet
- [x] Integration in Vorbehalt-Phase getestet
- [x] Code-Review / Plausibilitätsprüfung

## Stilles Solo

Findet sich innerhalb der ersten 3 Klärungsstiche kein Partner (d.h. der Hochzeits-Spieler gewinnt alle 3 Stiche selbst), wechselt das Spiel in das **stille Solo**:

- **Definition**: Der Hochzeits-Spieler spielt allein als Re-Partei gegen alle drei anderen Spieler (Kontra-Partei).
- **Wertung**: Das stille Solo wird wie ein reguläres Solo gewertet. Der **Solo-Multiplikator (×3)** gilt für die Spielpunkte.
- **Zustand**: `HochzeitStatus.stillesSolo` wird intern gesetzt; die Trumpfhierarchie bleibt die des Normalspiels.

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Hochzeit als eigene `Spieltyp`-Implementierung
- Zustand „Partner gesucht" muss während der Stichphase mitgeführt werden
- Event `PartnerGefunden` auslösen, wenn ein Partner ermittelt wird
- Die Partnerfindung beeinflusst die Partei-Zugehörigkeit für die Punkteberechnung
