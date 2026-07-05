# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-07-05 (Session 149). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–148b archiviert).

## Notiz

**Block A Sessions 131–148b vollständig abgeschlossen (Slim-Down).** Die gesamte letzte Runde (37 Tasks: Refactoring, Deps-Updates, Features, Spec-Sync, Security, Deploy-Verifikation) ist erledigt und archiviert. Höhepunkte: REFACTOR-BE-JSONB-CONVERTER (−45 %), FEAT-RATING-EIN-POOL (globaler TrueSkill-Pool), SEC-TOKEN-HASHING, QA-SPEC-LINT (CI-Gate, 0 Befunde), FE-MOBILE, DEPLOY-PLAIN-SMOKE (prod-Boot gegen PG grün).

**Neue Runde (Session 149).** Schwerpunkte: deploy-nahe Ops-Tasks (Sourcemaps), Test-Stabilität, Doku-Sync, Refactoring der verbleibenden Größen-Kandidaten.

**check_specs.py (S149):** 0 tote Referenzen in 55 Spec-Dateien — sauber.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S149: Code sauber (check_specs.py 0 Befunde, Lint grün, 503 BE-Tests, 478 FE-Tests). Das sind die realen offenen Hebel. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

- [ ] **OPS-SOURCEMAP-PROD** (Frontend/Ops, autonom, winzig — deploy-nah) — `vite.config.ts` baut aktuell mit `sourcemap: 'hidden'`; die ~10,9-MB-`.map`-Dateien landen in `dist/` und sind im öffentlich servierten Verzeichnis per URL-Raten abrufbar (Quellcode-Exposure, Review-Notiz S126/S148 F2). **Fix:** In `frontend/vite.config.ts` die Prod-Build-Konfiguration auf `sourcemap: false` setzen, damit keine `.map`-Dateien nach `dist/` geschrieben werden. Sentry-Upload (braucht DSN = MENSCH) ist erst mit OBS-SENTRY-Aktivierung relevant — bis dahin `false`. **Erste Datei zuerst:** `frontend/vite.config.ts`. **DoD:** `npm run build` erzeugt keine `.map`-Dateien in `dist/`; `npm test && npm run build && npm run lint` grün. **Risiko:** minimal (reine Build-Konfiguration).

- [ ] **TEST-BE-STATISTIK-FLAKINESS** (Backend/Test, autonom, klein) — `SpielerStatistikIntegrationTest.zweiRegelvarianten_erstellenJeweiligeStatistikZeilen` schlägt im parallelen Gesamtlauf gelegentlich fehl (`Expected size: 2 but was: 1`), im isolierten Lauf stets grün (Entdeckung S149). Ursache: asynchrone `SpielBeendet`-Events treffen unter Last aufeinander; 5-Sekunden-Await reicht manchmal nicht. **Fix-Optionen (in dieser Reihenfolge probieren):** (a) Await-Timeout auf 10–15 s erhöhen; (b) `@DirtiesContext` oder `@Sql`-Isolation ergänzen; (c) `@Execution(SAME_THREAD)` für den Test. **Erste Datei zuerst:** `SpielerStatistikIntegrationTest.java` lesen, Await-Stelle identifizieren. **DoD:** `mvn clean test` fünf aufeinanderfolgende Läufe ohne Flakiness; Kommentar erklärt gewählte Lösung. **Risiko:** niedrig (isoliert, kein Produktionspfad berührt).

- [ ] **DOC-FERTIGSTELLUNG-SYNC** (Doku/Spec, autonom, winzig) — `specs/fertigstellung.md` M1-Checkliste stimmt nicht mehr mit dem Code-Stand überein: SESSION-PERSISTENZ, OPS-COMPOSE-HARDENING, OPS-BUILD-INFO, FEAT-BUGREPORT, DEPLOY-OAUTH-SENTINEL, DOC-ENV-DEPLOY, VERIFY-MULTIPLAYER und das BACKUP-DB-Skript (`scripts/backup-db.sh`) wurden in früheren Sessions implementiert und gelten als erledigt — stehen aber noch als offene `[ ]`-Items. Außerdem: BUG-PROD-CHANGELOG-Zeile auf „prod-Boot via DEPLOY-PLAIN-SMOKE verifiziert (PG 15 Sandbox; PG 17 Prod-Ziel)" aktualisieren; SPEC-SQL-REVIEW-Eintrag abgleichen (war in Sessions 26–128 bereits erledigt, laut Archiv: REFACTOR-DB-1…10); Letztes-Update-Datum anpassen. **Erste Datei zuerst:** `specs/fertigstellung.md`. **DoD:** M1-Checkliste spiegelt den aktuellen Code-Stand; kein Widerspruch zu Plan oder Archiv; `check_specs.py` 0 Befunde. **Risiko:** null (reine Doku).

