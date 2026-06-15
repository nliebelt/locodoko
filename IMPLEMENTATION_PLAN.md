# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-06-15 (Session 129). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–128 archiviert).

## Notiz

**QA-METRICS-REFRESH + QA-METRICS-TOOLING** abgeschlossen (Session 129).

- `scripts/metrics.sh` auf echte Tooling-Basis umgestellt: lizard CCN (BE-Hotspots), coverage-final.json-Parser (FE-Coverage), Surefire-XML-Parser (BE-Testzahl), scc-Fallback (kein Gate).
- `docs/metrics.md` neu generiert (Stand 2026-06-15): BE **503 Tests** / FE **467 Tests**, BE Coverage 86%/75% Branches, FE Coverage 84%/83%.
- lizard wird bei fehlendem PATH via `python3 -m pip install --user lizard` automatisch installiert.
- **Entdeckung:** `Tisch`-Klasse in `de.locodoko.partie` hat **0% Line-Coverage** (25 LOC) — als Lücken-Task vermerkt.

**Nächster Schritt:** QA-FE-BIOME-COMPLEXITY (Biome additiv als kognitives Komplexitäts-Gate einführen).

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S126: Code sehr sauber (keine TODO/FIXME, keine verschluckten Exceptions, kein `any` im FE-Quellcode, jede FE-Datei getestet, Prod-Deps 0 CVEs). Das sind die realen offenen Hebel. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

- [x] **QA-VISION-MOBILE-LANDSCAPE** (E2E/Vision, autonom — **Backend muss laufen**, klein-mittel) — Verifikation der DISCO-S126-Umstellung: der Vision-Loop läuft jetzt unter dem Projekt **`mobile-landscape`** (851×393), erzeugt aber noch **keine** frischen Screenshots (alter `mobile-portrait`-Satz wurde S126 entfernt). **Fix/Schritte:** Backend starten (`mvn spring-boot:run`), `cd e2e && npx playwright test --config playwright.config.vision.ts` (beide Specs, beide Projekte) fahren; die neuen `mobile-landscape-*.png` **und** die `desktop-*.png` mit dem Read-Tool gegen `specs/frontend-visuelles-design.md` sichten; Layout-Mängel im Querformat (Kartenreihe, Nameplates, HUD, Modals bei 851×393) als gezielte Fixes beheben (real gerenderte Maße statt Hardcode), Retro-Look behalten. **DoD:** beide Projekte grün < 30 s je Szenen-Lauf; `mobile-landscape-*` Screenshots committet und visuell defektfrei; gefundene Defekte gefixt oder als „kein Defekt" vermerkt. **Risiko:** niedrig-mittel.

- [x] **CLEANUP-VISION-SCREENSHOT-DUBLETTE** (E2E/Cleanup, autonom, winzig) — `desktop-01-lobby.png` und `desktop-11-offene-tische.png` sind **byte-identisch** (md5 `0dd0b563…`, Befund schon S120) — der „gefüllte Tischliste"-Screen wird nicht eigenständig erzeugt. **Fix:** im Szenen-Spec sicherstellen, dass `desktop-11` tatsächlich die gefüllte Lobby (2. Kontext) fotografiert, oder den redundanten Shot streichen. Am besten im selben Lauf wie **QA-VISION-MOBILE-LANDSCAPE** miterledigen. **DoD:** kein byte-identisches Screenshot-Paar mehr, das verschiedene Zustände darstellen soll. **Risiko:** niedrig.

- [x] **SEC-DEPS-FE-DEV-AUDIT** (Frontend/Sicherheit, autonom, klein) — `npm audit` meldet **7 Schwachstellen in Dev-Deps** (1 moderate `brace-expansion`, 4 high/2 critical über die `esbuild`→`vite`→`vitest`/`@vitest/*`-Kette). **Prod-Deps: 0 CVEs** (nicht ausgeliefert → kein Live-Blocker, aber Toolchain-Hygiene + Supply-Chain). **Fix:** `npm audit fix` für `brace-expansion` (non-breaking); für die esbuild/vite-Kette `npm audit fix --force` evaluieren = **Major-Bumps** (Vite/Vitest) — nur mit anschließend grünem `npm test && npm run build && npm run lint` übernehmen, sonst gezielt einzelne Transitives anheben. **Erste Datei zuerst:** `frontend/package.json` / `package-lock.json`. **DoD:** `npm audit` ohne high/critical (oder dokumentierte, unvermeidbare Rest-Advisories); FE-Suite + Build + Lint grün. **Risiko:** mittel (Major-Tooling-Bump kann Tests/Build brechen).

