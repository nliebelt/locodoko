# Locodoko — Operativer Kontext für Claude Code

<!-- Spiegelt AGENTS.md (Quelle für GitHub Copilot). Beide synchron halten. -->

## Build & Run

### Backend (Java 25 / Spring Boot 4.x / Maven)

- Build: `mvn clean compile`
- Tests: `mvn test`
- Package: `mvn clean package -DskipTests`
- Run: `mvn spring-boot:run`
- Vollständiger Build mit Tests: `mvn clean verify`
- Profil: H2 In-Memory-Datenbank für Entwicklung
- `mvn clean package` / `mvn clean verify` betten das Frontend automatisch nach `target/classes/static` ein.

### Frontend (TypeScript / Phaser)

- Install: `cd frontend && npm install`
- Build: `cd frontend && npm run build`
- Dev-Server: `cd frontend && npm run dev`
- Tests: `cd frontend && npm test`
- Lint: `cd frontend && npm run lint`

### E2E-Tests (Playwright) — separat

- Setup: `cd e2e && npm install && npx playwright install chromium`
- Tests: `cd e2e && npx playwright test` (setzt laufendes Backend voraus: `mvn spring-boot:run`)
- Gegen Testsystem: `BASE_URL=https://... cd e2e && npx playwright test`
- Wird **nicht** von `mvn verify` ausgeführt — separater Schritt

## Validation

Führe diese Befehle nach dem Implementieren aus, um sofortiges Feedback zu bekommen:

- Backend-Tests: `mvn test`
- Frontend-Tests: `cd frontend && npm test`
- Frontend-Build: `cd frontend && npm run build`
- Frontend-Lint: `cd frontend && npm run lint`
- Vollständiger Build: `mvn clean verify`
- Log-Prüfung: Prüfe die Ausgabe auf Warnungen, Fehler und Plausibilität
- E2E Tests (Playwright) müssen erfolgreich durchgelaufen sein: `cd e2e && npm run test`
Dafür muss der Server aber laufen. `mvn spring-boot:run`

## Domänensprache

Die Domäne ist auf Deutsch (Ubiquitous Language nach DDD):

- Klassen, Methoden, Variablen: Deutsch (z.B. `Stich`, `Trumpf`, `Spieler`, `Karte`)
- Der Code muss exessiv auf Deutsch kommentiert werden: Klassen, Methoden, Variablen
- Specs und Dokumentation: Deutsch
- Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit

## Architektur

- Domain-Driven Design (DDD) mit Bounded Contexts
- Test-Driven Development (TDD) — Tests zuerst schreiben
- **Domain Model = Persistence Model** (pragmatisches DDD)
  - Aggregate Roots (mutable): `Tisch`, `Partie`, `Spieler`
  - Value Objects (immutable): `Karte`, `Stich`, `Spielregeln`, IDs
  - Lombok für Boilerplate-Reduktion (`@Getter`, `@RequiredArgsConstructor`, `@Value` für VOs)
- **Package-Struktur nach Bounded Contexts** (flach):
  - `de.locodoko.lobby` — Tisch erstellen, beitreten
  - `de.locodoko.partie` — Partie, Spiel (Domain+Persistence)
  - `de.locodoko.karten` — Kartendeck, Stich (Value Objects)
  - `de.locodoko.session` — Spieler, WebSocket
- **Aggregate Boundaries**: Jeder Bounded Context hat eigene Aggregate Root(s) mit Foreign Keys untereinander
- **Persistence**: Spring Data JDBC (kein JPA/Hibernate) + Liquibase für Schema-Migration
- Backend ist einzige Wahrheitsquelle — jeder Spielzug wird serverseitig validiert
- WebSocket (STOMP) für Echtzeit-Kommunikation
- REST-API für Lobby und Konfiguration
- H2 In-Memory DB für Entwicklung (PostgreSQL für Produktion)
- Auslieferung als einzelnes JAR (Frontend-Assets eingebettet)

(Wird von Ralph aktualisiert, wenn Patterns entdeckt werden)
