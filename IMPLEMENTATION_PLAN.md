# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-29 (Plan-Überarbeitung nach Gesamt-Review). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 35 (2026-06-02) — SPEC-RECHT abgeschlossen:** `specs/recht-impressum-datenschutz.md` angelegt. Enthält: Impressum-Pflichtangaben (§5 DDG), vollständige Datenschutzerklärung-Struktur (DSGVO Art. 13/14 — alle DB-Felder aufgeschlüsselt, Google-OAuth2-Drittland-Transfer, Betroffenenrechte, Speicherdauer, Hosting-Datenresidenz), AGB-Mindeststruktur, Checkliste vor M2, konkrete Build-Tasks (Frontend-Seiten `/impressum`/`/datenschutz`/`/agb`, Footer-Links, AVV). Keine Code-Änderung nötig (DOC-Task). Nächste autonome Tasks: DOC-DOCS-SITE, QA-CODE-METRICS oder SECURITY-REVIEW (Skill verfügbar).

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

Nächste offene Tasks — Fertigstellung (Session 30). **Zwei Meilensteine:** **M1 = Closed Beta auf `zock.locodoko.de`** (eingeladene Kollegen, Feedback sammeln) · **M2 = Public Go-Live**.

**Domain-Schema (Session 30, Teil 4 — sticky, da OAuth/Cookies/WS daran gebunden):** App = **`zock.locodoko.de`** · Wiki = **`docs.locodoko.de`** (MkDocs auf GitHub Pages, gratis) · Apex **`locodoko.de`** = Landing/Redirect. Permanente Wahl (kein „beta."-Umzug), da Beta-Daten erhalten bleiben.

**Beta-Entscheidungen (Session 30, Teil 3+4):** Daten **erhalten** → Schema final + Backups **vor** M1; Zugang via **`zock.locodoko.de`** (Domain+TLS); **Google OAuth aktiv**. Damit ist M1 faktisch ein **erster echter Deploy**. Weiter (Teil 4): **EU-Ops pragmatisch** (Grafana/Sentry mit EU-Region + AVV ok, kein Self-Hosting nötig); **Beta nicht gated** (kein Site-Gate, kein SEO/noindex-Fokus → `BETA-ACCESS` optional); **Sessions persistieren** (`spring-session-jdbc`) + **Build-Info** (`/actuator/info`); Admin-Tooling + Rollback-Doku **erwogen, zurückgestellt**. **Auth bleibt Google + Username/Passwort** — „Sign in with Apple" verworfen (99 €/Jahr + JWT-Rotation für reine UX; Apple-Nutzer können Google im Safari nutzen). Passwort-Reset/`OPS-EMAIL` **zurückgestellt** → Fallback in der Beta: manueller Reset durch Betreiber. Mobile: nominell M2 — **aber Freunde auf iPhone → Beta wird vermutlich mobil/Safari getestet** (Re-Evaluierung empfohlen).

**Meilenstein 1 — Closed Beta (`zock.locodoko.de`, eingeladene Kollegen, Daten erhalten).**
**Loop-Hinweis:** Ralph arbeitet **Block A** strikt der Reihe nach ab (alles autonom verifizierbar via `mvn`/`npm`). **Block B** trägt `Vorbedingung: MENSCH` — diese Tasks **überspringen**, bis die externe Voraussetzung (Server/Domain/Google-Account) erfüllt ist.

**Block A — Ralph-autonom (sofort, ohne externe Voraussetzung):**
1. **BUG-PROD-CHANGELOG** (P0) — App bootet gegen Postgres
2. **SPEC-SQL-REVIEW** — Schema final + Changelog-Konsolidierung. **Gate (Daten bleiben erhalten!).** (Schema-Entscheidungen: Mensch sollte gegenlesen — kein Loop-Blocker.)
3. **SESSION-PERSISTENZ** — `spring-session-jdbc`, damit Redeploys Kollegen nicht ausloggen
4. **OPS-COMPOSE-HARDENING** — `app`-Service restart-Policy + Healthcheck
5. **OPS-BUILD-INFO** — `/actuator/info` mit Git-SHA/Version (klein)
6. **BACKUP-DB** — Backup-/Restore-**Skript** + Doku (echter Restore-Drill auf Server = Mensch, kein Loop-Blocker)
7. **DEPLOY-OAUTH-SENTINEL** — Code: Google-Login nur bei gesetzten Credentials (Code autonom; echte Credentials = Block B)
8. **DOC-ENV-DEPLOY** — `.env.example` + README-Roll-out (echte Secret-Werte = Mensch)
9. **FEAT-FEEDBACK** — leichter „Feedback geben"-Link/Form (Log/Datei; Webhook-URL = Mensch falls Discord)

**Block B — Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt):**
10. **OAuth-Credentials** — *Vorbedingung: MENSCH* (Google Cloud Console: Client-ID/Secret + Redirect-URI `zock.locodoko.de`)
11. **OPS-DOMAIN** — *Vorbedingung: MENSCH* (Server/DNS/TLS) — Ralph kann nur die Reverse-Proxy-Config vorbereiten
12. **DEPLOY-COMPOSE-SMOKE** — *Vorbedingung: MENSCH* (Docker + echtes Postgres laufen lassen)
13. **CD-DEPLOY (manuell)** — *Vorbedingung: MENSCH* (Server, SSH, Plattformwahl hosting.de)
- *Empfohlen für M1:* OPS-GRAFANA-MONITORING + OPS-LOGS-LOKI (Instrumentierung autonom; Grafana-Cloud-Token = Mensch); minimaler Datenschutzhinweis; SECURITY-REVIEW vor Exposition.
- *Optional/zurückgestellt:* BETA-ACCESS (Beta muss nicht gated sein), Admin-Tooling, Rollback-Doku.

