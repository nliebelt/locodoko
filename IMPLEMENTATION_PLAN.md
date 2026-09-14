# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-09-14 (Session 157). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–156 archiviert).

## Notiz

**S157/Folge — QA-CODE-METRICS-SETUP erledigt (2026-09-14). Nächster Task: QA-CODE-METRICS-REPORT.**

- `pom.xml`: JaCoCo `report`-Phase auf `verify` verschoben, `destFile` + `dataFile` + `outputDirectory` explizit konfiguriert. `mvn clean verify` erzeugt Report in `target/site/jacoco/`. JaCoCo war bereits vorhanden (0.8.14) — nur Phase und Konfiguration angepasst.
- `frontend/package.json`: `knip` (6.35.1), `madge` (8.0.0), `depcheck` (1.4.7) als devDependencies ergänzt + npm-Scripts `knip`, `madge`, `depcheck` hinzugefügt.
- knip-Befunde: Exit 1 — 1 ungenutzte Datei (`eslint-complexity.config.mjs`), 57 ungenutzte Exports, 50 ungenutzte Typen. Werden in QA-CODE-METRICS-REPORT dokumentiert.
- madge: kein zirkulärer Abhängigkeit (Exit 0). depcheck: keine Issues (Exit 0).

**Nächster Schritt:** QA-CODE-METRICS-REPORT — Metriken auswerten, `specs/code-metrics-report.md` anlegen.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S157 (2026-09-14): 478 FE-Tests grün, ESLint 0 Warnungen, 7 check_specs.py-Befunde. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

### Empfohlene Build-Reihenfolge (Block M2-Alpha — aktuelle Runde, Stand S157)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

- [x] **DECISION-LIZENZ-LICENSE** — `LICENSE`-Datei mit Apache-2.0-Text anlegen. Entscheidung S157: **Apache-2.0**. Vorgehen: vollständigen Apache-2.0-Lizenztext (Copyright 2024–2026 Nils Liebelt) als `LICENSE` im Repo-Root anlegen. Außerdem in `fertigstellung.md` unter „Offene Entscheidungen" die Lizenz-Zeile auf `✅ Apache-2.0 (S157)` setzen, und `DECISION-LIZENZ` in `IMPLEMENTATION_PLAN.md` Sektion C auf `[x]` setzen. Validierung: kein Build-Schritt nötig — `python3 check_specs.py` läuft als Smoke-Test. Erste Datei: `LICENSE`.

- [x] **CI-GITHUB-ACTIONS** — `.github/workflows/ci.yml` anlegen. Trigger: `push` und `pull_request` auf `main`. Jobs: (1) `backend` — Ubuntu latest, Java 21 (temurin), `mvn clean test -q`; (2) `frontend` — Node 20, `cd frontend && npm ci && npm test --silent && npm run build && npm run lint`. Cache: Maven `~/.m2`, npm `~/.npm`. Keine weiteren Abhängigkeiten zwischen Jobs. Validierung: Datei syntaktisch korrekt (YAML-Linting via `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` oder äquivalent). Erste Datei: `.github/workflows/ci.yml`.

- [x] **QA-CODE-METRICS-SETUP** — Mess-Werkzeuge verdrahten. Backend: `jacoco-maven-plugin` in `pom.xml` (Goals `prepare-agent` + `report` an `verify`-Phase, Konfiguration: `destFile`, `dataFile`, Output nach `target/site/jacoco/`). Frontend: `knip`, `madge`, `depcheck` als dev-Dependencies in `package.json` + npm-Scripts `"knip": "knip"`, `"madge": "madge src --circular"`, `"depcheck": "depcheck"`. Validierung: `mvn clean verify -q` (JaCoCo-Report entsteht), `cd frontend && npm run knip`, `npm run madge`, `npm run depcheck` laufen ohne Abbruch (Befunde sind ok, Exit-Code-Fehler dokumentieren). Erste Datei: `pom.xml`.

- [ ] **QA-CODE-METRICS-REPORT** — Alle Metriken auswerten und dokumentieren. Vorbedingung: QA-CODE-METRICS-SETUP erledigt. Schritte: (1) `mvn clean verify -q` → JaCoCo-Gesamtdeckung aus `target/site/jacoco/index.html` auslesen; (2) `cd frontend && npm run knip` → tote Exporte/Dateien; (3) `npm run madge` → zirkuläre Abhängigkeiten; (4) `npm run depcheck` → ungenutzten Dependencies. Befunde in `specs/code-metrics-report.md` dokumentieren (Tabelle: Metrik / Wert / Trend / Handlungsbedarf). Für jeden kritischen Befund (Coverage < 60 %, zirkuläre Deps, ungenutzte Deps) einen neuen `[ ]`-Task in Sektion A des Plans anlegen. Validierung: `python3 check_specs.py` → 0 Befunde. Erste Datei: `specs/code-metrics-report.md`.

