# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-08-14 (Session 152). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–150 archiviert).

## Notiz

**S152 — Erster Prod-Deploy (2026-08-14, Mensch+Ralph). `https://zock.locodoko.de` ist live.**

- DECISION-DEPLOY-VARIANTE entschieden: **plain Linux + Java** (hosting.de, Debian 13, prod1.locodoko.de / 213.160.77.250)
- `specs/betrieb-deployment.md` neu erstellt (Wahrheitsquelle für Server-Setup)
- `scripts/setup-server.sh` (idempotent) + `scripts/deploy.sh` erstellt und ausgeführt
- Stack: Java 25 (Temurin), Postgres 17, Caddy 2 (TLS auto), unattended-upgrades, cron
- Google OAuth konfiguriert (Client ID/Secret in `.env` auf Server)
- DNS propagiert, HTTPS via Caddy, HTTP/2 200, Health UP
- Backup-Cron aktiv (03:00), Restore-Test noch offen (MENSCH)

**Block A: ein neuer autonomer Task (OPS-NOINDEX-PROXY).** Block B fast leer — nur Restore-Test offen.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S151 (2026-07-05): Code sauber (check_specs.py 0 Befunde, Lint grün, 506 BE-Tests). **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

### Empfohlene Build-Reihenfolge (Block A — aktuelle Runde, Stand S152)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

- [ ] **OPS-NOINDEX-PROXY** — `X-Robots-Tag: noindex, nofollow` Header in Caddy ergänzen. **[Erste Datei: `/etc/caddy/Caddyfile` auf prod1 via Paramiko]**

  Laut `specs/betrieb-deployment.md` + `specs/fertigstellung.md` soll Caddy zusätzlich zum `<meta robots noindex>` im HTML den `X-Robots-Tag`-Header setzen, damit Crawler die Beta nicht indexieren. **Schritte:** 1. Caddyfile um `header X-Robots-Tag "noindex, nofollow"` in der `zock.locodoko.de`-Block ergänzen. 2. `caddy reload` auf Server. 3. `curl -sI https://zock.locodoko.de | grep -i x-robots` verifizieren. Kein Code-Commit nötig — nur Server-Config. **DoD:** Header in HTTP-Antwort sichtbar. **Risiko:** minimal.

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung (Server/DNS/TLS/Docker/Google-Account/Plattformwahl). Ralph kann hier nur vorbereitende Config schreiben, nicht abschließen.

- [~] **BACKUP-DB-CRON** — Cron läuft (03:00, `scripts/backup-db.sh`), Skripte auf Server. **Offen: Restore einmal manuell testen.** [Vorbedingung: MENSCH]

  ```bash
  # Auf prod1: manuellen Backup auslösen + Restore testen
  su - locodoko -s /bin/bash -c "/opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups"
  # Dann: psql -U locodoko locodoko < /opt/locodoko/backups/locodoko_<datum>.sql.gz
  ```
  **DoD:** Restore verifiziert. **M1-Gate.**

---

## C) Wartet auf User-Entscheidung

- [x] **DECISION-DEPLOY-VARIANTE** — ✓ Entschieden S152: **plain Linux + Java** auf hosting.de. CI-DOCKER-BUILD + DEPLOY-COMPOSE-SMOKE entfallen → D).

- [ ] **DECISION-LIZENZ** — Projektlizenz festlegen + `LICENSE`-Datei anlegen. **[WARTET AUF USER-ENTSCHEIDUNG]**

  Tendenz Apache-2.0. **Zielkonflikt:** spätere Steam-/kommerzielle Veröffentlichung erwogen → permissive Lizenz erlaubt Dritten kommerziellen Nachbau. Alternativen: **proprietär** oder **AGPL-3.0** (Copyleft, Dual-Licensing möglich). Entscheidung, sobald Steam-Frage geklärt.

---

## D) Zurückgestellt (bewusst nicht im aktiven Backlog)