**Meilenstein 2 — Public Go-Live:**
- **SPEC-RECHT** (Impressum + Datenschutz Pflicht + AGB) · **SECURITY-REVIEW** · **CI/CD automatisiert** (CI-BUILD-TEST → CI-DOCKER-BUILD → CD-DEPLOY) · **VERIFY-MULTIPLAYER** · **FE-SPIELREGELN-HILFE** (Onboarding, da DoKo komplex) · **FEAT-BUGREPORT** (voll) · **DOC-DOCS-SITE** · **QA-CODE-METRICS** · **FE-UI-FINAL-REVIEW** · **FE-MOBILE** (Touch/Portrait) · **OPS-EMAIL** · **DECISION-LIZENZ**

Entscheidungen: **DECISION-AUTH** ✓ beide behalten · **DECISION-LIZENZ** aufgeschoben (Steam-Frage offen, Tendenz Apache vs. proprietär/AGPL)

---

## Fertigstellung — Öffentlicher Betrieb (Session 30, 2026-06-01)

> Ziel: Locodoko öffentlich betreiben (günstiges Hosting, Tendenz VPS via docker-compose; Plattform final offen). Fokus Deployment & Ops + CI/CD. Reihenfolge verbindlich: erst Deploy-Blocker, dann verifizierter Stack, dann CI/CD.

### Priorität 0 — Deploy-Blocker (verifizierter Bug)

- [x] **BUG-PROD-CHANGELOG** — prod-Profil referenziert eine nicht existierende Liquibase-Changelog-Datei.

  `application-prod.properties` Z. 5: `spring.liquibase.change-log=classpath:db/changelog/db.changelog-baseline.yaml`. Diese Datei existiert nur unter `db/changelog/archiv/db.changelog-baseline.yaml` (archiviert), **nicht** am referenzierten Pfad. Das dev-Profil nutzt korrekt `classpath:db/changelog/db.changelog-master.yaml` (existiert, inkludiert `000-initial-schema.sql`). Folge: Im prod-Profil scheitert die Liquibase-Initialisierung beim Start → App bootet nicht gegen Postgres. Dieser Pfad wurde mangels CI/verifiziertem Deploy nie real ausgeführt.

  **Erste Datei zuerst:** `src/main/resources/application-prod.properties` Z. 5 — auf `classpath:db/changelog/db.changelog-master.yaml` umstellen (identisch zu dev). **Achtung H2 vs. Postgres:** dev läuft H2 im PostgreSQL-Modus, prod echtes Postgres 17. Verifizieren, dass `000-initial-schema.sql` ohne H2-spezifische Syntax gegen echtes Postgres durchläuft (siehe `DEPLOY-COMPOSE-SMOKE`). Falls Postgres-Inkompatibilität auftritt: dialektspezifisches Changeset statt blindem Umbiegen.

  **DoD:** prod-Profil zeigt auf eine existierende Changelog-Datei; `grep -rn "baseline" src/main/resources/application-prod.properties` leer; App startet im prod-Profil gegen Postgres und migriert sauber (Nachweis via `DEPLOY-COMPOSE-SMOKE`). **Risiko:** mittel (SQL-Dialekt).

### Priorität 1 — Deployment & Ops

- [ ] **DEPLOY-COMPOSE-SMOKE** — Vollen prod-Stack lokal hochfahren und eine Partie durchspielen. **[Vorbedingung: MENSCH — Docker + echtes Postgres; hängt an BUG-PROD-CHANGELOG. Ralph: überspringen, nicht autonom abschließbar]**

  Vorhandene Bausteine: `docker-compose.yml` (Services `postgres` + `app`, Profil `prod`, ENV-Wiring inkl. `LOCODOKO_DB_*`/`GOOGLE_CLIENT_*`), `Dockerfile.app` (Multi-Stage: `mvn package` baut Frontend ein → schlankes JRE-Image). Bislang nie real verifiziert.

  **Schritte:** 1. `docker compose --profile prod up --build -d`. 2. Warten bis `postgres` healthy + `curl -s http://localhost:8081/actuator/health` „UP". 3. Liquibase-Migration im App-Log prüfen (keine Fehler). 4. Im Browser/E2E eine Partie gegen KI bis zur Auswertung durchspielen. 5. Stack wieder runterfahren.

  **DoD:** prod-Stack startet reproduzierbar, Health UP, eine Partie läuft bis Auswertung durch. Etwaige Fehler als eigene `BUG-…`-Tasks. **Risiko:** mittel.

- [x] **DOC-ENV-DEPLOY** — `.env.example` + README für öffentlichen Betrieb vervollständigen.

  `.env.example` enthält aktuell nur `GH_TOKEN` (Agent-Container), nicht die von `docker-compose.yml`/prod erwarteten Variablen. README ist auf Devmode-Stichworte beschränkt.

  **Erste Datei zuerst:** `.env.example` — ergänzen: `LOCODOKO_DB_USERNAME`, `LOCODOKO_DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS` (mit Kommentaren/Beispielwerten). Dann `README.md` — Abschnitt „Öffentlicher Betrieb": JAR-Build (`mvn clean package`), Start via `docker compose --profile prod up -d`, Google-OAuth2 einrichten (Redirect-URI `https://<domain>/login/oauth2/code/google`), HTTPS/Reverse-Proxy-Hinweis wegen `server.servlet.session.cookie.secure=true`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS` auf die Domain setzen.

  **DoD:** `.env.example` deckt alle prod-ENV ab; README erklärt einen Deploy von Null. Kein Code-Change, kein Test.