- [x] **QA-METRICS-REFRESH** (QA/Doc, autonom, klein) — `docs/metrics.md` ist auf Stand **S120** (BE 485 / FE 461 Tests); seither **BE 500 / FE 465**. **Fix:** `mvn clean verify` (JaCoCo) + `cd frontend && npx vitest run --coverage` neu vermessen, Zahlen + Datum aktualisieren, verbleibende Branch-Lücken benennen. Dabei die per-Namensheuristik testdatei-losen, aber ggf. nur indirekt abgedeckten Service-Klassen (z.B. `PartieLifecycleService`, `TischEchtzeitService`, `SpielverwaltungWebSocketController`) gegen den realen JaCoCo-Report prüfen und echte Lücken als Folge-Test-Tasks notieren. **Erste Datei zuerst:** `docs/metrics.md`. **DoD:** Report mit S128-Zahlen, reproduzierbar; etwaige echte Lücken als Tasks erfasst. **Risiko:** niedrig.

- [ ] **PERF-FE-BUNDLE-SPLIT-2** (Frontend, autonom, klein, optional) — trotz `PERF-FE-BUNDLE-SPLITTING` (Phaser-Vendor-Chunk) bleibt der `phaser-vendor`-Chunk **1,48 MB** und löst weiter die „chunks > 600 kB"-Build-Warnung aus. **Optionen:** (a) Szenen via `import()` lazy laden (echtes Code-Splitting des App-Teils), oder (b) die Warnung bewusst belassen und `chunkSizeWarningLimit` mit dokumentierter Begründung setzen (Phaser ist als Engine unteilbar). **Erste Datei zuerst:** `frontend/vite.config.ts`. **DoD:** entweder kleinere Initial-Chunks oder dokumentierte, bewusste Limit-Entscheidung; Build + Lint + Vision-Smoke grün. **Risiko:** niedrig.

- [ ] **QA-FE-BIOME-COMPLEXITY** (Frontend, autonom, klein — moderne Komplexitäts-Analyse, Session 128 prototypisiert) — **Biome additiv** als kognitives Komplexitäts-Gate einführen (ESLint bleibt Haupt-Linter, User-Entscheidung S128). **Schritte:** (1) `@biomejs/biome` als devDep; (2) `frontend/biome.json` mit **nur** der Regel `complexity.noExcessiveCognitiveComplexity` (`recommended:false`, alle anderen Regeln aus — Formatierung/Stil bleibt bei ESLint/Prettier); (3) npm-Script `"complexity": "biome lint --config-path=. src"`; (4) **Baseline-Schwelle** zunächst auf den Ist-Höchstwert setzen, sodass der Lauf **grün** ist (S128-Messung: Schwelle 40 → 0 Verstöße; der schlimmste Treffer liegt kognitiv im Bereich 31–39), dann in einem Kommentar dokumentieren + als Folge-Tasks schrittweise senken (40 → 30 → 25 → 20 → 15) und je Stufe die Ausreißer refactoren. **Bekannte kognitive Hotspots (Biome S128, Schwelle 15 → 14 Treffer):** `PartieStore.ts:140`, `TischInputHandler.ts:53/219`, `TischRundenEndeController.ts:32/146`, `layout.ts:71`, `SpielprotokollOverlay.ts:127`, `TischKartenRenderer.ts:362`, `BestenlisterSzene.ts:113`, `TischAnimationOrchestrator.ts:105`, `TischHudRenderer.ts:26`, `SpielerProfilModal.ts:132`, `SpielverwaltungApi.ts:76`, `AnimationenPrimitiven.ts:37`. **Erste Datei zuerst:** `frontend/package.json` + neue `frontend/biome.json`. **DoD:** `npm run complexity` läuft grün (Baseline-Schwelle), bricht bei Überschreitung; `npm test && npm run build && npm run lint` weiterhin grün; ggf. in CI als eigener Step. **Risiko:** niedrig (additiv, ESLint-Config unberührt).