- [ ] **REFACTOR-BE-STANDARDKISTRATEGIE** (Backend/Refactoring, autonom, mittel) — `src/main/java/de/locodoko/ki/StandardKiStrategie.java` hat **504 Zeilen** (über dem 300-Zeilen-Richtwert, S148 Radar). Die Klasse enthält zwei große Kartenwahlmethoden (`waehleAnspielKarte` ab Z. 141 und `waehleFolgeKarte` ab Z. 178) mit komplexen Bewertungslogiken sowie mehrere private Solo-Bewertungs-Hilfsmethoden. **Fix:** Bewertungslogik in package-private Hilfsklassen auslagern: `KiAnspielBewerter.java` (Anspiel-Strategie: `waehleAnspielKarte` + zugehörige Methoden) und `KiFolgeBewerter.java` (Folge-Strategie: `waehleFolgeKarte` + `gewinnendeKarten`, `vergleicheGewinnKosten`, `vergleicheAbwurfKosten`); `StandardKiStrategie` reduziert sich auf Delegations-Klasse + `handstaerke`/`ansageSchwelle`/`soloWert`. Keine Logikänderung — reine Extraktion. **Erste Datei zuerst:** `StandardKiStrategie.java` vollständig lesen, dann Extraktion. **DoD:** `StandardKiStrategie.java` deutlich unter 200 Zeilen; Gesamt-Logik aller neuen Klassen zusammen unter 600 Zeilen; `mvn clean test` grün; KI-Modul-Coverage unverändert. **Risiko:** niedrig-mittel (KI-Logik ist gut getestet, 91 % Coverage im ki-Modul).

- [ ] **REFACTOR-BE-TISCHVERWALTUNGSSERVICE** (Backend/Refactoring, autonom, mittel) — `src/main/java/de/locodoko/tisch/TischVerwaltungsService.java` hat **465 Zeilen** (über dem Richtwert, S148 Radar). **Fix:** Datei vollständig lesen, Verantwortlichkeiten identifizieren und sinnvoll trennen (z.B. Tisch-Erstellung/Konfiguration vs. Tisch-Lifecycle-Management/Teilnehmer-Verwaltung). Keine Logikänderung. **Erste Datei zuerst:** `TischVerwaltungsService.java` vollständig lesen, bevor irgend etwas extrahiert wird. **DoD:** Service deutlich unter 300 Zeilen; `mvn clean test` grün; Integrationstests der tisch-Module unverändert grün. **Risiko:** mittel (Application Layer, Integrationstests vorhanden).

### Empfohlene Build-Reihenfolge (Block A — aktuelle Runde, Stand S149)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

1. **OPS-SOURCEMAP-PROD** (winzig, deploy-nah — sofort sinnvoll)
2. **TEST-BE-STATISTIK-FLAKINESS** (klein, CI-Stabilität)
3. **DOC-FERTIGSTELLUNG-SYNC** (winzig, Doku)
4. **REFACTOR-BE-STANDARDKISTRATEGIE** (mittel)
5. **REFACTOR-BE-TISCHVERWALTUNGSSERVICE** (mittel)

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung (Server/DNS/TLS/Docker/Google-Account/Plattformwahl). Ralph kann hier nur vorbereitende Config schreiben, nicht abschließen.

- [ ] **BACKUP-DB-CRON** — Cron-Job für automatische `pg_dump`-Backups auf dem Host aktivieren + Restore-Test. **[Vorbedingung: MENSCH — Server-Zugriff; Skript bereits fertig: `scripts/backup-db.sh`]**

  `scripts/backup-db.sh` ist implementiert (pg_dump, gzip-9, 7-Tage-Rotation). Verbleibend: (1) Cron-Eintrag auf dem Host-Server anlegen (Empfehlung im Skript-Header: `0 3 * * * /opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups >> .../backup.log 2>&1`). (2) Restore einmal testen: `psql locodoko_prod < backup.sql`. (3) Backup-Verzeichnis auf separatem Volume oder Off-Server-Storage. **DoD:** automatischer nächtlicher Backup läuft, Restore verifiziert. **M1-Gate** (Beta-Daten erhalten). **Risiko:** niedrig.

