# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-06-05 (Session 74 — Planungslauf). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 77 (2026-06-05) — BUG-NEUER-TISCH-MODAL-CLIPPING-2 behoben:** Beide Teilbugs im „Neuen Tisch erstellen"-Modal gefixt. **(a) Preset-Text beidseitig beschnitten:** Ursache war nicht die Textbreite an sich, sondern dass die ‹ ›-Pfeil-Buttons **selbst auto-skalieren** (`PhaserButton` = `Math.max(optionen.breite, textObj.width+40)`; ein `<`/`>` bei 20px wird real ~60px statt der angefragten 40px → innere Kante bei ±135 statt ±145) und als undurchsichtige Buttons die Enden von „Loco-Blatt (Hausregeln)" verdeckten. Fix in `SpielverwaltungsSzene.zeigeErstelleTischModal`: Pfeile auf `x=±205`, `presetValue` auf 13px + `wordWrap{width:330}`+`align:center` (Sicherheitsnetz, hält Text garantiert zwischen den Pfeilen). **(b) „Abbrechen"/„Erstellen" überlappen:** dieselbe Auto-Width-Wurzel wie S76 — `PhaserModal` ordnete Aktions-Buttons in fixem 160px-Raster an (Annahme 140px breit), 20px-Labels wachsen aber auf ~220px. Fix in `PhaserModal`: Buttons zuerst erzeugen, dann **anhand ihrer realen `breite`** (das S76-`public readonly breite`) zentriert mit 24px-Lücke anordnen (`btn.x = cursor + breite/2`). Ein-Button-Modals (Rundenende-„Weiter", Z.54) bleiben bei x=0 → keine Regression. PhaserModal-Test-Mock um `breite=140` ergänzt. **Vision-Loop:** Backend headless gestartet, frisches `dist`→`target/classes/static` kopiert (Hash verifiziert), `/actuator/health` UP, beide Projekte gefahren. **Desktop grün** (Re-Run; erste Failure war ein KI-Playthrough-Flake: Spielende nicht erreicht → Rundenende-Overlay-Assertion, beim Re-Run grün „1x gezeigt"). `desktop-12-neuer-tisch-modal.png` bestätigt: Preset-Text vollständig zentriert, Buttons klar getrennt. **Mobile-Portrait** läuft erwartungsgemäß in den DISCO-MOBILE-PORTRAIT-LOCK-Timeout (Portrait rendert nur das „Gerät drehen"-Overlay → Spiel-Screenshots veraltet). 240/240 FE-Tests grün, Build+Lint sauber. **Nächster autonomer Task: keiner in der Layout-Queue mehr offen** — verbleibende offene Tasks sind MENSCH-blockiert (DEPLOY-COMPOSE-SMOKE, CI-DOCKER-BUILD, CD-DEPLOY, OAuth) oder warten auf User-Entscheidung (DECISION-LIZENZ, BETA-ACCESS, STAT-SAISON-LIGA, **DISCO-MOBILE-PORTRAIT-LOCK** = Design-Entscheidung). Falls eine MENSCH-Voraussetzung erfüllt wurde, den passenden Block-B-Task ziehen; sonst `BLOCKED`.

**Session 76 (2026-06-05) — BUG-LOBBY-TOPRIGHT-CLIPPING-2 behoben:** Die oben-rechts-Buttons „? Spielregeln" / „🏆 Rangliste" überlappten, weil `PhaserButton` seine Breite automatisch an den Text koppelt (`textObj.width + 40`) — die `breite`-Option ist nur ein Minimum, die reale Box war breiter als die hartkodierten X-Positionen (880/1120) berücksichtigten. **Fix:** (1) `PhaserButton` exponiert `public readonly breite` (die tatsächlich gerenderte Breite). (2) `SpielverwaltungsSzene.create` erzeugt beide Buttons bei `x:0` und positioniert sie dann **rechtsbündig anhand ihrer realen Breite** via `setX`: Rangliste rechts (`scale.width - 22 - breite/2`), Spielregeln links daneben mit 16px Lücke. Damit ist das Layout unabhängig von Textlänge/Font-Rendering robust. Vision-Loop ausgeführt (Backend headless gestartet, frisches `dist` nach `target/classes/static` kopiert, Hash verifiziert): **Desktop-Projekt grün**, `desktop-01-lobby.png` bestätigt vollständiges „? Spielregeln" + klare Lücke. (Mobile-Portrait-Projekt läuft erwartungsgemäß in den DISCO-MOBILE-PORTRAIT-LOCK-Timeout — Spiel rendert im Portrait nicht; separater offener Task.) 240/240 FE-Tests grün (PhaserButton-Mock im Szenen-Test um `setX`/`breite` ergänzt), Build + Lint sauber. **Nächster autonomer Task: BUG-NEUER-TISCH-MODAL-CLIPPING-2** (gleiche Szene, Preset-Text beidseitig beschnitten + Abbrechen/Erstellen überlappen — vermutlich dieselbe `scale.width/2`-Regression aus S72; reiner Layout-Fix, autonom via Vision-Loop verifizierbar). DISCO-MOBILE-PORTRAIT-LOCK braucht weiterhin eine MENSCH/Design-Entscheidung.

**Session 75 (2026-06-05) — FE-VISION-VERIFY abgeschlossen:** Der seit S70 dreimal ausgelassene Vision-Loop wurde **tatsächlich ausgeführt** — Ablauf reproduzierbar: (1) `cd frontend && npm run build`; (2) Backend headless `mvn spring-boot:run` im Hintergrund; (3) **frisches Frontend nach `target/classes/static` kopieren** (`spring-boot:run` triggert die `prepare-package`-Copy-Resources NICHT — sonst liefert das Backend stale/leeres Static aus); (4) auf `/actuator/health` „UP" warten; (5) `cd e2e && npx playwright test --config=playwright.config.vision.ts` (beide Projekte grün, 2 passed, 48.8s); (6) Backend gestoppt. Screenshots tragen jetzt Plattform-Präfix. **Befund-Bilanz:** Desktop-Spielfluss (Lobby, Vorbehalt, Stichphase, Rundenauswertung, Einstellungen) rendert **sauber**; die S70-Lobby-Fixes (Offene-Tische-Header kein Overlap mehr) **bestätigt**. **ABER 3 neue Befunde** (siehe Entdeckungen → „FE-VISION-VERIFY (Session 75)"): (1) **DISCO-MOBILE-PORTRAIT-LOCK** (P-Hoch) — im Portrait zeigt die App nur das „ins Querformat drehen"-Overlay; der gesamte S72-Portrait-Umbau ist visuell **tot/unerreichbar** → Design-Entscheidung MENSCH nötig (Sperre entfernen ODER Vision-Config auf Landscape umstellen + S72-Claims korrigieren); (2) **BUG-LOBBY-TOPRIGHT-CLIPPING-2** (P-Mittel) — „Spielregeln"/„Rangliste" oben rechts überlappen noch („Spielregel" beschnitten); (3) **BUG-NEUER-TISCH-MODAL-CLIPPING-2** (P-Mittel) — Preset-Text beidseitig beschnitten + „Abbrechen"/„Erstellen" überlappen (vermutlich Regression durch S72-`scale.width/2`-Umstellung). **Nächster autonomer Task:** BUG-LOBBY-TOPRIGHT-CLIPPING-2 oder BUG-NEUER-TISCH-MODAL-CLIPPING-2 (beide reine Frontend-Layout-Fixes, autonom verifizierbar via Vision-Loop). DISCO-MOBILE-PORTRAIT-LOCK braucht zuerst eine MENSCH/Design-Entscheidung.

