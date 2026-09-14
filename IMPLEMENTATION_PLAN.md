# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-09-14 (Session 157). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–156 archiviert).

## Notiz

**BE-SPIELVERLAUF erledigt (2026-09-14). Nächster Task: FE-RUNDENENDE-REDESIGN.**

- `PartieStandAntwort` um `spielverlauf: List<LetztesSpielergebnisAntwort>` erweitert (alle abgeschlossenen Spiele).
- Frontend: `TischAnsichtModell.spielverlauf: LetztesSpielergebnisAnsicht[]` + Mapping in beiden Hilfsfunktionen.
- WireFormat-Baseline neu generiert (additives Feld, kein Breaking Change).
- Nächste Aufgabe: FE-RUNDENENDE-REDESIGN — Vollbild-Overlay mit scrollbarer Verlaufstabelle (nutzt jetzt `spielverlauf`).

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S157 (2026-09-14): 478 FE-Tests grün, ESLint 0 Warnungen, 7 check_specs.py-Befunde. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

### Empfohlene Build-Reihenfolge (Block M2-Beta — aktuelle Runde, Stand S157)

> Nimm den **obersten noch offenen** Task. Alle autonom. Diese Sektion ist die EINZIGE
> Build-Reihenfolge — alte Runden-Sektionen werden beim Plan-Scan entfernt.

- [x] **BE-SPIELVERLAUF** — `PartieStandAntwort` um `spielverlauf: List<LetztesSpielergebnisAntwort>` erweitern (alle abgeschlossenen Spiele der aktuellen Partie). Vorgehen: (1) In `PartieStandAntwort.java` ein neues Record-Feld `List<LetztesSpielergebnisAntwort> spielverlauf` ergänzen (nach `letztesSpielergebnis`); (2) In der `aus()`-Fabrikmethode befüllen: `partie.spiele().stream().filter(s -> s.ergebnis().isPresent()).map(LetztesSpielergebnisAntwort::aus).toList()`; (3) Im Frontend `TischAnsichtModell.ts`: Interface `TischAnsichtModell` bekommt `spielverlauf: LetztesSpielergebnisAnsicht[]`, Defaultwert `[]`; Mapping in `erstelleTischAnsichtAusStatus()` analog zu `letztesSpielergebnis` (alle Einträge von `partieStand.spielverlauf` mappen). Der neue JSON-Key ist additiv — kein Breaking Change. Validierung: `mvn clean test` grün; `cd frontend && npm test && npm run build && npm run lint` grün. Erste Datei: `src/main/java/de/locodoko/tisch/PartieStandAntwort.java`.

- [ ] **FE-RUNDENENDE-REDESIGN** — `TischRundenEndeController.ts` vollständig neu gestalten. Vorbedingung: BE-SPIELVERLAUF erledigt. **Design-Spec:**  
  *Palette:* Grüne Spieltisch-Palette durchgehend (kein Lila mehr): Hintergrund-Overlay `0x0d1f0d` (semi-transparent, alpha 0.92), Trenner `0x4a7c59`, Standardtext `#a3c4a8`, Überschrift weiß `#f8f9fa`, Gold `#f8c94e`, Re-Farbe `#f8c94e` (gold), Kontra-Farbe `#90caf9` (hellblau), Negativ `#ff6b6b`.  
  *Layout RundenEnde:* Vollbild-Overlay (kein PhaserModal) — `Graphics`-Rechteck über volle Canvas-Größe + `Container` für Inhalt. Zeilen von oben: (a) Spieltyp + Spielnummer, klein, grau-grün; (b) „★ RE GEWINNT ★" / „★ KONTRA GEWINNT ★", groß, Teamfarbe, bestehende Count-up-Animation für Spielwert beibehalten; (c) Zwei Spalten Re/Kontra: je Spalte Augen-Zahl prominent, darunter alle Sonderpunkte einzeln aufgelistet via `formatiereSonderpunkt()` — bei 0 Sonderpunkten „(keine)" anzeigen; (d) Berechnungszeile mittig: „Grundwert +X · Ansagen +Y → Spielwert: +Z"; (e) Spielerpunkte, nach Partei gruppiert (Re links, Kontra rechts), eigener Spieler gold markiert; (f) Trennlinie + „Bisherige Spiele"-Überschrift; (g) **Scrollbare Verlaufstabelle** (Spalten: Nr │ Typ │ Sieger │ Spielername₁ │ … │ Spielername₄) — das aktuelle Spiel mit „▶" und hellerer Hintergrundfarbe hervorgehoben; Scroll via `scene.input.on('wheel', …)` auf einem maskierten Container (`scene.add.graphics()` + `setMask()`); sichtbarer Bereich ~5 Zeilen, Rest scrollbar; (h) Σ-Zeile (Gesamtstand) immer sichtbar unterhalb der Tabelle (nicht scrollt mit); (i) „Weiter"-Button unten mittig.  
  *Layout PartieEnde:* Gleiche Palette und Struktur; statt „Weiter" zwei Buttons „Neue Partie" + „Tisch verlassen"; Countdown-Text klein unter Buttons; Gesamtstand-Tabelle mit ★ beim Führenden.  
  *Scroll-Implementierung:* `maxSichtbareZeilen = 5`, `zeilenHoehe = 20`, `scrollOffset` als Instanzvariable; wheel-Event in `zeigeRundenEndeModal` registrieren, in `schliesseRundenEndeModal` entfernen; `zeichneTabelle()`-Methode, die bei jedem Scroll neu rendert (alte Zeilen zerstören + neu erzeugen oder per Y-Offset auf Container).  
  Validierung: `npm test && npm run build && npm run lint` grün; danach Vision Loop `cd e2e && npx playwright test vision-loop.spec.ts --headed` — Screenshots einlesen und visuell prüfen. Erste Datei: `frontend/src/szenen/TischRundenEndeController.ts`.

