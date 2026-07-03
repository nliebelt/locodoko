# Verbindungsabbruch, Reconnect und Tisch-Lebenszyklus

| Feld           | Wert                                                                      |
|----------------|---------------------------------------------------------------------------|
| Status         | Stabil |
| Priorität      | Hoch                                                                      |
| Abhängigkeiten | spieler-session.md, ki-strategie.md, websocket-kommunikation.md, lobby.md |

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

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Disconnect-Erkennung geschrieben und bestanden
- [x] Unit-Tests für Reconnect-Logik geschrieben und bestanden
- [x] Unit-Tests für KI-Übernahme geschrieben und bestanden
- [x] Integrationstests für Disconnect/Reconnect-Szenario bestanden
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise (Verbindungsabbruch)

- **Bounded Context**: Kommunikation / Spielverwaltung
- WebSocket-Disconnect-Event nutzen, um Verbindungsverlust zu erkennen
- Spring WebSocket `SessionDisconnectEvent` abfangen
- Reconnect über gleiche Session-ID ermöglichen
- Timer-basierte Logik für Timeout (z.B. `ScheduledExecutorService` oder Spring `@Scheduled`)
- Zustandswechsel: `VERBUNDEN → GETRENNT → (RECONNECTED | KI_UEBERNOMMEN)`
- Event `VerbindungStatusGeaendert` an alle Spieler am Tisch senden

---

## Session-Recovery: Tab-Reload und Browserfenster neu öffnen

Wenn ein Spieler den Tab neu lädt oder das Browserfenster schließt und erneut öffnet, soll er automatisch zurück an seinen Tisch geleitet werden — ohne manuelles Suchen in der Lobby.

### Session-Recovery: Anforderungen

1. **Backend**: `GET /api/spieler/session` liefert neben Session-Daten auch `aktiverTischId` (falls der Spieler aktuell einem Tisch zugeordnet ist).
2. **Frontend (BootSzene)**: Beim App-Start wird die Session abgefragt. Falls `aktiverTischId` vorhanden, leitet das Frontend direkt zur `TischSzene` weiter — ohne Umweg über die `SpielverwaltungsSzene`.
3. **WebSocket-Reconnect**: Die `TischSzene` baut nach Redirect die WebSocket-Verbindung neu auf und abonniert `/topic/tisch/{id}` und `/user/queue/partie/{partieId}` neu.
4. **Spielstand wiederherstellen**: Das Frontend fordert nach Reconnect einen Snapshot an (`/app/tisch/{id}/snapshot`), um den aktuellen Spielzustand zu laden.
   **Hand-Privacy:** Der Snapshot enthält ausschließlich die **eigene Hand** des reconnectenden Spielers — niemals Handkarten anderer Spieler. `PartieStandAntwort.aus(tisch, spielerId)` generiert den Snapshot spieler-spezifisch. Das Frontend übernimmt die Hand vollständig aus dem Snapshot und darf keinen lokalen Hand-State eigenständig mergen.
5. **Vollständiger State-Reset vor Snapshot-Load:** Vor dem Verarbeiten des Snapshots müssen `AppStore`, `AnimationenService` und alle laufenden Tweens vollständig zurückgesetzt werden. Kein Animations-State (laufende Tweens, Overlay-Sichtbarkeit, Rundenauswertungs-Screen) darf über den Reconnect hinaus bestehen bleiben.
5. Falls der Tisch oder die Partie nicht mehr existiert (z.B. abgebrochen), leitet das Frontend zur Lobby weiter.

### Session-Recovery: Akzeptanzkriterien

- Tab neu laden → automatische Weiterleitung zur Tischansicht ohne manuelle Aktion
- Spielstand ist nach Reload korrekt dargestellt (Hand, Stichmitte, Phase)
- Falls Tisch nicht mehr existiert → Lobby-Weiterleitung ohne Fehlermeldung

---

## Tisch verlassen (manueller Abbruch)

Ein Spieler kann den Tisch jederzeit freiwillig verlassen. Dies bricht die laufende Partie ab, da eine Partie mit weniger als 4 Spielern nicht fortgesetzt werden kann (KI übernimmt **nicht** bei willentlichem Verlassen).

### Tisch verlassen: Anforderungen

1. **Frontend**: Ein "Tisch verlassen"-Button ist in der Tischansicht jederzeit zugänglich (z.B. im HUD oder Menü).
2. **Aktion**: Klick → Bestätigungsdialog ("Tisch wirklich verlassen? Die Partie wird abgebrochen.") → Bestätigung → `POST /api/tische/{id}/verlassen`
3. **Backend**: Bei Verlassen während einer laufenden Partie:
   - Partie wird mit Status `ABGEBROCHEN` gespeichert
   - Alle verbleibenden Spieler am Tisch erhalten ein WebSocket-Event (`TischEreignisTyp.PARTIE_ABGEBROCHEN`) mit Begründung
   - Tisch wechselt in Status `WARTEND` (offen für neue Spieler) oder wird gelöscht — abhängig von Konfiguration