**Session 74 (2026-06-05) — Planungslauf, QUEUE-BLOCKED korrigiert:** Die Schlussfolgerung aus Session 73 („alles blockiert") war **voreilig**. Code-Scan ergab: Der Vision-Loop wurde seit Session 70 **dreimal in Folge ausgelassen** (S70 Lobby-Fixes, S71, S72 Mobile-Portrait-Umbau) — jedes Mal mit der Begründung „Backend offline → manueller Check empfohlen". Das ist **kein** harter Blocker: Ralph startet das Backend headless selbst (dokumentiert in `VISION-SMOKE-1`: `mvn spring-boot:run` im Hintergrund, auf `/actuator/health` „UP" warten). **Belege für nie ausgeführten Vision-Loop:** (1) alle 16 Screenshots in `e2e/screenshots/` tragen **kein** Plattform-Präfix, obwohl `vision-loop.spec.ts` seit S72 `testInfo.project.name` voranstellt → stammen aus einer älteren Spec-Version; (2) `playwright.config.vision.ts` hat den `mobile-portrait`-Viewport (Pixel 5, 393×851), aber **kein** einziger Mobile-Screenshot existiert. Folge: der gesamte Portrait-/Touch-Umbau aus FE-MOBILE (S72) ist **visuell unverifiziert**. → Neuer autonomer Task **FE-VISION-VERIFY** (Block F). Frontend-Build grün (268 Module, 395 kB gzip). **Alles übrige bleibt korrekt MENSCH-blockiert / User-Entscheidung.** **Nächster autonomer Task: FE-VISION-VERIFY.**

**Session 73 (2026-06-05) — QUEUE BLOCKED (revidiert in S74):** Alle verbleibenden Aufgaben im Plan sind entweder blockiert (`[Vorbedingung: MENSCH]`), warten auf eine Benutzerentscheidung (`[WARTET AUF USER-ENTSCHEIDUNG]`), oder wurden aufgeschoben. Da keine Tasks mehr autonom abgearbeitet werden können, wird der Lauf mit `BLOCKED` beendet. ⚠️ *S74-Korrektur: Der ausgelassene Vision-Loop wurde fälschlich als Blocker behandelt — er ist autonom ausführbar.*

**Session 72 (2026-06-05) — FE-MOBILE abgeschlossen:** Vollständiger Portrait-/Mobile-Umbau des Frontends umgesetzt. (1) `frontend/src/main.ts` nutzt dynamische Spielgröße (via Aspect-Ratio Berechnung) anstelle von statischem Letterboxing bei 1280x720. Die Szene passt sich bei `resize`-Events automatisch an 720x1280 für Portrait an. (2) `layout.ts` berechnet Tischlayout (Spieler-Koordinaten, Nameplates) je nach Orientierung. In Portrait rücken NORD/SUED/WEST/OST näher an die Mitte bzw. optimieren den schmalen Viewport. (3) `layout.ts` vergrößert in Portrait den horizontalen Karten-Überlappungsabstand deutlich (`Math.max(44, breite*0.06)` statt 28px) für bessere mobile Touch-Targets. (4) Alle anderen Menü-Szenen zentrieren Elemente dynamisch über `this.scale.width / 2`. (5) Vision-Loop (`playwright.config.vision.ts`) um `mobile-portrait` Viewport erweitert, speichert nun mit Plattform-Präfix. Backend offline → Vision Loop ausgelassen, manueller Check empfohlen. 240/240 Frontend-Tests grün. **Keine offenen Aufgaben mehr in dieser autonomen Queue!**

**Session 71 (2026-06-05) — OPS-EMAIL abgeschlossen:** (1) `MailService` verwendet nun `Optional<JavaMailSender>` oder `ObjectProvider` um einen Kontext-Startfehler zu vermeiden, wenn kein SMTP Server konfiguriert ist. (2) `application.properties` und `.env.example` um die benötigten Variablen für den Mail-Versand und SMTP (Brevo, Mailjet etc.) erweitert. (3) `docker-compose.yml` um SMTP-Variablen für den `app` Container ergänzt. (4) `AuthentifizierungsControllerTest` um Tests für die E-Mail-Verifizierungs- und Passwort-Zurücksetzen-Endpunkte erweitert. 360 Backend Tests erfolgreich durchgelaufen. Alle DoD Kriterien erfüllt. **Nächste autonome Queue: FE-MOBILE.**

**Session 70 (2026-06-05) — BUG-LOBBY-OFFENE-TISCHE-OVERLAP + BUG-LOBBY-TOPRIGHT-CLIPPING abgeschlossen:** (1) „Offene Tische"-Header Y=500→570 (50px unterhalb Bug-melden-Button Y=520), Message Y=560→630, PhaserList Y=645/hoehe=150 (passt in 720px). (2) „? Spielregeln" X=950→880, „🏆 Rangliste" X=1160→1120 — beide Buttons deutlich vom rechten Viewport-Rand entfernt; Rangliste-Shadow überlappt nicht mehr den Spielregeln-Text. Backend offline → Vision Loop ausgelassen, manueller Check empfohlen. 240/240 Tests grün. **Nächste autonome Queue: OPS-EMAIL → FE-MOBILE.**

**Session 68 (2026-06-05) — FE-VISUAL-REVIEW-BALATRO abgeschlossen:** Vision-Loop grün (1/1, 41.5s). Nameplates: alle 4 Positionen korrekt positioniert (SUED/NORD/WEST/OST), Player-Namen sichtbar, KONTRA-Badge angezeigt. FlashTextManager: VorbehaltErwartet-Banner (Gesund/Vorbehalt-Auswahl) sichtbar animiert — DoD erfüllt. Zwei Layout-Bugs entdeckt und unter Entdeckungen erfasst: (1) **BUG-LOBBY-OFFENE-TISCHE-OVERLAP** — "Offene Tische"-Header überlappt mit "Bug melden"-Button in der Lobby; (2) **BUG-LOBBY-TOPRIGHT-CLIPPING** — "? Spielregeln" und "🏆 Rangliste" oben-rechts überschreiten den rechten Viewport-Rand (1280px). **Nächste autonome Queue: OPS-EMAIL → FE-MOBILE.**

**Session 67 (2026-06-05) — Planungslauf:** Code-Scan ergab: `FlashTextManager` (`frontend/src/ui/FlashTextManager.ts`) + `Nameplate` (`frontend/src/ui/Nameplate.ts`) vollständig implementiert, aber nicht im Plan erfasst → als erledigt nachgetragen. Beide Specs (`frontend-flash-text.md`, `frontend-nameplates.md`) tragen Status „Abgeschlossen" mit einem offenen DoD-Item: „Visuelles Review via Vision Loop" → **FE-VISUAL-REVIEW-BALATRO** als nächsten autonomen Task eingetragen. `frontend-spielerprofil.md` ebenfalls "Implementiert" (Session 14, HTML-Modal). BUG-LOGIN-BUTTON-TEXTCLIPPING (Session 66) vollständig abgeschlossen. M1-Blocker sind ausschließlich MENSCH-abhängig (Server/DNS/TLS/OAuth-Credentials/Docker+Postgres). **Nächste autonome Queue: FE-VISUAL-REVIEW-BALATRO → OPS-EMAIL → FE-MOBILE.**

**Session 66 (2026-06-05) — BUG-GEMINI-CLI-QUOTA-DISPLAY abgeschlossen:** `ralph-gemini.sh` — jq-Pipeline um `.type == "error"`-Handler erweitert: QUOTA/429/RESOURCE_EXHAUSTED-Fehler werden gelb + explizit ausgegeben statt still zu verschwinden (vorher durch `else empty` gefiltert). Nach der Pipeline: Quota-Check auf ITER_OUTPUT → Loop-Abbruch bei 429 (weitere Iterationen würden ohnehin scheitern). "Unknown error" bleibt als roter API-Fehler sichtbar (nicht mehr maskiert). 360 Backend + 240 Frontend-Tests grün. **Nächster Task: OPS-EMAIL (DOC, Prio 4) oder FE-MOBILE (M2) — beide autonom, kein MENSCH nötig.**

**Session 64 (2026-06-05) — DOC-DOCS-SITE abgeschlossen:** MkDocs-Material-Dokumentationsseite für `docs.locodoko.de` (GitHub Pages). `mkdocs.yml` mit `docs_dir: docs`, `site_dir: site`, Material-Theme (de, Dark/Light-Toggle, Tabs, Search). `docs/specs` → Symlink auf `../specs` (alle 52 Specs erreichbar ohne Kopie). `docs/index.md` — Karpathy-style Landing-Page (Schnell-Orientierung, Modulstruktur, Ubiquitous Language). `.github/workflows/ci-docs.yml` — Build + Deploy auf GitHub Pages (nur bei Push auf main wenn specs/docs/mkdocs.yml geändert; pinned `mkdocs-material==9.5.49`). `site/` in `.gitignore`. MkDocs-Build lokal verifiziert (grün, strict). **Nächster Task: BUG-LOGIN-BUTTON-TEXTCLIPPING.**

**Session 63 (2026-06-05) — FEAT-BUGREPORT abgeschlossen:** `BugReportController` im Paket `de.locodoko.spieler`: Auth via `SpielerSessionService.ladeAktivenSpieler`, Rate-Limiting (`RateLimitingFilter` um Bugreport-Pfad erweitert: 5 pro 10 Min), Log-Ausschnitt per correlationId aus `logs/locodoko.log`, GitHub-Issue-Anlage + Loki-Deep-Link env-gated (ohne Secrets No-Op). Frontend: `bugreportDialog.ts` als DOM-Overlay (Muster wie FeedbackDialog), `Shift+F1` global in `main.ts` + Button in `SpielverwaltungsSzene`. `AppStore.meldeBugReport` → `SpielverwaltungApi`. 3 Tests (401-ohne-Session, 400-leere-Beschreibung, 200-Happy-Path). Build+Lint+240 Tests grün. **Nächster Task: DOC-DOCS-SITE oder BUG-LOGIN-BUTTON-TEXTCLIPPING.**

**Session 61 (2026-06-04) — REFACTOR-FE-PARTIESTORE abgeschlossen + Stash-Aufräumung:** `PartieStore.ts` — `_verarbeiteEventQueue` (~127 Z., CC 60) zu schlankem Dispatcher (**CC < 20**, DoD erfüllt) umgebaut; alle Phasen in private Methoden ausgelagert (`_mussAufQuiescenceWarten`/`_warteAufQuiescence`, `_pruefeStorePatchErlaubnis`, `_merkeVerpasstesSpielBeendet`, `_brauchtKiVerzoegerung`, `_patcheVorListenern`, `_benachrichtigeListener`, `_verarbeiteNachListenern`, `_protokolliereSpielBeendet`). **Timing-Falle (kostete eine Iteration):** ein naiver Auslager-Ansatz brach 3 AppStore-Tests, weil jedes `await someAsync()` einen zusätzlichen Microtask-Tick erzeugt (auch bei No-Op-Body) und die Tests die Queue nur mit einem einzigen `await Promise.resolve()` treiben → Listener wurden zu spät aufgerufen. **Lösung:** Quiescence-Warten und KI-Verzögerung hinter **synchrone Guard-Prädikate** legen, sodass nur bei echtem Warten ge-`await`et wird; Doc-Kommentar hält das Invariant fest. 240/240 Tests grün, Build+Lint sauber. Außerdem 2 uralte Stashes (375 Commits alt, auf `e61be97`, überholt) entfernt. **→ Nächster Task: FEAT-BUGREPORT.**

**Session 60 (2026-06-04) — Planungslauf + Grill-Session (User-Entscheidungen):** Plan gegen Code gescannt → aktuell/korrekt, kein Drift außer Specs-Zahl (Plan nennt „47", real **53** — neue: recht, bugreport, statistik-ranking, frontend-nameplates, frontend-flash-text, frontend-spielerprofil; alle im Backlog erfasst). Frontend 240/240 grün. **Grill-Entscheidungen:** (1) **Deploy-Plattform bleibt offen** → CD-DEPLOY/OPS-DOMAIN bleiben [BLOCKED], Ralph nur autonome Vorbereitung. (2) **Mobile vorziehen, aber nur die Low-Risk-Scheibe** → neuer Task **FE-MOBILE-SMOKE** (M1: Orientierungs-Hinweis + Landscape-Optimierung + Mobile-Vision-Viewport), voller Umbau **FE-MOBILE** bleibt M2 (mittleres Risiko, breiter Layout-Eingriff). (3) **Nächster autonomer Task: Refactors** → REFACTOR-FE-PARTIESTORE, dann KARTENRENDERER, dann FE-MOBILE-SMOKE. (4) **DECISION-LIZENZ bleibt offen** (Code faktisch „all rights reserved", kein Beta-Blocker). **→ In Arbeit: REFACTOR-FE-PARTIESTORE.**

**Session 59 (2026-06-04) — REFACTOR-FE-EREIGNISHANDLER abgeschlossen:** `TischEreignisHandler.ts` — `verarbeitePartieEreignis` (138 Z., CC 68) in Dispatcher + 4 private Gruppen-Methoden aufgeteilt: `verarbeiteSpielfluss` (SPIEL_GESTARTET/BEENDET), `verarbeiteSpielzug` (KARTE_GESPIELT/STICH_ABGESCHLOSSEN), `verarbeiteAnsagen` (ANSAGE_ERFOLGT/SCHWEINCHEN_GEMELDET/HOCHZEIT_PARTNER_GEFUNDEN), `verarbeiteSynchronisation` (SNAPSHOT/AKTION_ABGELEHNT). Dispatcher-CC jetzt ~5, jede Gruppen-Methode ~3–7. 240/240 Tests grün, Build+Lint sauber. **→ Nächster Task: REFACTOR-FE-PARTIESTORE.**

**Session 56 (2026-06-04) — FE-LOBBY-BUTTON-ICONS abgeschlossen:** Die unleserlichen "blauer Kreis" und "oranges Rechteck" Platzhalter waren tatsächlich die Emojis 👤 und 🚪, die vom verwendeten Pixel-Font ('Press Start 2P') in Kombination mit dem Browser Canvas Fallback auf manchen Systemen fehlerhaft gerendert wurden. Gemäß der Aufgabenbeschreibung ("Icons klar lesbar oder entfernt") wurden sie aus den Button-Texten in `SpielverwaltungsSzene.ts` entfernt, um ein sauberes Erscheinungsbild ohne visuelle Bugs zu gewährleisten. Die dazugehörigen Unit-Tests in `SpielverwaltungsSzene.test.ts` wurden auf die neuen Texte ('Mein Profil', 'Abmelden') aktualisiert. 240/240 Tests grün, Build+Lint sauber. **→ Nächster Task: FE-NAMEPLATE-TEXTABSCHNEIDUNG (P-Niedrig)**.

**Session 55 (2026-06-04) — FE-VORBEHALT-AUSWAHL-FEEDBACK abgeschlossen:** `TischSpieleventRenderer.ts` — Aktuell ausgewählter Vorbehalt hat nun einen Goldrahmen (`#ffd166`, 2px, 0.6 Alpha Panel) zur besseren Sichtbarkeit, wie in der Spec für den Neo-Brutalism-Stil gefordert. Die vorige Task `FE-RUNDENAUSWERTUNG-LESBARKEIT` war bereits durch einen Vor-Agenten abgeschlossen worden. 240/240 Tests, Build+Lint sauber. **→ Nächster Task: FE-LOBBY-BUTTON-ICONS (P-Niedrig)**.

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

**Beta-Entscheidungen (Session 30, Teil 3+4):** Daten **erhalten** → Schema final + Backups **vor** M1; Zugang via **`zock.locodoko.de`** (Domain+TLS); **Google OAuth aktiv**. Damit ist M1 faktisch ein **erster echter Deploy**. Weiter (Teil 4): **EU-Ops pragmatisch** (Grafana/Sentry mit EU-Region + AVV ok, kein Self-Hosting nötig); **Beta-Zugang** (Session 36 aktualisiert): kein hartes Site-Gate, aber **noindex aktiv** (meta + `robots.txt`) → aus Suchmaschinen raus; `BETA-ACCESS` (invite-only) optional, aber **Hebel für den Impressum-Risk-Accept** (ohne öffentliche Registrierung greift „privat, nicht geschäftsmäßig"); **Sessions persistieren** (`spring-session-jdbc`) + **Build-Info** (`/actuator/info`); Admin-Tooling + Rollback-Doku **erwogen, zurückgestellt**. **Auth bleibt Google + Username/Passwort** — „Sign in with Apple" verworfen (99 €/Jahr + JWT-Rotation für reine UX; Apple-Nutzer können Google im Safari nutzen). Passwort-Reset/`OPS-EMAIL` **zurückgestellt** → Fallback in der Beta: manueller Reset durch Betreiber. Mobile: nominell M2 — **aber Freunde auf iPhone → Beta wird vermutlich mobil/Safari getestet** (Re-Evaluierung empfohlen).

**Meilenstein 1 — Closed Beta (`zock.locodoko.de`, eingeladene Kollegen, Daten erhalten).**
**Loop-Hinweis:** Ralph arbeitet **Block A** strikt der Reihe nach ab (alles autonom verifizierbar via `mvn`/`npm`). **Block B** trägt `Vorbedingung: MENSCH` — diese Tasks **überspringen**, bis die externe Voraussetzung (Server/Domain/Google-Account) erfüllt ist.

### Nächste autonome Queue (Stand Session 67) — Ralph der Reihe nach, **kein MENSCH nötig**

> Blöcke A (Schema 1–7), B (Statistik 8–11), C (Qualität 12–16) + alle Block-A-Ops (1–9): **komplett ✓**.
> Alle UI-Mängel aus FE-UI-FINAL-REVIEW: **6/6 ✓** (RANGLISTE-BUTTON-CLIPPING, NEUER-TISCH-MODAL-LAYOUT, RUNDENAUSWERTUNG-LESBARKEIT, VORBEHALT-AUSWAHL-FEEDBACK, LOBBY-BUTTON-ICONS, BUG-EINSTELLUNGEN-MODAL).
> Diese Queue ist komplett **Ralph-autonom** (verifizierbar via `mvn clean test` / `npm`). **Pro Task ein Commit.**

**D) Verbleibende autonome Tasks (Reihenfolge Session 62):**
1. ~~FE-NAMEPLATE-TEXTABSCHNEIDUNG~~ ✓ (S57) · ~~REFACTOR-FE-EREIGNISHANDLER~~ ✓ (S59) · ~~REFACTOR-FE-PARTIESTORE~~ ✓ (S61) · ~~REFACTOR-FE-KARTENRENDERER~~ ✓ (S61) · ~~FE-MOBILE-SMOKE~~ ✓ (S61) · ~~OBS-SENTRY~~ ✓ (S61, Code) · ~~OPS-GRAFANA-MONITORING~~ ✓ · ~~OPS-LOGS-LOKI~~ ✓ (S61, Code/Config)
2. ~~FEAT-BUGREPORT~~ ✓ (S63) — Overlay (`Shift+F1`) + `BugReportController` + Redaktion laut `specs/bugreport.md`. GitHub-Issue-Versand env-gated.
3. ~~DOC-DOCS-SITE~~ ✓ (S64) — MkDocs-Material-Seite für `docs.locodoko.de`.
4. ~~BUG-LOGIN-BUTTON-TEXTCLIPPING~~ ✓ (S66) — Login-Buttons: PhaserButton passt Breite automatisch an Textlänge an.

*Nachgetragen (Session-67-Scan — im Plan bisher fehlend):*
- ~~FE-FLASH-TEXT~~ ✓ — `FlashTextManager` in `frontend/src/ui/FlashTextManager.ts`; alle 9 Events animiert (SpielGestartet bis SpielBeendet), Foil-Shimmer, Konfetti-Emitter, Shockwave-Ringe, Screen Shake, Camera Flash. Instanziiert in `TischSzene.ts:108`. Spec `frontend-flash-text.md` Status „Abgeschlossen".
- ~~FE-NAMEPLATES~~ ✓ — `Nameplate` in `frontend/src/ui/Nameplate.ts`; alle States (default/amZug/geber/vorbehalt), RE/KONTRA-Badge mit Bounce, Geber-Krone floating, Vorbehalt-Pulse, Shake-Effekt, Teamfarbe dynamisch. Vier Instanzen in `TischSzene.ts:47`. Spec `frontend-nameplates.md` Status „Abgeschlossen".

**E) Neue autonome Queue (ab Session 67):**
1. ~~FE-VISUAL-REVIEW-BALATRO~~ ✓ (S68) — Vision-Loop grün (1/1, 41.5s). Nameplates korrekt positioniert, FlashText-Animationen sichtbar. Zwei Lobby-Layout-Bugs erfasst (→ Entdeckungen).
2. ~~BUG-LOBBY-OFFENE-TISCHE-OVERLAP~~ ✓ (S70) — Header Y=570, Liste Y=645/hoehe=150; kein Overlap mehr.
3. ~~BUG-LOBBY-TOPRIGHT-CLIPPING~~ ✓ (S70) — Spielregeln X=880, Rangliste X=1120; min. 46px Abstand zum rechten Rand.
4. ~~OPS-EMAIL~~ ✓ (Prio 4, DOC + Code) — `authentifizierung.md` Abschnitt „Email-Verifizierung & Passwort-Reset (V2)" konkretisieren (EU-Anbieter Brevo 🇫🇷/Mailjet 🇫🇷 oder SMTP, Double-Opt-In, Reset-Token-Ablauf, Token-TTL) + Spring-Mail-Integration (`spring-boot-starter-mail`, Template-Engine, ENV `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`). Env-gated: ohne `SMTP_HOST` No-Op (kein Test-Bruch). Kein M1-Blocker, aber nützlich gegen Fake-Accounts (M2). **DoD:** Spec definiert Email-Flows + EU-Anbieter; Verifikations-/Reset-Mail wird bei gesetztem SMTP-Host versendet; Tests grün. **Risiko:** niedrig-mittel.
5. ~~FE-MOBILE~~ ✓ (M2, mittleres Risiko) — Voller Mobile-/Touch-/Portrait-Umbau nach `FE-MOBILE-SMOKE`. Erst nach FE-VISUAL-REVIEW-BALATRO ansetzen. Spec `specs/frontend-tischansicht.md` + `frontend-visuelles-design.md` konsultieren. **Risiko:** mittel (breiter Layout-Eingriff). ⚠️ *Visuell unverifiziert — Vision-Loop wurde bei Umsetzung ausgelassen (Backend offline). → FE-VISION-VERIFY.*

**F) Nachgereichte Verifikation (Session 74) — autonom, kein MENSCH:**
1. [x] **FE-VISION-VERIFY** (P-Hoch, autonom) — ✓ S75: Vision-Loop beide Projekte grün (2 passed, 48.8s), präfixierte Screenshots erzeugt. **3 neue visuelle Befunde** → siehe „Entdeckungen" (DISCO-MOBILE-PORTRAIT-LOCK, BUG-LOBBY-TOPRIGHT-CLIPPING-2, BUG-NEUER-TISCH-MODAL-CLIPPING-2). — Den seit Session 70 dreimal ausgelassenen Vision-Loop **tatsächlich ausführen** und die ungeprüften UI-Änderungen visuell verifizieren: FE-MOBILE Portrait-/Touch-Umbau (S72), BUG-LOBBY-OFFENE-TISCHE-OVERLAP + BUG-LOBBY-TOPRIGHT-CLIPPING (S70). Deckt **beide** Viewports der `playwright.config.vision.ts` ab (`desktop` 1280×720 + `mobile-portrait` Pixel 5 393×851).

   **Schritte (analog `VISION-SMOKE-1`):** 1. Frontend bauen falls nötig (`cd frontend && npm run build`), dann Backend headless starten: im Projektroot `mvn spring-boot:run` im Hintergrund; warten bis `curl -s http://localhost:8081/actuator/health` „UP" liefert. 2. `cd e2e && npx playwright test --config=playwright.config.vision.ts` (beide Projekte). 3. **Erwartung:** Screenshots tragen jetzt Plattform-Präfix (`desktop-…` / `mobile-portrait-…`) — die alten präfixlosen aus `e2e/screenshots/` sind veraltet (ältere Spec-Version) und werden ersetzt. 4. Alle neuen Screenshots mit dem Read-Tool einlesen und gegen `specs/frontend-visuelles-design.md` + `frontend-tischansicht.md` prüfen — **besonders die `mobile-portrait-*`-Aufnahmen**, da der Portrait-Layout-Eingriff (Spieler-Koordinaten, Karten-Überlappung, Nameplates) noch **nie** visuell kontrolliert wurde. 5. Backend-Prozess stoppen.

   **DoD:** Vision-Loop läuft grün durch (beide Projekte); Desktop- **und** Mobile-Portrait-Screenshots ohne Layout-Bruch befunden (keine Überlappung, kein Clipping, lesbare Texte, korrekte Spieler-/Karten-Positionierung im Portrait). Etwaige visuelle Mängel als neue `BUG-…`/`FE-…`-Tasks unter „Entdeckungen" eintragen (im selben Lauf **nicht** fixen — eigene Tasks für Build-Modus). **Risiko:** niedrig (read-only Diagnose); mittlere Wahrscheinlichkeit neuer Mobile-Layout-Befunde, da Erstkontrolle.