- [ ] **DEPLOY-COMPOSE-SMOKE** — Vollen prod-Stack via Docker Compose hochfahren und eine Partie durchspielen. **[Vorbedingung: MENSCH — Docker; nur noch relevant, falls DECISION-DEPLOY-VARIANTE auf Docker fällt — die fachliche prod-Verifikation übernimmt DEPLOY-PLAIN-SMOKE (Block A, erledigt)]**

  Vorhandene Bausteine: `docker-compose.yml` (Services `postgres` + `app`, Profil `prod`), `Dockerfile.app` (Multi-Stage). Bislang nie real verifiziert. **Schritte:** 1. `docker compose --profile prod up --build -d`. 2. `curl -s http://localhost:8081/actuator/health` → UP. 3. Liquibase-Migration im App-Log prüfen (PG 17 — Prod-Ziel). 4. Eine Partie gegen KI via E2E durchspielen. 5. Stack runterfahren. **DoD:** prod-Stack startet reproduzierbar, Health UP, eine Partie läuft durch. **Risiko:** mittel.

- [ ] **CI-DOCKER-BUILD** — Produktions-Image bauen und nach GHCR pushen. **[hängt an CI-BUILD-TEST ✓, DEPLOY-COMPOSE-SMOKE]**

  `.github/workflows/ci.yml` erweitern: `Dockerfile.app` bauen, mit Commit-SHA + `latest` taggen, nach `ghcr.io/<owner>/locodoko` pushen (nur `main`/Tag, `packages: write`). **DoD:** Nach Push auf `main` liegt ein lauffähiges Image in GHCR. **Risiko:** niedrig.

- [ ] **CD-DEPLOY** — Auto-Deploy auf die Zielplattform. **[BLOCKED: Plattformwahl offen — kein echter Deploy ohne fertige Domain]**

  **Harte Anforderung:** EU/DE-Hosting. US-Anbieter ausgeschlossen. Engere Wahl: Hetzner 🇩🇪, Scaleway 🇫🇷, Netcup 🇩🇪, OVHcloud 🇫🇷. Bis Entscheidung: manueller Roll-out dokumentiert. **DoD (bei Entsperrung):** Push auf `main` → automatischer Deploy + Health-Check. **Risiko:** plattformabhängig.

- [~] **OPS-DOMAIN** — Domain + DNS + TLS. **[Vorbedingung: MENSCH — Server/DNS/TLS]**

  **Schema festgelegt:** App = `zock.locodoko.de`, Wiki = `docs.locodoko.de`, Apex = Landing/Redirect. Gebraucht: OAuth2-Redirect-URI, `cookie.secure=true`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de`. **Schritte:** DNS-Records, TLS via Caddy/Traefik + Let's Encrypt, **WebSocket-Upgrade-Header durchreichen** (Snapshot+Hint bricht sonst), HTTP→HTTPS-Redirect. **Closed-Beta-noindex** bereits im Code (`<meta robots noindex>` + `robots.txt`); im Reverse-Proxy zusätzlich `X-Robots-Tag: noindex, nofollow`. **DoD:** `https://zock.locodoko.de` erreichbar, WS durch Proxy. **Risiko:** niedrig.

---

## C) Wartet auf User-Entscheidung

- [ ] **DECISION-DEPLOY-VARIANTE** — Docker Compose vs. **plain Linux + Java** (User-Tendenz S148: plain). JAR ist self-contained — plain heißt systemd-Unit + natives Postgres (apt) + Caddy. **Konsequenz:** Bei plain entfällt CI-DOCKER-BUILD; DEPLOY-COMPOSE-SMOKE nur noch nice-to-have; CD-DEPLOY wird scp/systemctl. Docker-Artefakte können als Alternative im Repo bleiben. **[WARTET AUF USER-ENTSCHEIDUNG — danach Block-B-Tasks entsprechend umformulieren]**

- [ ] **DECISION-LIZENZ** — Projektlizenz festlegen + `LICENSE`-Datei anlegen. **[WARTET AUF USER-ENTSCHEIDUNG]**

  Tendenz Apache-2.0. **Zielkonflikt:** spätere Steam-/kommerzielle Veröffentlichung erwogen → permissive Lizenz erlaubt Dritten kommerziellen Nachbau. Alternativen: **proprietär** oder **AGPL-3.0** (Copyleft, Dual-Licensing möglich). Entscheidung, sobald Steam-Frage geklärt.

---

## D) Zurückgestellt (bewusst nicht im aktiven Backlog)