- [x] **QA-METRICS-TOOLING** (QA/Doc, autonom, klein — am besten mit QA-METRICS-REFRESH bündeln) — `scripts/metrics.sh` von handgezählten LOC/grep-Heuristiken auf echte Werkzeuge umstellen: **`lizard`** (zyklomatische Komplexität + Token-Count, **Java *und* TS** in einem Lauf — ersetzt „größte Klasse als Komplexitäts-Proxy") als nicht-brechenden Report-Step; optional **`scc`** für LOC + **COCOMO-Kostenschätzer**. Beides nur Report, **kein** Build-Gate (das Gate ist FE=Biome, siehe QA-FE-BIOME-COMPLEXITY). **S128-Messung als Erwartungswert:** BE Avg CCN 1.9, nur 2 Funktionen > 15 (max `KiTischOrchestrator::automatisiereTisch` CCN 20); FE Avg CCN 2.4, 8 Funktionen > 15 (max `TischInputHandler::verarbeiteTastatureingabe` CCN 34). **Installation/Reproduzierbarkeit (wichtig):** `lizard` ist **kein** Repo-Dependency und liegt **nicht** im PATH — das Skript muss die Verfügbarkeit selbst sicherstellen (z.B. `python3 -m pip install --user lizard` bzw. venv/pipx und Aufruf via `python3 -m lizard`; `scc` ist ein Go-Binary, nur nutzen wenn vorhanden, sonst überspringen). Nicht auf einen lokal vorinstallierten Stand verlassen; bei fehlendem Tool den Step sauber überspringen statt das Skript abbrechen zu lassen. **Erste Datei zuerst:** `scripts/metrics.sh` + `docs/metrics.md`. **DoD:** Report nutzt `lizard` (+ggf. `scc`) statt `find|wc`-Heuristik; CC-Top-20 + COCOMO im Report; Skript reproduzierbar **auf einer frischen Umgebung** (Tool-Installation/-Fallback im Skript geregelt). **Risiko:** niedrig.

### Empfohlene Build-Reihenfolge (Block A)

> Nimm den **obersten noch offenen** Task. Alle autonom; bei Vision-Tasks fährt Ralph das Backend selbst headless hoch.

1. ~~**QA-VISION-MOBILE-LANDSCAPE** (+ **CLEANUP-VISION-SCREENSHOT-DUBLETTE** im selben Lauf bündeln)~~ ✓ S129
2. ~~**SEC-DEPS-FE-DEV-AUDIT**~~ ✓ S129
3. ~~**QA-METRICS-REFRESH** (+ **QA-METRICS-TOOLING** im selben Lauf bündeln)~~ ✓ S129
4. **QA-FE-BIOME-COMPLEXITY**
5. **PERF-FE-BUNDLE-SPLIT-2** (optional)

### Review-Notizen S126 (offen, niedrigste Prio / Deploy-nah — keine eigenen Tasks)

- **B2/B3 (low, Nebenläufigkeit):** `VerbindungsabbruchService` — TOCTOU zwischen `computeIfPresent`/`containsKey` in `verarbeiteDisconnect` (meist selbstheilend) und fehlender expliziter `aktiveWsSessionen`-Evict bei Session-Expiry (defensiv). Single-Instance-Betrieb → praktisch irrelevant; bei Bedarf in eine atomare `compute`-Operation ziehen.
- **F2 (Deploy):** `sourcemap:'hidden'` schreibt die ~10,9-MB-`.map` weiterhin nach `dist/` → bei statischer Auslieferung per URL-Raten abrufbar (Quellcode-Exposure). An **OBS-SENTRY/Deploy** koppeln: `.map` nicht ins öffentlich servierte Verzeichnis legen (nur zu Sentry hochladen) oder in Prod `sourcemap:false`.
- **F3 (kosmetisch):** Ein per OAuth gemergtes Passwort-Konto behält `authentifizierungsMethode=PASSWORT`, obwohl es auch OAuth-fähig ist. Gatet nichts Sensibles — nur das Anzeigefeld in `AuthentifizierungsAntwort` ist leicht ungenau. Eher dokumentieren als ändern.
- **F4 (a11y):** `installiereDialogA11y`-Fokus-Trap lenkt Tab nur um, wenn der Fokus exakt auf erstem/letztem Element liegt; liegt er außerhalb des Containers, läuft Tab durch. In der Praxis ok (Dialoge fokussieren initial nach innen). Optional härten.

---

## B) Vorbedingung: MENSCH (Ralph überspringt, bis erfüllt)

> Externe Voraussetzung (Server/DNS/TLS/Docker/Google-Account/Plattformwahl). Ralph kann hier nur vorbereitende Config schreiben, nicht abschließen.

- [ ] **DEPLOY-COMPOSE-SMOKE** — Vollen prod-Stack lokal hochfahren und eine Partie durchspielen. **[Vorbedingung: MENSCH — Docker + echtes Postgres; hängt an BUG-PROD-CHANGELOG ✓]**

  Vorhandene Bausteine: `docker-compose.yml` (Services `postgres` + `app`, Profil `prod`, ENV-Wiring), `Dockerfile.app` (Multi-Stage). Bislang nie real verifiziert. **Schritte:** 1. `docker compose --profile prod up --build -d`. 2. Warten bis `postgres` healthy + `curl -s http://localhost:8081/actuator/health` „UP". 3. Liquibase-Migration im App-Log prüfen. 4. Eine Partie gegen KI bis zur Auswertung durchspielen. 5. Stack runterfahren. **DoD:** prod-Stack startet reproduzierbar, Health UP, eine Partie läuft durch; Fehler als eigene `BUG-…`-Tasks. **Gate für** REFACTOR-DB-Härtung-Verifikation gegen echtes Postgres 17. **Risiko:** mittel.

- [ ] **CI-DOCKER-BUILD** — Produktions-Image bauen und nach GHCR pushen. **[hängt an CI-BUILD-TEST ✓, DEPLOY-COMPOSE-SMOKE]**

  `.github/workflows/ci.yml` erweitern (oder `release.yml`): `Dockerfile.app` bauen, mit Commit-SHA + `latest` taggen, nach `ghcr.io/<owner>/locodoko` pushen (nur `main`/Tag, `packages: write`). **DoD:** Nach Push auf `main` liegt ein lauffähiges Image in GHCR. **Risiko:** niedrig.

- [ ] **CD-DEPLOY** — Auto-Deploy auf die Zielplattform. **[BLOCKED: Plattformwahl offen — kein echter Deploy ohne fertige Domain]**

  **Harte Anforderung:** EU/DE-Hosting (Datenresidenz). US-Anbieter (Fly.io, Railway) ausgeschlossen. Engere Wahl: Hetzner 🇩🇪, Scaleway 🇫🇷, Netcup 🇩🇪, OVHcloud 🇫🇷. Tendenz: günstiger VPS via `docker compose`. Bis zur Entscheidung: dokumentierter manueller Roll-out (`docker compose pull && docker compose --profile prod up -d`). **DoD (bei Entsperrung):** Push auf `main` → automatischer Deploy + Health-Check. **Risiko:** plattformabhängig.

- [~] **OPS-DOMAIN** — Domain + DNS + TLS. **[Vorbedingung: MENSCH — Server/DNS/TLS; Ralph kann nur die Reverse-Proxy-Config vorbereiten]**

  **Schema festgelegt:** App = `zock.locodoko.de`, Wiki = `docs.locodoko.de` (GitHub Pages), Apex `locodoko.de` = Landing/Redirect. Gebraucht: OAuth2-Redirect-URI (`https://zock.locodoko.de/login/oauth2/code/google`), `cookie.secure=true` + Cookie-Domain `zock.locodoko.de`, `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de`. **Schritte:** DNS-Records (`zock` + `docs`), TLS via Reverse-Proxy (Caddy/Traefik + Let's Encrypt), **WebSocket-Upgrade-Header durchreichen** (Snapshot+Hint bricht sonst), HTTP→HTTPS-Redirect, Apex → 301 auf `zock.`. **Closed-Beta-noindex:** `index.html` (`<meta robots noindex>`) + `robots.txt` (`Disallow: /`) bereits gesetzt; im Reverse-Proxy zusätzlich `X-Robots-Tag: noindex, nofollow`. **Bei Public Go-Live (M2) alle drei zurücknehmen.** **DoD:** `https://zock.locodoko.de` zeigt auf die App, WS funktioniert durch den Proxy. **Risiko:** niedrig.

---

## C) Wartet auf User-Entscheidung

- [ ] **DECISION-LIZENZ** — Projektlizenz festlegen + `LICENSE`-Datei anlegen. **[WARTET AUF USER-ENTSCHEIDUNG — bewusst aufgeschoben]**

  Tendenz Apache-2.0. **Aber:** spätere Steam-/kommerzielle Veröffentlichung erwogen. **Zielkonflikt:** Eine permissive Lizenz (Apache/MIT) erlaubt jedem, das Spiel nachzubauen und kommerziell zu vertreiben, was einer eigenen bezahlten Veröffentlichung den Boden entziehen kann. Wer kommerzielle Verwertung offenhalten will, wählt eher **proprietär** oder **AGPL-3.0** (Copyleft hält Klone offen, erlaubt Dual-Licensing). Entscheidung, wenn Steam-Frage geklärt ist.

---

## D) Zurückgestellt (bewusst nicht im aktiven Backlog)

- [ ] **BETA-ACCESS** (optional) — Registrierung invite-only/Whitelist. User-Entscheidung: für die Beta **kein** Gating nötig (`/register` bleibt offen, Restrisiko akzeptiert; noindex aktiv). Bei Bedarf via Einladungscode/Whitelist in `AuthentifizierungsController` reaktivieren.
- [ ] **ADMIN-TOOLING / ROLLBACK-DOKU** — erwogen, **zurückgestellt**. (a) Betreiber-Tooling (hängenden Tisch beenden, User sperren, aktive Tische sehen); (b) Rollback-Strategie (Image-Tags + dokumentierter Rückfall). Bei Betriebsproblemen in der Beta reaktivieren.
- [ ] **STAT-SAISON-LIGA** — Saisons (Reset/Listen/Rollover-Job) + Ligen (Auf-/Abstieg). Additive Erweiterung (neue Tabellen). Nur bauen, falls öffentlich/wachsend — rückwirkend aus dem Archiv berechenbar, keine Greenfield-Dringlichkeit.
- [ ] **BE-ERRORPRONE-NULLAWAY** (Backend, zurückgestellt — **Java-25-Gate**) — moderne Compile-Zeit-Analyse via **Google Error Prone + NullAway** (500+ Bug-Checks + NPE-Eliminierung während `mvn compile`). **Blocker (S128 recherchiert):** Error Prone ist auf **JDK 25 noch nicht stabil** (`NoSuchFieldError: TypeTag`; Kompatibilität wird erst Richtung JDK 26 EA nachgezogen) — bräuchte allerneueste Version + `--add-exports`-JVM-Flags, also genau die Bleeding-Edge-Bastelei, die bei Sentry (Boot 4/Java 25) bewusst vermieden wurde. **Reaktivieren**, sobald eine Error-Prone-Version JDK 25 sauber unterstützt. Ergänzend dann **OpenRewrite** (Auto-Remediation-Rezepte) erwägen. **Risiko:** mittel-hoch (Toolchain/Bleeding-Edge).

---

## Entdeckungen

- **S129 — `Tisch`-Klasse (de.locodoko.partie) hat 0% Line-Coverage** (25 LOC laut JaCoCo): Domänen-Klasse im Partie-Kern ohne eigene Tests. Wenn nicht durch Integrationstests abgedeckt → Unit-Test-Task ergänzen.
- **S129 — `partie.ereignisse`-Paket: 50% Coverage** (10 Lines): Ereignis-Klassen im Partie-Kern nur halb abgedeckt. Prüfen ob wichtige Pfade fehlen.
- **S129 — `tisch.persistenz`-Paket: 68% Coverage** (206 Lines): knapp unter 70%-Schwelle. `JsonbConverter` (55%, 45 LOC) ist Haupttreiber.
- **S129 — FE-Komplexitäts-Hotspot neu: `TischInputHandler::verarbeiteTastatureingabe` CCN 35** (vorher als 27 geschätzt — ESLint cyclomatic, nicht kognitiv). Realer Messwert aus aktuellem ESLint-Lauf.

## Meilensteine

- **M1 — Closed Beta** auf `zock.locodoko.de` (eingeladene Kollegen, Daten erhalten). Faktisch der erste echte Deploy. Verbleibend: Block B (MENSCH: Domain/TLS/OAuth-Credentials/Compose-Smoke).
- **M2 — Public Go-Live:** Rechtstexte live schalten (Specs vorhanden: `recht-impressum-datenschutz.md`), CI/CD automatisiert (CI-DOCKER-BUILD → CD-DEPLOY), DECISION-LIZENZ, ggf. BETA-ACCESS/Admin-Tooling.

---

## Build-Modus-Leitfaden (gilt für alle autonomen Tasks)

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis.
2. **Pro Task ein Commit.** Keine Bündelung mehrerer Tasks in einem PR.
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
