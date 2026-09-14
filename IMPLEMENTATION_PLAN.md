# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-09-14 (Session 157). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–156 archiviert).

## Notiz

**S157 — FE-SPIEL-BEENDET-OUTCOME committet (2026-09-14). Nächster Task: DOC-SPEC-ENVVAR-WHITELIST.**

- Beide Frontend-Fixes committet: Animation-Stop-Fix + GEWONNEN/VERLOREN-Flash. 478 Tests grün.
- Noch offen: 3 DOC/OPS-Tasks (WHITELIST_ENUMS, Spec-Update, X-Robots-Tag).

**Nächster Schritt:** DOC-SPEC-ENVVAR-WHITELIST — 7 Env-Var-Namen in check_specs.py WHITELIST_ENUMS eintragen.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S157 (2026-09-14): 478 FE-Tests grün, ESLint 0 Warnungen, 7 check_specs.py-Befunde. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

### Empfohlene Build-Reihenfolge (Block A — aktuelle Runde, Stand S157)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

- [x] **FE-ANIM-STOP-FIX** — Animation-Stop-Cleanup committen. Die Änderungen liegen bereits als uncommittete Working-Tree-Modifikationen vor (`AnimationenPrimitiven.ts` + `AnimationenService.ts`). Hintergrund: `warte()`-Promises hingen nach `stopAlles()`, weil laufende `setTimeout`-Resolver nie aufgerufen wurden; gleichzeitig lösten gestoppte Tweens (`tween.stop()`) die `onComplete`-Promise nicht auf. Fix: `laufendeWarteLoeser: Set<() => void>` trackt alle aktiven `warte()`-Resolver; `stopAlles()` ruft sie durch; `onStop: fertig` hinzugefügt. Validierung: `npm test && npm run build && npm run lint` grün. Erste Datei: `frontend/src/services/AnimationenPrimitiven.ts`.

- [x] **FE-SPIEL-BEENDET-OUTCOME** — GEWONNEN/VERLOREN-Flash committen. Änderungen liegen vor (`TischEreignisHandler.ts` + `FlashTextManager.ts`). `TischEreignisHandler` ermittelt die Partei des SUED-Spielers und vergleicht sie mit `letztesSpielergebnis.siegerPartei`; übergibt `{ gewonnen }` an `zeigeSpielevent('SpielBeendet')`. `FlashTextManager.spielBeendet()` zeigt "GEWONNEN" (grün, Konfetti + cameraFlash grün) oder "VERLOREN" (pink, kein Konfetti, cameraFlash rot). Validierung: `npm test && npm run build && npm run lint`. Erste Datei: `frontend/src/szenen/TischEreignisHandler.ts`.

