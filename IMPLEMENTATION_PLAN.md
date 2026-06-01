# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-29 (Plan-Überarbeitung nach Gesamt-Review). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 30 (2026-06-01) — Plan-Lauf „Fertigstellung öffentlicher Betrieb":** Gesamt-Scan ergab: Code ist gegenüber allen 47 Specs feature-complete (Status durchgehend Implementiert/Stabil/Abgeschlossen), `mvn clean test` grün. Keine offenen Spec-Lücken. Ziel laut User: **öffentlich betrieben**; Fokus **Deployment & Ops + CI/CD** (Mehrspieler-Verifikation bewusst zurückgestellt). Neuer, **verifizierter Deploy-Blocker** entdeckt: prod-Profil lädt eine nicht existierende Liquibase-Changelog-Datei → App bootet nicht gegen Postgres (`BUG-PROD-CHANGELOG`). Daraus neue Sektion „## Fertigstellung — Öffentlicher Betrieb". Plan-Modus: nichts implementiert.

**Session 29 (2026-06-01):** `BUG-EINSTELLUNGEN-MODAL` + `BUG-LOBBY-TISCHEINTRAG` behoben. Modal-Fix: In `TischInputHandler` Navigation-Shortcuts ('i', 's') vor `vorbehaltAktiv`-Check verschoben — im Turbo-Modus war die Vorbehalt-Phase bereits aktiv beim 's'-Druck. Lobby-Fix: Button-Text "Beitreten"/"Fortsetzen" lief dunkelgrün (#14361f) auf dunklem Hintergrund aus dem 150px-Button über (Zeichenbreite ~20.5px → 9 Zeichen = 185px). Behoben: `spielerTxt` auf x=10, nur für nicht-hervorgehobene Einträge; Button x=175, breite=215. Neuer Regressions-Test im Handler. Vision-Loop grün, alle Screenshots ohne Overflow. **Alle Tasks erledigt.**

**Session 28 (2026-06-01):** `VISION-SMOKE-1` abgeschlossen. Frontend neu gebaut (uncommittete Bridge-Erweiterung `drueckeSzenenButton` + SpielverwaltungsSzene Fokus-Fix). Vision-Loop grün (1 passed, 37.4s). Zwei visuelle Mängel entdeckt und als BUG-Tasks eingetragen: `BUG-EINSTELLUNGEN-MODAL` und `BUG-LOBBY-TISCHEINTRAG`.

**Session 27 (2026-05-29):** `REFACTOR-TISCHVERWALTUNG` abgeschlossen. `gibPresets`, `ladeKonfiguration`, `aktualisiereKonfiguration` aus `TischVerwaltungsService` (509 → ~470 Z.) in neuen `@Service TischKonfigurationsService` extrahiert (Deps: `TischZugriff`, `TischRepository`, `TischEchtzeitService`). `TischController` auf Constructor-Injection des neuen Service umgestellt. `mvn clean test` grün.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

## Empfohlene Build-Reihenfolge (verbindlich)

Erledigt (Session 26–28): DOC-PUNKTE-HINWEISE ✓ · SPEC-ARCH-HIERARCHIE ✓ · DOC-AGENTS-DEDUP ✓ · REFACTOR-SAGEAN ✓ · REFACTOR-JSONB-CONVERTER ✓ · BUG-JACKSON-ACCESSORNAMING ✓ · REFACTOR-TISCH-ZUGRIFF ✓ · REFACTOR-TISCHVERWALTUNG ✓ · VISION-SMOKE-1 ✓

Spec-getriebene Tasks: **alle erledigt** (Code feature-complete gegenüber allen 47 Specs).

Nächste offene Tasks — Fertigstellung öffentlicher Betrieb (Session 30, verbindliche Reihenfolge):

1. **BUG-PROD-CHANGELOG** (P0, Deploy-Blocker) — prod-Profil lädt fehlende Changelog-Datei
2. **DEPLOY-COMPOSE-SMOKE** — prod-Stack hochfahren + Partie durchspielen (hängt an 1)
3. **DOC-ENV-DEPLOY** — `.env.example` + README für Betrieb vervollständigen
4. **DEPLOY-OAUTH-SENTINEL** — Google-Login nur bei konfigurierten Credentials (klein)
5. **CI-BUILD-TEST** → **CI-DOCKER-BUILD** → **CD-DEPLOY** (CD blockiert bis Plattformwahl; EU/DE-Hosting Pflicht. Favorit: **hosting.de** — DE-Anbieter, User hat Account)
6. **VERIFY-MULTIPLAYER** — Mensch-gegen-Mensch E2E, vor Live-Gang (niedrig)

Produktreife & Specs (P4, Session 30 Teil 2 — zuerst als Spec erfassen):

7. **SPEC-SQL-REVIEW** — kritisches Schema-Review vor erster echter DB (Normalform, Audit, Indizes)
8. **OPS-GRAFANA-MONITORING** — Grafana Cloud Free-Tier (Actuator/Micrometer/Prometheus)
9. **OPS-DOMAIN** — Domain + DNS + TLS (Reverse-Proxy, OAuth-Redirect, WS-Origins)
10. **DOC-DOCS-SITE** — öffentliche Docs-/Wiki-Seite (MkDocs Material empf.), LLM-tauglich
11. **QA-CODE-METRICS** — Code-Metriken/Static-Analysis → Refactoring-Kandidaten + Report fürs Wiki
12. **FE-UI-FINAL-REVIEW** — finales UI/UX-Review, Mängel katalogisieren
13. **SPEC-RECHT** — Impressum + Datenschutz (Pflicht) + AGB, vor Live-Gang
14. **OPS-EMAIL** — Email-Versand Registrierung/Passwort-Reset (niedrig, kein Blocker)

Entscheidungen: **DECISION-AUTH** ✓ beide behalten · **DECISION-LIZENZ** aufgeschoben (Steam-Frage offen, Tendenz Apache vs. proprietär/AGPL)

---

## Fertigstellung — Öffentlicher Betrieb (Session 30, 2026-06-01)

> Ziel: Locodoko öffentlich betreiben (günstiges Hosting, Tendenz VPS via docker-compose; Plattform final offen). Fokus Deployment & Ops + CI/CD. Reihenfolge verbindlich: erst Deploy-Blocker, dann verifizierter Stack, dann CI/CD.

### Priorität 0 — Deploy-Blocker (verifizierter Bug)

- [ ] **BUG-PROD-CHANGELOG** — prod-Profil referenziert eine nicht existierende Liquibase-Changelog-Datei.

  `application-prod.properties` Z. 5: `spring.liquibase.change-log=classpath:db/changelog/db.changelog-baseline.yaml`. Diese Datei existiert nur unter `db/changelog/archiv/db.changelog-baseline.yaml` (archiviert), **nicht** am referenzierten Pfad. Das dev-Profil nutzt korrekt `classpath:db/changelog/db.changelog-master.yaml` (existiert, inkludiert `000-initial-schema.sql`). Folge: Im prod-Profil scheitert die Liquibase-Initialisierung beim Start → App bootet nicht gegen Postgres. Dieser Pfad wurde mangels CI/verifiziertem Deploy nie real ausgeführt.

  **Erste Datei zuerst:** `src/main/resources/application-prod.properties` Z. 5 — auf `classpath:db/changelog/db.changelog-master.yaml` umstellen (identisch zu dev). **Achtung H2 vs. Postgres:** dev läuft H2 im PostgreSQL-Modus, prod echtes Postgres 17. Verifizieren, dass `000-initial-schema.sql` ohne H2-spezifische Syntax gegen echtes Postgres durchläuft (siehe `DEPLOY-COMPOSE-SMOKE`). Falls Postgres-Inkompatibilität auftritt: dialektspezifisches Changeset statt blindem Umbiegen.

  **DoD:** prod-Profil zeigt auf eine existierende Changelog-Datei; `grep -rn "baseline" src/main/resources/application-prod.properties` leer; App startet im prod-Profil gegen Postgres und migriert sauber (Nachweis via `DEPLOY-COMPOSE-SMOKE`). **Risiko:** mittel (SQL-Dialekt).

### Priorität 1 — Deployment & Ops

- [ ] **DEPLOY-COMPOSE-SMOKE** — Vollen prod-Stack lokal hochfahren und eine Partie durchspielen. **[hängt an BUG-PROD-CHANGELOG]**

  Vorhandene Bausteine: `docker-compose.yml` (Services `postgres` + `app`, Profil `prod`, ENV-Wiring inkl. `LOCODOKO_DB_*`/`GOOGLE_CLIENT_*`), `Dockerfile.app` (Multi-Stage: `mvn package` baut Frontend ein → schlankes JRE-Image). Bislang nie real verifiziert.

  **Schritte:** 1. `docker compose --profile prod up --build -d`. 2. Warten bis `postgres` healthy + `curl -s http://localhost:8081/actuator/health` „UP". 3. Liquibase-Migration im App-Log prüfen (keine Fehler). 4. Im Browser/E2E eine Partie gegen KI bis zur Auswertung durchspielen. 5. Stack wieder runterfahren.

  **DoD:** prod-Stack startet reproduzierbar, Health UP, eine Partie läuft bis Auswertung durch. Etwaige Fehler als eigene `BUG-…`-Tasks. **Risiko:** mittel.

- [ ] **DOC-ENV-DEPLOY** — `.env.example` + README für öffentlichen Betrieb vervollständigen.

  `.env.example` enthält aktuell nur `GH_TOKEN` (Agent-Container), nicht die von `docker-compose.yml`/prod erwarteten Variablen. README ist auf Devmode-Stichworte beschränkt.

  **Erste Datei zuerst:** `.env.example` — ergänzen: `LOCODOKO_DB_USERNAME`, `LOCODOKO_DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS` (mit Kommentaren/Beispielwerten). Dann `README.md` — Abschnitt „Öffentlicher Betrieb": JAR-Build (`mvn clean package`), Start via `docker compose --profile prod up -d`, Google-OAuth2 einrichten (Redirect-URI `https://<domain>/login/oauth2/code/google`), HTTPS/Reverse-Proxy-Hinweis wegen `server.servlet.session.cookie.secure=true`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS` auf die Domain setzen.

  **DoD:** `.env.example` deckt alle prod-ENV ab; README erklärt einen Deploy von Null. Kein Code-Change, kein Test.

- [ ] **DEPLOY-OAUTH-SENTINEL** — „Mit Google anmelden" nur anzeigen/aktiv, wenn OAuth2 konfiguriert ist (klein, optional).

  `application.properties` Z. 19–20 setzt `client-id/secret` auf Default-Sentinel `disabled`. Ohne echte Credentials registriert Spring trotzdem einen Google-Client mit ID „disabled" → ein „Login mit Google"-Button liefe ins Leere. Passwort-Login funktioniert unabhängig.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/spieler/SecurityConfig.java` — OAuth2-Login nur registrieren, wenn `GOOGLE_CLIENT_ID` ≠ `disabled`/leer (z.B. `@ConditionalOnProperty` oder bedingte `ClientRegistrationRepository`-Bean). Frontend-Login-Button entsprechend ausblenden, wenn Provider fehlt.

  **DoD:** Ohne gesetzte Google-Credentials startet die App, zeigt keinen Google-Button und Passwort-Login funktioniert; mit Credentials erscheint der Button. Bestehende Auth-Tests grün. **Risiko:** niedrig.

### Priorität 2 — CI/CD (volle Pipeline)

- [ ] **CI-BUILD-TEST** — GitHub Actions Workflow für Build + Tests bei jedem Push/PR auf `main`.

  Aktuell kein `.github/workflows/`. Bei agentengetriebenem Workflow fängt nichts rote Builds ab.

  **Erste Datei zuerst:** `.github/workflows/ci.yml` — Job `backend`: Temurin 25 (siehe `Dockerfile.app`), `mvn clean verify`. Job `frontend`: Node 22, `cd frontend && npm ci && npm test && npm run build && npm run lint`. Trigger: `push`/`pull_request` auf `main`. Caching für Maven + npm.

  **DoD:** Workflow läuft auf GitHub grün durch (beide Jobs). Badge optional in README. **Risiko:** niedrig.

- [ ] **CI-DOCKER-BUILD** — Produktions-Image bauen und in GHCR pushen. **[hängt an CI-BUILD-TEST, DEPLOY-COMPOSE-SMOKE]**

  **Erste Datei zuerst:** `.github/workflows/ci.yml` erweitern (oder `release.yml`) — Job baut `Dockerfile.app`, taggt mit Commit-SHA + `latest`, pusht nach `ghcr.io/<owner>/locodoko` (nur auf `main`/Tag, via `GITHUB_TOKEN`/`packages: write`).

  **DoD:** Nach Push auf `main` liegt ein lauffähiges Image in GHCR; lokal `docker run` startet die App (gegen externe Postgres-ENV). **Risiko:** niedrig.

- [ ] **CD-DEPLOY** — Auto-Deploy auf die Zielplattform. **[BLOCKED: Plattformwahl offen]**

  **Harte Anforderung:** Europäisches Hosting, Server in der EU/Deutschland (Datenresidenz). Daher US-Anbieter (Fly.io, Railway) ausgeschlossen, auch wenn sie EU-Regionen anbieten. Engere Wahl: Hetzner (🇩🇪), Scaleway (🇫🇷), Netcup (🇩🇪), OVHcloud (🇫🇷). Tendenz: günstiger VPS via `docker compose`.

  Bis zur Plattformentscheidung: kein automatischer Deploy-Step. Stattdessen dokumentierter manueller Roll-out (`docker compose pull && docker compose --profile prod up -d` auf dem Zielserver) als Teil von `DOC-ENV-DEPLOY`. Sobald Plattform feststeht: entsperren und konkretisieren (bei VPS: GitHub Action → SSH → `docker compose pull && up -d`).

  **DoD (bei Entsperrung):** Push auf `main` → automatischer Deploy der neuen Version auf die EU-Zielplattform; Health-Check nach Deploy. **Risiko:** abhängig von Plattform.

### Priorität 3 — Vor Live-Gang (niedrig, aber laut Spec Multiplayer-Blocker)

- [ ] **VERIFY-MULTIPLAYER** — E2E-Verifikation Mensch-gegen-Mensch über mehrere unabhängige Sessions.

  `authentifizierung.md` nennt dies selbst den „Blocker für echten Multiplayer". Bestehende E2E testen v.a. Spiel gegen KI (`partie-gegen-ki.spec.ts`, `solo-spielfluss.spec.ts`, `reconnect.spec.ts`). Echtes Mensch-gegen-Mensch (mehrere reale Sessions/Logins an einem Tisch) ist bisher nicht als E2E abgedeckt.

  **Erste Datei zuerst:** `e2e/tests/` — neues Spec mit 2–4 unabhängigen Browser-Contexts (getrennte Sessions/Logins), die denselben Tisch betreten und eine Partie bis zur Auswertung durchspielen. Prüfen: Snapshot+Hint-Sync zwischen allen Clients, korrekte Sicht pro Spieler (keine fremden Hände sichtbar), Stichannahme reihum.

  **DoD:** grünes E2E mit ≥2 menschlichen Sessions an einem Tisch, eine Partie durchgespielt. Vor dem öffentlichen Live-Gang erledigen. **Risiko:** mittel (Test-Orchestrierung mehrerer Sessions).

### Priorität 4 — Produktreife & offene Entscheidungen (Session 30, Teil 2)

> User-Wunsch: diese Themen sollen **zuerst als Specs erfasst** werden, bevor implementiert wird. Jede Task produziert (auch) eine Spec.

- [ ] **SPEC-SQL-REVIEW** — Extrem kritisches Schema-/SQL-Review **vor** dem Aufbau der ersten echten DB.

  Greenfield (keine Migration nötig) → das Schema kann jetzt sauber gezogen werden, bevor produktiv Daten liegen. Hängt fachlich mit `BUG-PROD-CHANGELOG` zusammen (Changelog-Hygiene). Prüfen: Normalformen (3NF), Audit-Spalten (`erstellt_am`, `geaendert_am`, ggf. `erstellt_von` als `timestamptz`), Primär-/Fremdschlüssel + ON DELETE, Indizes (insb. Fremdschlüssel + Abfragepfade `tischId`/`partieId`/`spielerId`), Datentypen (UUID, `timestamptz` statt `timestamp`, `numeric` statt float für Punkte), NOT-NULL/CHECK-Constraints, Namenskonventionen, JSONB-Spalten (Validierung/GIN-Index sinnvoll?), Liquibase-Changelog-Konsolidierung (`archiv/` vs. aktiv).

  **Erste Datei zuerst:** `specs/datenbankmodell.md` — Review-Befunde + Soll-Schema dokumentieren. Daraus dann (eigene Build-Tasks) konsolidiertes Liquibase-Changelog. Gegen echtes Postgres 17 validieren (siehe `DEPLOY-COMPOSE-SMOKE`).

  **DoD:** `datenbankmodell.md` enthält reviewtes Soll-Schema mit Audit-Konzept + Index-/Constraint-Liste; offene Schema-Änderungen als nachgelagerte `REFACTOR-DB-…`-Tasks. **Risiko:** mittel-hoch (Schema ist Fundament).

- [ ] **OPS-GRAFANA-MONITORING** — Monitoring via Grafana Cloud (Free-Tier).

  Spring Boot Actuator + Micrometer → Prometheus-Endpoint → Grafana Cloud (Free: Metriken/Logs/Traces). Free-Account vorhanden.

  **Erste Datei zuerst:** neue `specs/betrieb-monitoring.md` (Was wird überwacht: JVM, HTTP-Latenzen, aktive Tische/Partien, WS-Verbindungen, Fehlerrate; welche Dashboards/Alerts). Dann Build-Tasks: `micrometer-registry-prometheus` ins `pom.xml`, `/actuator/prometheus` exponieren (gesichert), Grafana Alloy/Agent als Sidecar im `docker-compose.yml` zum remote_write an Grafana Cloud (Token via ENV, kein Secret im Repo).

  **DoD:** Spec beschreibt Monitoring-Konzept; (Build) Metriken erscheinen im Grafana-Cloud-Dashboard. **Risiko:** niedrig-mittel.

- [ ] **OPS-DOMAIN** — Domain + DNS + TLS für den öffentlichen Betrieb.

  Wird gebraucht: OAuth2-Redirect-URI, `cookie.secure=true` (erzwingt HTTPS), `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS`. prod-Props referenzieren bereits beispielhaft `locodoko.de`.

  **Erste Datei zuerst:** Abschnitt in `DOC-ENV-DEPLOY`/README bzw. `specs/betrieb-monitoring.md`-Nachbarspec: Domain wählen+registrieren (EU-Registrar), DNS auf den Server zeigen, TLS via Reverse-Proxy (Caddy/Traefik + Let's Encrypt) vor der App, HTTP→HTTPS-Redirect. OAuth-Redirect-URI + WS-Origins auf die finale Domain setzen.

  **DoD:** Domain zeigt per HTTPS auf die App, OAuth-Redirect + WS-Origins konfiguriert. **Risiko:** niedrig. **[teilw. abhängig von Plattformwahl]**

- [ ] **DOC-DOCS-SITE** — Öffentliche Docs-/Wiki-Seite (zugleich LLM-tauglich, Karpathy-Stil).

  Zweck: Menschen außerhalb des GitHub-Kontexts sollen das Projekt verstehen/„lernen" können; gleichzeitig LLM-freundlich (eindeutige Begriffe, flache Hierarchie, explizite Querverweise, optional `llms.txt`/generiertes Bundle). Die ~47 Markdown-Specs liegen bereits passend vor.

  **Empfehlung:** **MkDocs Material** (geringste Reibung — rendert die vorhandenen `specs/*.md` direkt, Volltextsuche, GitHub-Pages-Deploy). Alternativen: Docusaurus, Astro Starlight. Framework final offen.

  **Erste Datei zuerst:** `mkdocs.yml` im Root (Navigation aus `specs/README.md` ableiten) — oder zuerst Konzept in neuer `specs/docs-site.md`. Karpathy-Prinzipien anwenden; den Code-Metrik-Report aus `QA-CODE-METRICS` als eigene Seite einbinden.

  **DoD:** Docs-Seite baut lokal + als GitHub-Pages-Deploy; alle Specs navigierbar/durchsuchbar. **Risiko:** niedrig.

- [ ] **QA-CODE-METRICS** — Codebase mit Mess-/Analyse-Tooling vermessen: Refactoring-Kandidaten + Report für die Docs-Seite.

  Ziel: Größe, Komplexität, Duplikate, Coverage, Architektur sichtbar machen → konkrete `REFACTOR-…`/`FE-…`-Tasks ableiten **und** einen schönen Report fürs Wiki erzeugen.

  **Werkzeuge (Vorschlag):**
  - Größe/Sprachen: `scc` (oder `cloc`) — LOC, Komplexitätsindex, COCOMO.
  - Java: JaCoCo (Coverage), SpotBugs, PMD (zykl. Komplexität), Checkstyle. Architektur: Spring-Modulith-Modularity-Tests / `jdeps` / ArchUnit.
  - TS/Frontend: ESLint (vorhanden) + Komplexitätsregeln, `knip`/`ts-prune` (toter Code), `madge` (zyklische Abhängigkeiten + Graph), `depcheck` (ungenutzte Deps).
  - Cross-Language: `lizard` (Komplexität). Gesamtbild: **SonarQube Community** (lokal via Docker) oder **SonarCloud** (frei für öffentliche Repos) — Maintainability, Duplikate, Tech-Debt, Hotspots in einem Dashboard.

  **Erste Datei zuerst:** Tooling als Skript-Target (z.B. `scripts/metrics.sh`) + pom-Plugins; Ergebnis als Markdown/HTML-Report unter `docs/` für die Docs-Seite. Refactoring-Befunde als neue Tasks unter „Entdeckungen".

  **DoD:** reproduzierbarer Metrik-Report erzeugt + in Docs-Seite eingebunden; mind. die Top-Refactoring-Kandidaten als Tasks erfasst. **Risiko:** niedrig (additiv, kein Produktivcode-Change).

- [ ] **FE-UI-FINAL-REVIEW** — Finales UI/UX-Review; „nicht schöne" Stellen katalogisieren.

  User empfindet viele UI-Details als unschön. Systematisch erfassen statt punktuell fixen.

  **Erste Datei zuerst:** Vision-Loop über alle Spielzustände laufen lassen (`cd e2e && npx playwright test --config=playwright.config.vision.ts`), Screenshots in `e2e/screenshots/` einlesen und gegen `specs/frontend-visuelles-design.md` prüfen. Befunde als priorisierte `FE-…`-Einzeltasks unter „Entdeckungen" eintragen (Spacing, Farben, Typografie, Alignment, Animationen).

  **DoD:** Katalog konkreter UI-Mängel als Tasks; `frontend-visuelles-design.md` bei Bedarf präzisiert. **Risiko:** niedrig.

- [x] **DECISION-AUTH** — **Entschieden (Session 30): beide Methoden behalten** (Google OAuth2 + Username/Passwort/bcrypt). `authentifizierung.md` ist damit konsistent, kein Code-Change nötig.

- [ ] **SPEC-RECHT** — Rechtstexte für öffentlichen Betrieb in DE (Pflicht-Voraussetzung für Live-Gang).

  Für einen öffentlich betriebenen Dienst in Deutschland gesetzlich erforderlich: **Impressum** (§5 DDG), **Datenschutzerklärung** (DSGVO — Accounts, Google-OAuth-Datenfluss, Statistiken). **AGB/Nutzungsbedingungen** empfohlen (Haftung, Verhaltensregeln, Account-Sperrung).

  **Erste Datei zuerst:** neue `specs/recht-impressum-datenschutz.md` — Inhalte/Pflichtangaben skizzieren (Impressum-Felder, verarbeitete Datenarten, Rechtsgrundlagen, Drittland-Hinweis Google-OAuth, Lösch-/Auskunftsrechte). Dann Build-Task: Frontend-Seiten/Footer-Links (`/impressum`, `/datenschutz`, `/agb`). **Hinweis:** konkrete Rechtstexte ggf. anwaltlich/Generator prüfen — die Spec definiert nur Struktur & Pflichtangaben.

  **DoD:** Spec mit Pflichtangaben vorhanden; (Build) Seiten verlinkt und erreichbar. **Risiko:** niedrig (Inhalt), rechtlich relevant.

- [ ] **OPS-EMAIL** — Email-Versand für Registrierungs-Verifizierung + Passwort-Reset (V2).

  Aktuell keine Email-Infra. Auth-Spec stellt Email optional, Passwort-Reset V2. Bei Bedarf: EU-Transaktionsmail-Anbieter mit Free-Tier (Brevo 🇫🇷, Mailjet 🇫🇷) oder SMTP. Kein Launch-Blocker, aber sinnvoll gegen Fake-Accounts.

  **Erste Datei zuerst:** `authentifizierung.md` — Abschnitt „Email-Verifizierung & Passwort-Reset (V2)" konkretisieren (Anbieterwahl EU, Double-Opt-In, Reset-Token-Ablauf). Dann Build-Tasks (Spring Mail / Anbieter-API, ENV-Secrets).

  **DoD:** Spec definiert Email-Flows + EU-Anbieter; (Build) Verifizierungs-/Reset-Mail wird versendet. **Risiko:** niedrig-mittel. **[Priorität niedrig — kein Launch-Blocker]**

- [ ] **DECISION-LIZENZ** — Projektlizenz festlegen + `LICENSE`-Datei anlegen. **[WARTET AUF USER-ENTSCHEIDUNG — bewusst aufgeschoben]**

  Tendenz Apache-2.0. **Aber:** User erwägt evtl. spätere Steam-/kommerzielle Veröffentlichung. **Zielkonflikt:** Eine permissive Lizenz (Apache/MIT) erlaubt jedem — auch Dritten — das Spiel nachzubauen und kommerziell (auch auf Steam) zu vertreiben, was einer eigenen bezahlten Veröffentlichung den Boden entziehen kann. Wer kommerzielle Verwertung offenhalten will, wählt eher **proprietär** oder **AGPL-3.0** (Copyleft hält Klone offen, erlaubt aber Dual-Licensing). Entscheidung an anderer Stelle, wenn Steam-Frage geklärt ist.

---

## Offene Aufgaben (Spec-getriebene Tasks — alle erledigt)

### Priorität 1 — Doku-Hygiene (klein, risikoarm)

- [x] **DOC-PUNKTE-HINWEISE** — `specs/punkteberechnung.md` „Technische Hinweise" an den Code angleichen.

  Die Spec nennt unverbindlich `PunkteRechner.berechneErgebnis(Spiel) → SpielErgebnis`. Real: `PunkteRechner.berechneNormalspielErgebnis(stiche, parteien, trumpfOrdnung, ansagen, spielregeln) → Spielergebnis` (reine Funktion, kein `Spiel`-Parameter). Die normativen Anforderungen 1–20 sind korrekt umgesetzt — nur die Hinweise driften.

  **Erste Datei zuerst:** `specs/punkteberechnung.md`, Abschnitt „Technische Hinweise" (Z. ~89–96): Methodensignatur + Rückgabetyp korrigieren, Klassennamen `SpielErgebnis` → `Spielergebnis`.

  **DoD:** `grep -rn "berechneErgebnis\|SpielErgebnis\b" specs/punkteberechnung.md` liefert nichts Veraltetes mehr; Hinweise stimmen mit `PunkteRechner.java` überein. Kein Code-Change → keine Tests, nur `grep`-Konsistenzcheck.

- [x] **SPEC-ARCH-HIERARCHIE** — Eindeutige Hierarchie der Architektur-Specs herstellen.

  Es existieren sechs `architektur*.md`; vier tragen Status „Aktive Vorgabe / Kritisch". `architektur-unified.md` („Unified Architecture") überlappt inhaltlich stark mit `architektur.md` (Snapshot+Hint, DB-as-Source-of-Truth, `@Version`) — der Name suggeriert fälschlich, *es* sei kanonisch, während `architektur.md` der „Kompass" ist.

  **Erste Datei zuerst:** `specs/architektur.md` — Status-Feld auf „Aktive Vorgabe — Single Source of Truth" präzisieren; im Detail-Specs-Block klar benennen, welche Dokumente reine Detail-Specs sind. Dann in `architektur-unified.md`, `architektur-domain-events.md`, `architektur-spielkern.md` die Status-Zeile auf „Detail-Spec (konsolidiert in architektur.md)" setzen (analog zu `architektur-ddd.md`); in `architektur-unified.md` die mit `architektur.md` redundanten Passagen auf Verweise kürzen.

  **DoD:** Genau ein Architektur-Dokument trägt Status „Single Source"; alle übrigen „Detail-Spec". `specs/README.md` bleibt konsistent (`grep -n "architektur" specs/README.md` prüfen). Kein Code-Change.

- [x] **DOC-AGENTS-DEDUP** — Doppelpflege von `CLAUDE.md`/`AGENTS.md` beenden.

  `CLAUDE.md` und `AGENTS.md` sind byte-identisch (`diff` leer) und werden bei jedem Build-Commit beide getrackt → Drift-Quelle. `GEMINI.md` weicht inhaltlich ab und bleibt eigenständig.

  **Erste Datei zuerst:** `AGENTS.md` durch einen Git-Symlink auf `CLAUDE.md` ersetzen (`ln -sf CLAUDE.md AGENTS.md`), sodass nur noch eine Quelle gepflegt wird. Prüfen, dass alle Verweise (`PROMPT_build.md` referenziert `AGENTS.md`) weiterhin auflösen.

  **DoD:** `readlink AGENTS.md` → `CLAUDE.md`; `diff CLAUDE.md AGENTS.md` leer; `git status` zeigt AGENTS.md als geänderten Symlink. Kein Test, nur Konsistenzcheck.

### Priorität 2 — Code-Qualität

- [x] **REFACTOR-SAGEAN** — Einrückung + Extraktion in `Spiel.sageAn`.

  Im `try`-Block von `Spiel.sageAn` (≈ Z. 414–433) ist `Ansagen neueAnsagen = …` eingerückt, die folgenden Anweisungen springen auf Methoden-Ebene zurück — funktional korrekt, aber irreführend. Der Pflichtansage-Abzug (Z. ~418–425) gehört in eine eigene private Methode.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/partie/Spiel.java`, Methode `sageAn` — Block konsistent einrücken, Pflichtansage-Logik in private Methode (z.B. `entferneErfuellteGrundansagePflicht(Set<Partei>, SpielerPosition)`) auslagern.

  **DoD:** Einrückung korrekt, neue private Hilfsmethode, Verhalten unverändert; `cd /home/agent/workspace && mvn test` grün.

### Priorität 3 — Refactorings (mittel, je eigene Iteration)

- [x] **REFACTOR-JSONB-CONVERTER** — Boilerplate in `JsonbConverter.java` (1131 Z.) reduzieren. **Realisiert:** Dead-Code-Entfernung — 14 ungenutzte Converter (rohe `Map`/`List`/`Set` aus der Prä-VO-Zeit, durch die VO-Wrapper ersetzt, nirgends registriert) + 5 tote Tests gelöscht → 1131 → 917 Z. Eine zusätzliche generische Basisklasse für die verbleibenden 60 (registrierten) Converter ist optional und niedrig priorisiert (Spring-Typauflösung via konkrete Subklassen nötig).

  Pro Domänentyp existieren ~3 nahezu identische Converter-Klassen (`…SchreibConverter` / `…LeseConverter`(PGobject) / `…StringLeseConverter`(String)) über ~12 Typen ⇒ ~36 Klassen mit gleichem Rumpf (`toJsonString` / `fromPGobject` / `fromString`).

  **Erste Datei zuerst:** `src/main/java/de/locodoko/tisch/persistenz/JsonbConverter.java` — generische Basisklassen einführen (`JsonbSchreibConverter<T>`, `JsonbPGobjectLeseConverter<T>`, `JsonbStringLeseConverter<T>` mit `ObjectMapper` + `JavaType`/`TypeReference<T>`). Zuerst EINEN Typ (z.B. `Stich`) umstellen, Roundtrip-Test grün, dann sukzessive die übrigen; Registrierung über eine Typliste statt Einzelklassen.

  **DoD:** Datei deutlich < 1131 Z., keine Verhaltensänderung. `PartieStandAntwortWireFormatTest` + alle JSONB-Roundtrip-Tests + `mvn test` grün. **Risiko:** mittel — pro Typ ein Schritt, Tests zwischen jedem Schritt.

- [x] **BUG-JACKSON-ACCESSORNAMING** — Clean-Build repariert (vorbestehend, beim TischZugriff-Refactor entdeckt).

  `JsonbConverter.NurEchteIsGetterStrategie(Provider)` (aus REFACTOR-DOMAIN-6) kompilierte nicht gegen Jackson 2.21.2: `DefaultAccessorNamingStrategy` hat keinen no-arg-Konstruktor mehr, und `Provider.forDeserialization/forSerialization` existieren nicht. `mvn clean compile` war gebrochen — maskiert dadurch, dass `mvn test` inkrementell eine veraltete `.class` aus `target/` wiederverwendete. **Fix:** Provider auf `AccessorNamingStrategy.Provider` (forPOJO/forBuilder/forRecord) umgestellt, Strategie delegiert an die Standardstrategie und überschreibt nur `findNameForIsGetter`. `mvn clean test` grün.

- [x] **REFACTOR-TISCH-ZUGRIFF** — Geteilte Lade-/Guard-Helfer in `@Component TischZugriff` extrahiert (VORTASK für die Konfig-Extraktion).

  `ladeTischEntity`, `ladeTischEntityMitSperre`, `ladeSpieler`, `pruefeWartendenTisch` aus `TischVerwaltungsService` (542 → 508 Z.) in `TischZugriff` (63 Z.) gezogen. **Bonus:** `SpielAktionsService` hatte eigene Duplikate von `ladeTischEntity`/`ladeSpieler` — ebenfalls auf `TischZugriff` umgestellt, die verwaiste `spielerRepository`-Dependency entfernt. Test-Spy `SpionTischVerwaltungsService` an neuen Konstruktor angepasst. `mvn clean test` grün.

- [x] **REFACTOR-TISCHVERWALTUNG** — `TischVerwaltungsService` (jetzt 508 Z.) weiter aufteilen (Konfiguration extrahieren).

  **Vorbedingung erfüllt:** `REFACTOR-TISCH-ZUGRIFF` ist erledigt — die geteilten Helfer liegen jetzt in `TischZugriff`, eine Konfig-Extraktion dupliziert daher nichts mehr.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/tisch/TischVerwaltungsService.java` — `ladeKonfiguration`, `aktualisiereKonfiguration`, `gibPresets` → neuer `TischKonfigurationsService` (Deps: `TischZugriff`, `TischRepository`, `TischEchtzeitService`; für die Liste-Aktualisierung `listeOffeneTische()` wiederverwenden). Aufrufer in `TischController` (Z. 66, 219, 244) umstellen. Pro Extraktion ein Commit + `mvn clean test`.

  **DoD:** Jede resultierende Klasse ≤ ~300 Z.; alle Aufrufer angepasst; `cd /home/agent/workspace && mvn clean test` grün. **Risiko:** mittel.

### Abschluss-Verifikation — visueller Smoke-Test (autonom)

- [x] **VISION-SMOKE-1** — Visueller End-to-End-Smoke-Test über die Vision-Loop (ersetzt den früheren manuellen `SMOKE-UI-1`).

  Screenshottet die wichtigsten Spielzustände automatisiert und headless — kein User/Browser nötig.

  **Schritte:**
  1. Backend starten (serviert das eingebaute Frontend auf :8081): im Projektroot `mvn spring-boot:run` im Hintergrund; warten bis `curl -s http://localhost:8081/actuator/health` „UP" liefert. (Falls das Frontend nicht mitgebaut ist: vorher `cd frontend && npm run build`.)
  2. Vision-Loop headless ausführen: `cd e2e && npx playwright test --config=playwright.config.vision.ts`.
  3. Alle erzeugten Screenshots in `e2e/screenshots/` mit dem Read-Tool einlesen und visuell prüfen (Positionen, Überlappungen, Alpha-Werte, fehlende Elemente, Texte).
  4. Backend-Prozess wieder stoppen.

  **DoD:** Vision-Loop läuft grün durch; alle Screenshots visuell ohne Defekt befunden. Etwaige visuelle Mängel als neue `BUG-…`-Tasks unter „Entdeckungen" eintragen (im selben Lauf nicht fixen — der Plan-/Build-Modus arbeitet sie als eigene Tasks ab).

---

## Entdeckungen (Gesamt-Review Session 26, 2026-05-29)

Siehe vollständigen Bericht `specs/review-2026-05-28.md`. Bestätigte, **nicht** als akute Tasks geführte Befunde:

### Visuelle Mängel aus VISION-SMOKE-1 (Session 28, 2026-06-01)

- [x] **BUG-EINSTELLUNGEN-MODAL** — `08-einstellungen-modal.png` ist visuell identisch mit `07-seitenlade-offen.png`; das Einstellungen-Modal öffnet sich nach `s`-Tastendruck nicht sichtbar.

  Gefunden im Vision-Loop. Der Test drückt `s` nach dem Schließen der Seitenlade (`i`-Toggle), wartet 1000ms und screenshottet — aber das Modal erscheint nicht. Mögliche Ursachen: (a) Fokus liegt nach Seitenlade-Schließen nicht mehr auf dem Canvas, sodass der Tastendruck nicht ankommt; (b) das Einstellungen-Modal hat kein eigenes Render-Element oder rendert hinter anderen Ebenen.

  **Erste Datei zuerst:** `e2e/tests/vision-loop.spec.ts` — vor `page.keyboard.press('s')` ein `await page.locator('canvas').focus()` einfügen. Falls das Modal danach erscheint: nur Timing-Bug im Test. Falls nicht: `frontend/src/szenen/TischSzene.ts` nach dem Einstellungen-Key-Handler durchsuchen.

  **DoD:** `08-einstellungen-modal.png` zeigt ein sichtbares Settings-Overlay; Test bleibt grün.

- [x] **BUG-LOBBY-TISCHEINTRAG** — In `01-lobby.png` / `11-offene-tische.png`: Tischeintrag-Text „Schnellstart von Spieler…" wird abgeschnitten und überlappt mit dem „Beitreten"-Button; Spieler-ID-Zahl rendert nicht vollständig.

  Der Tischlisten-Eintrag zeigt den Namen linksbündig und den „Beitreten"-Button rechtsbündig, aber die Breite des Textfeldes überschreitet die Spaltenbreite. Könnte ein fehlendes `clip`/`overflow: hidden` oder eine falsch berechnete Zeilenbreite in `SpielverwaltungsSzene.ts` sein.

  **Erste Datei zuerst:** `frontend/src/szenen/SpielverwaltungsSzene.ts` — Tischlisten-Render-Methode (`renderTischListe`) auf Text-Breite und Clipping prüfen.

  **DoD:** Tischeintrag zeigt vollständige, nicht überlappende Texte; `01-lobby.png` + `11-offene-tische.png` ohne Overflow.

### Klassengrößen über Richtwert (~300 Z.) — beobachten, kein akuter Rückstand

| Klasse | Zeilen | Hinweis |
|---|---|---|
| `JsonbConverter.java` | 917 | REFACTOR-JSONB-CONVERTER erledigt (Dead-Code entfernt); optionale Generik offen |
| `TischVerwaltungsService.java` | 508 | → REFACTOR-TISCHVERWALTUNG (Konfig-Extraktion) |
| `PartieStandAntwort.java` | 529 | durch >10 nested Wire-Format-DTOs begründet — kein Rückstand |
| `Spiel.java` | 526 | Domain-Komplexität, REFACTOR-DOMAIN erledigt |
| `StandardKiStrategie.java` | 504 | bei Bedarf |
| `Partie.java` | 452 | bei Bedarf |

### Keine Befunde (geprüft, konsistent)
- Modulgrenzen: keine verbotenen Imports zwischen `karten`/`partie`/`ki`/`spieler`/`tisch`.
- Spielkern: `PunkteRechner` (Re≥121/Kontra≥120, Ansagen ×2/×4, Absagen, Gegen-die-Alten, Solo ×3, Nullsumme), `Stich` (Trumpf-/Fehl-/Dullen-Logik) regelkonform.
- Point Provenance: korrekt im Wire-DTO `PartieStandAntwort` (`PunkteKomponenteAntwort[]`).
- Keine TODO/FIXME/`System.out`/`printStackTrace` im Produktivcode.

---

## Build-Modus-Leitfaden (gilt für alle Tasks)

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis.
2. **Pro Task ein Commit.** Keine Bündelung mehrerer Tasks in einem PR.
3. **Bei Unklarheit: kleinste Änderung + `mvn clean test`.** Nicht spekulativ refaktorieren. (`clean` ist Pflicht — inkrementelle Builds maskieren Compile-Brüche durch veraltete `target/`-Klassen.)
4. **Tests müssen vor jedem Commit grün sein.** Bei Bruch: ROLLBACK des aktuellen Versuchs, Wurzelursache verstehen, neu ansetzen.
5. **Pure-JUnit-Tests bleiben pure JUnit.** `@SpringBootTest` darf NICHT zu einer Test-Klasse hinzugefügt werden, die heute ohne läuft.
6. **VO bleibt VO wo möglich:** Postgres JSONB + Custom Converter ermöglichen immutable VOs.
7. **Greenfield-Annahme:** Keine Datenmigration nötig.
8. **Spec-Konsultation:** Bei jedem Task der Specs anpasst: `grep -rn "<altes Konzept>" specs/` als Verifikations-Schritt.

## Stoppregeln für Build-Modus

- **Test-Suite bricht und in 3 Versuchen nicht reparierbar**: Stoppen, Iteration abbrechen, Notiz unter „Entdeckungen". Nicht stapeln.
- **Unklar zwischen Optionen**: Die kleinere/risikoärmere Option wählen.
- **Niemals**: `--no-verify`, `git push --force` ohne explizite User-Anweisung, Tests `@Disabled` ohne Notiz.