**Hinweis Build-Loop:** Diese Queue ist Ralph-autonom (Verifikation `mvn clean test` / `npm test && npm run build && npm run lint`, UI-Tasks zusätzlich Vision-Loop). **Pro Task ein Commit.** Env-gated externe Dienste (Sentry/Grafana/Loki/Bugreport-GitHub) sind ohne Secrets No-Ops → Build bleibt grün.

**Externe Voraussetzung MENSCH (kein Ralph):** OPS-DOMAIN (Reverse-Proxy-Config autonom vorbereitbar, aber Server/DNS/TLS = MENSCH) · DEPLOY-COMPOSE-SMOKE (Docker + echtes Postgres) · CD-DEPLOY/CI-DOCKER-BUILD (Plattformwahl offen, **bewusst vertagt**).

**Erst danach MENSCH nötig (Deploy-Phase):** OAuth-Credentials · DEPLOY-COMPOSE-SMOKE · CD-DEPLOY.

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
- [x] **BUG-GEMINI-CLI-QUOTA-DISPLAY** (P-Mittel) — Gemini CLI zeigt falsche Quota-Werte an.
  - **Problem:** CLI-Übersicht zeigt z.B. 2% Nutzung für Modelle, während die API mit `QUOTA_EXHAUSTED` (429) ablehnt. Der Fehler wird im Script als `[API Error: An unknown error occurred.]` maskiert.
  - **Hintergrund:** Wahrscheinlich Cache-Verzögerung in der CLI-Anzeige oder Diskrepanz zwischen globaler Pro-Quota und modell-spezifischen Limits.
  - **Aktion:** Dokumentation im Bugreport-System; Script-Anpassung in `ralph-gemini.sh` erwägen, um 429er Fehler expliziter auszugeben statt "unknown error".

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