- [ ] **BETA-ACCESS** (optional) — Registrierung invite-only/Whitelist. User-Entscheidung: Beta nicht gated (`/register` offen, noindex aktiv). Bei Bedarf reaktivieren.
- [ ] **ADMIN-TOOLING / ROLLBACK-DOKU** — zurückgestellt. (a) Betreiber-Tooling (hängenden Tisch beenden, User sperren); (b) Rollback-Strategie. Bei Betriebsproblemen reaktivieren.
- [ ] **STAT-SAISON-LIGA** — Saisons + Ligen. Additive Erweiterung, rückwirkend berechenbar. Nur bauen, falls öffentlich/wachsend.
- [ ] **BE-ERRORPRONE-NULLAWAY** (Backend — **Java-25-Gate**) — Error Prone + NullAway: auf JDK 25 noch nicht stabil (`NoSuchFieldError: TypeTag`, S128 recherchiert). Reaktivieren, sobald Error-Prone JDK 25 sauber unterstützt.
- [ ] **SEC-CSP** (Frontend/Security — M2-Task) — Content Security Policy. Phaser 4 WebGL benötigt `'unsafe-eval'` → strikte CSP bricht das Spiel. Nach Live-Gang per `CSP-Report-Only`-Header Violations erfassen, dann iterativ einschränken. (S145: akzeptiertes Restrisiko M1.)

---

## Entdeckungen

- **S149 — Flakiger Integrationstest:** `SpielerStatistikIntegrationTest.zweiRegelvarianten_erstellenJeweiligeStatistikZeilen` schlägt im parallelen Gesamtlauf (503 Tests) gelegentlich fehl (`Expected size: 2 but was: 1`). Ursache: Timing bei asynchronen SpielBeendet-Events. Pre-existent (tritt auch ohne Änderungen auf). → **TEST-BE-STATISTIK-FLAKINESS**.

- **S148 — Radar, keine eigenen Tasks:** (a) `AppStore.snapshot()` macht `structuredClone` des Gesamtzustands pro Listener-Benachrichtigung — bei aktueller Spielgröße unkritisch; wird erster FE-Hotspot, falls Protokoll/Historie im Zustand wächst. (b) Nach REFACTOR-BE-JSONB-CONVERTER sind `StandardKiStrategie.java` (504 Z.) und `TischVerwaltungsService.java` (465 Z.) die nächsten Kandidaten über dem 300-Zeilen-Richtwert. → **REFACTOR-BE-STANDARDKISTRATEGIE** + **REFACTOR-BE-TISCHVERWALTUNGSSERVICE**. (c) Sourcemaps in `dist/` öffentlich abrufbar (F2 S126). → **OPS-SOURCEMAP-PROD**.

- **S148 — DEPLOY-PLAIN-SMOKE Delta-Notiz:** Sandbox-Postgres war PG 15, Prod-Ziel PG 17. Kein Breaking Change bekannt — Vorbehalt bis DEPLOY-COMPOSE-SMOKE (echtes PG 17) verifiziert ist.

- **Review-Notizen S126 (akzeptierte Restrisiken, keine eigenen Tasks):**
  - **B2/B3 (low):** `VerbindungsabbruchService` — TOCTOU zwischen `computeIfPresent`/`containsKey`. Single-Instance-Betrieb → praktisch irrelevant; bei Bedarf atomare `compute`-Operation.
  - **F3 (kosmetisch):** Gemergtes Passwort-Konto behält `authentifizierungsMethode=PASSWORT` statt korrekt. Gatet nichts Sensibles — nur Anzeige leicht ungenau.
  - **F4 (a11y):** `installiereDialogA11y`-Fokus-Trap lenkt Tab nur bei exaktem Fokus auf erstem/letztem Element um. In der Praxis ok. Optional härten.

---

## Meilensteine

- **M1 — Closed Beta** auf `zock.locodoko.de` (eingeladene Kollegen, Daten erhalten). Autonom offen: OPS-SOURCEMAP-PROD + TEST-BE-STATISTIK-FLAKINESS. Block B: BACKUP-DB-CRON / OPS-DOMAIN / OAuth-Credentials (MENSCH). Block C: DECISION-DEPLOY-VARIANTE.
- **M2 — Public Go-Live:** Rechtstexte live schalten (`specs/recht-impressum-datenschutz.md` fertig, Platzhalter füllen), CI/CD automatisiert (CI-DOCKER-BUILD → CD-DEPLOY), DECISION-LIZENZ, SEC-CSP.

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
