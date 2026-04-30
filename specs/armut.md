# Sonderspiel: Armut

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Implementiert |
| Priorität      | Mittel                                      |
| Abhängigkeiten | kartendeck.md, trumpfhierarchie.md, spielablauf.md |

## Beschreibung

Die Armut (auch „Trumpfarmut") ist ein Sonderspiel, bei dem ein Spieler mit sehr wenigen Trümpfen auf der Hand (≤ 3) seine Trumpfkarten einem anderen Spieler zum Tausch anbieten kann. Der aufnehmende Spieler wird sein Partner.

## Anforderungen

1. Ein Spieler mit **3 oder weniger Trümpfen** auf der Hand darf in der Vorbehalt-Phase eine **Armut** anmelden.
2. Die Armut wird als Vorbehalt angemeldet (Priorität: unter Hochzeit und Solo).
3. Der Armut-Spieler legt seine **Trumpfkarten verdeckt** auf den Tisch (maximal 3 Karten).
4. **Reihum** (im Uhrzeigersinn, beginnend links vom Armut-Spieler) wird gefragt, ob jemand die Karten aufnehmen möchte.
5. Der **aufnehmende Spieler**:
   - Nimmt die angebotenen Trumpfkarten auf die Hand.
   - Gibt **die gleiche Anzahl Karten** an den Armut-Spieler zurück (beliebige Karten).
   - Wird Partner des Armut-Spielers (beide bilden die **Re-Partei**).
6. Die zurückgegebenen Karten dürfen beliebig sein (Trumpf oder Fehl).
7. Nimmt **kein Spieler** die Armut an, wird das Spiel **eingeworfen** (neu gemischt und ausgeteilt).
8. Es gibt **keine Begrenzung** für die Anzahl der Einwürfe — wird nach dem Einwurf erneut eine Armut verteilt, die niemand annimmt, wird erneut eingeworfen.
9. **Bockrunden bei Einwurf**: Optional kann konfiguriert werden, dass jeder Einwurf (aufgrund einer abgelehnten Armut) die Anzahl der verbleibenden Bockrunden in der Partie erhöht (Standard: +1 Bockrunde pro Einwurf).
10. Der Kartentausch findet **vor der Stichphase** statt.
11. Die Trumpfhierarchie im Armut-Spiel entspricht dem **Normalspiel**.
12. Die Armut kann über die Tischkonfiguration **deaktiviert** werden.
13. Die Anzahl der zu tauschenden Karten entspricht der Anzahl der Trumpfkarten des Armut-Spielers (maximal 3).

## Akzeptanzkriterien

- Ein Spieler mit ≤ 3 Trümpfen kann eine Armut anmelden.
- Ein Spieler mit > 3 Trümpfen kann keine Armut anmelden.
- Der Kartentausch wird korrekt durchgeführt (gleiche Anzahl hin und zurück).
- Der aufnehmende Spieler und der Armut-Spieler bilden die Re-Partei.
- Wenn kein Spieler die Armut annimmt, wird korrekt eingeworfen (neu gemischt).
- Wiederholte Einwürfe bei erneuter Armut funktionieren korrekt.
- Die beteiligten Hände haben nach dem Tausch die korrekte Kartenanzahl.
- Die getauschten Karten sind nur den beiden beteiligten Spielern bekannt.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Armut-Erkennung geschrieben und bestanden
- [x] Unit-Tests für Kartentausch geschrieben und bestanden
- [x] Szenario „Armut abgelehnt → Einwurf" getestet
- [x] Integration in Vorbehalt-Phase getestet
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielregeln
- Der Kartentausch ist eine eigene `Spielphase` (`ArmutTausch`) — der Phasenwechsel ist ein atomarer DB-Schreibvorgang, der die `@Version` des `Partie`-Aggregats erhöht.
- Jeder Teilschritt (Angebot, Annahme/Ablehnung, Kartentausch) landet als vollständiger Zustandsupdate in der DB; kein Teilzustand existiert nur in-memory.
- WebSocket-Events für Angebot und Annahme/Ablehnung werden erst nach erfolgreichem DB-Commit gesendet (`@TransactionalEventListener(phase = AFTER_COMMIT)`).
- Die Tauschkarten müssen serverseitig validiert werden (Anzahl, Besitz)
- Der Armut-Spieler sieht die zurückgegebenen Karten, der aufnehmende Spieler sieht die angebotenen Karten

## Implementierungsnotizen (Stand 2026-04-30)

**Backend vollständig implementiert.**

- `partie/ArmutStatus.java` — Zustandsautomat für Angebot, Annahme, Ablehnung und Einwurf
- `karten/Spieltyp.java` — enthält ARMUT als eigenen Spieltyp
- `partie/Partie.java` — Kartentausch-Logik und Einwurf-Behandlung

Einwurf-Bockrunden (Anforderung 9) per Konfiguration steuerbar; keine bekannten Lücken.