- [ ] **BETA-ACCESS** (optional) — Registrierung invite-only/Whitelist. User-Entscheidung: Beta nicht gated (`/register` offen, noindex aktiv). Bei Bedarf reaktivieren.
- [ ] **ADMIN-TOOLING / ROLLBACK-DOKU** — zurückgestellt. (a) Betreiber-Tooling (hängenden Tisch beenden, User sperren); (b) Rollback-Strategie. Bei Betriebsproblemen reaktivieren.
- [ ] **DEPLOY-COMPOSE-SMOKE** — entfällt (plain Linux gewählt S152).
- [ ] **CI-DOCKER-BUILD** — entfällt (plain Linux gewählt S152). CD-DEPLOY für M2: GitHub Actions → `scripts/deploy.sh` via SSH.
- [ ] **STAT-SAISON-LIGA** — Saisons + Ligen. Additive Erweiterung, rückwirkend berechenbar. Nur bauen, falls öffentlich/wachsend.
- [ ] **BE-ERRORPRONE-NULLAWAY** (Backend — **Java-25-Gate**) — Error Prone + NullAway: auf JDK 25 noch nicht stabil (`NoSuchFieldError: TypeTag`, S128 recherchiert). Reaktivieren, sobald Error-Prone JDK 25 sauber unterstützt.
- [ ] **SEC-CSP** (Frontend/Security — M2-Task) — Content Security Policy. Phaser 4 WebGL benötigt `'unsafe-eval'` → strikte CSP bricht das Spiel. Nach Live-Gang per `CSP-Report-Only`-Header Violations erfassen, dann iterativ einschränken. (S145: akzeptiertes Restrisiko M1.)

---

## Entdeckungen

- **S151 — Repo-Scan sauber:** 506 BE-Tests, check_specs.py 0 Befunde (55 Specs), ESLint 0 Warnungen, 0 TODOs/FIXMEs. Größte Java-Produktionsdateien: `Spiel.java` (542, Aggregat), `PartieStandAntwort.java` (529, Snapshot-DTO), `JsonbConverter.java` (500, Persistenz-Boilerplate) — alle verteidigt. Größte TS-Produktionsdatei: `TischKartenRenderer.ts` (418, Phaser-Rendering) — kein Handlungsbedarf. Keine neuen Refactoring-Kandidaten.

- **S150 — Verteidigte Übergrößen (Radar, kein Handlungsbedarf):** `Spielregeln.java` (438) ist Value-Object-Builder mit idiomatischem Pattern; `JsonbConverter.java` (500) wurde von 915 auf 500 gebracht und enthält notwendigen Boilerplate; `PartieStandAntwort.java` (529) ist Snapshot-DTO; `Partie.java` (471) + `Spiel.java` (542) sind Aggregate — alle verteidigt.

- **S149 — Flakiger Integrationstest (behoben):** `SpielerStatistikIntegrationTest.zweiRegelvarianten_erstellenJeweiligeStatistikZeilen` — 15s-Timeout + Zwischenawait. → TEST-BE-STATISTIK-FLAKINESS (erledigt).

- **S148 — Review-Notizen S126 (akzeptierte Restrisiken, keine eigenen Tasks):**
  - **B2/B3 (low):** `VerbindungsabbruchService` — TOCTOU zwischen `computeIfPresent`/`containsKey`. Single-Instance-Betrieb → praktisch irrelevant; bei Bedarf atomare `compute`-Operation.
  - **F3 (kosmetisch):** Gemergtes Passwort-Konto behält `authentifizierungsMethode=PASSWORT` statt korrekt. Gatet nichts Sensibles — nur Anzeige leicht ungenau.
  - **F4 (a11y):** `installiereDialogA11y`-Fokus-Trap lenkt Tab nur bei exaktem Fokus auf erstem/letztem Element um. In der Praxis ok. Optional härten.

---

## Meilensteine

- **M1 — Closed Beta** auf `zock.locodoko.de` ✅ Stack live (S152). Offen: BACKUP-DB-CRON Restore-Test (MENSCH, kurz) + Beta-Tester als Google Test-User eintragen (MENSCH).
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