- [x] **DEPLOY-OAUTH-SENTINEL** — „Mit Google anmelden" nur anzeigen/aktiv, wenn OAuth2 konfiguriert ist (klein, optional).

  `application.properties` Z. 19–20 setzt `client-id/secret` auf Default-Sentinel `disabled`. Ohne echte Credentials registriert Spring trotzdem einen Google-Client mit ID „disabled" → ein „Login mit Google"-Button liefe ins Leere. Passwort-Login funktioniert unabhängig.

  **Erste Datei zuerst:** `src/main/java/de/locodoko/spieler/SecurityConfig.java` — OAuth2-Login nur registrieren, wenn `GOOGLE_CLIENT_ID` ≠ `disabled`/leer (z.B. `@ConditionalOnProperty` oder bedingte `ClientRegistrationRepository`-Bean). Frontend-Login-Button entsprechend ausblenden, wenn Provider fehlt.

  **DoD:** Ohne gesetzte Google-Credentials startet die App, zeigt keinen Google-Button und Passwort-Login funktioniert; mit Credentials erscheint der Button. Bestehende Auth-Tests grün. **Risiko:** niedrig.

### Priorität 2 — CI/CD (volle Pipeline)

- [x] **CI-BUILD-TEST** — GitHub Actions Workflow für Build + Tests bei jedem Push/PR auf `main`.

  Aktuell kein `.github/workflows/`. Bei agentengetriebenem Workflow fängt nichts rote Builds ab.

  **Erste Datei zuerst:** `.github/workflows/ci.yml` — Job `backend`: Temurin 25 (siehe `Dockerfile.app`), `mvn clean verify`. Job `frontend`: Node 22, `cd frontend && npm ci && npm test && npm run build && npm run lint`. Trigger: `push`/`pull_request` auf `main`. Caching für Maven + npm.

  **DoD:** Workflow läuft auf GitHub grün durch (beide Jobs). Badge optional in README. **Risiko:** niedrig.

- [ ] **CI-DOCKER-BUILD** — Produktions-Image bauen und in GHCR pushen. **[hängt an CI-BUILD-TEST, DEPLOY-COMPOSE-SMOKE]**

  **Erste Datei zuerst:** `.github/workflows/ci.yml` erweitern (oder `release.yml`) — Job baut `Dockerfile.app`, taggt mit Commit-SHA + `latest`, pusht nach `ghcr.io/<owner>/locodoko` (nur auf `main`/Tag, via `GITHUB_TOKEN`/`packages: write`).

  **DoD:** Nach Push auf `main` liegt ein lauffähiges Image in GHCR; lokal `docker run` startet die App (gegen externe Postgres-ENV). **Risiko:** niedrig.

- [ ] **CD-DEPLOY** — Auto-Deploy auf die Zielplattform. **[BLOCKED: Plattformwahl offen + Voraussetzungen SPEC-SQL-REVIEW ✓, SPEC-RECHT ✓, OPS-DOMAIN ✓ — kein echter Deploy mit unfertigem Schema/ohne Rechtstexte/Domain]**

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

- [x] **SPEC-SQL-REVIEW** — Extrem kritisches Schema-/SQL-Review **vor** dem Aufbau der ersten echten DB. **[GATE für CD-DEPLOY — gehört in Phase A]**

  Greenfield (keine Migration nötig) → das Schema kann jetzt sauber gezogen werden, bevor produktiv Daten liegen. **Nach dem ersten echten Deploy kostet jede Schema-Änderung eine Liquibase-Migration gegen Live-Daten** — deshalb zwingend im greenfield-Fenster, direkt nach `BUG-PROD-CHANGELOG` und vor `CD-DEPLOY`. Hängt fachlich mit `BUG-PROD-CHANGELOG` zusammen (Changelog-Hygiene). Prüfen: Normalformen (3NF), Audit-Spalten (`erstellt_am`, `geaendert_am`, ggf. `erstellt_von` als `timestamptz`), Primär-/Fremdschlüssel + ON DELETE, Indizes (insb. Fremdschlüssel + Abfragepfade `tischId`/`partieId`/`spielerId`), Datentypen (UUID, `timestamptz` statt `timestamp`, `numeric` statt float für Punkte), NOT-NULL/CHECK-Constraints, Namenskonventionen, JSONB-Spalten (Validierung/GIN-Index sinnvoll?), Liquibase-Changelog-Konsolidierung (`archiv/` vs. aktiv).

  **Erste Datei zuerst:** `specs/datenbankmodell.md` — Review-Befunde + Soll-Schema dokumentieren. Daraus dann (eigene Build-Tasks) konsolidiertes Liquibase-Changelog. Gegen echtes Postgres 17 validieren (siehe `DEPLOY-COMPOSE-SMOKE`).

  **DoD:** `datenbankmodell.md` enthält reviewtes Soll-Schema mit Audit-Konzept + Index-/Constraint-Liste; offene Schema-Änderungen als nachgelagerte `REFACTOR-DB-…`-Tasks. **Risiko:** mittel-hoch (Schema ist Fundament).