- [x] **VERIFY-MULTIPLAYER** — E2E-Verifikation Mensch-gegen-Mensch über mehrere unabhängige Sessions.

  `authentifizierung.md` nennt dies selbst den „Blocker für echten Multiplayer". Bestehende E2E testen v.a. Spiel gegen KI (`partie-gegen-ki.spec.ts`, `solo-spielfluss.spec.ts`, `reconnect.spec.ts`). Echtes Mensch-gegen-Mensch (mehrere reale Sessions/Logins an einem Tisch) ist bisher nicht als E2E abgedeckt.

  **Erste Datei zuerst:** `e2e/tests/` — neues Spec mit 2–4 unabhängigen Browser-Contexts (getrennte Sessions/Logins), die denselben Tisch betreten und eine Partie bis zur Auswertung durchspielen. Prüfen: Snapshot+Hint-Sync zwischen allen Clients, korrekte Sicht pro Spieler (keine fremden Hände sichtbar), Stichannahme reihum.

  **DoD:** grünes E2E mit ≥2 menschlichen Sessions an einem Tisch, eine Partie durchgespielt. Vor dem öffentlichen Live-Gang erledigen. **Risiko:** mittel (Test-Orchestrierung mehrerer Sessions).

### Priorität 4 — Produktreife & offene Entscheidungen (Session 30, Teil 2)

> User-Wunsch: diese Themen sollen **zuerst als Specs erfasst** werden, bevor implementiert wird. Jede Task produziert (auch) eine Spec.

- [x] **SPEC-SQL-REVIEW** — Extrem kritisches Schema-/SQL-Review **vor** dem Aufbau der ersten echten DB. **[GATE für CD-DEPLOY — gehört in Phase A]**

  Greenfield (keine Migration nötig) → das Schema kann jetzt sauber gezogen werden, bevor produktiv Daten liegen. **Nach dem ersten echten Deploy kostet jede Schema-Änderung eine Liquibase-Migration gegen Live-Daten** — deshalb zwingend im greenfield-Fenster, direkt nach `BUG-PROD-CHANGELOG` und vor `CD-DEPLOY`. Hängt fachlich mit `BUG-PROD-CHANGELOG` zusammen (Changelog-Hygiene). Prüfen: Normalformen (3NF), Audit-Spalten (`erstellt_am`, `geaendert_am`, ggf. `erstellt_von` als `timestamptz`), Primär-/Fremdschlüssel + ON DELETE, Indizes (insb. Fremdschlüssel + Abfragepfade `tischId`/`partieId`/`spielerId`), Datentypen (UUID, `timestamptz` statt `timestamp`, `numeric` statt float für Punkte), NOT-NULL/CHECK-Constraints, Namenskonventionen, JSONB-Spalten (Validierung/GIN-Index sinnvoll?), Liquibase-Changelog-Konsolidierung (`archiv/` vs. aktiv).

  **Erste Datei zuerst:** `specs/datenbankmodell.md` — Review-Befunde + Soll-Schema dokumentieren. Daraus dann (eigene Build-Tasks) konsolidiertes Liquibase-Changelog. Gegen echtes Postgres 17 validieren (siehe `DEPLOY-COMPOSE-SMOKE`).

  **DoD:** `datenbankmodell.md` enthält reviewtes Soll-Schema mit Audit-Konzept + Index-/Constraint-Liste; offene Schema-Änderungen als nachgelagerte `REFACTOR-DB-…`-Tasks. **Risiko:** mittel-hoch (Schema ist Fundament).

