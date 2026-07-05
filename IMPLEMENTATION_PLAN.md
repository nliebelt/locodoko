# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-07-05 (Session 150). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–149 archiviert).

## Notiz

**S150 — Alle autonomen Tasks erledigt (2026-07-05, Ralph).**

- **DOC-FERTIGSTELLUNG-SYNC-2:** `specs/fertigstellung.md` M1- und M2-Checkliste korrigiert (SECURITY-REVIEW-PRE-M1 → `[x]`). check_specs.py 0 Befunde.
- **REFACTOR-BE-EREIGNISPUBLIKATION:** `veroeffentlicheAnsageEreignisse` + `veroeffentlicheEinwurfEreignisse` in neue Klasse `TischEreignisPublikation.java` (47 Z.) extrahiert. `SpielAktionsService.java` 379 → 349 Z., `KiTischOrchestrator.java` 315 → 285 Z. 503 Tests grün.

**Sektion A leer.** Nächste Runde beginnt mit einem frischen Repo-Scan.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S150: Code sauber (check_specs.py 0 Befunde, Lint grün, 503 BE-Tests, 478 FE-Tests). **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

- [x] **DOC-FERTIGSTELLUNG-SYNC-2** (Doku/Spec, autonom, winzig) — `specs/fertigstellung.md` M1-Checkliste zeigt noch `[~] Feedback-Kanal ... SECURITY-REVIEW ausstehend`, obwohl SECURITY-REVIEW-PRE-M1 in S148b erledigt und archiviert ist. M2-Checkliste hat `[ ] SECURITY-REVIEW vollständig, kritische Findings behoben (18)` — ebenfalls falsch. **Fix:** M1-Zeile auf `[x]` (SECURITY-REVIEW erledigt, nur minimaler Datenschutzhinweis-Text noch MENSCH-seitig) korrigieren; M2-Checkliste `[ ] SECURITY-REVIEW` → `[x]`; Letztes-Update-Datum auf 2026-07-05 setzen. **Erste Datei zuerst:** `specs/fertigstellung.md`. **DoD:** Checklisten spiegeln Code-Stand; kein Widerspruch zu Archiv; `check_specs.py` 0 Befunde. **Risiko:** null (reine Doku).

- [x] **REFACTOR-BE-EREIGNISPUBLIKATION** (Backend/Refactoring, autonom, mittel) — `veroeffentlicheAnsageEreignisse(TischEntity)` und `veroeffentlicheEinwurfEreignisse(TischEntity)` sind wortidentisch in `SpielAktionsService.java` (378 Z.) und `KiTischOrchestrator.java` (314 Z.) — klassische DRY-Verletzung. Beide Dienste injizieren `TischEchtzeitService`, von dem diese Methoden abhängen. **Fix:** Neue package-private Klasse `de.locodoko.tisch.TischEreignisPublikation.java` einführen, die `TischEchtzeitService` injiziert und die beiden Methoden bereitstellt; `SpielAktionsService` und `KiTischOrchestrator` injizieren `TischEreignisPublikation` und rufen dorthin durch. Keine Logikänderung — reine Extraktion. **Erste Datei zuerst:** `SpielAktionsService.java` vollständig lesen, dann `KiTischOrchestrator.java` lesen, dann `TischEreignisPublikation` schreiben. **DoD:** `SpielAktionsService.java` < 300 Zeilen; `KiTischOrchestrator.java` < 300 Zeilen; keine Duplikation mehr; `mvn clean test` grün; Integrationstests des tisch-Moduls unverändert grün. **Risiko:** niedrig (gut getesteter Application Layer, keine Logikänderung).

### Empfohlene Build-Reihenfolge (Block A — aktuelle Runde, Stand S150)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

1. **DOC-FERTIGSTELLUNG-SYNC-2** (winzig, Doku)
2. **REFACTOR-BE-EREIGNISPUBLIKATION** (mittel, Backend)

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

- **S150 — DRY-Verletzung Ereignispublikation:** `veroeffentlicheAnsageEreignisse(TischEntity)` und `veroeffentlicheEinwurfEreignisse(TischEntity)` sind wortidentisch in `SpielAktionsService.java` (378 Z.) und `KiTischOrchestrator.java` (314 Z.). Extraktion in `TischEreignisPublikation.java` bringt beide Dateien unter 300 Zeilen. → **REFACTOR-BE-EREIGNISPUBLIKATION**.

- **S150 — Checklisten-Drift fertigstellung.md:** M1- und M2-Checkliste listen SECURITY-REVIEW noch als offen, obwohl in S148b erledigt (SECURITY-REVIEW-PRE-M1 archiviert). → **DOC-FERTIGSTELLUNG-SYNC-2**.

- **S150 — Verteidigte Übergrößen (Radar, kein Handlungsbedarf):** `Spielregeln.java` (438) ist Value-Object-Builder mit idiomatischem Pattern; `JsonbConverter.java` (500) wurde von 915 auf 500 gebracht und enthält notwendigen Boilerplate; `PartieStandAntwort.java` (529) ist Snapshot-DTO; `Partie.java` (471) + `Spiel.java` (542) sind Aggregate — alle verteidigt.

- **S149 — Flakiger Integrationstest (behoben):** `SpielerStatistikIntegrationTest.zweiRegelvarianten_erstellenJeweiligeStatistikZeilen` — 15s-Timeout + Zwischenawait. → TEST-BE-STATISTIK-FLAKINESS (erledigt).

- **S148 — Review-Notizen S126 (akzeptierte Restrisiken, keine eigenen Tasks):**
  - **B2/B3 (low):** `VerbindungsabbruchService` — TOCTOU zwischen `computeIfPresent`/`containsKey`. Single-Instance-Betrieb → praktisch irrelevant; bei Bedarf atomare `compute`-Operation.
  - **F3 (kosmetisch):** Gemergtes Passwort-Konto behält `authentifizierungsMethode=PASSWORT` statt korrekt. Gatet nichts Sensibles — nur Anzeige leicht ungenau.
  - **F4 (a11y):** `installiereDialogA11y`-Fokus-Trap lenkt Tab nur bei exaktem Fokus auf erstem/letztem Element um. In der Praxis ok. Optional härten.

---

## Meilensteine

- **M1 — Closed Beta** auf `zock.locodoko.de` (eingeladene Kollegen, Daten erhalten). Autonom offen: DOC-FERTIGSTELLUNG-SYNC-2 + REFACTOR-BE-EREIGNISPUBLIKATION. Block B: BACKUP-DB-CRON / OPS-DOMAIN / OAuth-Credentials (MENSCH). Block C: DECISION-DEPLOY-VARIANTE.
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