- [ ] **OPS-GRAFANA-MONITORING** — Monitoring via Grafana Cloud (Free-Tier).

  Spring Boot Actuator + Micrometer → Prometheus-Endpoint → Grafana Cloud (Free: Metriken/Logs/Traces). Free-Account vorhanden.

  **Erste Datei zuerst:** neue `specs/betrieb-monitoring.md` (Was wird überwacht: JVM, HTTP-Latenzen, aktive Tische/Partien, WS-Verbindungen, Fehlerrate; welche Dashboards/Alerts). Dann Build-Tasks: `micrometer-registry-prometheus` ins `pom.xml`, `/actuator/prometheus` exponieren (gesichert), Grafana Alloy/Agent als Sidecar im `docker-compose.yml` zum remote_write an Grafana Cloud (Token via ENV, kein Secret im Repo).

  **Loco-Domain-Metriken (aus `statistik-ranking.md`):** zusätzlich zu Infra-Metriken ein „Locodoko in Zahlen"-Dashboard aus **aggregierten** Micrometer-Metern an den bestehenden Domain-Events: Spieltyp-Verteilung (Counter `spieltyp`), Re-/Kontra-Siege (`partei`), Sonderpunkte (`typ`), Hochzeiten/Armuten, Augen/Spiel (Histogram), aktive Tische/Partien (Gauge), Spiele/Stunde (`regelvariante`), Bockrunden. **Hart einhalten:** niedrige Kardinalität, **kein `spieler_id`-Label** (Per-Spieler-Stats bleiben in Postgres). Dasselbe „Spiel abgeschlossen"-Event speist DB-Statistik *und* Counter.

  **DoD:** Spec beschreibt Monitoring-Konzept (Infra + Loco-Domain-Metriken); (Build) Metriken erscheinen im Grafana-Cloud-Dashboard. **Risiko:** niedrig-mittel.

- [ ] **OPS-LOGS-LOKI** — Strukturierte Logs nach Grafana Cloud Loki (Free-Tier), per LogQL abfragbar.

  Grafana Cloud Free enthält Loki (~50 GB Ingest, ~14 Tage Retention — für Hobby/Live-Debugging ausreichend). Das Backend loggt bereits JSON mit MDC-Feldern `tischId`/`partieId` → ideal für Loki-Labels/LogQL. Versand via Grafana Alloy/Promtail-Sidecar, Token via ENV. **Retention begrenzt → für Bug-Tickets relevante Log-Ausschnitte beim Erstellen ins Ticket snapshotten (siehe `FEAT-BUGREPORT`), nicht nur verlinken.**

  **Erste Datei zuerst:** `specs/betrieb-monitoring.md` (Abschnitt Log-Pipeline) + Alloy-Service im `docker-compose.yml`. Sicherstellen, dass eine `correlationId` pro Request im MDC liegt (für die Bugreport-Verknüpfung).

  **DoD:** Logs erscheinen in Grafana Cloud, per `tischId`/`partieId`/Level/`correlationId` filterbar. **Risiko:** niedrig-mittel.

- [ ] **FEAT-BUGREPORT** — In-App-Bugreport mit Session-Kontext → GitHub-Issue (+ Log-Verknüpfung). **[hängt an OPS-LOGS-LOKI für den Deep-Link]**

  Frontend: „Bug melden"-Dialog (Beschreibung + optional Screenshot), erfasst automatisch `correlationId`, `tischId`/`partieId`, `sessionId`, Client/Browser und **redigierten** AppStore-Zustand (keine Passwörter, keine fremden Hände). Backend-Endpoint reichert mit serverseitigem Log-Ausschnitt zur `correlationId` an und erstellt ein GitHub-Issue via **server-seitigem Token** (nie im Frontend) mit redigiertem Kontext + Log-Snapshot + Grafana-LogQL-Deep-Link.

  **Sicherheit/Datenschutz:** Auth erforderlich, Rate-Limiting (`RateLimitingFilter` vorhanden), PII-Redaktion. **Offene Sub-Entscheidung:** Issues im öffentlichen Repo (sichtbar!) vs. separatem privaten Issue-Repo — bei öffentlichem Repo strenge Redaktion zwingend. **Ergänzung empfohlen:** Sentry (Free, EU-Region) für automatische Fehlererfassung (Frontend+Backend) parallel zum user-initiierten Button. **GitHub-Hygiene mitnehmen:** `.github/ISSUE_TEMPLATE/` (Bug-/Feature-Vorlagen).

  **Erste Datei zuerst:** neue `specs/bugreport.md` (Flow, Redaktions-/Datenschutzregeln, Repo-Ziel, Sentry-Entscheidung) — dann Build (Frontend-Dialog, Backend-Endpoint, GitHub-API).

  **DoD:** Report aus der App erzeugt ein GitHub-Issue mit redigiertem Kontext + Log-Verknüpfung; nachweislich keine sensiblen Daten geleakt. **Risiko:** mittel (Datenschutz/Redaktion).