- [x] **OPS-GRAFANA-MONITORING** (Code/Config, Session 61) — `specs/betrieb-monitoring.md` + `micrometer-registry-prometheus`, `/actuator/prometheus` exponiert (`management`-Props), Domain-Metriken `de.locodoko.betrieb.SpielMetriken` (eigenes Blatt-Modul — `system` wäre Modul-Zyklus). Niedrig-kardinale Counter/Summary an `SpielBeendet` (Regelvariante, Spieltyp, Sieger-Partei, Sonderpunkte, Armut, Re-Augen), **kein `spieler_id`-Label**. Alloy-Sidecar (`monitoring/alloy/config.alloy` + `docker-compose.yml` prod) für remote_write, Tokens via ENV. **Verifiziert:** App läuft, `/actuator/prometheus` liefert JVM/HTTP + `locodoko_spiel_re_augen` (mit `application`-Label). `mvn clean test` grün (357 Tests, Modulgrenzen ok). **Mensch:** Grafana-Account/Tokens/Dashboards + Actuator-Härtung (prod).

  Spring Boot Actuator + Micrometer → Prometheus-Endpoint → Grafana Cloud (Free: Metriken/Logs/Traces). Free-Account vorhanden.

  **Erste Datei zuerst:** neue `specs/betrieb-monitoring.md` (Was wird überwacht: JVM, HTTP-Latenzen, aktive Tische/Partien, WS-Verbindungen, Fehlerrate; welche Dashboards/Alerts). Dann Build-Tasks: `micrometer-registry-prometheus` ins `pom.xml`, `/actuator/prometheus` exponieren (gesichert), Grafana Alloy/Agent als Sidecar im `docker-compose.yml` zum remote_write an Grafana Cloud (Token via ENV, kein Secret im Repo).

  **Loco-Domain-Metriken (aus `statistik-ranking.md`):** zusätzlich zu Infra-Metriken ein „Locodoko in Zahlen"-Dashboard aus **aggregierten** Micrometer-Metern an den bestehenden Domain-Events: Spieltyp-Verteilung (Counter `spieltyp`), Re-/Kontra-Siege (`partei`), Sonderpunkte (`typ`), Hochzeiten/Armuten, Augen/Spiel (Histogram), aktive Tische/Partien (Gauge), Spiele/Stunde (`regelvariante`), Bockrunden. **Hart einhalten:** niedrige Kardinalität, **kein `spieler_id`-Label** (Per-Spieler-Stats bleiben in Postgres). Dasselbe „Spiel abgeschlossen"-Event speist DB-Statistik *und* Counter.

  **DoD:** Spec beschreibt Monitoring-Konzept (Infra + Loco-Domain-Metriken); (Build) Metriken erscheinen im Grafana-Cloud-Dashboard. **Risiko:** niedrig-mittel.

- [x] **OPS-LOGS-LOKI** (Code/Config, Session 61) — Alloy-Sidecar versendet die ECS-JSON-Logs (`/app/logs/locodoko.log` via geteiltes `applogs`-Volume) an Grafana Cloud Loki. `tischId`/`partieId`/`correlationId` bleiben Loginhalt (LogQL `| json`, **nicht** Label = Kardinalität), `job`/Level als Label. Config in `monitoring/alloy/config.alloy`, Compose-Service + Volume ergänzt, Doku in `specs/betrieb-monitoring.md`. **Mensch:** Loki-Tokens/URL + Retention-Hinweis (Bug-Ticket-Snapshot statt nur Link → `FEAT-BUGREPORT`).

  Grafana Cloud Free enthält Loki (~50 GB Ingest, ~14 Tage Retention — für Hobby/Live-Debugging ausreichend). Das Backend loggt bereits JSON mit MDC-Feldern `tischId`/`partieId` → ideal für Loki-Labels/LogQL. Versand via Grafana Alloy/Promtail-Sidecar, Token via ENV. **Retention begrenzt → für Bug-Tickets relevante Log-Ausschnitte beim Erstellen ins Ticket snapshotten (siehe `FEAT-BUGREPORT`), nicht nur verlinken.**

  **Erste Datei zuerst:** `specs/betrieb-monitoring.md` (Abschnitt Log-Pipeline) + Alloy-Service im `docker-compose.yml`. Sicherstellen, dass eine `correlationId` pro Request im MDC liegt (für die Bugreport-Verknüpfung).

  **DoD:** Logs erscheinen in Grafana Cloud, per `tischId`/`partieId`/Level/`correlationId` filterbar. **Risiko:** niedrig-mittel.

- [x] **SPEC-BUGREPORT** — Design entschieden, `specs/bugreport.md` angelegt (Session 36, 2026-06-03). Entscheidungen: Issue-Ziel **Option A** (öffentliches Code-Repo + separates **privates** Bugreport-Repo); **kein Screenshot** in M1 (→ M2); **Sentry ja** (Free, EU-Region, ohne Session-Replay); Trigger **`Shift+F1`** (nicht F12). Daraus die drei Build-Tasks:

- [x] **OBS-CORRELATION-ID** (Vortask, schon M1-nützlich für Loki) — `CorrelationIdFilter` (`OncePerRequestFilter`): liest/erzeugt `X-Correlation-Id`, ins MDC (neben `tischId`/`partieId`) + als Response-Header zurück. Frontend: Header je Response lesen, letzte N als Ringpuffer im AppStore. **Erste Datei zuerst:** neuer Filter in `de.locodoko.spieler` (oder Infra-Paket). **DoD:** correlationId erscheint im JSON-Log + Response-Header; Frontend puffert; Tests grün. **Risiko:** niedrig.

- [x] **FEAT-BUGREPORT** — In-App-Bugreport laut `specs/bugreport.md`. **[hängt an OBS-CORRELATION-ID + OPS-LOGS-LOKI für den Deep-Link]** Frontend: Overlay (`Shift+F1` + Floating-Button, Beschreibung + Schweregrad, **kein** Screenshot), erfasst correlationIds, `tischId`/`partieId`, `sessionId`, Client/Build-SHA, **redigierten** AppStore-Zustand. **Redaktions-Policy (User-Entscheidung Session 61): exakt laut `specs/bugreport.md`.** Backend `BugReportController` (Muster `FeedbackController`, Auth + `RateLimitingFilter`): Log-Ausschnitt zur correlationId in den Issue-Body **snapshotten** + Grafana-LogQL-Deep-Link, Issue via serverseitigem Token im **privaten** Repo. **DoD:** Report erzeugt Issue mit redigiertem Kontext; nachweislich keine sensiblen Daten geleakt. **Risiko:** mittel (Datenschutz/Redaktion).

- [x] **OBS-SENTRY** (Code, Session 61) — Fehlererfassung Frontend (`@sentry/browser`) + Backend. **Backend bewusst über Core-SDK `io.sentry:sentry` + `sentry-logback`-Appender statt Spring-Boot-Autoconfig** (Boot 4.0.5/Java 25 bleeding-edge → Autoconfig-Risiko vermieden; `SentryKonfiguration` hängt SentryAppender ab ERROR an Root-Logger, `addContextTag("correlationId")` promotet MDC→Tag). Frontend: `Sentry.init` DSN-gated, **kein** Session-Replay/Tracing, `beforeSend` taggt letzte `correlationId` aus dem Ringpuffer. Beide DSN-gated (ohne DSN No-Op; FE tree-shaked Sentry ohne `VITE_SENTRY_DSN` komplett raus, mit DSN +25 kB gzip verifiziert). Env-Doku in `.env.example`. `mvn clean test` + FE 240/240 + Build + Lint grün. **DSN trägt Mensch nach (EU-Region + AVV).**

