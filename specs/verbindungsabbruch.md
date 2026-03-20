# Verbindungsabbruch und Reconnect

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | Niedrig                                     |
| Abhängigkeiten | spieler-session.md, ki-strategie.md, websocket-kommunikation.md |

## Beschreibung

Wenn ein menschlicher Spieler während eines laufenden Spiels die Verbindung verliert (Browser geschlossen, Netzwerkfehler), muss das Spiel damit umgehen können. Das System wartet eine konfigurierbare Zeit auf Reconnect und lässt danach die KI den Spieler übernehmen.

## Anforderungen

1. Bei **Verbindungsverlust** (WebSocket-Disconnect) wird der Spieler als **getrennt** markiert.
2. Das laufende Spiel wird **pausiert**, wenn der getrennte Spieler am Zug ist.
3. Es wird ein **Reconnect-Timeout** gestartet (konfigurierbar, Standard: 120 Sekunden).
4. Innerhalb des Timeouts kann der Spieler sich **neu verbinden** (gleiche Session):
   - Der Spieler erhält den aktuellen Spielzustand.
   - Das Spiel wird an der Stelle fortgesetzt, an der es pausiert wurde.
   - Der Spieler sieht seine eigene Hand und den aktuellen Stich.
5. Nach Ablauf des Timeouts **übernimmt die KI** den getrennten Spieler:
   - Die KI spielt für den Rest des Spiels (oder der Partie).
   - Das Spiel wird fortgesetzt ohne weitere Unterbrechung.
6. Ein menschlicher Spieler kann **auch nach KI-Übernahme** reconnecten und seine Position zurückerhalten — allerdings erst **ab dem nächsten Spiel** (nicht mitten im laufenden Spiel).
7. Andere Spieler am Tisch werden über den **Verbindungsstatus** informiert (getrennt, reconnected, KI-Übernahme).
8. Wenn **alle** menschlichen Spieler getrennt sind, wird das Spiel nach Timeout komplett von KI beendet.

## Akzeptanzkriterien

- Ein Spieler mit Verbindungsverlust wird als getrennt markiert.
- Das Spiel pausiert, wenn der getrennte Spieler am Zug ist.
- Ein Reconnect innerhalb des Timeouts stellt den Spielzustand wieder her.
- Nach Timeout-Ablauf übernimmt die KI den Spieler nahtlos.
- Andere Spieler werden über Statusänderungen informiert.
- Ein vollständiges Spiel kann auch mit KI-Übernahme korrekt abgeschlossen werden.

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Unit-Tests für Disconnect-Erkennung geschrieben und bestanden
- [ ] Unit-Tests für Reconnect-Logik geschrieben und bestanden
- [ ] Unit-Tests für KI-Übernahme geschrieben und bestanden
- [ ] Integrationstests für Disconnect/Reconnect-Szenario bestanden
- [ ] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kommunikation / Spielverwaltung
- WebSocket-Disconnect-Event nutzen, um Verbindungsverlust zu erkennen
- Spring WebSocket `SessionDisconnectEvent` abfangen
- Reconnect über gleiche Session-ID ermöglichen
- Timer-basierte Logik für Timeout (z.B. `ScheduledExecutorService` oder Spring `@Scheduled`)
- Zustandswechsel: `VERBUNDEN → GETRENNT → (RECONNECTED | KI_UEBERNOMMEN)`
- Event `VerbindungStatusGeaendert` an alle Spieler am Tisch senden