4. **Frontend (alle Spieler)**: Nach `PARTIE_ABGEBROCHEN`-Event → Weiterleitung zur Lobby mit Hinweis "Ein Spieler hat den Tisch verlassen"
5. **Verlassen vor Spielstart** (Tisch im Status `WARTEND`): Bestehende Logik (`verlasseTisch`) bleibt unverändert — kein Abbruch nötig.

### Abgrenzung: Disconnect vs. Verlassen

| Szenario                  | Verhalten                                          |
|---------------------------|----------------------------------------------------|
| Tab neu laden             | Session-Recovery, zurück zum Tisch                 |
| Kurzer Netzwerkausfall    | Reconnect-Timeout, KI übernimmt nach 120s          |
| Tisch verlassen klicken   | Sofortiger Abbruch, alle Spieler zurück zur Lobby  |

### Tisch verlassen: Akzeptanzkriterien

- Button ist in der Tischansicht sichtbar und zugänglich
- Bestätigungsdialog verhindert versehentliches Verlassen
- Alle Spieler am Tisch erhalten eine Benachrichtigung und werden zur Lobby geleitet
- Kein inkonsistenter Zustand nach Abbruch (Partie als ABGEBROCHEN persistiert)

---

## Tisch-Lebenszyklus: Neue Partie nach Partie-Ende

Nach dem Ende einer Partie (alle Spiele gespielt) startet der Tisch automatisch eine neue Partie — ohne dass die Spieler zurück zur Lobby müssen.

### Neue Partie: Anforderungen

1. Nach Abschluss der letzten Auswertung wird eine neue Partie mit denselben Spielern und derselben Konfiguration gestartet.
2. Das Ergebnis-Overlay zeigt den Gesamtstand und einen "Nächste Partie"-Countdown (z.B. 10 Sekunden).
3. Ein Spieler kann den Countdown abbrechen und mit "Tisch verlassen" zur Lobby wechseln — die Partie startet dann mit KI-Ersatz **nicht** (Abbruch wie oben beschrieben).
4. Die neue Partie beginnt mit der Geber-Rotation entsprechend `specs/spielablauf.md`.
5. Ein WebSocket-Event (`NEUE_PARTIE_GESTARTET`) informiert alle Spieler.

### Neue Partie: Akzeptanzkriterien

- Nach Partie-Ende startet automatisch eine neue Partie
- Countdown-Overlay informiert Spieler über bevorstehenden Neustart
- Verlassen während des Countdowns bricht den Neustart nicht für alle ab — erst wenn ein Spieler wirklich verlässt, greift die "Tisch verlassen"-Logik

---

## Aktualisiertes Definition of Done

- [x] `GET /api/spieler/session` liefert `aktiverTischId`
- [x] `BootSzene` leitet bei `aktiverTischId` direkt zur `TischSzene` weiter
- [x] WebSocket-Reconnect und Snapshot-Anfrage nach Tab-Reload funktionieren
- [x] "Tisch verlassen"-Button in Tischansicht vorhanden
- [x] Bestätigungsdialog vor Verlassen implementiert
- [x] Backend: `PARTIE_ABGEBROCHEN`-Event bei willentlichem Verlassen
- [x] Alle Spieler werden nach Abbruch zur Lobby weitergeleitet
- [x] Nach Partie-Ende startet automatisch neue Partie mit Countdown
- [x] Alle bestehenden Disconnect/Reconnect-Tests bleiben grün
- [x] Neue Tests für Session-Recovery, Tisch-Verlassen und Neustart
- [x] KI-Übernahme-Timeout deaktiviert für Einzelspieler-Tische (4.18)
- [x] Laufende eigene Tische in Spielverwaltungs-Szene mit „Zurückkehren"-Button (4.18)

---

## Single-Player UX: Timeout-Verhalten (4.18)

Wenn ein Spieler **alleine** (gegen ausschließlich KI-Spieler) spielt, macht ein Inaktivitäts-Timeout keinen Sinn — der Spieler kann so lange nachdenken wie er will, ohne andere zu blockieren.

### Single-Player Timeout: Anforderungen

1. Wenn alle Mitspieler am Tisch KI-Spieler sind, wird der **Inaktivitäts-Timeout deaktiviert** — die KI übernimmt nie automatisch.
2. Der Spieler kann so lange nachdenken wie er will, ohne seinen Platz zu verlieren.
3. Das Verhalten bei willentlichem Tisch-Verlassen bleibt unverändert (sofortiger Abbruch).
4. Tab-Reload funktioniert weiterhin via Session-Recovery.

### Single-Player Timeout: Akzeptanzkriterien

- Einzelspieler-Tisch: KI übernimmt nie automatisch, egal wie lange der Spieler inaktiv ist.
- Mehrspieler-Tisch: Timeout-Verhalten bleibt wie bisher (120s Standard).
- Session-Recovery nach Tab-Reload bleibt für beide Fälle funktionsfähig.
