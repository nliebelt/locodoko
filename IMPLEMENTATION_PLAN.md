# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-10-07 (Session 159). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–158 archiviert).

## Notiz

**Session 159 (2026-10-07): M2-Beta vollständig abgeschlossen. CD-Deploy via GitHub Actions erstmals erfolgreich gegen prod1.locodoko.de gelaufen (1m9s, alle Steps grün). GitHub Secrets gesetzt via gh CLI. Locodoko `active`, Actuator `/actuator/health` UP. Alloy-Config auf Prod aktuell, Service `active` — nur Grafana-Cloud-Tokens noch Platzhalter.**

**M2-Status:** Einziger verbleibender Go-Live-Blocker: Rechtstexte mit echten Daten füllen (MENSCH). CI/CD ✓ · Spielregeln ✓ · Mobile ✓ · Security ✓ · Lizenz ✓ · Multiplayer ✓.

**Entdeckung S157 korrigiert:** `de.locodoko.betrieb.SpielMetriken` existiert in `src/main/java/de/locodoko/betrieb/SpielMetriken.java:27` — kein Task nötig.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S159 (2026-10-07): check_specs.py 0 Befunde, locodoko active auf prod1, Actuator UP. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

### Empfohlene Build-Reihenfolge (Block Go-Live-Finish — aktuelle Runde, Stand S159)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

- [ ] **CI-FIX-DOCS-PAGES** — `ci-docs.yml` schlägt fehl mit „Get Pages site failed" (GitHub Pages im Repo noch nicht aktiviert). Fix: `actions/configure-pages@v4` bekommt `enablement: true` — das aktiviert Pages automatisch ohne manuellen Repo-Settings-Klick. Vorgehen: In `.github/workflows/ci-docs.yml` den Schritt „GitHub Pages konfigurieren" um `with: enablement: true` erweitern. Validierung: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-docs.yml'))"` → kein Fehler. Erste Datei: `.github/workflows/ci-docs.yml`.

- [ ] **CLEANUP-FE-ESLINT-COMPLEX** — `eslint-complexity.config.mjs` aus Code-Metrics-Befund S157: entweder via `extends` in einer ESLint-Config eingebunden (behalten + kommentieren warum) oder Dead Code (löschen). Vorgehen: (1) `grep -rn "eslint-complexity" frontend/` — prüfen ob die Datei importiert/referenziert wird; (2) wenn nirgends eingebunden → Datei löschen; wenn eingebunden → nichts ändern, Befund in `specs/code-metrics-report.md` als „aktiv genutzt" schließen. Validierung: `cd frontend && npm run build && npm run lint` grün. Erste Datei: `frontend/eslint-complexity.config.mjs` (oder `specs/code-metrics-report.md` falls nur Befund geschlossen).

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung — Ralph kann hier nur vorbereiten, nicht abschließen.

- [ ] **MENSCH-RECHT-TEXTE** (**Go-Live-Blocker**) — Platzhalter in den Rechtsseiten mit echten Daten füllen: `src/main/resources/static/impressum.html`, `datenschutz.html`, `agb.html`. Felder: `[Vollständiger Name]`, `[Straße und Hausnummer]`, `[PLZ] [Ort]`, `[Kontakt-E-Mail]`, `[Hosting-Provider: hosting.de, Deutschland]`, `[Datum]` in AGB. Anwalt-Review oder Generator (e-recht24.de) empfohlen. Danach `fertigstellung.md` M2-Checklist: `[x] Impressum + Datenschutzerklärung + AGB veröffentlicht`.

- [ ] **MENSCH-GRAFANA-TOKENS** — Echte Grafana Cloud Tokens in `/etc/default/alloy` auf prod1 setzen (Platzhalter aktiv seit S155). Alloy läuft, Config ist deployed — nur Tokens fehlen. Benötigt: Grafana Cloud Account (Free, EU-Region), dann in `/etc/default/alloy` (chmod 600): `GRAFANA_PROMETHEUS_URL`, `GRAFANA_PROMETHEUS_USER`, `GRAFANA_API_KEY`, `GRAFANA_LOKI_URL`, `GRAFANA_LOKI_USER`. Dann `systemctl restart alloy` + in Grafana Cloud prüfen ob Metriken/Logs ankommen. Details → `specs/betrieb-monitoring.md`.

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

- [x] **FE-RUNDENENDE-REDESIGN** — ✅ nach Sektion A verschoben (S157, Design-Abstimmung abgeschlossen). Vollständige Spec in Sektion A.

- [x] **FE-MOBILE** — ✅ in FE-MOBILE-DIAGNOSE + FE-MOBILE-FIX aufgeteilt und nach Sektion A verschoben (S158).