- [ ] **OPS-DOMAIN** — Domain + DNS + TLS für den öffentlichen Betrieb. **[Vorbedingung: MENSCH — Server/DNS/TLS; Ralph kann nur die Reverse-Proxy-Config vorbereiten]** **Schema festgelegt:** App = `zock.locodoko.de`, Wiki = `docs.locodoko.de` (GitHub Pages), Apex `locodoko.de` = Landing/Redirect.

  Wird gebraucht: OAuth2-Redirect-URI (`https://zock.locodoko.de/login/oauth2/code/google`), `cookie.secure=true` (erzwingt HTTPS; Cookie-Domain auf `zock.locodoko.de`), `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de`. prod-Props referenzieren beispielhaft noch `locodoko.de` → auf `zock.` anpassen.

  **Erste Datei zuerst:** DNS-Records (`zock` + `docs` CNAME/A) beim Registrar; TLS via Reverse-Proxy (Caddy/Traefik + Let's Encrypt) vor der App, **WebSocket-Upgrade-Header durchreichen** (Snapshot+Hint bricht sonst), HTTP→HTTPS-Redirect; Apex → 301 auf `zock.` (bis Landing existiert). `application-prod.properties` + `.env`: Redirect-URI, Cookie-Domain, WS-Origins auf `zock.locodoko.de`.

  **DoD:** `https://zock.locodoko.de` zeigt auf die App, WS funktioniert durch den Proxy, OAuth-Redirect + WS-Origins gesetzt. **Risiko:** niedrig. **[abhängig von Plattformwahl/Server]**

- [ ] **DOC-DOCS-SITE** — Öffentliche Docs-/Wiki-Seite (zugleich LLM-tauglich, Karpathy-Stil).

  Zweck: Menschen außerhalb des GitHub-Kontexts sollen das Projekt verstehen/„lernen" können; gleichzeitig LLM-freundlich (eindeutige Begriffe, flache Hierarchie, explizite Querverweise, optional `llms.txt`/generiertes Bundle). Die ~47 Markdown-Specs liegen bereits passend vor.

  **Empfehlung:** **MkDocs Material** (geringste Reibung — rendert die vorhandenen `specs/*.md` direkt, Volltextsuche, GitHub-Pages-Deploy). Alternativen: Docusaurus, Astro Starlight. Framework final offen.

  **Erste Datei zuerst:** `mkdocs.yml` im Root (Navigation aus `specs/README.md` ableiten) — oder zuerst Konzept in neuer `specs/docs-site.md`. Karpathy-Prinzipien anwenden; den Code-Metrik-Report aus `QA-CODE-METRICS` als eigene Seite einbinden.

  **DoD:** Docs-Seite baut lokal + als GitHub-Pages-Deploy unter **`docs.locodoko.de`** (Pages-Custom-Domain via CNAME); alle Specs navigierbar/durchsuchbar; kann die Spielregeln hosten (entlastet `FE-SPIELREGELN-HILFE` → App verlinkt nur dorthin). **Risiko:** niedrig.

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

- [x] **SPEC-RECHT** — Rechtstexte für öffentlichen Betrieb in DE (Pflicht-Voraussetzung für Live-Gang).

  Für einen öffentlich betriebenen Dienst in Deutschland gesetzlich erforderlich: **Impressum** (§5 DDG), **Datenschutzerklärung** (DSGVO — Accounts, Google-OAuth-Datenfluss, Statistiken). **AGB/Nutzungsbedingungen** empfohlen (Haftung, Verhaltensregeln, Account-Sperrung).

  **Erste Datei zuerst:** neue `specs/recht-impressum-datenschutz.md` — Inhalte/Pflichtangaben skizzieren (Impressum-Felder, verarbeitete Datenarten, Rechtsgrundlagen, Drittland-Hinweis Google-OAuth, Lösch-/Auskunftsrechte). Dann Build-Task: Frontend-Seiten/Footer-Links (`/impressum`, `/datenschutz`, `/agb`). **Hinweis:** konkrete Rechtstexte ggf. anwaltlich/Generator prüfen — die Spec definiert nur Struktur & Pflichtangaben.

  **DoD:** Spec mit Pflichtangaben vorhanden; (Build) Seiten verlinkt und erreichbar. **Risiko:** niedrig (Inhalt), rechtlich relevant.

- [ ] **OPS-EMAIL** — Email-Versand für Registrierungs-Verifizierung + Passwort-Reset (V2).

  Aktuell keine Email-Infra. Auth-Spec stellt Email optional, Passwort-Reset V2. Bei Bedarf: EU-Transaktionsmail-Anbieter mit Free-Tier (Brevo 🇫🇷, Mailjet 🇫🇷) oder SMTP. Kein Launch-Blocker, aber sinnvoll gegen Fake-Accounts.

  **Erste Datei zuerst:** `authentifizierung.md` — Abschnitt „Email-Verifizierung & Passwort-Reset (V2)" konkretisieren (Anbieterwahl EU, Double-Opt-In, Reset-Token-Ablauf). Dann Build-Tasks (Spring Mail / Anbieter-API, ENV-Secrets).

  **DoD:** Spec definiert Email-Flows + EU-Anbieter; (Build) Verifizierungs-/Reset-Mail wird versendet. **Risiko:** niedrig-mittel. **[Priorität niedrig — kein Launch-Blocker]**

- [ ] **DECISION-LIZENZ** — Projektlizenz festlegen + `LICENSE`-Datei anlegen. **[WARTET AUF USER-ENTSCHEIDUNG — bewusst aufgeschoben]**

  Tendenz Apache-2.0. **Aber:** User erwägt evtl. spätere Steam-/kommerzielle Veröffentlichung. **Zielkonflikt:** Eine permissive Lizenz (Apache/MIT) erlaubt jedem — auch Dritten — das Spiel nachzubauen und kommerziell (auch auf Steam) zu vertreiben, was einer eigenen bezahlten Veröffentlichung den Boden entziehen kann. Wer kommerzielle Verwertung offenhalten will, wählt eher **proprietär** oder **AGPL-3.0** (Copyleft hält Klone offen, erlaubt aber Dual-Licensing). Entscheidung an anderer Stelle, wenn Steam-Frage geklärt ist.

### Priorität 5 — Beta/Go-Live-Tasks (Session 30, Teil 3)

> Aus der Meilenstein-Planung (M1 Closed Beta / M2 Public). M1-Blocker zuerst.

- [x] **BACKUP-DB** (M1) — Automatische Postgres-Backups + verifizierter Restore.

  Aktuell **kein** Backup-Mechanismus. Beta-Daten sollen erhalten bleiben → Backups ab Tag 1 Pflicht.

  **Erste Datei zuerst:** `docker-compose.yml` — Backup-Sidecar oder Cron (`pg_dump` der `locodoko`-DB, täglich, rotierend, off-volume; idealerweise off-site/verschlüsselt). Restore-Prozedur dokumentieren in `DOC-ENV-DEPLOY`/README und **einmal real testen** (Backup → frische DB → Restore → App startet).

  **DoD:** Tägliches Backup läuft, Restore nachweislich getestet, Ablage außerhalb des DB-Volumes. **Risiko:** niedrig-mittel (Datensicherheit).

- [ ] **BETA-ACCESS** (optional — Session 30 Teil 4: Beta muss **nicht** gated sein) — Registrierung invite-only/Whitelist.

  `/register` ist heute **offen** (jeder mit der URL kann Accounts anlegen). User-Entscheidung: für die Beta kein Gating nötig, SEO/noindex bewusst kein Thema. **Restrisiko:** Fremde mit URL-Kenntnis können Accounts anlegen — akzeptiert. Bei Bedarf später reaktivieren.

  **Erste Datei zuerst (falls reaktiviert):** `src/main/java/de/locodoko/spieler/AuthentifizierungsController.java` (`/register`) — Gating via Einladungscode/Whitelist (ENV-Liste oder Invite-Token).

  **DoD:** (falls umgesetzt) Ohne gültigen Invite schlägt `/register` fehl. **Risiko:** niedrig.

- [x] **SESSION-PERSISTENZ** (M1) — HTTP-Sessions in Postgres statt in-memory.

  Aktuell kein `spring-session` → Sessions liegen im RAM. Folge: **jeder Redeploy/Neustart loggt alle Spieler aus** und setzt das In-memory-Disconnect-Tracking zurück. Spiele überleben (DB = Wahrheit), aber die Beta wird bei häufigen Deploys unangenehm.

  **Erste Datei zuerst:** `pom.xml` — `spring-session-jdbc`; `application.properties` `spring.session.store-type=jdbc`; Liquibase-Changeset für die Session-Tabellen (in `SPEC-SQL-REVIEW` mitdenken). Prüfen, ob das In-memory-Disconnect-Tracking in `VerbindungsabbruchService` ebenfalls neustart-robust sein muss.

  **DoD:** Nach App-Neustart bleiben angemeldete Spieler eingeloggt; Session-Tabelle in Postgres. **Risiko:** niedrig-mittel.

- [x] **OPS-BUILD-INFO** (M1, klein) — Version/Build-Info über Actuator.

  Fürs Beta-Debugging: „welcher Build läuft?".

  **Erste Datei zuerst:** `pom.xml` — `spring-boot-maven-plugin` `build-info`-Goal (erzeugt `META-INF/build-info.properties`); Git-SHA via `git-commit-id-maven-plugin`. `/actuator/info` exponieren (gesichert).

  **DoD:** `/actuator/info` liefert Version + Git-SHA. **Risiko:** niedrig.

- [ ] **~~ADMIN-TOOLING~~ / ~~ROLLBACK-DOKU~~** — erwogen, **zurückgestellt** (Session 30 Teil 4).

  Real fehlend, aber bewusst nicht im aktiven Backlog: (a) Admin-/Betreiber-Tooling (hängenden Tisch beenden, User sperren, aktive Tische sehen) — kein `admin`/`moderation`-Code vorhanden; (b) Rollback-Strategie (Image-Tags + dokumentierter Rückfall). Bei Betriebsproblemen in der Beta reaktivieren.

- [x] **OPS-COMPOSE-HARDENING** (M1) — `app`-Service betriebsfest machen.

  Der `app`-Service in `docker-compose.yml` hat (anders als `postgres`) **keine `restart`-Policy und keinen Healthcheck**.

  **Erste Datei zuerst:** `docker-compose.yml` (`app`-Service) — `restart: unless-stopped` + `healthcheck` auf `/actuator/health`; ggf. `depends_on: postgres condition: service_healthy` (bereits vorhanden prüfen).

  **DoD:** App startet nach Crash/Reboot automatisch neu; Healthcheck grün. **Risiko:** niedrig.

- [x] **FEAT-FEEDBACK** (M1, leicht) — „Feedback geben"-Kanal für die Beta.

  Für schnelles Kollegen-Feedback; bewusst **leichter** als `FEAT-BUGREPORT` (kein GitHub/Log-Pipeline nötig).

  **Erste Datei zuerst:** Frontend — Button/Link „Feedback" mit kurzem Formular (Freitext) → simpler Backend-Endpoint, der in `logs/locodoko.log` schreibt oder an einen Webhook (z.B. Discord/Matrix) sendet. Alternativ erstmal nur ein externer Link (Discord/Formular).

  **DoD:** Beta-Tester können aus der App Feedback abgeben; landet auffindbar (Log/Webhook). **Risiko:** niedrig.

- [ ] **SECURITY-REVIEW** (M1 empfohlen / M2 Pflicht) — Sicherheits-Review vor öffentlicher Exposition.

  Vor dem Stellen auf eine öffentliche Domain. Es existiert das `/security-review`-Tooling.

  **Prüfumfang:** Auth-Endpunkte + Rate-Limiting, CORS + WebSocket-`allowed-origins` (in prod auskommentiert!), Secret-Handling (keine Secrets im Image/Repo), Session-Cookie-Flags, Input-Validierung, OAuth-Redirect-Whitelist, Abhängigkeits-CVEs.

  **DoD:** Review durchgeführt, Findings als `BUG-…`-Tasks erfasst, kritische vor Exposition behoben. **Risiko:** mittel.

- [ ] **FE-SPIELREGELN-HILFE** (M2) — In-App-Spielregeln/Onboarding.

  Keine spielerklärende Hilfe erkennbar (nur Regel-*Presets* der Tischkonfig). Doppelkopf ist komplex → für ein öffentliches Publikum nötig; für DoKo-kundige Kollegen in M1 entbehrlich.

  **Erste Datei zuerst:** Frontend — Regel-/Hilfe-Overlay (Trumpfhierarchie, Ansagen, Sonderspiele) verlinkt aus Lobby + Tisch. Inhalte aus `specs/` ableitbar.

  **DoD:** Erreichbare Regelhilfe in der App. **Risiko:** niedrig.

- [ ] **FE-MOBILE** (M2) — Mobile-/Touch-/Portrait-Tauglichkeit.

  Phaser nutzt `Scale.FIT` auf 1280×720 — skaliert (letterboxed), aber **nicht** mobil-optimiert (Portrait, Touch-Targets, kleine Karten). Entscheidung Mobile erst M2.

  **Erste Datei zuerst:** `frontend/src/main.ts` (Scale-Config) + Tisch-Layout — Touch-Bedienung, Portrait-Handling, Karten-Trefferflächen. Vision-Loop mit mobilen Viewports erweitern.

  **DoD:** Spielbar auf gängigen Mobil-Viewports; Vision-Screenshots ohne Layout-Brüche. **Risiko:** mittel.

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

### Schema-Befunde aus SPEC-SQL-REVIEW (Session 31, 2026-06-02)

Alle noch im Greenfield-Fenster (vor erstem echten Deploy). Details und Audit-Konzept in `specs/datenbankmodell.md#schema-review`.

- [x] **REFACTOR-DB-1** — FK-Spalten ohne Index: `tisch.partie_id`, `partie_teilnehmer.spieler_id`, `spieler_statistik.spieler_id`, `spielergebnis_archiv.partie_id`, `sonderpunkt_eintrag.spielergebnis_archiv_id`. Changeset `002-fk-indexes.sql` hinzugefügt (`001` war durch Spring-Session belegt). **Risiko:** niedrig (Abfrageperformance, nicht Korrektheit).

- [x] **REFACTOR-DB-2** — `spielergebnis_archiv`: Spalten `re_augen`, `kontra_augen`, `sieger_partei`, `spielwert`, `grundwert` sind nullable, werden aber immer gesetzt. NOT NULL-Constraints als Changeset `003-archiv-not-null.sql`. **Risiko:** niedrig.

- [x] **REFACTOR-DB-3** — `spieler_statistik.solos_pro_typ JSONB` nullable → `JSONB NOT NULL DEFAULT '{}'` per Changeset `004-statistik-solos-not-null.sql`. Fix in `SpielerStatistik.fuer()`: `solosProTypJson = "{}"` initialisiert. **Risiko:** niedrig.

### Schema-Gegencheck Opus (Session 36, 2026-06-02)

> Zweiter, unabhängiger Review gegen `000-initial-schema.sql` + Code. Befunde in `specs/datenbankmodell.md#gegencheck-opus-2026-06-02`. Alle noch im Greenfield-Fenster. **Vor `CD-DEPLOY` abarbeiten** (GATE), Reihenfolge nach Priorität.

- [ ] **REFACTOR-DB-5** (P-hoch) — `spieler.benutzername` ohne UNIQUE → Race Condition bei Registrierung (`AuthentifizierungsController:72` prüft nur per Query). Partieller UNIQUE-Index `WHERE benutzername IS NOT NULL` (OAuth2 = NULL); `email` analog prüfen. **Erste Datei zuerst:** neues Changeset (oder Konsolidierung in `000`). **DoD:** zwei parallele Registrierungen mit gleichem Namen scheitern an der DB; bestehende Auth-Tests grün + Regressions-Test. **Risiko:** niedrig im Greenfield.

- [ ] **REFACTOR-DB-6** — Audit `erstellt_am`/`aktualisiert_am` nullable auf `spieler`, `partie`, `tisch`, `laufendes_spiel`, `spieler_statistik` → `NOT NULL DEFAULT NOW()` (DB erzwingt + befüllt). **DoD:** Spalten NOT NULL; `mvn clean test` grün. **Risiko:** niedrig.

- [ ] **REFACTOR-DB-7** — Audit-of-who: `erstellt_von_spieler_id UUID` auf `partie` ergänzen (nullable, NULL = System/KI). ON DELETE aller Creator-FKs auf `SET NULL`. Entity + Schreibpfad mitziehen. **DoD:** neue Partien tragen den Ersteller; `mvn clean test` grün. **Risiko:** mittel (Schreibpfad).

- [ ] **REFACTOR-DB-8** — NOT-NULL-Abdeckung vervollständigen (Ergänzung zu DB-2): `spielergebnis_archiv` (`geber_position`, `spieltyp`, `absage_punkte`, `gegen_die_alten_punkte`, `solo_multiplikator`, `spielpunkte_*`, `abgeschlossen_am`), `sonderpunkt_eintrag` (`partei`, `sonderpunkt_typ`), `partie` (`regelvariante`, `spielregeln`), `tisch.zugangsmodus` (`DEFAULT 'OFFEN'`). **DoD:** Constraints gesetzt, App setzt alle Werte; `mvn clean test` grün. **Risiko:** niedrig-mittel.

- [ ] **REFACTOR-DB-9** — `event_publication` ohne PRIMARY KEY → `PRIMARY KEY (id)` ergänzen (Spring-Modulith-Default). **DoD:** PK vorhanden; Outbox-Tests grün. **Risiko:** niedrig.

- [ ] **REFACTOR-DB-10** — DSGVO-ON-DELETE-Politik für alle `spieler`-referenzierenden FKs festlegen (`partie_teilnehmer`, `spieler_statistik`, `tisch_spieler`, `tisch.erstellt_von_spieler_id`, `spieler_rating`). Empfehlung: Statistik/Rating CASCADE, Archiv/Teilnahme SET NULL. **Vorbedingung-Entscheidung:** koppelt an späteres Lösch-Feature — Politik **jetzt** im Schema, Feature später. **DoD:** ON-DELETE auf allen FKs explizit; dokumentiert. **Risiko:** niedrig (Schema), mittel (Semantik).

### Statistik & Ranking (Session 36 — entschieden: Stufe 0+1, TrueSkill; Saison/Liga aufgeschoben)

> Vollständig in `specs/statistik-ranking.md`. **Umfang entschieden:** Stufe 0 (abgeleitete Kennzahlen) + Stufe 1 (TrueSkill-Rating + ewige Bestenliste, 1 neue UI-Szene). Saison/Liga **aufgeschoben** — additive Erweiterung später (risikoarm; `spielergebnis_archiv` erlaubt rückwirkende Berechnung). **Wichtige Trennung:** Per-Spieler-Statistik → Postgres/API; aggregierte Domain-Metriken → Prometheus/Grafana (nie `spieler_id` als Label).

- [ ] **STAT-DERIVED** (Stufe 0) — Abgeleitete Kennzahlen (Ø Punkte/Spiel, Siegquote, Ø Augen) im Profil-Endpoint/View, analog `partie_ergebnis_view`. **DoD:** Kennzahlen im Profil sichtbar; `mvn clean test` + `npm test` grün. **Risiko:** niedrig.

- [ ] **STAT-RATING** (Stufe 1) — TrueSkill-Rating. `rating_mu`/`rating_sigma NUMERIC(8,4)` an die bestehende `spieler_statistik` (in `000` konsolidiert; Defaults μ=25, σ=8.3333). TrueSkill-Update im **selben Pro-Spiel-Statistikpfad** beim Event „Spiel abgeschlossen". **Erste Datei zuerst:** `000-initial-schema.sql` (Spalten) + der Statistik-Fortschreibungs-Service. **DoD:** Rating wird pro Spiel fortgeschrieben; Roundtrip-Test; `mvn clean test` grün. **Risiko:** mittel (Korrektheit der TrueSkill-Formel — Bibliothek prüfen).

- [ ] **FE-LEADERBOARD** (Stufe 1) — Neue Bestenlisten-Szene + Endpoint, sortiert nach `rating_mu − 3·rating_sigma` (pro Regelvariante, ewige Liste). **Erste Datei zuerst:** Backend-Endpoint, dann neue Phaser-Szene + Lobby-Verlinkung. **DoD:** Bestenliste in der App erreichbar; Vision-Loop ohne Layout-Bruch; Tests grün. **Risiko:** niedrig-mittel (UI).

- [x] **DECISION-RATING-ALGO** — ✓ **TrueSkill** (Session 36). 4-Spieler mit wechselnden Parteien; ELO ist 1-gegen-1. Schema (μ/σ) bleibt algorithmus-agnostisch.

- [ ] **STAT-SAISON-LIGA** (aufgeschoben) — Saisons (Reset/Listen/Rollover-Job) + Ligen (Auf-/Abstieg). Additive Erweiterung (neue Tabellen `saison` + saison-Rating + nullable `spielergebnis_archiv.saison_id`). Nur bauen, falls öffentlich/wachsend. **[WARTET — keine Greenfield-Dringlichkeit, rückwirkend aus Archiv berechenbar]**

- [ ] **CHANGELOG-KONSOLIDIERUNG** (✓ entschieden: echtes Greenfield → konsolidieren) — `002`–`004` + alle Gegencheck-Fixes (DB-5…10) **direkt in `000-initial-schema.sql`** einpflegen statt additiver `005…`-Changesets. Ergebnis: ein einziges, sauberes Initial-Schema beim ersten Deploy. **Methode:** jeder DB-Task editiert `000` direkt (kein neues Changeset). `001-spring-session-schema.sql` bleibt eigenständig (Fremd-Schema). H2-Tests unkritisch (Neuaufbau je Lauf); persistente Dev-DB ggf. `clearCheckSums`. **DoD:** nur `000` + `001` aktiv, `002`–`004` entfernt, `mvn clean test` grün. **Risiko:** niedrig im Greenfield.

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
