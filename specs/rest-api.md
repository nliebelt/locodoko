# REST-API

| Feld           | Wert                                                                      |
|----------------|---------------------------------------------------------------------------|
| Status         | Implementiert |
| Priorität      | Hoch                                                                      |
| Abhängigkeiten | lobby.md, tischkonfiguration.md, spieler-session.md, punkteberechnung.md |

## Beschreibung

Die REST-API stellt Endpunkte für nicht-echtzeit-kritische Operationen bereit: Lobby-Verwaltung (Tische anzeigen, erstellen, beitreten), Tischkonfiguration und Spielhistorie/Punktestand. Die API ergänzt die WebSocket-Kommunikation.

## Anforderungen

### Tisch-Endpunkte

1. **`GET /api/tische`** — Alle offenen Tische abrufen.
   - Response: Liste von Tisch-Objekten mit: id, name, spielerAnzahl, status, kurzKonfiguration.
   - Keine Authentifizierung erforderlich.

2. **`POST /api/tische`** — Neuen Tisch erstellen.
   - Request-Body: `{ name, konfiguration (optional) }`
   - Der Ersteller wird automatisch dem Tisch hinzugefügt.
   - Response: Erstellter Tisch mit ID.

3. **`POST /api/tische/{id}/beitreten`** — Einem bestehenden Tisch beitreten.
   - Validierung: Tisch existiert, hat freie Plätze, Spieler ist nicht schon an einem Tisch.
   - Response: Aktualisierter Tisch oder Fehler.

4. **`POST /api/tische/{id}/verlassen`** — Tisch verlassen (vor Spielbeginn).
   - Validierung: Spiel hat noch nicht begonnen.
   - Response: Bestätigung.

5. **`POST /api/tische/{id}/starten`** — Spiel starten (nur Tischersteller).
   - Validierung: Mindestens 1 menschlicher Spieler, Tisch noch nicht gestartet.
   - Freie Plätze werden mit KI-Spielern aufgefüllt.
   - Response: Bestätigung, WebSocket-Events werden ausgelöst.

### Konfiguration-Endpunkte

1. **`GET /api/tische/{id}/konfiguration`** — Tischregeln abrufen.
   - Response: Vollständige Tischkonfiguration.

2. **`PUT /api/tische/{id}/konfiguration`** — Tischregeln anpassen.
   - Validierung: Nur durch Tischersteller, nur vor Spielbeginn.
   - Request-Body: Konfigurationsobjekt.
   - Response: Aktualisierte Konfiguration.

### Punktestand-Endpunkte

1. **`GET /api/partien/{id}/stand`** — Aktuellen Punktestand einer Partie abrufen.
   - Response: Gesamtpunktestand pro Spieler, Anzahl gespielte Spiele.

### Betrieb / Monitoring

1. **`GET /actuator/health`** — Anwendungsstatus für Health-Checks (z.B. Load Balancer, Deployment-Pipelines).
   - Response: `{ "status": "UP" }` — keine Details exponiert.

2. **`GET /actuator/info`** — Build-Metadaten der laufenden Instanz.
   - Response: `{ "build": { "artifact": "locodoko", "group": "de.locodoko", "version": "...", "name": "...", "time": "..." } }`
   - Erzeugt durch `spring-boot-maven-plugin` Goal `build-info` (`META-INF/build-info.properties`).

### Allgemein

1. Alle Endpunkte verwenden **JSON** als Datenformat.
1. Fehler werden mit geeigneten **HTTP-Statuscodes** beantwortet:
    - 400: Ungültige Anfrage (Validierungsfehler)
    - 404: Ressource nicht gefunden
    - 409: Konflikt (z.B. Tisch voll)
    - 500: Serverfehler
1. Fehler-Responses enthalten eine **strukturierte Fehlermeldung**: `{ fehlerCode, nachricht }`.
1. Alle Endpunkte loggen **Zugriff und Fehler** für die Fehleranalyse.

## Akzeptanzkriterien

- Alle Endpunkte sind erreichbar und liefern korrekte Responses.
- Tische können erstellt, abgerufen und beigetreten werden.
- Validierungsfehler werden mit 400 und verständlicher Fehlermeldung beantwortet.
- Nicht existierende Ressourcen ergeben 404.
- Konflikte (Tisch voll, Spiel läuft) ergeben 409.
- Die Konfiguration kann vor Spielbeginn geändert werden.
- Der Punktestand ist während und nach einer Partie abrufbar.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Controller mit allen Endpunkten implementiert
- [x] Request-/Response-DTOs definiert
- [x] Validierung implementiert
- [x] Unit-Tests für Controller geschrieben und bestanden
- [x] Integrationstests (MockMvc) geschrieben und bestanden
- [x] API-Dokumentation erstellt (z.B. via Swagger/OpenAPI)
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Kommunikation
- Spring MVC `@RestController` mit getrennten Controller-Klassen pro Ressource
- DTOs für Request/Response (nicht die Domain-Objekte direkt exponieren)
- `@Valid`-Annotation für Bean-Validation
- Exception-Handler mit `@ControllerAdvice` für einheitliche Fehler-Responses
- Optional: Swagger/OpenAPI-Dokumentation mit `springdoc-openapi`