- [ ] **OPS-GRAFANA-SPRING** — Spring Boot für Prometheus-Scraping vorbereiten. Schritte: (1) `micrometer-registry-prometheus` in `pom.xml` ergänzen (kein explizites Version-Tag nötig — Spring Boot BOM verwaltet); (2) in `src/main/resources/application.properties` (bzw. prod-Profil falls vorhanden): `management.endpoints.web.exposure.include=health,info,prometheus` und `management.endpoint.prometheus.enabled=true` setzen — dabei prüfen ob der Endpoint nicht schon existiert; (3) `specs/betrieb-monitoring.md` neu anlegen: Zweck, Prometheus-Endpunkt (`/actuator/prometheus`), empfohlene Grafana-Cloud-Einrichtung (Alloy-Config-Snippet für `locodoko`-Job, DE-Region), wichtigste JVM- und App-Metriken die zu beobachten sind. Validierung: `mvn clean test -q` grün. Erste Datei: `pom.xml`.

- [ ] **SPEC-RECHT-DRAFT** — `specs/recht-impressum-datenschutz.md` anlegen. Inhalt: (1) **Impressum-Template** (§5 DDG Pflichtfelder für DE-Betreiber: vollständiger Name, Anschrift, E-Mail-Adresse — Platzhalter `[NAME]`, `[ADRESSE]`, `[E-MAIL]` markieren); (2) **Datenschutzerklärung-Template** (DSGVO-Pflichtangaben: Verantwortlicher, Verarbeitungszwecke je Funktion — Google OAuth, Passwort-Auth, Session, Logs/Monitoring, Bug-Report —, Rechtsgrundlagen Art. 6 DSGVO, Hosting-Standort DE, Löschfristen, Betroffenenrechte, Kontakt Datenschutz); (3) **Checkliste vor Go-Live** (Texte mit echten Daten befüllen, Anwalt-Review empfohlen, Impressum im Footer verlinkt, Cookie-Hinweis falls nötig). Ton: sachlich-technisch, keine Rechtsberatung — explizit als Vorlage kennzeichnen. Validierung: `python3 check_specs.py` → 0 Befunde. Erste Datei: `specs/recht-impressum-datenschutz.md`.

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung (Server/DNS/TLS/Docker/Google-Account/Plattformwahl). Ralph kann hier nur vorbereitende Config schreiben, nicht abschließen.

*(Alle MENSCH-Tasks dieser Runde erledigt — siehe Archiv Sessions 151–156)*

---

## C) Wartet auf User-Entscheidung

- [x] **DECISION-DEPLOY-VARIANTE** — ✓ Entschieden S152: **plain Linux + Java** auf hosting.de. CI-DOCKER-BUILD + DEPLOY-COMPOSE-SMOKE entfallen → D).

- [x] **DECISION-LIZENZ** — ✓ Entschieden S157: **Apache-2.0**. `LICENSE`-Datei via DECISION-LIZENZ-LICENSE angelegt.

---

## D) Zurückgestellt (bewusst nicht im aktiven Backlog)

- [ ] **BETA-ACCESS** (optional) — Registrierung invite-only/Whitelist. User-Entscheidung: Beta nicht gated (`/register` offen, noindex aktiv). Bei Bedarf reaktivieren.
- [ ] **ADMIN-TOOLING / ROLLBACK-DOKU** — zurückgestellt. (a) Betreiber-Tooling (hängenden Tisch beenden, User sperren); (b) Rollback-Strategie. Bei Betriebsproblemen reaktivieren.
- [ ] **DEPLOY-COMPOSE-SMOKE** — entfällt (plain Linux gewählt S152).
- [ ] **CI-DOCKER-BUILD** — entfällt (plain Linux gewählt S152). CD-DEPLOY für M2: GitHub Actions → `scripts/deploy.sh` via SSH.
- [ ] **STAT-SAISON-LIGA** — Saisons + Ligen. Additive Erweiterung, rückwirkend berechenbar. Nur bauen, falls öffentlich/wachsend.
- [ ] **BE-ERRORPRONE-NULLAWAY** (Backend — **Java-25-Gate**) — Error Prone + NullAway: auf JDK 25 noch nicht stabil (`NoSuchFieldError: TypeTag`, S128 recherchiert). Reaktivieren, sobald Error-Prone JDK 25 sauber unterstützt.
- [ ] **SEC-CSP** (Frontend/Security — M2-Task) — Content Security Policy. Phaser 4 WebGL benötigt `'unsafe-eval'` → strikte CSP bricht das Spiel. Nach Live-Gang per `CSP-Report-Only`-Header Violations erfassen, dann iterativ einschränken. (S145: akzeptiertes Restrisiko M1.)