- [ ] **DOC-SPEC-ENVVAR-WHITELIST** — `check_specs.py`: 7 Umgebungsvariablen-Namen in `WHITELIST_ENUMS` eintragen. `betrieb-deployment.md` referenziert `SPRING_PROFILES_ACTIVE`, `LOCODOKO_DB_USERNAME`, `LOCODOKO_DB_PASSWORD`, `LOCODOKO_DB_URL`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS`, `SENTRY_DSN`, `LOCODOKO_BUGREPORT_GITHUB_TOKEN` als Bezeichner in einer Tabelle — der Linter erkennt sie fälschlich als tote Enum-Konstanten. Fix: alle sieben in `WHITELIST_ENUMS = frozenset({...})` um Zeile 70 ergänzen. Verifikation: `python3 check_specs.py` → 0 Befunde. Erste Datei: `check_specs.py`.

- [ ] **DOC-FLASH-TEXT-VERLOREN** — `specs/frontend-flash-text.md` aktualisieren. Die Spec beschreibt `SpielBeendet` als rein grünes GEWONNEN-Banner. Nach FE-SPIEL-BEENDET-OUTCOME gilt: GEWONNEN = grün (Konfetti + Camera Flash grün), VERLOREN = pink (kein Konfetti, Camera Flash rot). Anpassen: (1) Event-Tabelle: `SpielBeendet`-Zeile ergänzen um GEWONNEN/VERLOREN-Unterscheidung; (2) Technische Hinweise Abschnitt: Camera Flash Grün → bedingt; (3) DoD-Checkbox für Visuelles Review auf `[x]` setzen (Review war ausstehend, aber Spec-Status ist Abgeschlossen — entweder Review nachholen oder Checkbox als „Design-Review in Vision-Loop nötig" offenlassen). Erste Datei: `specs/frontend-flash-text.md`.

- [ ] **OPS-SETUP-SERVER-NOINDEX** — `scripts/setup-server.sh`: `X-Robots-Tag`-Header im Caddyfile-Template nachpflegen. S155 hat den Header direkt via Paramiko auf prod1 gesetzt, aber das `setup-server.sh`-Skript schreibt das Caddyfile ohne diesen Header — bei Neuprovisioning geht er verloren. Fix: `header X-Robots-Tag "noindex, nofollow"` in den `zock.locodoko.de`-Block des generierten Caddyfiles eintragen (analog zu dem, was S155 direkt auf dem Server gesetzt hat). Prüfen: Struktur in `scripts/setup-server.sh` suchen, wo das Caddyfile via Heredoc oder Echo geschrieben wird. Keine Validierung via `caddy` möglich (kein Caddy in Sandbox) — Code-Review reicht. Erste Datei: `scripts/setup-server.sh`.

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung (Server/DNS/TLS/Docker/Google-Account/Plattformwahl). Ralph kann hier nur vorbereitende Config schreiben, nicht abschließen.

*(Alle MENSCH-Tasks dieser Runde erledigt — siehe Archiv Sessions 151–156)*

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

- [ ] **FE-RUNDENENDE-REDESIGN** (M2 — Design-Task, braucht User-Input) — Rundenende- und Partieende-Screen komplett neu gestalten. Aktuell: kleines PhaserModal mit lila Balatro-Palette — fühlt sich an wie ein Web-Popup. Ziel: Vollbild-Overlay mit Filz-Hintergrund + grüner Spieltisch-Palette (wie BestenlisterSzene), vernünftige Informationshierarchie (Teams/Augen/Sonderpunkte einzeln, Gesamtstand). `TischRundenEndeController.ts` ist die zentrale Datei. Vor Umsetzung: kurze Design-Abstimmung mit User (welche Infos prominent? getrennte oder zusammengeführte Screens?). Daten vorhanden: `augenRe/augenKontra`, `sonderpunkteRe[]`, `sonderpunkteKontra[]`, `gesamtpunktestand[]`.

- [ ] **FE-MOBILE** (M2 — Touch/Layout) — Mobile Touch funktioniert nicht. Ziel: separater Mobile-Screen mit größeren Karten, Touch-optimiertem Layout. Braucht visuelle Regressionstests für Mobile (Playwright Viewport 390×844 o.ä.), damit Fehler ohne echtes Gerät findbar sind. Kein Visual-Loop ohne Mobile-Viewport-Test möglich. Erst planen wenn FE-RUNDENENDE-REDESIGN und CI stehen (visuelle Tests benötigen stabilen Baseline).

- [ ] **CI-GITHUB-ACTIONS** (M2 — DevOps) — GitHub Actions Pipeline: `mvn clean test` + `npm test && npm run build && npm run lint` bei jedem Push/PR. Ziel: grüner Badge im Repo. User möchte alles in GitHub — Issues als Tickets, ggf. automatisierten Workflow der GitHub-Issues via `ralph.sh` abarbeitet (Idee: Issue-Label → Ralph-Run). Vorher: DECISION-LIZENZ abschließen.

- [ ] **UX-USER-FEEDBACK** (M2 — Nach Live-Gang) — In-Game Feedback-Kanal für Nutzer. Form noch offen: einfaches Kontaktformular, GitHub-Issue-Link, oder integrierter Feedback-Button im Spiel. Ziel: Nutzerfeedback nach öffentlichem Betrieb strukturiert sammeln.

---

## Entdeckungen

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
