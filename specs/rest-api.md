# REST-API

| Feld           | Wert                                                                      |
|----------------|----------------------------------------------------------------------------|
| Status         | Implementiert — Endpunkt-Referenz: generierte OpenAPI-Spec (Entscheidung S148) |
| Priorität      | Hoch                                                                      |
| Abhängigkeiten | lobby.md, tischkonfiguration.md, spieler-session.md, punkteberechnung.md |

## Beschreibung

Die REST-API stellt Endpunkte für nicht-echtzeit-kritische Operationen bereit: Lobby-Verwaltung,
Tischkonfiguration, Authentifizierung, Spielerprofil/Bestenliste, Bugreport/Feedback und
Punktestand. Die API ergänzt die WebSocket-Kommunikation (`websocket-kommunikation.md`).

## Kanonische Endpunkt-Referenz: OpenAPI

> **Diese Spec pflegt bewusst KEINE handgepflegte Endpunkt-Liste mehr** (Entscheidung S148 —
> die Liste war auf ~50 % des Ist-Stands gedriftet). Die einzige Wahrheit über Pfade,
> Parameter und DTOs ist die **generierte OpenAPI-Spec**:
>
> - Laufend: `http://localhost:8081/v3/api-docs` (springdoc), Swagger-UI unter `/swagger-ui.html`
> - Build-Artefakt: `target/openapi.json` (Basis für `npm run generate-types` → `api-types.ts`)
> - Controller-Übersicht im Code: `@RequestMapping` in `tisch/`, `spieler/`, `system/`
>   (`/api/tische`, `/api/partien`, `/api/auth`, `/api/spieler`, `/api/spieler/session`,
>   `/api/feedback`, `/api/bugreport`, `/api/system`, `/api/debug` + `/join/{code}`)

Hier stehen nur die **Design-Regeln**, die für alle Endpunkte gelten.

## Design-Regeln

### Format & Fehler-Contract

1. Alle Endpunkte verwenden **JSON**; Fehler liefern `application/problem+json` (RFC 9457,
   siehe `architektur-ddd.md` Abschnitt 8).
2. Statuscode-Mapping (via `@ControllerAdvice` / `SpielverwaltungExceptionHandler`):
   - 400: Ungültige Anfrage (Bean-Validation)
   - 403: Spieler gehört nicht zum Tisch (`SpielerZugriffVerweigertException`)
   - 404: Ressource/Session nicht gefunden (`SpielverwaltungNichtGefundenException`)
   - 409: Zustandskonflikt, z.B. Tisch voll, Optimistic-Lock (`SpielverwaltungKonfliktException`)
   - 422: Regelverstoß im Spielzug (`UngueltigerSpielzugException`)
   - 500: Serverfehler
3. Fehler-Responses enthalten eine strukturierte Meldung (`ApiFehlerAntwort`: `fehlerCode`, `nachricht`).

### Sicherheit & Validierung

4. Identität kommt **immer aus der HTTP-Session** (`SpielerSessionService`) — Client-Angaben zu
   Spieler/Position wird nicht vertraut.
5. Schreibende Spiel-Endpunkte re-validieren jede Aktion server-seitig (Bedienpflicht, am Zug,
   Karte in Hand) — das Frontend liefert nur UI-Hints.
6. Rate-Limiting auf Auth-/Feedback-Endpunkten (`RateLimitingFilter`).
7. DTOs statt Domain-Objekte an der API-Grenze; `@Valid` für Bean-Validation.

### Betrieb / Monitoring

8. **`GET /actuator/health`** — Anwendungsstatus für Health-Checks; keine Details exponiert.
9. **`GET /actuator/info`** — Build-Metadaten (Git-SHA/Version) der laufenden Instanz.

### Logging

10. Alle Endpunkte loggen Zugriff und Fehler (strukturiertes JSON, MDC `correlationId` via
    `CorrelationIdFilter` — siehe `bugreport.md`).

## Akzeptanzkriterien

- Jeder Endpunkt erscheint in der generierten OpenAPI-Spec (springdoc erfasst alle Controller).
- Fehlerfälle folgen dem Statuscode-Mapping oben (Tests im `SpielverwaltungExceptionHandler`-Umfeld).
- `npm run generate-types` erzeugt aus `target/openapi.json` konsistente Frontend-Typen.

## Definition of Done

- [x] Controller + DTOs implementiert, Validierung aktiv
- [x] Exception-Handler mit RFC-9457-Mapping
- [x] OpenAPI via springdoc generiert; Type-Brücke zum Frontend (`generate-types`)
- [x] Unit-/MockMvc-Tests für Controller
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- Spring MVC `@RestController`, getrennte Controller pro Ressource
- OpenAPI-Konfiguration: `system/OpenApiKonfiguration.java`, Schema-Erweiterungen:
  `tisch/OpenApiSchemaErweiterung.java`