- [ ] **FE-RUNDENENDE-REDESIGN** (M2 — Design-Task, braucht User-Input) — Rundenende- und Partieende-Screen komplett neu gestalten. Aktuell: kleines PhaserModal mit lila Balatro-Palette — fühlt sich an wie ein Web-Popup. Ziel: Vollbild-Overlay mit Filz-Hintergrund + grüner Spieltisch-Palette (wie BestenlisterSzene), vernünftige Informationshierarchie (Teams/Augen/Sonderpunkte einzeln, Gesamtstand). `TischRundenEndeController.ts` ist die zentrale Datei. Vor Umsetzung: kurze Design-Abstimmung mit User (welche Infos prominent? getrennte oder zusammengeführte Screens?). Daten vorhanden: `augenRe/augenKontra`, `sonderpunkteRe[]`, `sonderpunkteKontra[]`, `gesamtpunktestand[]`.

- [ ] **FE-MOBILE** (M2 — Touch/Layout) — Mobile Touch funktioniert nicht. Ziel: separater Mobile-Screen mit größeren Karten, Touch-optimiertem Layout. Braucht visuelle Regressionstests für Mobile (Playwright Viewport 390×844 o.ä.), damit Fehler ohne echtes Gerät findbar sind. Kein Visual-Loop ohne Mobile-Viewport-Test möglich. Erst planen wenn FE-RUNDENENDE-REDESIGN und CI stehen (visuelle Tests benötigen stabilen Baseline).

- [ ] **CI-GITHUB-ACTIONS** (M2 — DevOps) — GitHub Actions Pipeline: `mvn clean test` + `npm test && npm run build && npm run lint` bei jedem Push/PR. Ziel: grüner Badge im Repo. User möchte alles in GitHub — Issues als Tickets, ggf. automatisierten Workflow der GitHub-Issues via `ralph.sh` abarbeitet (Idee: Issue-Label → Ralph-Run). Vorher: DECISION-LIZENZ abschließen.

- [ ] **UX-USER-FEEDBACK** (M2 — Nach Live-Gang) — In-Game Feedback-Kanal für Nutzer. Form noch offen: einfaches Kontaktformular, GitHub-Issue-Link, oder integrierter Feedback-Button im Spiel. Ziel: Nutzerfeedback nach öffentlichem Betrieb strukturiert sammeln.

---

## Entdeckungen

- **S157 — CI-GITHUB-ACTIONS war bereits committed** (2026-09-14): `.github/workflows/ci.yml` (Java 25 Temurin, Node 22, Backend + Frontend + Spec-Lint) wurde in Commit `CI-BUILD-TEST` (vor der M2-Alpha-Runde) angelegt. `ci-docs.yml` (MkDocs → GitHub Pages) in `DOC-DOCS-SITE`. Plan-Eintrag nachgezogen. Kein Code-Handlungsbedarf.

- **S157 — `frontend-flash-text.md` DoD: Visuelles Review noch offen** (2026-09-14): Die Spec hat `[ ] Visuelles Review via Vision Loop (ausstehend — Backend muss laufen)` als offene DoD-Checkbox. Da FE-SPIEL-BEENDET-OUTCOME jetzt VERLOREN-Pfad ergänzt, wäre ein Vision-Loop-Durchlauf sinnvoll. → In DOC-FLASH-TEXT-VERLOREN klären, ob Review nachgeholt oder als Tech-Debt akzeptiert wird.

- **S153 — Prod-Bug behoben: SPRING_PROFILES_ACTIVE=prod fehlte** (2026-08-18): App lief mit H2 in-memory (Dev-Profil) statt PostgreSQL. Stacktrace: `JdbcSQLIntegrityConstraintViolationException: Check constraint invalid: CONSTRAINT_69`. Fix: Env-Variable in `.env` gesetzt + Neustart. Setup-Skript + Doku aktualisiert.