- [x] **CI-GITHUB-ACTIONS** — ✅ erledigt (war bereits in `CI-BUILD-TEST` committed, Plan nachgezogen S157).

- [ ] **UX-USER-FEEDBACK** (M2 — Nach Live-Gang) — In-Game Feedback-Kanal für Nutzer. Form noch offen: einfaches Kontaktformular, GitHub-Issue-Link, oder integrierter Feedback-Button im Spiel. Ziel: Nutzerfeedback nach öffentlichem Betrieb strukturiert sammeln.

---

## Entdeckungen

- **S158/FE-MOBILE-DIAGNOSE — RundenEnde/PartieEnde-Overlay auf Mobile abgeschnitten** (2026-09-14): Alle y-Offsets in `TischRundenEndeController.ts` waren für 720px Canvas hartkodiert. Auf Mobile Landscape (851×393px) liefen Verlaufstabelle, Σ-Zeile und Weiter/Neue-Partie-Buttons über den sichtbaren Bereich hinaus. Trenner (900px) überschritten Canvas-Breite. Fix: viewport-adaptiver `lo(bw, bh)`-Helper mit `skala = min(1, bh/680)`. Spieltisch, Seitenlade, Einstellungen, Letzter-Stich, Hilfe — alle bereits responsiv, kein weiterer Handlungsbedarf.


- **S157/FE-SPIELREGELN-HILFE — HilfeSzene war bereits vollständig vorhanden** (2026-09-14): `SpielregelnOverlay.ts` musste nicht neu angelegt werden — `HilfeSzene.ts` existierte bereits mit H-Taste, ?-TopBar-Icon und 4 Tabs. Ergänzt wurden: F1-Taste in `TischInputHandler.ts`, Tab `parteien` (Partei-Ermittlung + Hochzeit) und Tab `sonderpunkte` (FUCHS_GEFANGEN, KARLCHEN, DOPPELKOPF, Dulle-Regel, Gegen-die-Alten). Tab-Labels gekürzt für 6-Tab-Reihe. Task ist vollständig abgeschlossen.

- **S157/FE-UI-FINAL-REVIEW — Container.setMask() WebGL-Bug bestätigt** (2026-09-14): Browser-Konsole zeigt `Phaser.GameObjects.Components.Mask.setMask: This method is not supported in WebGL. Create a Mask filter instead.` beim Öffnen des RundenEnde-Overlays. Ursache: `TischRundenEndeController.ts` Zeile 395 ruft `this.tabellenContainer.setMask(maske)` auf — Phaser 3 unterstützt `Container.setMask()` in WebGL nicht. Folge: Scroll-Clipping für die Verlaufstabelle ist wirkungslos, Zeilen außerhalb des 5-Zeilen-Fensters werden nicht ausgeblendet. Fix → FE-FIX-MASK-WEBGL (Maske auf einzelne Text-Objekte in `zeichneTabelle()` verlagern).

- **S157/FE-UI-FINAL-REVIEW — Mobile-Screenshots veraltet** (2026-09-14): `mobile-landscape-05-*.png` stammt vom 2026-07-04 (vor FE-RUNDENENDE-REDESIGN). Der Vision Loop setzt `VISION_MOBILE=1` voraus (per `playwright.config.vision.ts`) — ohne diese Env-Variable werden nur Desktop-Shots neu aufgenommen. Nach FE-FIX-MASK-WEBGL sollte einmal `VISION_MOBILE=1 npx playwright test --config playwright.config.vision.ts` laufen, um Mobile-Baseline zu erneuern.

- **S157/FE-UI-FINAL-REVIEW — vision-loop-szenen.spec.ts Timeout** (2026-09-14): `warteAufSzene(page, 'LoginSzene')` läuft in 20 s timeout, weil der Nutzer bereits eingeloggt ist und die `LoginSzene` übersprungen wird. Kein Regressionsproblem — pre-existing Annahme im Test (immer ausgeloggt starten). Kein Code-Handlungsbedarf im Rahmen der aktuellen Tasks.

- **S157/Folge — OPS-GRAFANA-SPRING war bereits vollständig implementiert** (2026-09-14): `micrometer-registry-prometheus`, Actuator-Konfiguration und `specs/betrieb-monitoring.md` waren bereits im Repo vorhanden — Task war nur im Plan nicht abgehakt. `specs/betrieb-monitoring.md` dokumentiert außerdem eine `de.locodoko.betrieb.SpielMetriken`-Komponente (Domain-Metriken per `SpielBeendet`-Event), deren Java-Implementierung nicht gefunden wurde. Falls dieser Code fehlt, wäre ein eigener Task `OPS-SPIEL-METRIKEN` sinnvoll.

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
