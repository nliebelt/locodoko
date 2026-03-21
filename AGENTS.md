## Build & Run

### Backend (Java 25 / Spring Boot 4.x / Maven)

- Build: `mvn clean compile`
- Tests: `mvn test`
- Package: `mvn clean package -DskipTests`
- Run: `mvn spring-boot:run`
- Vollständiger Build mit Tests: `mvn clean verify`
- Profil: H2 In-Memory-Datenbank für Entwicklung
- `mvn clean package` / `mvn clean verify` betten das Frontend automatisch nach `src/main/resources/static/app` ein.

### Frontend (TypeScript / Phaser)

- Install: `cd frontend && npm install`
- Build: `cd frontend && npm run build`
- Build + Backend-Einbettung: `cd frontend && npm run build:embed`
- Dev-Server: `cd frontend && npm run dev`
- Tests: `cd frontend && npm test`
- Lint: `cd frontend && npm run lint`

## Validation

Führe diese Befehle nach dem Implementieren aus, um sofortiges Feedback zu bekommen:

- Backend-Tests: `mvn test`
- Frontend-Tests: `cd frontend && npm test`
- Frontend-Build: `cd frontend && npm run build`
- Frontend-Lint: `cd frontend && npm run lint`
- Vollständiger Build: `mvn clean verify`
- Log-Prüfung: Prüfe die Ausgabe auf Warnungen, Fehler und Plausibilität

## Projektstruktur

```
locodoko/
├── pom.xml                            # Maven Root
├── src/main/java/...                  # Spring Boot Backend
├── src/main/resources/
│   ├── application.properties         # Haupt-Konfiguration
│   ├── application-dev.properties     # Dev-Profil (H2)
│   └── static/                        # Frontend-Assets (nach Build)
├── src/test/java/...                  # Backend-Tests
├── frontend/                          # TypeScript/Phaser (npm-Projekt)
├── specs/                             # Spezifikationen (eine Datei pro Thema)
├── PRD.md                             # Product Requirements Document
├── ralph.sh                           # Ralph Loop Script
├── PROMPT_plan.md                     # Planning-Modus Prompt
├── PROMPT_build.md                    # Build-Modus Prompt
├── AGENTS.md                          # Diese Datei (operativ, kurz halten!)
└── IMPLEMENTATION_PLAN.md             # Aufgabenplan (generiert/aktualisiert von Ralph)
```

## Domänensprache

Die Domäne ist auf Deutsch (Ubiquitous Language nach DDD):

- Klassen, Methoden, Variablen: Deutsch (z.B. `Stich`, `Trumpf`, `Spieler`, `Karte`)
- Der Code muss exessiv auf Deutsch kommentiert werden: Klassen, Methoden, Variablen
- Specs und Dokumentation: Deutsch
- Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit

## Architektur

- Domain-Driven Design (DDD) mit Bounded Contexts
- Test-Driven Development (TDD) — Tests zuerst schreiben
- **Domain Model = Persistence Model** (pragmatisches DDD, Option A)
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

## Codebase Patterns

**Wichtige Specs für Architektur-Refactoring**:
- `specs/architektur-ddd.md` — DDD-Prinzipien, Package-Struktur, Aggregate Boundaries
- `specs/tech-migration.md` — Migration auf Java 25, Spring Boot 4.x, Spring Data JDBC, Liquibase
- `specs/datenbankmodell.md` — Tabellenstruktur, Aggregate Roots vs. Value Objects

(Wird von Ralph aktualisiert, wenn Patterns entdeckt werden)
