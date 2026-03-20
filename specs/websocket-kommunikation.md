# WebSocket-Kommunikation

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Hoch                                        |
| Abhängigkeiten | spielablauf.md, spieler-session.md          |

## Beschreibung

Die Echtzeit-Kommunikation zwischen Frontend und Backend erfolgt über WebSocket mit dem STOMP-Protokoll. Alle spielrelevanten Aktionen (Karte spielen, Ansagen, Spielzustand-Updates) werden als Events über WebSocket transportiert. Diese Spec definiert alle Events, ihre Richtung und ihren Payload.

## Anforderungen

### Verbindung

1. Das Frontend verbindet sich beim Beitreten eines Tisches über **WebSocket (STOMP)** mit dem Backend.
2. Die Verbindung wird über die **Session-ID** authentifiziert.
3. Jeder Tisch hat eigene **STOMP-Destinations** (z.B. `/topic/tisch/{tischId}`).
4. Spielerspezifische Nachrichten gehen an User-spezifische Destinations (z.B. `/user/queue/hand`).

### Client → Server Events

5. **`KarteGespielt`**: Spieler spielt eine Karte aus.
   - Payload: `{ karteId, spielerId }`
   - Validierung: Server prüft, ob die Karte spielbar ist (Bedienpflicht, am Zug).

6. **`AnsageGetaetigt`**: Spieler macht eine Ansage (Re, Kontra, Keine 90, etc.).
   - Payload: `{ ansageTyp, spielerId }`
   - Validierung: Server prüft Berechtigung und Zeitfenster.

7. **`SonderspielAngemeldet`**: Spieler meldet in der Vorbehalt-Phase ein Sonderspiel an.
   - Payload: `{ spieltyp, spielerId }` (Solo-Typ, Hochzeit, Armut, oder „gesund")

8. **`ArmutAntwort`**: Spieler nimmt Armut an oder lehnt ab.
   - Payload: `{ angenommen, spielerId, rueckgabeKarten[] }` (falls angenommen)

### Server → Client Events

9. **`SpielGestartet`**: Neues Spiel beginnt, Karten werden verteilt.
   - Payload: `{ spielId, hand[], geber, aufspieler }`
   - Die eigene Hand wird nur an den jeweiligen Spieler gesendet.

10. **`SpielbrettAktualisiert`**: Aktueller Spielzustand nach jedem Zug.
    - Payload: `{ aktuellerStich[], werIstDran, ansagen[], phase }`

11. **`StichGewonnen`**: Ein Stich wurde abgeschlossen.
    - Payload: `{ stichNummer, karten[], gewinner, augen }`

12. **`AnsageErfolgt`**: Eine Ansage wurde getätigt (Broadcast an alle Spieler).
    - Payload: `{ ansageTyp, spielerId }`

13. **`SonderspielAufgeloest`**: Vorbehalt-Phase abgeschlossen, Spieltyp steht fest.
    - Payload: `{ spieltyp, soloSpieler (optional) }`

14. **`ArmutKartenAngeboten`**: Armut-Spieler bietet Karten an (an potentielle Aufnehmer).
    - Payload: `{ anzahlKarten, anAktuellenSpieler }`

15. **`SpielBeendet`**: Spiel ist vorbei, Auswertung.
    - Payload: `{ ergebnis, augenRe, augenKontra, spielpunkte[], sonderpunkte[] }`

16. **`PartieBeendet`**: Partie ist vorbei, Gesamtauswertung.
    - Payload: `{ gesamtstand[], gewinner }`

17. **`FehlerAufgetreten`**: Ungültiger Zug oder Serverfehler.
    - Payload: `{ fehlerCode, nachricht }`
    - Wird nur an den betroffenen Spieler gesendet.

### Allgemein

18. Alle Events haben einen **Timestamp**.
19. Ungültige Aktionen werden mit `FehlerAufgetreten` beantwortet; der Spielzustand bleibt unverändert.
20. Events müssen **idempotent** verarbeitet werden können (für den Fall von Reconnects).

## Akzeptanzkriterien

- Eine WebSocket-Verbindung wird beim Tisch-Beitritt korrekt aufgebaut.
- Alle Client → Server Events werden serverseitig validiert.
- Ungültige Aktionen erzeugen ein Fehler-Event, ohne den Spielzustand zu verändern.
- Spielzustand-Updates werden an alle Spieler am Tisch gesendet.
- Spielerspezifische Daten (Hand) werden nur an den jeweiligen Spieler gesendet.
- Events werden mit Timestamp versehen.
- Der vollständige Spielablauf (Start → Stiche → Ende) funktioniert über WebSocket.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] WebSocket-Konfiguration (STOMP) implementiert
- [ ] Alle Event-Handler implementiert und getestet
- [ ] Unit-Tests für Event-Validierung geschrieben und bestanden
- [ ] Integrationstests für WebSocket-Kommunikation bestanden
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kommunikation
- Spring WebSocket mit STOMP-Protokoll (`@MessageMapping`, `@SendTo`)
- STOMP-Destinations:
  - `/app/tisch/{id}/karte` — Karte spielen
  - `/app/tisch/{id}/ansage` — Ansage machen
  - `/app/tisch/{id}/vorbehalt` — Sonderspiel anmelden
  - `/topic/tisch/{id}` — Broadcast an alle Spieler am Tisch
  - `/user/queue/hand` — Spielerspezifische Nachrichten
- `SimpMessagingTemplate` für serverseitiges Event-Senden
- DTOs für alle Event-Payloads definieren (Serialisierung mit Jackson)
- WebSocket-Interceptor für Session-Validierung
