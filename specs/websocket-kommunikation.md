# WebSocket-Kommunikation

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Implementiert |
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
   - Validierung: Server prüft **hart** ob die Karte legal ist (Bedienpflicht, am Zug, Karte in Hand). Bei Verstoß: `AKTION_ABGELEHNT`. **Kein Pfad, auf dem der Client die Legalitätsprüfung ersetzt** — er darf erlaubte Karten als UI-Hint anzeigen (`moeglicheKarten`), aber jeder Zug wird server-seitig re-validiert.

6. **`AnsageGetaetigt`**: Spieler macht eine Ansage (Re, Kontra, Keine 90, etc.).
   - Payload: `{ ansageTyp, spielerId }`
   - Validierung: Server prüft Berechtigung und Zeitfenster.

7. **`SonderspielAngemeldet`**: Spieler meldet in der Vorbehalt-Phase ein Sonderspiel an.
   - Payload: `{ spieltyp, spielerId }` (Solo-Typ, Hochzeit, Armut, oder „gesund")

8. **`ArmutAntwort`**: Spieler nimmt Armut an oder lehnt ab.
   - Payload: `{ angenommen, spielerId, rueckgabeKarten[] }` (falls angenommen)

### Server → Client Events

Alle spielrelevanten Events werden als `PartieEreignisAntwort` über die persönliche Destination
`/user/queue/partie/{partieId}` gesendet. **Kein anonymer `/topic/`-Broadcast für Partie-Spielstände**
(Datenschutz: jeder Spieler sieht nur seine eigene Hand). `TischEchtzeitService` broadcastet jedoch nicht-geheime Tisch-Metadaten über `/topic/tische` (Lobby) und `/topic/tisch/{id}` (Wartezimmer).

#### `PartieEreignisAntwort` — Discriminated Union

`PartieEreignisAntwort` ist im Backend ein **sealed interface** mit einem Record pro Ereignistyp
(OpenAPI `oneOf` → typsichere Union im Frontend). Gemeinsame Felder aller Records:

```typescript
// Basis (in jedem Record enthalten)
{
  timestamp: string;               // Zeitpunkt des Ereignisses
  version: number;                 // @Version der Partie NACH dem Ereignis
  ereignisTyp: PartieEreignisTyp;  // Diskriminator
  partieStand: PartieStandAntwort; // vollständiger spielerspezifischer Stand NACH dem Ereignis
}
// Zusatzfelder je Typ:
//   KARTE_GESPIELT        + spielerPosition, karteId
//   STICH_ABGESCHLOSSEN   + neueSonderpunkte: SonderpunktEreignisAntwort[]
//   SCHWEINCHEN_GEMELDET  + spielerPosition
//   HOCHZEIT_PARTNER_GEFUNDEN + partnerPosition
//   AKTION_ABGELEHNT      + fehlerCode
```

#### `PartieEreignisTyp` — Event-Typen

9. **`SNAPSHOT`**: Kompletter Spielstand nach Reconnect.
   - `partieStand`: vollständiger Stand inkl. eigene Hand
   - Frontend: sofort anwenden, keine Animation (Seite neu gerendert).

10. **`SPIEL_GESTARTET`**: Eine neue Runde (Einzelspiel) beginnt.
    - `partieStand`: Stand mit neuen Handkarten und neuem Geber.
    - Frontend: triggert die "Karten austeilen"-Animation. Alte Stichmitte und Stiche werden gelöscht.

11. **`KARTE_GESPIELT`**: Eine Karte wurde gespielt (menschlicher oder KI-Zug).
    - `partieStand`: Stand nach der gespielten Karte.
    - `spielerPosition`: Position des Spielers (NORD, SUED, OST, WEST).
    - `karteId`: Eindeutige ID der Karte (z.B. "HERZ-10-1").
    - Frontend: Animation der Karte zur Mitte.

12. **`STICH_ABGESCHLOSSEN`**: Stich vollständig (4 Karten lagen, jetzt leer).
    - `partieStand`: Stand nach Stich-Einziehen
    - `neueSonderpunkte`: Fuchs-gefangen, Doppelkopf, Karlchen (leer wenn keiner)
    - Frontend: Stich-einziehen-Animation, danach Sonderpunkt-Banner

13. **`SPIEL_BEENDET`**: Spiel ausgewertet.
    - `partieStand`: Stand inkl. Spielergebnis.
    - Frontend: Rundenauswertungs-Overlay anzeigen.

14. **`ANSAGE_ERFOLGT`**: Ein Spieler hat Re/Kontra/Absage angesagt.
    - Frontend: Ansage-Banner, Ansage-Status aktualisieren.

15. **`SCHWEINCHEN_GEMELDET`**: Erstes Karo-As einer Schweinchen-Hand gespielt.
    - `spielerPosition`: Wer gemeldet hat.
    - Frontend: Schweinchen-Banner.

16. **`HOCHZEIT_PARTNER_GEFUNDEN`**: Der Hochzeits-Partner steht fest.
    - `partnerPosition`: Position des Partners.
    - Frontend: Banner „Partner gefunden!", Parteien anzeigen.

17. **`AKTION_ABGELEHNT`**: Ein vom Spieler gesendeter Spielzug (Karte, Ansage) war ungültig.
    - `fehlerCode`: Technischer Bezeichner des Fehlers (z.B. "KARTE_UNGUELTIG").
    - Frontend: Fehlermeldung anzeigen; der mitgelieferte `partieStand` korrigiert die Anzeige.

#### Zusatz-DTOs

```typescript
interface GespielteKarteAntwort {
  spielerPosition: SpielerPosition;  // NORD | SUED | OST | WEST
  karteId: string;
}

interface SonderpunktEreignisAntwort {
  typ: 'FUCHS_GEFANGEN' | 'DOPPELKOPF' | 'KARLCHEN';
  gewinner: SpielerPosition;
  verlierer?: SpielerPosition;  // nur bei FUCHS_GEFANGEN
}
```

#### Nicht-Spiel-Events (Tisch-Ebene)

18. **`FehlerAufgetreten`**: Ungültiger Zug oder Serverfehler.
    - Payload: `{ fehlerCode, nachricht }`
    - Destination: `/user/queue/fehler` — nur an betroffenen Spieler.

### Allgemein

19. Alle Events haben einen **Timestamp**.
20. Ungültige Aktionen werden mit `FehlerAufgetreten` beantwortet; der Spielzustand bleibt unverändert.
21. Events müssen **idempotent** verarbeitet werden können (für den Fall von Reconnects).

## Akzeptanzkriterien

- Eine WebSocket-Verbindung wird beim Tisch-Beitritt korrekt aufgebaut.
- Alle Client → Server Events werden serverseitig validiert.
- Ungültige Aktionen erzeugen ein Fehler-Event, ohne den Spielzustand zu verändern.
- Spielzustand-Updates werden an alle Spieler am Tisch gesendet.
- Spielerspezifische Daten (Hand) werden nur an den jeweiligen Spieler gesendet.
- Events werden mit Timestamp versehen.
- Der vollständige Spielablauf (Start → Stiche → Ende) funktioniert über WebSocket.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] WebSocket-Konfiguration (STOMP) implementiert
- [x] Alle Event-Handler implementiert und getestet
- [x] Unit-Tests für Event-Validierung geschrieben und bestanden
- [x] Integrationstests für WebSocket-Kommunikation bestanden
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kommunikation
- Spring WebSocket mit STOMP-Protokoll (`@MessageMapping`, `@SendTo`)
- STOMP-Destinations:
  - `/app/tisch/{id}/karte` — Karte spielen
  - `/app/tisch/{id}/ansage` — Ansage machen
  - `/app/tisch/{id}/vorbehalt` — Sonderspiel anmelden
  - `/app/tisch/{id}/armut-antwort` — Armut annehmen/ablehnen
  - `/app/tisch/{id}/snapshot` — Sofortigen Snapshot anfordern (BF-7)
  - `/user/queue/partie/{partieId}` — Spielerspezifische Partie-Events (typisiert)
  - `/user/queue/fehler` — Fehler-Events nur an betroffenen Spieler
  - `/topic/tisch/{id}` — Broadcast von Tisch-Metadaten
  - `/topic/tische` — Broadcast der offenen Tische (Lobby)
  - ~~`/topic/partie/{id}`~~ — Anonymer Broadcast (ab ARCH-1 gelöscht)
- `TischEchtzeitService.planeAnBenutzer()` für serverseitiges Event-Senden (nach DB-Commit)
- `PartieEreignisAntwort` als Basis-DTO für alle Spielstand-Events
- WebSocket-Interceptor für Session-Validierung