- [ ] **FE-UI-FINAL-REVIEW** — Systematisches UI-Review per Vision Loop direkt nach FE-RUNDENENDE-REDESIGN. Vorbedingung: FE-RUNDENENDE-REDESIGN erledigt und Backend läuft. Schritte: (1) Backend starten (`mvn spring-boot:run &`, warten bis Port 8080 antwortet); (2) `cd e2e && npx playwright test vision-loop.spec.ts --headed`; (3) alle Screenshots in `e2e/screenshots/` mit dem Read-Tool einlesen und visuell bewerten: Lobby, Spieltisch, Rundenende-Overlay, PartieEnde-Overlay, Bestenliste; (4) Befunde mit konkreten Dateinamen + Zeilennummern als neue `[ ]`-Tasks in Sektion A eintragen (Format: `FE-FIX-<KURZNAME>`); (5) Backend stoppen. Keine Code-Änderungen in diesem Task — nur Diagnose + Plan. Validierung: mindestens 5 Screenshots gelesen, Befunde als Tasks eingetragen (oder explizit „keine Befunde" vermerkt). Erste Datei: `IMPLEMENTATION_PLAN.md` (neue FE-FIX-Tasks).

- [ ] **FE-SPIELREGELN-HILFE** — In-App Doppelkopf-Regelreferenz als eigene Overlay-Klasse. Vorgehen: (1) `frontend/src/szenen/SpielregelnOverlay.ts` anlegen — `Phaser.GameObjects.Container`-basiertes Vollbild-Overlay, gleiche grüne Spieltisch-Palette wie RundenEnde-Redesign; (2) 5 Seiten (per Index 0–4) mit Prev/Next-Navigation: **Seite 0** Trumpf-Reihenfolge (Dulle > Bube Kreuz/Pik/Herz/Karo > Dame Kreuz/Pik/Herz/Karo > Karo A/10/K/9/8/7, dann Fehlfarben); **Seite 1** Partei-Ermittlung (Kreuz-Damen = Re; wer keine hat = Kontra; Hochzeit-Sonderregel); **Seite 2** Sonderpunkte (Fuchs gefangen, Karlchen, Dulle fängt Dulle, Doppelkopf, vollständige Liste aus `Sonderpunkt`-Enum); **Seite 3** Ansagen (Re/Kontra/Keine-90/Keine-60/Keine-30/Schwarz + Zeitfenster); **Seite 4** Spieltypen (Normalspiel, Solo-Varianten, Hochzeit, Armut, Bockrunde); (3) Öffnen per Tastatur: `F1` (nur wenn kein Shift gedrückt, damit Shift+F1 Bug-Report unberührt bleibt) und per Help-Button `?` in der TischSzene (kleines `Text`-Objekt oben rechts, depth 50); (4) Schließen per Escape oder X-Button; (5) Overlay-Instanz als Instanzvariable in `TischSzene` halten, `zeigeSpielregeln()` / `schliesseSpielregeln()` Methoden. Validierung: `npm test && npm run build && npm run lint` grün; Vision Loop Screenshot — Overlay muss auf Screen-2 sichtbar sein. Erste Datei: `frontend/src/szenen/SpielregelnOverlay.ts`.

- [ ] **CD-DEPLOY** — GitHub Actions CD-Pipeline schreiben. Vorgehen: (1) `.github/workflows/cd.yml` anlegen: Trigger `workflow_dispatch` (manuell, kein Auto-Push); Job `deploy` auf `ubuntu-latest`; Schritte: checkout, Java 21 temurin setup, `mvn clean package -DskipTests -q`, SSH-Agent mit Secret `SSH_PRIVATE_KEY`, `ssh-keyscan` für `SSH_KNOWN_HOSTS`, `scp target/locodoko-*.jar $SERVER:/opt/locodoko/locodoko.jar`, `ssh $SERVER "systemctl restart locodoko"`, Healthcheck `ssh $SERVER "systemctl is-active locodoko"`; Secrets: `SSH_PRIVATE_KEY` (Ed25519 privater Schlüssel), `SSH_KNOWN_HOSTS` (Output von `ssh-keyscan prod1.locodoko.de`), `DEPLOY_HOST` (`root@prod1.locodoko.de`); (2) `DEPLOY_SECRETS.md` im Repo-Root anlegen: erklärt welche 3 Secrets in GitHub repo settings → Secrets and variables → Actions angelegt werden müssen, mit Beispiel-Befehlen zum Erzeugen; (3) YAML syntaktisch validieren: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/cd.yml'))"`. ⚠️ CI-Verifikation via `gh run watch` erfordert validen `GH_TOKEN` mit Scopes `repo`+`workflow` — ohne Token nur lokale YAML-Validierung möglich. Erste Datei: `.github/workflows/cd.yml`.

- [x] **DECISION-LIZENZ-LICENSE** — `LICENSE`-Datei mit Apache-2.0-Text anlegen. Entscheidung S157: **Apache-2.0**. Vorgehen: vollständigen Apache-2.0-Lizenztext (Copyright 2024–2026 Nils Liebelt) als `LICENSE` im Repo-Root anlegen. Außerdem in `fertigstellung.md` unter „Offene Entscheidungen" die Lizenz-Zeile auf `✅ Apache-2.0 (S157)` setzen, und `DECISION-LIZENZ` in `IMPLEMENTATION_PLAN.md` Sektion C auf `[x]` setzen. Validierung: kein Build-Schritt nötig — `python3 check_specs.py` läuft als Smoke-Test. Erste Datei: `LICENSE`.

- [x] **CI-GITHUB-ACTIONS** — `.github/workflows/ci.yml` anlegen. Trigger: `push` und `pull_request` auf `main`. Jobs: (1) `backend` — Ubuntu latest, Java 21 (temurin), `mvn clean test -q`; (2) `frontend` — Node 20, `cd frontend && npm ci && npm test --silent && npm run build && npm run lint`. Cache: Maven `~/.m2`, npm `~/.npm`. Keine weiteren Abhängigkeiten zwischen Jobs. Validierung: Datei syntaktisch korrekt (YAML-Linting via `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` oder äquivalent). Erste Datei: `.github/workflows/ci.yml`.

- [x] **QA-CODE-METRICS-SETUP** — Mess-Werkzeuge verdrahten. Backend: `jacoco-maven-plugin` in `pom.xml` (Goals `prepare-agent` + `report` an `verify`-Phase, Konfiguration: `destFile`, `dataFile`, Output nach `target/site/jacoco/`). Frontend: `knip`, `madge`, `depcheck` als dev-Dependencies in `package.json` + npm-Scripts `"knip": "knip"`, `"madge": "madge src --circular"`, `"depcheck": "depcheck"`. Validierung: `mvn clean verify -q` (JaCoCo-Report entsteht), `cd frontend && npm run knip`, `npm run madge`, `npm run depcheck` laufen ohne Abbruch (Befunde sind ok, Exit-Code-Fehler dokumentieren). Erste Datei: `pom.xml`.

- [x] **QA-CODE-METRICS-REPORT** — Alle Metriken auswerten und dokumentieren. Vorbedingung: QA-CODE-METRICS-SETUP erledigt. Schritte: (1) `mvn clean verify -q` → JaCoCo-Gesamtdeckung aus `target/site/jacoco/index.html` auslesen; (2) `cd frontend && npm run knip` → tote Exporte/Dateien; (3) `npm run madge` → zirkuläre Abhängigkeiten; (4) `npm run depcheck` → ungenutzten Dependencies. Befunde in `specs/code-metrics-report.md` dokumentieren (Tabelle: Metrik / Wert / Trend / Handlungsbedarf). Für jeden kritischen Befund (Coverage < 60 %, zirkuläre Deps, ungenutzte Deps) einen neuen `[ ]`-Task in Sektion A des Plans anlegen. Validierung: `python3 check_specs.py` → 0 Befunde. Erste Datei: `specs/code-metrics-report.md`.

- [x] **OPS-GRAFANA-SPRING** — Spring Boot für Prometheus-Scraping vorbereiten. Schritte: (1) `micrometer-registry-prometheus` in `pom.xml` ergänzen (kein explizites Version-Tag nötig — Spring Boot BOM verwaltet); (2) in `src/main/resources/application.properties` (bzw. prod-Profil falls vorhanden): `management.endpoints.web.exposure.include=health,info,prometheus` und `management.endpoint.prometheus.enabled=true` setzen — dabei prüfen ob der Endpoint nicht schon existiert; (3) `specs/betrieb-monitoring.md` neu anlegen: Zweck, Prometheus-Endpunkt (`/actuator/prometheus`), empfohlene Grafana-Cloud-Einrichtung (Alloy-Config-Snippet für `locodoko`-Job, DE-Region), wichtigste JVM- und App-Metriken die zu beobachten sind. Validierung: `mvn clean test -q` grün. Erste Datei: `pom.xml`.

- [x] **SPEC-RECHT-DRAFT** — `specs/recht-impressum-datenschutz.md` anlegen. Inhalt: (1) **Impressum-Template** (§5 DDG Pflichtfelder für DE-Betreiber: vollständiger Name, Anschrift, E-Mail-Adresse — Platzhalter `[NAME]`, `[ADRESSE]`, `[E-MAIL]` markieren); (2) **Datenschutzerklärung-Template** (DSGVO-Pflichtangaben: Verantwortlicher, Verarbeitungszwecke je Funktion — Google OAuth, Passwort-Auth, Session, Logs/Monitoring, Bug-Report —, Rechtsgrundlagen Art. 6 DSGVO, Hosting-Standort DE, Löschfristen, Betroffenenrechte, Kontakt Datenschutz); (3) **Checkliste vor Go-Live** (Texte mit echten Daten befüllen, Anwalt-Review empfohlen, Impressum im Footer verlinkt, Cookie-Hinweis falls nötig). Ton: sachlich-technisch, keine Rechtsberatung — explizit als Vorlage kennzeichnen. Validierung: `python3 check_specs.py` → 0 Befunde. Erste Datei: `specs/recht-impressum-datenschutz.md`.

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

- [ ] **FE-RUNDENENDE-REDESIGN** — ✅ nach Sektion A verschoben (S157, Design-Abstimmung abgeschlossen). Vollständige Spec in Sektion A.

- [ ] **FE-MOBILE** (M2 — Touch/Layout) — Mobile Touch funktioniert nicht. Ziel: separater Mobile-Screen mit größeren Karten, Touch-optimiertem Layout. Braucht visuelle Regressionstests für Mobile (Playwright Viewport 390×844 o.ä.), damit Fehler ohne echtes Gerät findbar sind. Kein Visual-Loop ohne Mobile-Viewport-Test möglich. Erst planen wenn FE-RUNDENENDE-REDESIGN und CI stehen (visuelle Tests benötigen stabilen Baseline).

- [x] **CI-GITHUB-ACTIONS** — ✅ erledigt (war bereits in `CI-BUILD-TEST` committed, Plan nachgezogen S157).

- [ ] **UX-USER-FEEDBACK** (M2 — Nach Live-Gang) — In-Game Feedback-Kanal für Nutzer. Form noch offen: einfaches Kontaktformular, GitHub-Issue-Link, oder integrierter Feedback-Button im Spiel. Ziel: Nutzerfeedback nach öffentlichem Betrieb strukturiert sammeln.

---

## Entdeckungen

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