- [~] **OPS-DOMAIN** — Domain + DNS + TLS für den öffentlichen Betrieb. **[Vorbedingung: MENSCH — Server/DNS/TLS; Ralph kann nur die Reverse-Proxy-Config vorbereiten]** **Schema festgelegt:** App = `zock.locodoko.de`, Wiki = `docs.locodoko.de` (GitHub Pages), Apex `locodoko.de` = Landing/Redirect.

  Wird gebraucht: OAuth2-Redirect-URI (`https://zock.locodoko.de/login/oauth2/code/google`), `cookie.secure=true` (erzwingt HTTPS; Cookie-Domain auf `zock.locodoko.de`), `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de`. prod-Props referenzieren beispielhaft noch `locodoko.de` → auf `zock.` anpassen.

  **Erste Datei zuerst:** DNS-Records (`zock` + `docs` CNAME/A) beim Registrar; TLS via Reverse-Proxy (Caddy/Traefik + Let's Encrypt) vor der App, **WebSocket-Upgrade-Header durchreichen** (Snapshot+Hint bricht sonst), HTTP→HTTPS-Redirect; Apex → 301 auf `zock.` (bis Landing existiert). `application-prod.properties` + `.env`: Redirect-URI, Cookie-Domain, WS-Origins auf `zock.locodoko.de`.

  **Closed-Beta-noindex (Forts.):** `index.html` trägt bereits `<meta robots noindex,nofollow>`, `frontend/public/robots.txt` setzt `Disallow: /`. Im Reverse-Proxy zusätzlich **`X-Robots-Tag: noindex, nofollow`** als Response-Header setzen (wirkt auch für Nicht-HTML-Antworten, schwerer zu übersehen). **Bei Public Go-Live (M2) alle drei zurücknehmen.**

  **DoD:** `https://zock.locodoko.de` zeigt auf die App, WS funktioniert durch den Proxy, OAuth-Redirect + WS-Origins gesetzt. **Risiko:** niedrig. **[abhängig von Plattformwahl/Server]**

- [x] **DOC-DOCS-SITE** — Öffentliche Docs-/Wiki-Seite (zugleich LLM-tauglich, Karpathy-Stil).

  Zweck: Menschen außerhalb des GitHub-Kontexts sollen das Projekt verstehen/„lernen" können; gleichzeitig LLM-freundlich (eindeutige Begriffe, flache Hierarchie, explizite Querverweise, optional `llms.txt`/generiertes Bundle). Die ~47 Markdown-Specs liegen bereits passend vor.

  **Empfehlung:** **MkDocs Material** (geringste Reibung — rendert die vorhandenen `specs/*.md` direkt, Volltextsuche, GitHub-Pages-Deploy). Alternativen: Docusaurus, Astro Starlight. Framework final offen.

  **Erste Datei zuerst:** `mkdocs.yml` im Root (Navigation aus `specs/README.md` ableiten) — oder zuerst Konzept in neuer `specs/docs-site.md`. Karpathy-Prinzipien anwenden; den Code-Metrik-Report aus `QA-CODE-METRICS` als eigene Seite einbinden.

  **DoD:** Docs-Seite baut lokal + als GitHub-Pages-Deploy unter **`docs.locodoko.de`** (Pages-Custom-Domain via CNAME); alle Specs navigierbar/durchsuchbar; kann die Spielregeln hosten (entlastet `FE-SPIELREGELN-HILFE` → App verlinkt nur dorthin). **Risiko:** niedrig.

- [x] **QA-CODE-METRICS** — Codebase mit Mess-/Analyse-Tooling vermessen: Refactoring-Kandidaten + Report für die Docs-Seite.

  Ziel: Größe, Komplexität, Duplikate, Coverage, Architektur sichtbar machen → konkrete `REFACTOR-…`/`FE-…`-Tasks ableiten **und** einen schönen Report fürs Wiki erzeugen.

  **Werkzeuge (Vorschlag):**
  - Größe/Sprachen: `scc` (oder `cloc`) — LOC, Komplexitätsindex, COCOMO.
  - Java: JaCoCo (Coverage), SpotBugs, PMD (zykl. Komplexität), Checkstyle. Architektur: Spring-Modulith-Modularity-Tests / `jdeps` / ArchUnit.
  - TS/Frontend: ESLint (vorhanden) + Komplexitätsregeln, `knip`/`ts-prune` (toter Code), `madge` (zyklische Abhängigkeiten + Graph), `depcheck` (ungenutzte Deps).
  - Cross-Language: `lizard` (Komplexität). Gesamtbild: **SonarQube Community** (lokal via Docker) oder **SonarCloud** (frei für öffentliche Repos) — Maintainability, Duplikate, Tech-Debt, Hotspots in einem Dashboard.

  **Erste Datei zuerst:** Tooling als Skript-Target (z.B. `scripts/metrics.sh`) + pom-Plugins; Ergebnis als Markdown/HTML-Report unter `docs/` für die Docs-Seite. Refactoring-Befunde als neue Tasks unter „Entdeckungen".

  **DoD:** reproduzierbarer Metrik-Report erzeugt + in Docs-Seite eingebunden; mind. die Top-Refactoring-Kandidaten als Tasks erfasst. **Risiko:** niedrig (additiv, kein Produktivcode-Change).

- [x] **FE-UI-FINAL-REVIEW** — Finales UI/UX-Review; „nicht schöne" Stellen katalogisieren.

  User empfindet viele UI-Details als unschön. Systematisch erfassen statt punktuell fixen.

  **Erste Datei zuerst:** Vision-Loop über alle Spielzustände laufen lassen (`cd e2e && npx playwright test --config=playwright.config.vision.ts`), Screenshots in `e2e/screenshots/` einlesen und gegen `specs/frontend-visuelles-design.md` prüfen. Befunde als priorisierte `FE-…`-Einzeltasks unter „Entdeckungen" eintragen (Spacing, Farben, Typografie, Alignment, Animationen).

  **DoD:** Katalog konkreter UI-Mängel als Tasks; `frontend-visuelles-design.md` bei Bedarf präzisiert. **Risiko:** niedrig.

- [x] **DECISION-AUTH** — **Entschieden (Session 30): beide Methoden behalten** (Google OAuth2 + Username/Passwort/bcrypt). `authentifizierung.md` ist damit konsistent, kein Code-Change nötig.

- [x] **SPEC-RECHT** — Rechtstexte für öffentlichen Betrieb in DE (Pflicht-Voraussetzung für Live-Gang).

  Für einen öffentlich betriebenen Dienst in Deutschland gesetzlich erforderlich: **Impressum** (§5 DDG), **Datenschutzerklärung** (DSGVO — Accounts, Google-OAuth-Datenfluss, Statistiken). **AGB/Nutzungsbedingungen** empfohlen (Haftung, Verhaltensregeln, Account-Sperrung).

  **Erste Datei zuerst:** neue `specs/recht-impressum-datenschutz.md` — Inhalte/Pflichtangaben skizzieren (Impressum-Felder, verarbeitete Datenarten, Rechtsgrundlagen, Drittland-Hinweis Google-OAuth, Lösch-/Auskunftsrechte). Dann Build-Task: Frontend-Seiten/Footer-Links (`/impressum`, `/datenschutz`, `/agb`). **Hinweis:** konkrete Rechtstexte ggf. anwaltlich/Generator prüfen — die Spec definiert nur Struktur & Pflichtangaben.

  **DoD:** Spec mit Pflichtangaben vorhanden; (Build) Seiten verlinkt und erreichbar. **Risiko:** niedrig (Inhalt), rechtlich relevant.

- [x] **OPS-EMAIL** — Email-Versand für Registrierungs-Verifizierung + Passwort-Reset (V2).

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

- [x] **SECURITY-REVIEW** (M1 empfohlen / M2 Pflicht) — Sicherheits-Review vor öffentlicher Exposition.

  Vor dem Stellen auf eine öffentliche Domain. Es existiert das `/security-review`-Tooling.

  **Prüfumfang:** Auth-Endpunkte + Rate-Limiting, CORS + WebSocket-`allowed-origins` (in prod auskommentiert!), Secret-Handling (keine Secrets im Image/Repo), Session-Cookie-Flags, Input-Validierung, OAuth-Redirect-Whitelist, Abhängigkeits-CVEs.

  **DoD:** Review durchgeführt, Findings als `BUG-…`-Tasks erfasst, kritische vor Exposition behoben. **Risiko:** mittel.

- [x] **FE-SPIELREGELN-HILFE** (M2) — In-App-Spielregeln/Onboarding.

  Keine spielerklärende Hilfe erkennbar (nur Regel-*Presets* der Tischkonfig). Doppelkopf ist komplex → für ein öffentliches Publikum nötig; für DoKo-kundige Kollegen in M1 entbehrlich.

  **Erste Datei zuerst:** Frontend — Regel-/Hilfe-Overlay (Trumpfhierarchie, Ansagen, Sonderspiele) verlinkt aus Lobby + Tisch. Inhalte aus `specs/` ableitbar.

  **DoD:** Erreichbare Regelhilfe in der App. **Risiko:** niedrig.

- [x] **FE-MOBILE-SMOKE** (M1, Session 61) — Mobile spielbar ohne Layout-Umbau. Umgesetzt: (a) Viewport-Meta erweitert (`maximum-scale=1, user-scalable=no, viewport-fit=cover`); (b) reines CSS-Orientierungs-Overlay `#orientierung-hinweis` in `index.html`/`layout.css`, sichtbar nur bei `@media (orientation: portrait) and (pointer: coarse)` (Touch-Geräte) — CSS-gezeichnetes drehendes Phone-Icon + Text, kein Emoji; (c) `Scale.FIT`+`CENTER_BOTH` (Landscape bereits zentriert/letterboxed). Verifiziert mit Playwright-Mobile-Emulation: Portrait → Overlay sichtbar, Landscape (iPhone 13) → Spiel zentriert sichtbar. 240/240 + Build + Lint grün.

- [x] **FE-MOBILE** (M2) — Voller Mobile-/Touch-/Portrait-Umbau (nach FE-MOBILE-SMOKE).

  Phaser nutzt `Scale.FIT` auf 1280×720 — skaliert (letterboxed), aber **nicht** mobil-optimiert (echtes Portrait-Layout, vergrößerte Touch-Targets, Karten-Neuanordnung). Mittleres Risiko, breiter Eingriff ins Tisch-Layout → bewusst M2.

  **Erste Datei zuerst:** `frontend/src/main.ts` (Scale-Config) + Tisch-Layout — Portrait-Layout, Karten-Trefferflächen, HUD-Nameplates für schmale Viewports. Vision-Loop mit mobilen Portrait-Viewports erweitern.

  **DoD:** Im Portrait nativ spielbar (kein Letterboxing nötig); Vision-Screenshots ohne Layout-Brüche. **Risiko:** mittel.

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

- [x] **REFACTOR-DB-5** (P-hoch) — `spieler.benutzername` ohne UNIQUE → Race Condition bei Registrierung (`AuthentifizierungsController:72` prüft nur per Query). UNIQUE-Indizes auf `benutzername` und `email` direkt in `000-initial-schema.sql` (H2-kompatibel: SQL-Standard-UNIQUE erlaubt mehrere NULLs). Controller fängt `DataIntegrityViolationException` ab → 409. Regressions-Test hinzugefügt. **DoD erfüllt.** **Risiko:** niedrig im Greenfield.

- [x] **REFACTOR-DB-6** — Audit `erstellt_am`/`aktualisiert_am` nullable auf `spieler`, `partie`, `tisch`, `laufendes_spiel`, `spieler_statistik` → `NOT NULL DEFAULT NOW()` (DB erzwingt + befüllt). **DoD:** Spalten NOT NULL; `mvn clean test` grün. **Risiko:** niedrig.

- [x] **REFACTOR-DB-7** — Audit-of-who: `erstellt_von_spieler_id UUID` auf `partie` ergänzen (nullable, NULL = System/KI). ON DELETE aller Creator-FKs auf `SET NULL`. Entity + Schreibpfad mitziehen. **DoD:** neue Partien tragen den Ersteller; `mvn clean test` grün. **Risiko:** mittel (Schreibpfad).

- [x] **REFACTOR-DB-8** — NOT-NULL-Abdeckung vervollständigen (Ergänzung zu DB-2): `spielergebnis_archiv` (`geber_position`, `spieltyp`, `absage_punkte`, `gegen_die_alten_punkte`, `solo_multiplikator`, `spielpunkte_*`, `abgeschlossen_am`), `sonderpunkt_eintrag` (`partei`, `sonderpunkt_typ`), `partie` (`regelvariante`, `spielregeln`), `tisch.zugangsmodus` (`DEFAULT 'OFFEN'`). **DoD:** Constraints gesetzt, App setzt alle Werte; `mvn clean test` grün. **Risiko:** niedrig-mittel.

- [x] **REFACTOR-DB-9** — `event_publication` ohne PRIMARY KEY → `PRIMARY KEY (id)` ergänzen (Spring-Modulith-Default). **DoD:** PK vorhanden; Outbox-Tests grün. **Risiko:** niedrig.

- [x] **REFACTOR-DB-10** — DSGVO-ON-DELETE-Politik für alle `spieler`-referenzierenden FKs festlegen (`partie_teilnehmer`, `spieler_statistik`, `tisch_spieler`, `tisch.erstellt_von_spieler_id`, `spieler_rating`). Empfehlung: Statistik/Rating CASCADE, Archiv/Teilnahme SET NULL. **Vorbedingung-Entscheidung:** koppelt an späteres Lösch-Feature — Politik **jetzt** im Schema, Feature später. **DoD:** ON-DELETE auf allen FKs explizit; dokumentiert. **Risiko:** niedrig (Schema), mittel (Semantik).

### Statistik & Ranking (Session 36 — entschieden: Stufe 0+1, TrueSkill; Saison/Liga aufgeschoben)

> Vollständig in `specs/statistik-ranking.md`. **Umfang entschieden:** Stufe 0 (abgeleitete Kennzahlen) + Stufe 1 (TrueSkill-Rating + ewige Bestenliste, 1 neue UI-Szene). Saison/Liga **aufgeschoben** — additive Erweiterung später (risikoarm; `spielergebnis_archiv` erlaubt rückwirkende Berechnung). **Wichtige Trennung:** Per-Spieler-Statistik → Postgres/API; aggregierte Domain-Metriken → Prometheus/Grafana (nie `spieler_id` als Label).

- [x] **STAT-DERIVED** (Stufe 0) — Abgeleitete Kennzahlen (Ø Punkte/Spiel, Siegquote, Ø Augen) im Profil-Endpoint/View, analog `partie_ergebnis_view`. **DoD:** Kennzahlen im Profil sichtbar; `mvn clean test` + `npm test` grün. **Risiko:** niedrig.

- [x] **STAT-RATING** (Stufe 1) — TrueSkill-Rating. `rating_mu`/`rating_sigma NUMERIC(8,4)` an die bestehende `spieler_statistik` (in `000` konsolidiert; Defaults μ=25, σ=8.3333). TrueSkill-Update im **selben Pro-Spiel-Statistikpfad** beim Event „Spiel abgeschlossen". **Erste Datei zuerst:** `000-initial-schema.sql` (Spalten) + der Statistik-Fortschreibungs-Service. **DoD:** Rating wird pro Spiel fortgeschrieben; Roundtrip-Test; `mvn clean test` grün. **Risiko:** mittel (Korrektheit der TrueSkill-Formel — Bibliothek prüfen).

- [x] **FE-LEADERBOARD** (Stufe 1) — Neue Bestenlisten-Szene + Endpoint, sortiert nach `rating_mu − 3·rating_sigma` (pro Regelvariante, ewige Liste). **Erste Datei zuerst:** Backend-Endpoint, dann neue Phaser-Szene + Lobby-Verlinkung. **DoD:** Bestenliste in der App erreichbar; Vision-Loop ohne Layout-Bruch; Tests grün. **Risiko:** niedrig-mittel (UI).

- [x] **DECISION-RATING-ALGO** — ✓ **TrueSkill** (Session 36). 4-Spieler mit wechselnden Parteien; ELO ist 1-gegen-1. Schema (μ/σ) bleibt algorithmus-agnostisch.

- [ ] **STAT-SAISON-LIGA** (aufgeschoben) — Saisons (Reset/Listen/Rollover-Job) + Ligen (Auf-/Abstieg). Additive Erweiterung (neue Tabellen `saison` + saison-Rating + nullable `spielergebnis_archiv.saison_id`). Nur bauen, falls öffentlich/wachsend. **[WARTET — keine Greenfield-Dringlichkeit, rückwirkend aus Archiv berechenbar]**

- [x] **CHANGELOG-KONSOLIDIERUNG** (✓ entschieden: echtes Greenfield → konsolidieren) — `002`–`004` + alle Gegencheck-Fixes (DB-5…10) **direkt in `000-initial-schema.sql`** einpflegen statt additiver `005…`-Changesets. Ergebnis: ein einziges, sauberes Initial-Schema beim ersten Deploy. **Methode:** jeder DB-Task editiert `000` direkt (kein neues Changeset). `001-spring-session-schema.sql` bleibt eigenständig (Fremd-Schema). H2-Tests unkritisch (Neuaufbau je Lauf); persistente Dev-DB ggf. `clearCheckSums`. **DoD:** nur `000` + `001` aktiv, `002`–`004` entfernt, `mvn clean test` grün. **Risiko:** niedrig im Greenfield.

### Security-Review-Befunde (Session 48, 2026-06-04)

- [x] **BUG-FEEDBACK-JSON-INJECTION** (behoben) — `FeedbackController.java:43–44`: manuelles JSON-Escaping fehlte Backslash-Behandlung. Angreifer konnte via `\\"` die JSON-Struktur brechen und beliebige Felder in den Discord-Webhook-Payload injizieren (z.B. `"tts":true`, `@here`-Mentions). **Fix:** String-Konkatenation durch `ObjectMapper.writeValueAsString(Map.of(...))` ersetzt. Confidence 8/10. Kein Secrets-Leak, kein Datenverlust — nur Discord-Channel-Missbrauch möglich. **Risiko:** niedrig (nur relevant, wenn Webhook-URL gesetzt).

### Komplexitäts-Hotspots aus QA-CODE-METRICS (Session 47, 2026-06-04)

> Vollständig in `docs/metrics.md`. ESLint-Komplexitätsmessung + JaCoCo-Coverage (Backend 83% Lines / 71% Branches, Frontend 79%). Alle Modul-Grenzen OK.

- [x] **REFACTOR-FE-EREIGNISHANDLER** — `TischEreignisHandler.verarbeitePartieEreignis` hat zyklomatische Komplexität **68** (ESLint-Befund). Die Methode ist ein monolithischer Switch über alle Ereignistypen. Aufteilen in separate private Methoden je Ereignisgruppe (Spielzug, Ansage, Rundenende, Verbindung). **Erste Datei zuerst:** `frontend/src/szenen/TischEreignisHandler.ts` — `verarbeitePartieEreignis` in Dispatcher + je eine Methode pro Gruppe. **DoD:** Komplexität < 20; `npm test && npm run build` grün. **Risiko:** mittel (viel Logik).

- [x] **REFACTOR-FE-PARTIESTORE** — `PartieStore._verarbeiteEventQueue` (CC 60) → Dispatcher CC < 20 (Session 61). Phasen ausgelagert; Quiescence/KI-Verzögerung hinter synchrone Guard-Prädikate (Microtask-Timing-Invariant, Doc-Kommentar). 240/240 grün.

- [x] **REFACTOR-FE-KARTENRENDERER** (Session 61) — `renderKartenFaecher` (CC 53) + `setzeKartenInteraktion` (CC 32) → alle Methoden CC < 20. `renderKartenFaecher` ist jetzt Dispatcher (`berechneFaecherKontext` → Schleife über `rendereHandkarte`, das `berechneKartenFlags`/`kartenAlpha` nutzt); `setzeKartenInteraktion` delegiert an `entferneKartenListener`/`setzeSpielInteraktion`/`deaktiviereKartenInteraktion`. Öffentliche Signaturen unverändert. 240/240 + Build + Lint grün.

### UI-Mängel aus FE-UI-FINAL-REVIEW (Session 50, 2026-06-04)

> Vision-Loop grün (39.8s). Befunde aus Screenshots 01–12 gegen `specs/frontend-visuelles-design.md` geprüft. Details in `e2e/screenshots/`.

**P-Hoch:**

- [x] **BUG-LOGIN-BUTTON-TEXTCLIPPING** (entdeckt Session 61, FE-MOBILE-SMOKE-Verifikation) — In der `LoginSzene` ragt der Button-Text über die helle Button-Fläche hinaus: „Als Gast spielen" → letztes „n" liegt außerhalb der Box, „SCHNELLSTART (K)" wird rechts beschnitten. Vom Canvas (Phaser) gezeichnet, also viewport-unabhängig (auch Desktop betroffen, nicht durch Mobile-Viewport verursacht). **Erste Datei zuerst:** `frontend/src/szenen/LoginSzene.ts` — Button-Hintergrundbreite an Textbreite koppeln (analog zu den behobenen FE-UI-Clippings) oder Schriftgröße/Padding anpassen. **DoD:** Button-Text vollständig innerhalb der Fläche; Vision-/Mobile-Screenshot ohne Clipping. **Risiko:** niedrig.

- [x] **FE-RANGLISTE-BUTTON-CLIPPING** — Der „Rangliste"-Button (Trophy-Icon + Text) oben rechts wird in der Lobby an der rechten Viewport-Kante abgeschnitten (sichtbar in `01-lobby.png`, `11-offene-tische.png`). Trophy-Icon und Text teilweise außerhalb des sichtbaren Bereichs. **Erste Datei zuerst:** `frontend/src/szenen/SpielverwaltungsSzene.ts` — Button-X-Position so anpassen, dass min. 8–16px Abstand zum rechten Rand bleibt. **DoD:** Button vollständig sichtbar, kein Clipping. **Risiko:** niedrig.

- [x] **FE-NEUER-TISCH-MODAL-LAYOUT** — Im „Neuen Tisch erstellen"-Modal (`12-neuer-tisch-modal.png`): (a) Linker `<`-Pfeil-Button des Preset-Selektors wird am linken Modal-Rand abgeschnitten; (b) „Abbrechen"- und „Erstellen"-Buttons liegen zu nah beieinander und überlappen die darunter liegende „Offene Tische"-Sektion. **Erste Datei zuerst:** `frontend/src/szenen/SpielverwaltungsSzene.ts` — Modal-Höhe erhöhen, Preset-Selektor mit innerem Padding, Button-Abstände/Positionen korrigieren. **DoD:** Kein Clipping des Pfeil-Buttons; Buttons überlappen nicht; Vision-Loop grün. **Risiko:** niedrig-mittel.

**P-Mittel:**

- [x] **FE-RUNDENAUSWERTUNG-LESBARKEIT** — Das Rundenauswertungs-Overlay (`05-rundenauswertung-overlay.png`): Spielstatistiken in sehr kleiner Schrift mit niedrigem Kontrast auf dunklem Hintergrund — kaum lesbar. Außerdem: Status-Header zeigt rohes Enum `IM_SPIEL` statt deutschem Label „Im Spiel". **Erste Datei zuerst:** Render-Code des Rundenauswertungs-Overlays (in `TischSzene.ts` oder `TischEreignisHandler.ts`) — Font-Größe auf min. SM (10px) erhöhen, Kontrast anpassen, Enum-Mapping `IM_SPIEL → Im Spiel` ergänzen. **DoD:** Overlay-Text lesbar; kein rohes Enum sichtbar; Vision-Loop grün. **Risiko:** niedrig.

- [x] **FE-VORBEHALT-AUSWAHL-FEEDBACK** — Die drei Vorbehalt-Wechsel-Frames (`02-vorbehalt-wechsel-0/50/100`) zeigen alle denselben Text „Dasensolo" ohne erkennbares „aktuell ausgewählt"-Feedback (kein Cursor-Hervorhebung, kein farbiger Rahmen, kein Pfeil). Spec fordert klaren Selektions-Indikator für den Neo-Brutalism-Stil. **Erste Datei zuerst:** `frontend/src/szenen/TischSzene.ts` — aktuelle Auswahl mit Goldrahmen (`#ffd166`, 2px) oder `▶`-Prefix hervorheben. **DoD:** Aktuell gewählter Vorbehalt klar visuell markiert; Vision-Loop grün. **Risiko:** niedrig.

**P-Niedrig:**

- [x] **FE-LOBBY-BUTTON-ICONS** — „Mein Profil"-Button zeigt blauen Kreis, „Abmelden"-Button zeigt oranges Rechteck — sehen wie Debug-Platzhalter aus, keine semantische Icon-Bedeutung erkennbar (`01-lobby.png`). **Erste Datei zuerst:** `frontend/src/szenen/SpielverwaltungsSzene.ts` — Phaser-Sprite oder Emoji-Alternative (z.B. 👤 / 🚪) verwenden, oder Button-Icons entfernen falls kein passendes Asset vorhanden. **DoD:** Icons klar lesbar oder entfernt; kein Platzhalter-Grafik sichtbar. **Risiko:** niedrig.

- [x] **FE-NAMEPLATE-TEXTABSCHNEIDUNG** — In `03-stich-ausspielen-100.png` erscheint „Gu" als abgeschnittener Text im Spieler-Nameplate (vermutlich Stich-Zähler „Gu" statt vollständiger Abkürzung). Nameplate-Breite oder Font-Größe für den Stich-Zähler anpassen. **Erste Datei zuerst:** `frontend/src/szenen/TischSzene.ts` / Nameplate-Render-Methode — Textfeld-Breite prüfen und bei Bedarf anpassen. **DoD:** Stich-Zähler vollständig lesbar; Vision-Loop grün. **Risiko:** niedrig.