- **S153 — E2E gegen Prod: Stich-Phase Timeout** (2026-08-18): `schnellstart.spec.ts` gegen Prod scheitert bei Schritt 6 (Stich-Zähler nach erstem Stich). Schnellstart selbst ✓. Ursache: KI-Reaktionszeit oder WebSocket-Latenz auf Prod zu hoch für lokale Test-Timeouts (20s). → E2E-PROD-SMOKE hat Timeouts für Prod angepasst (erledigt).

- **S151 — Repo-Scan sauber:** 506 BE-Tests, check_specs.py 0 Befunde (55 Specs), ESLint 0 Warnungen, 0 TODOs/FIXMEs. Größte Java-Produktionsdateien: `Spiel.java` (542, Aggregat), `PartieStandAntwort.java` (529, Snapshot-DTO), `JsonbConverter.java` (500, Persistenz-Boilerplate) — alle verteidigt. Größte TS-Produktionsdatei: `TischKartenRenderer.ts` (418, Phaser-Rendering) — kein Handlungsbedarf. Keine neuen Refactoring-Kandidaten.

- **S150 — Verteidigte Übergrößen (Radar, kein Handlungsbedarf):** `Spielregeln.java` (438) ist Value-Object-Builder mit idiomatischem Pattern; `JsonbConverter.java` (500) wurde von 915 auf 500 gebracht und enthält notwendigen Boilerplate; `PartieStandAntwort.java` (529) ist Snapshot-DTO; `Partie.java` (471) + `Spiel.java` (542) sind Aggregate — alle verteidigt.

- **S149 — Flakiger Integrationstest (behoben):** `SpielerStatistikIntegrationTest.zweiRegelvarianten_erstellenJeweiligeStatistikZeilen` — 15s-Timeout + Zwischenawait. → TEST-BE-STATISTIK-FLAKINESS (erledigt).

- **S148 — Review-Notizen S126 (akzeptierte Restrisiken, keine eigenen Tasks):**
  - **B2/B3 (low):** `VerbindungsabbruchService` — TOCTOU zwischen `computeIfPresent`/`containsKey`. Single-Instance-Betrieb → praktisch irrelevant; bei Bedarf atomare `compute`-Operation.
  - **F3 (kosmetisch):** Gemergtes Passwort-Konto behält `authentifizierungsMethode=PASSWORT` statt korrekt. Gatet nichts Sensibles — nur Anzeige leicht ungenau.
  - **F4 (a11y):** `installiereDialogA11y`-Fokus-Trap lenkt Tab nur bei exaktem Fokus auf erstem/letztem Element um. In der Praxis ok. Optional härten.

---

## Meilensteine

- **M1 — Closed Beta** ✅ Vollständig abgehakt S156 (2026-08-18). Stack live, Backup-Cron gefixt + Restore verifiziert. Offen: Beta-Tester als Google Test-User eintragen (MENSCH).
- **M2 — Public Go-Live:** Rechtstexte (`specs/recht-impressum-datenschutz.md`), CI/CD via GitHub Actions → `scripts/deploy.sh`, DECISION-LIZENZ, SEC-CSP.

---

## Build-Modus-Leitfaden (gilt für alle autonomen Tasks)

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis.
2. **Pro Task ein Commit.** Keine Bündelung mehrerer Tasks in einem Commit.
3. **Bei Unklarheit: kleinste Änderung + `mvn clean test`.** Nicht spekulativ refaktorieren. (`clean` ist Pflicht — inkrementelle Builds maskieren Compile-Brüche durch veraltete `target/`-Klassen.)
4. **Tests müssen vor jedem Commit grün sein.** Bei Bruch: ROLLBACK des aktuellen Versuchs, Wurzelursache verstehen, neu ansetzen.
5. **Pure-JUnit-Tests bleiben pure JUnit.** `@SpringBootTest` darf NICHT zu einer Test-Klasse hinzugefügt werden, die heute ohne läuft.
6. **VO bleibt VO wo möglich:** Postgres JSONB + Custom Converter ermöglichen immutable VOs.
7. **Greenfield-Annahme:** Keine Datenmigration nötig.
8. **Spec-Konsultation:** Bei jedem Task der Specs anpasst: `grep -rn "<altes Konzept>" specs/` als Verifikations-Schritt.

## Stoppregeln für Build-Modus

- **Test-Suite bricht und in 3 Versuchen nicht reparierbar:** Stoppen, Iteration abbrechen, Notiz unter „Entdeckungen". Nicht stapeln.
- **Unklar zwischen Optionen:** Die kleinere/risikoärmere Option wählen.
- **Niemals:** `--no-verify`, `git push --force` ohne explizite User-Anweisung, Tests `@Disabled` ohne Notiz.
