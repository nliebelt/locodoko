## Build & Run

### Backend (Java 21 / Spring Boot / Maven)

- Build: `mvn clean compile`
- Tests: `mvn test`
- Package: `mvn clean package -DskipTests`
- Run: `mvn spring-boot:run`
- Vollständiger Build mit Tests: `mvn clean verify`
- Profil: H2 In-Memory-Datenbank für Entwicklung

### Frontend (TypeScript / Phaser)

- Install: `cd frontend && npm install`
- Build: `cd frontend && npm run build`
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
- Code-Kommentare: Deutsch
- Specs und Dokumentation: Deutsch
- Fachbegriffe: Stich, Trumpf, Dulle, Fuchs, Karlchen, Re, Kontra, Armut, Hochzeit

## Architektur

- Domain-Driven Design (DDD) mit Bounded Contexts
- Test-Driven Development (TDD) — Tests zuerst schreiben
- Backend ist einzige Wahrheitsquelle — jeder Spielzug wird serverseitig validiert
- WebSocket (STOMP) für Echtzeit-Kommunikation
- REST-API für Lobby und Konfiguration
- H2 In-Memory DB für Entwicklung (PostgreSQL für Produktion)
- Auslieferung als einzelnes JAR (Frontend-Assets eingebettet)

## Codebase Patterns

(Wird von Ralph aktualisiert, wenn Patterns entdeckt werden)