### UI-Mängel aus FE-VISUAL-REVIEW-BALATRO (Session 68, 2026-06-05)

> Vision-Loop grün (41.5s). Screenshots `01-lobby.png` / `11-offene-tische.png` zeigen zwei Layout-Fehler in der Lobby.

**P-Mittel:**

- [x] **BUG-LOBBY-OFFENE-TISCHE-OVERLAP** (entdeckt Session 68, behoben Session 70) — Header Y=570, Message Y=630, Liste Y=645/hoehe=150. Kein Overlap mehr. Vision-Loop ausgelassen (Backend offline), manueller Check empfohlen.

- [x] **BUG-LOBBY-TOPRIGHT-CLIPPING** (entdeckt Session 68, behoben Session 70) — Spielregeln X=880, Rangliste X=1120; Shadow-Overlap eliminiert, beide Buttons vollständig im Viewport.

### UI-Befunde aus FE-VISION-VERIFY (Session 75, 2026-06-05)

> Vision-Loop endlich tatsächlich ausgeführt (beide Projekte grün, 2 passed, 48.8s). Backend headless via `mvn spring-boot:run` + frisches Frontend nach `target/classes/static` kopiert. Screenshots tragen jetzt Plattform-Präfix (`desktop-*` / `mobile-portrait-*`). **Desktop-Spielfluss (Vorbehalt, Stichphase, Rundenauswertung, Einstellungen) rendert sauber.** Drei Layout-Befunde — **nicht im selben Lauf gefixt** (eigene Build-Tasks):

