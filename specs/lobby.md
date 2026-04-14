# Lobby

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                        |
| Abhängigkeiten | spieler-session.md, tischkonfiguration.md   |

## Beschreibung

Die Lobby ist die zentrale Übersichtsseite, auf der Spieler offene Tische sehen, neue Tische erstellen und bestehenden Tischen beitreten können. Sie ist der Einstiegspunkt für jede Spielsitzung.

## Anforderungen

1. Die Lobby zeigt eine **Liste aller offenen Tische** an.
2. Für jeden Tisch werden folgende Informationen angezeigt:
   - Tischname
   - Anzahl der Spieler (besetzt / Plätze)
   - Status (wartend, im Spiel)
   - Wesentliche Regelkonfiguration (z.B. „mit Neunen", „Turniermodus")
3. Ein Spieler kann einen **neuen Tisch erstellen**:
   - Vergabe eines Tischnamens
   - Konfiguration der Tischregeln (siehe `tischkonfiguration.md`)
   - Der Ersteller wird automatisch dem Tisch als Spieler hinzugefügt
4. Ein Spieler kann einem **bestehenden Tisch beitreten**, sofern der Tisch noch freie Plätze hat.
5. Ein Tisch fasst genau **4 Spieler** (1 Mensch + 3 KI im Einzelspielermodus, perspektivisch 4 Menschen).
6. Nicht besetzte Plätze werden **automatisch mit KI-Spielern aufgefüllt** wenn das Spiel gestartet wird.
7. Der **Tischersteller** kann das Spiel starten, sobald mindestens 1 menschlicher Spieler am Tisch sitzt.
8. Die Lobby aktualisiert sich **in Echtzeit** (via WebSocket), wenn Tische erstellt/gelöscht werden oder Spieler beitreten.
9. Ein Spieler kann jeweils nur **an einem Tisch** gleichzeitig sitzen.
10. Ein Spieler kann einen Tisch **verlassen**, bevor das Spiel gestartet ist.

## Akzeptanzkriterien

- Offene Tische werden korrekt in der Lobby-Liste angezeigt.
- Ein neuer Tisch kann erstellt werden und erscheint in der Liste.
- Ein Spieler kann einem Tisch beitreten und wird dort als Spieler geführt.
- Ein voller Tisch kann nicht beigetreten werden.
- KI-Spieler füllen freie Plätze bei Spielstart auf.
- Die Lobby aktualisiert sich in Echtzeit bei Änderungen.
- Ein Spieler kann nicht an zwei Tischen gleichzeitig sitzen.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] REST-API-Endpunkte für Tische implementiert und getestet
- [x] WebSocket-Update für Lobby-Aktualisierung implementiert
- [x] Frontend-Lobby-Seite implementiert
- [x] Unit-Tests geschrieben und bestanden
- [x] Integrationstests bestanden
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielverwaltung
- REST-API Endpunkte:
  - `GET /api/tische` — Alle offenen Tische
  - `POST /api/tische` — Neuen Tisch erstellen
  - `POST /api/tische/{id}/beitreten` — Tisch beitreten
- WebSocket-Topic `/topic/lobby` für Echtzeit-Updates der Tischliste
- `Tisch`-Entity als Aggregate Root mit Status und Spielerliste
- Im MVP reicht die Lobby für den Einzelspielermodus (1 Mensch + 3 KI)