**P-Hoch:**

- [ ] **DISCO-MOBILE-PORTRAIT-LOCK** — **Widerspruch FE-MOBILE (S72) ↔ Orientierungssperre (FE-MOBILE-SMOKE).** Im `mobile-portrait`-Viewport (Pixel 5, 393×851) zeigt die App **ausschließlich** das Overlay „Bitte drehe dein Gerät ins Querformat, um Loco Doko zu spielen" — sowohl in Lobby (`mobile-portrait-01-lobby.png`) als auch in allen Spielphasen (`mobile-portrait-02/03/05-*.png`, alle ~18 KB, byte-nah identisch = statisches Overlay). Das Spiel/die Lobby wird im Portrait **nie** gerendert. Das steht im **direkten Widerspruch** zur S72-Notiz „Vollständiger Portrait-/Mobile-Umbau" (dynamische 720×1280-Portrait-Größe, Spieler-Koordinaten, Karten-Überlappung), die damit **visuell tot/unerreichbar** ist. **Konsequenz:** der `mobile-portrait`-Vision-Loop kann faktisch **nie** echtes Portrait-Gameplay aufnehmen → der S72-Layout-Eingriff bleibt unverifizierbar, solange die Sperre aktiv ist. **Entscheidung nötig (MENSCH/Design):** entweder (a) Orientierungssperre für Portrait **entfernen** und den S72-Portrait-Layout tatsächlich aktivieren (→ dann Portrait-Layout neu via Vision verifizieren), **oder** (b) Portrait bewusst als „Landscape erzwingen" belassen → dann `playwright.config.vision.ts` mobiles Projekt auf **Landscape** (z.B. 851×393) umstellen, um die echte Mobile-Landscape-Erfahrung zu prüfen, und die S72-Portrait-Claims in der Notiz korrigieren. **Erste Datei zuerst:** Orientierungs-Overlay-Logik (`frontend/src/main.ts` / Resize-/Orientation-Handler) + `e2e/playwright.config.vision.ts`. **Risiko:** mittel (Design-Entscheidung, nicht rein technisch).

**P-Mittel:**

- [x] **BUG-LOBBY-TOPRIGHT-CLIPPING-2** (Regression/Rest aus S70) — ✓ S76: `PhaserButton` exponiert seine tatsächliche Renderbreite (`public readonly breite`, inkl. Text-Autosize). `SpielverwaltungsSzene` layoutet die beiden oben-rechts-Buttons jetzt **rechtsbündig anhand der realen Breite**: Rangliste an `width - 22 - breite/2`, Spielregeln links daneben mit 16px Lücke. Kein hartkodiertes X mehr → unabhängig von Textlänge/Font keine Überlappung. Vision-Loop (Desktop) grün, `desktop-01-lobby.png` zeigt „? Spielregeln" vollständig + klare Lücke zur Rangliste. 240/240 FE-Tests grün (PhaserButton-Mock um `setX`/`breite` ergänzt).

- [x] **BUG-NEUER-TISCH-MODAL-CLIPPING-2** (Regression aus FE-MOBILE S72) — ✓ S77: Zwei Ursachen behoben. (a) Preset-Text: Die ‹ ›-Pfeil-Buttons sind **selbst auto-skaliert** (PhaserButton `Math.max(breite, textObj.width+40)` → `<`/`>` real ~60px statt 40px, innere Kante bei ±135 statt ±145) und verdeckten als undurchsichtige Buttons die Enden des 14px-Textes „Loco-Blatt (Hausregeln)". Fix: Pfeile auf x=±205 nach außen, presetValue auf 13px + `wordWrap{width:330}`+`align:center` als Sicherheitsnetz → Text bleibt garantiert zwischen den Pfeilen. (b) Button-Überlappung war **dieselbe Auto-Width-Wurzel wie S76**: `PhaserModal` ordnete Aktions-Buttons in fixem 160px-Raster an (Annahme 140px), aber „Abbrechen"/„Erstellen" (20px-Font) wachsen auf ~220px → Überlappung. Fix: `PhaserModal` erzeugt die Buttons jetzt zuerst und ordnet sie **anhand ihrer realen `breite`** zentriert mit 24px-Lücke an (Ein-Button-Modals wie das Rundenende-„Weiter" bleiben bei x=0, keine Regression). Vision-Loop Desktop grün, `desktop-12-neuer-tisch-modal.png` zeigt vollständigen Preset-Text + klar getrennte Buttons; `desktop-05`-Rundenende-„Weiter" weiterhin zentriert. 240/240 FE-Tests grün (PhaserModal-Mock um `breite` ergänzt), Build+Lint sauber. (Erste Desktop-Vision-Failure war ein KI-Playthrough-Flake — Re-Run grün; Mobile-Portrait erwartungsgemäß im DISCO-MOBILE-PORTRAIT-LOCK-Timeout.)

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
