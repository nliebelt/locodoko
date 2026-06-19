# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-06-19 (Session 143). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md` (Sessions 1–128 archiviert).

## Notiz

**DOC-METRICS-REFRESH abgeschlossen (Session 143).** `scripts/metrics.sh` ausgeführt, `docs/metrics.md` auf Stand 2026-06-19 gebracht. Post-Refactoring-Zahlen: KiTischOrchestrator CCN 14 (war 20), FE-Hotspots TischEreignisHandler/PartieStore/TischKartenRenderer deutlich reduziert (höchster Einzelwert jetzt 25 statt 68). Statische Kandidaten-Tabelle im Skript ebenfalls aktualisiert. Kein Test-Lauf nötig (rein dokumentarisch).

**Nächster Schritt:** `BUG-BE-FE-SCHWEINCHEN-STATISTIK` — `schweinchenGespielt` zu `SpielerProfilAntwort.StatistikAntwort` hinzufügen.

**FEAT-RANGLISTE-EINHEITLICH abgeschlossen (Session 141).** Bestenliste und Spielerprofil-Statistik vereinheitlicht: BE aggregiert alle Regelvarianten (`AVG(rating_mu/sigma)`, `SUM(anzahl_spiele/siege/...)`) in `SpielerProfilService.ladeBestenlisteAggregiert()` via `JdbcClient`. Neues Projektions-Record `BestenlisteStatistikAggregat`. `BestenlisteAntwort.regelvariante` entfernt, `SpielerProfilAntwort.statistiken` (Map) → `statistik` (einzelner aggregierter Eintrag). FE: `BestenlisterSzene` ohne Tabs, `SpielerProfilModal` ohne Varianten-Tabs, `AppStore.ladeBestenliste()` ohne Parameter. 477/477 FE-Tests, 503/503 BE-Tests, Build + Lint + Complexity grün. Alle autonomen Tasks Block A (S131–S141) erledigt.

**Neue autonome Runde (Session 131, mit User abgestimmt).** Block-A-Vorgängerrunde (S129/130) komplett erledigt → wird beim nächsten Slim-Down ins Archiv verschoben. Aus dem Metrik-Review (lizard/Biome/JaCoCo) und einem Dependency-Check abgeleitet, vom User priorisiert:

- **REFACTOR-BE-KI-ORCHESTRATOR** — echter BE-Hotspot (CCN 20).
- **REFACTOR-FE-COMPLEXITY-HOTSPOTS** + **QA-FE-BIOME-LOWER** — Top-FE-Kandidaten refactoren, *dann* Biome-Schwelle senken (Reihenfolge zwingend).
- **DEPS-BE-SPRING-UPDATE** — Boot 4.0.5→4.1.0, Modulith 2.0.0→2.1.0, Sentry 8.9.0→8.43.2 (Minor innerhalb aktueller Major, risikoarm).
- **DEPS-FE-TOOLING-MAJORS** (TS/Vite/Vitest/ESLint) und **DEPS-FE-PHASER4-SPIKE** (riskant, separat).
- **CLEANUP-VISION-MOBILE-DEFER** — mobile-landscape aus dem Vision-Lauf nehmen (Mobile = nice-to-have, nicht release-relevant).

**Geklärt im Review (kein Task nötig):** DB-Migrationen sind bereits zu `000-initial-schema.sql` + `001-spring-session-schema.sql` konsolidiert (Alt-Changesets in `db/changelog/archiv/`). FE-Doku ausführlich (547 JSDoc-Blöcke / 51 von 61 Dateien). Vision-Desktop läuft unverändert.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün) — wird nach Abschluss ins Archiv verschoben
- [~] Teilweise implementiert
- [ ] Offen

---

## A) Offene autonome Tasks (Ralph — kein MENSCH nötig)

> Geerdet am Repo-Scan S126: Code sehr sauber (keine TODO/FIXME, keine verschluckten Exceptions, kein `any` im FE-Quellcode, jede FE-Datei getestet, Prod-Deps 0 CVEs). Das sind die realen offenen Hebel. **Pro Task ein Commit**, `mvn clean test` / `npm test && npm run build && npm run lint` grün.

- [x] **REFACTOR-BE-KI-ORCHESTRATOR** (Backend/Refactoring, autonom, klein-mittel) — `KiTischOrchestrator::automatisiereTisch` ist der reale BE-Komplexitäts-Spitzenreiter (**lizard CCN 20, 81 NLOC**, `src/main/java/de/locodoko/tisch/KiTischOrchestrator.java:106`). Eine große `while`-Schleife mit zwei klar trennbaren fachlichen Blöcken: (a) **Spielabschluss** (Phase `Auswertung`/`GesamtstandAktualisieren` → `schliesseAktuellesSpielAbUndStarteNaechstes` + Lifecycle + ggf. Pause für menschliche Spieler) und (b) **KI-Zug ausführen** (`fuehreAktionAus` + Ereignis-Veröffentlichung + Optimistic-Lock-Handling). **Fix:** beide Blöcke in private Teilmethoden ziehen (z.B. `schliesseSpielAbUndStarteNaechstes(...)` mit Rückgabe „weiterlaufen/abbrechen" und `fuehreKiZugAus(...)`), Schleifenrumpf auf Lese-/Verzweigungslogik reduzieren. **Verhalten exakt erhalten** — reine Extraktion, keine Logikänderung; insbesondere die `REQUIRES_NEW`-Transaktionssemantik und das `return`-vs-`continue`-Verhalten 1:1 bewahren. **Erste Datei zuerst:** `KiTischOrchestrator.java`. **DoD:** `automatisiereTisch` deutlich unter CCN 15 (per `scripts/metrics.sh` / lizard verifiziert), `mvn clean test` grün, keine Verhaltensänderung. **Risiko:** niedrig (Modul ki 91 %, orchestrierung 100 % Coverage).

- [x] **REFACTOR-FE-COMPLEXITY-HOTSPOTS** (Frontend/Refactoring, autonom, mittel) — die drei kognitiven FE-Top-Kandidaten aus `docs/metrics.md` entschärfen: `TischEreignisHandler.verarbeitePartieEreignis` (kogn. **68**), `PartieStore._verarbeiteEventQueue` (**60**), `TischKartenRenderer.renderKartenFaecher` (**53**). **Fix je Methode:** Dispatcher-/Teilmethoden je Ereignistyp bzw. Render-Schritt extrahieren (siehe Empfehlungen in `docs/metrics.md`), Verhalten exakt erhalten. **Pro Hotspot ein eigener Commit** (drei Commits) — nicht bündeln. Nach jedem Refactor `npm test && npm run build && npm run lint` grün. **Vorbedingung für QA-FE-BIOME-LOWER.** **Erste Datei zuerst:** `frontend/src/szenen/TischEreignisHandler.ts`. **DoD:** alle drei Methoden messbar unter Biome-kognitiver Schwelle 15 (per `npm run complexity` mit testweise gesenkter Schwelle prüfen), FE-Suite/Build/Lint grün, keine visuellen Regressionen (Vision-Smoke desktop). **Risiko:** mittel (Kern-Render-/Event-Pfade — gut getestet, aber zentral).

- [x] **QA-FE-BIOME-LOWER** (Frontend/QA, autonom, klein — **hängt an REFACTOR-FE-COMPLEXITY-HOTSPOTS**) — die Biome-Schwelle `maxAllowedComplexity` in `frontend/biome.json` (aktuell **40**) stufenweise senken. **Schritte:** nach jedem Refactoring-Schritt die Schwelle auf den neuen Ist-Höchstwert ziehen (Zielkorridor 40 → 30 → 25 → 20 → **15**), je Stufe verbleibende Ausreißer aus der Hotspot-Liste (`TischInputHandler.ts:53/219`, `SpielerProfilModal.ts:132`, `SpielverwaltungApi.ts:76`, `TischRundenEndeController.ts`, `BestenlisterSzene.ts:113` u.a.) refactoren, bis `npm run complexity` bei 15 grün läuft. Erreicht eine Stufe ihr Ziel nicht ohne unverhältnismäßigen Umbau, bei der niedrigsten grünen Schwelle stoppen und im Kommentar dokumentieren. **Erste Datei zuerst:** `frontend/biome.json`. **DoD:** Biome-Schwelle so niedrig wie ohne Risiko möglich (Ziel 15), `npm run complexity` + Suite/Build/Lint grün; gewählte Schwelle im JSON kommentiert. **Risiko:** niedrig (Gate-Verschärfung, additiv).

- [x] **DEPS-FE-TOOLING-MAJORS** (Frontend/Deps, autonom, mittel) — FE-Tooling-Majors anheben (Phaser **ausgenommen** — eigener Spike). Offen laut `npm outdated`: `typescript` 5.9→6.x, `vite` 6.4→8.x, `vitest`+`@vitest/coverage-v8` 3.2→4.x, `eslint`+`@eslint/js` 9.39→10.x, `globals` 16→17, `typescript-eslint` auf 8.61. **Schritte:** **einzeln/gestaffelt** anheben (nicht alle auf einmal), nach jedem Bump `npm test && npm run build && npm run lint` + `npm run complexity`; bricht ein Bump und ist in zumutbarem Rahmen nicht zu fixen, diesen Major auslassen und als Notiz unter „Entdeckungen" vermerken (Rest trotzdem heben). Achtung Wechselwirkung: `vite`/`vitest` wurden in `SEC-DEPS-FE-DEV-AUDIT` nur innerhalb des Majors CVE-gepatcht — der Sprung auf 4/8 ist der eigentliche Major. **Pro erfolgreichem Major ein Commit.** **Erste Datei zuerst:** `frontend/package.json`. **DoD:** so viele Tooling-Majors wie sicher möglich aktuell, Suite/Build/Lint/Complexity grün; ausgelassene Majors begründet notiert. **Risiko:** mittel (Major-Bumps brechen erfahrungsgemäß Config/Build).

- [x] **DEPS-FE-PHASER4-SPIKE** (Frontend/Deps, autonom, **riskant — Spike, kein blindes Merge**) — Machbarkeit des Sprungs **Phaser 3.90 → 4.1** evaluieren (Engine-Rewrite, potenziell viele Breaking Changes in Szenen/Renderer/Input). **Schritte:** in einem **Wegwerf-Branch** (`git worktree`/Branch) `phaser@4` installieren, `npm run build` + `npm test` laufen lassen, Bruchstellen kategorisieren (API-Renames, Typänderungen, Verhaltensänderungen im Renderer/Tween). **Nicht** auf `main` mergen, wenn nicht alle Tests + Vision-Smoke (desktop) sauber grün sind. **Ergebnis = Bericht:** Aufwandsschätzung + Liste der Breaking Changes als Notiz unter „Entdeckungen" und, falls trivial machbar, als sauberer eigener Migrations-Commit; sonst dokumentiert zurückstellen. **Erste Datei zuerst:** Notiz im Plan / `package.json` im Spike-Branch. **DoD:** belastbare Aussage „machbar mit Aufwand X" oder „zurückgestellt, Gründe Y", **ohne** instabilen `main`. **Risiko:** hoch (Engine-Major) — daher bewusst als Spike isoliert.

- [x] **CLEANUP-VISION-MOBILE-DEFER** (E2E/Cleanup, autonom, winzig) — Mobile ist fürs erste Release **nicht** relevant (User-Entscheidung S131). Das `mobile-landscape`-Projekt aus dem regulären Vision-Lauf nehmen, damit es keine Laufzeit/Screenshots-Pflege erzeugt. **Fix:** in `e2e/playwright.config.vision.ts` das `mobile-landscape`-Projekt auskommentieren oder per Env-Flag (`VISION_MOBILE=1`) optional schalten; den erläuternden Kommentar (Orientierungssperre, DISCO S126) als Begründung für die Zurückstellung erhalten. Veraltete `mobile-landscape-*.png` aus `e2e/screenshots/` entfernen oder belassen — Entscheidung im Commit notieren. **Erste Datei zuerst:** `e2e/playwright.config.vision.ts`. **DoD:** regulärer Vision-Lauf fährt nur noch `desktop`; Mobile reaktivierbar dokumentiert. **Risiko:** niedrig.

- [x] **DEPS-BE-SPRING-UPDATE** (Backend/Deps, autonom, klein) — BE hängt innerhalb der aktuellen Major-Generation (Boot 4 / Modulith 2 / Java 25) ein Minor zurück. Live gegen Maven Central (S131): `spring-boot-starter-parent` **4.0.5 → 4.1.0** (Minor — zieht via BOM transitiv den Großteil der Spring/Jackson/Tomcat/etc-Deps mit), `spring-modulith.version` **2.0.0 → 2.1.0**, `sentry.version` **8.9.0 → 8.43.2** (großer Sprung *innerhalb* Major 8). Java 25 ist bereits neueste. **Schritte:** Parent-Bump und die zwei Properties **einzeln** anheben, nach jedem Bump `mvn clean test` (Pflicht-`clean`); Reihenfolge: erst Sentry (isoliert, selbstverwaltet), dann Modulith, dann Boot-Parent (größter transitiver Effekt). Bricht ein Bump und ist nicht zumutbar fixbar, diesen auslassen + Notiz unter „Entdeckungen", Rest trotzdem heben. Auf deprecation-/Konfig-Warnungen im Boot-4.1-Log achten. **Pro erfolgreichem Bump ein Commit.** **Erste Datei zuerst:** `pom.xml`. **DoD:** Boot/Modulith/Sentry auf neuestem Stand (oder begründet ausgelassen), `mvn clean test` grün, Logs ohne neue Warnungen. **Risiko:** niedrig-mittel (Minor innerhalb aktueller Major, kein Rewrite — Boot-Parent betrifft aber viele transitive Deps).

### Neue Tasks (Session 139, User-priorisiert)

> Aus User-Feedback (manuelles Testen Phaser-4-Build). Echte Pointer-Klicks sind von **keinem** Test abgedeckt (Vision/E2E nutzen die JS-Bridge `drueckeSzenenButton`/`btn.trigger()` bzw. Tastatur) — daher ist die Klick-Lücke unten der erste Task.

- [x] **TEST-E2E-ECHTE-KLICKS** (E2E/Test, autonom, klein-mittel) — Smoke-Test mit **echten Maus-Klicks** (`page.mouse.click` auf Canvas-Koordinaten), nicht über die Bridge. Hintergrund S139: bei der Phaser-4-Migration konnte ein vermuteter Input-Bug nur per echtem Klick reproduziert/widerlegt werden — die bestehende Suite (`vision-loop`, `schnellstart`, `multiplayer`) triggert Buttons ausschließlich via `__locodoko.drueckeSzenenButton` (ruft `btn.trigger()`) bzw. spielt Karten per Tastatur, prüft also **nie** das echte Pointer-Hit-Testing. **Abdecken:** (a) Schnellstart-Button per echtem Klick → `TischSzene`; (b) „Beitreten" eines wartenden Tischs (zweiter Gast-Kontext) per echtem Klick → `TischSzene`; (c) eine Handkarte per echtem Klick spielen — **mit Polling**, da Karten während Animationen bewusst nicht interaktiv sind (`TischKartenRenderer` `istInteraktiv = !animationAktiv && …`). Game-Size ist 1280×720 (FIT, scale 1) → Canvas-Pixel ≈ Seitenpixel. Button-/Kartenkoordinaten ggf. robust über eine kleine Test-Hilfe ermitteln (interaktive Objekt-Bounds), **nicht** dauerhaft Debug-Hooks in `main.ts` lassen. **Erste Datei zuerst:** `e2e/tests/echte-klicks.spec.ts` (neu). **DoD:** drei echte-Klick-Pfade grün, kein Debug-Code in `src/`. **Risiko:** niedrig.

- [x] **FEAT-FE-TISCH-REGELN-ERWEITERT** (Frontend/Feature, autonom, mittel) — Im „Neuer Tisch"-Dialog (`frontend/src/szenen/tischErstellenDialog.ts`) lassen sich aktuell **nur** Preset + Anzahl Spiele + Privat wählen — **keine Einzelregeln**, obwohl Backend + Store das können (`appStore.erstelleKonfiguriertenTisch(name, konfiguration, privat)` mit voller `TischKonfigurationDto`, siehe `frontend/src/modelle/SpielverwaltungDto.ts:51`). **User-Wunsch:** eigene Regeln konfigurierbar machen. **Umsetzung:** aufklappbarer **„Erweitert"-Bereich** mit Schaltern/Feldern für **alle** Felder der `TischKonfigurationDto` (ohneNeunen, hochzeitErlaubt, armutErlaubt, damen-/buben-/fleischlos-/trumpfsoloErlaubt, zweiteDulleSticht, fuchsGefangenAktiv, karlchenAktiv, doppelkopfAktiv, bockrundenAktiv, schweinchenAktiv, dreissigAugenPflichtAktiv, schmeissenAktiv, herzDurchgegangenNurHoch, mindestkarten\* , kiSchwierigkeit, tischhintergrund). Das gewählte **Preset liefert die Startwerte** (Presets tragen `.konfiguration`); ändert der Nutzer etwas, wird beim Erstellen `erstelleKonfiguriertenTisch(...)` statt `erstelleTischMitPreset(...)` aufgerufen. Ohne Änderung bleibt der Preset-Pfad (kompatibel). **Erste Datei zuerst:** `tischErstellenDialog.ts`. **DoD:** Erweitert-Bereich vorhanden; Tisch mit eigenen Regeln end-to-end erstellbar (Regeln greifen im Spiel); `npm test && npm run build && npm run lint` grün; Vision-Smoke des Dialogs (offen + Erweitert aufgeklappt). **Risiko:** niedrig-mittel (DOM-Overlay, viele Felder).

- [x] **FEAT-RANGLISTE-EINHEITLICH** (Full-Stack/Feature, autonom, mittel) — Die Bestenliste trennt aktuell in **TURNIER/SONDER/FREI** (`frontend/src/szenen/BestenlisterSzene.ts:9` `REGELVARIANTEN`; Backend `SpielerProfilController` Param `regelvariante`, `BestenlisteAntwort`). Das verwirrt: „TURNIER" liest sich wie ein Turnier-Event, ist aber nur eine **Regelkategorie**. **User-Entscheidung S139:** **nur EINE Rangliste** über alle Regelvarianten, Kategorisierung entfernen. **Umsetzung:** (FE) Tabs/`REGELVARIANTEN` aus `BestenlisterSzene` entfernen, eine kombinierte Liste rendern. (BE) Bestenliste über alle Varianten **aggregieren** — Endpoint/Query in `SpielerProfilController`/zugehörigem Service so anpassen, dass eine variantenübergreifende Wertung berechnet wird (ein Spieler = Summe/Aggregat über alle Varianten). **Mitentscheiden:** Die Profil-Statistik (`SpielerProfilAntwort`, ebenfalls nach Variante gruppiert) konsequent **ebenfalls** auf eine Gesamtansicht zusammenführen (sonst inkonsistent). **Erste Datei zuerst:** `frontend/src/szenen/BestenlisterSzene.ts` (FE-Schnitt), dann Backend-Aggregation. **DoD:** Bestenliste zeigt eine einheitliche Liste ohne Tabs; Backend liefert variantenübergreifende Wertung; `mvn clean test` + FE-Suite/Build/Lint grün; Vision-Smoke der Bestenliste. **Risiko:** mittel (Backend-Aggregation + evtl. Migrations-/Query-Anpassung).

### Neue Tasks (Session 142, Codebase-Scan)

> Aus dem Spec-/Code-Scan S142. Zwei Bugs, zwei Doku-Tasks, ein M2-Feature.

- [x] **BUG-FE-STANDARD-KONFIG** (Frontend/Bugfix, autonom, winzig) — `STANDARD_KONFIG` in `frontend/src/szenen/tischErstellenDialog.ts:52–54` setzt `bockrundenAktiv`, `schweinchenAktiv` und `dreissigAugenPflichtAktiv` auf `true`. Spec (`tischkonfiguration.md`) und Backend (`TischkonfigurationEmbeddable.java:52–54`) definieren den Standard für alle drei als `false`. Damit sendet das FE beim „Neuer Tisch ohne Preset-Änderung" abweichende Defaults ans Backend. **Fix:** alle drei Felder in `STANDARD_KONFIG` auf `false` setzen. Die Preset-Werte (`konfiguration`-Prop) bleiben unberührt — die Regel greift nur für den initialen Fallback. **Erste Datei zuerst:** `tischErstellenDialog.ts`. **DoD:** alle drei Felder auf `false`, `npm test && npm run build && npm run lint` grün, Tests für STANDARD_KONFIG ergänzen oder prüfen. **Risiko:** minimal (ein-Zeilen-Fix pro Feld).

- [ ] **BUG-BE-FE-SCHWEINCHEN-STATISTIK** (Full-Stack/Bugfix, autonom, klein) — `SpielerStatistik.schweinchenGespielt()` wird vom Domain-Listener bereits getrackt (`SpielerStatistik.java:60/118`), fehlt aber in `SpielerProfilAntwort.StatistikAntwort` (weder im Record-Konstruktor noch in `aus()` noch in `aggregiereStatistiken()` — `SpielerProfilAntwort.java:31–100/141–200`). FE `SpielerProfilModal` und `BestenlisterSzene` zeigen es daher nicht. Spec `statistik-ranking.md` listet Schweinchen unter den zu trackenden Ereignissen. **Fix:** (1) `schweinchenGespielt: int` zu `StatistikAntwort`-Record-Feldern ergänzen, (2) `aus()` und `aggregiereStatistiken()` erweitern, (3) im FE `SpielerProfilModal.ts` die Anzeige ergänzen (analog `karlchenGespielt`), (4) OpenAPI-Types regenerieren (`npm run generate-types`). **Erste Datei zuerst:** `SpielerProfilAntwort.java`. **DoD:** Feld in API + FE sichtbar, `mvn clean test` + FE-Suite/Build/Lint grün. **Risiko:** niedrig (additives Feld).

- [x] **DOC-METRICS-REFRESH** (Doku/Tooling, autonom, winzig) — `docs/metrics.md` ist auf Stand ~Session 131 (Pre-REFACTOR, 2026-06-15) und zeigt veraltete CCN-Werte (z.B. `KiTischOrchestrator::automatisiereTisch` CCN 20, `TischInputHandler` CCN 35) — nach den abgeschlossenen REFACTOR-Tasks sind die realen Werte deutlich niedriger. **Fix:** `bash scripts/metrics.sh > docs/metrics.md` (oder äquivalent — Skript prüfen ob es direkt in die Datei schreibt) ausführen, Output committen. **Erste Datei zuerst:** `scripts/metrics.sh` lesen, dann ausführen. **DoD:** `docs/metrics.md` enthält Post-Refactoring-Zahlen (Datum aktuell), `KiTischOrchestrator` und die drei FE-Hotspots (TischEreignisHandler/PartieStore/TischKartenRenderer) zeigen deutlich reduzierte Werte. **Risiko:** minimal (rein dokumentarisch).

- [ ] **DOC-SPEC-SPIELERPROFIL-UPDATE** (Doku/Spec-Pflege, autonom, winzig) — `specs/frontend-spielerprofil.md` beschreibt noch das alte Varianten-Tab-Konzept (`TURNIER/SONDER/FREI`-Tabs im Profil-Modal), das per `FEAT-RANGLISTE-EINHEITLICH` (S141) entfernt wurde. Außerdem fehlt die Erwähnung von `schweinchenGespielt` als anzuzeigendes Statistik-Feld. **Fix:** Spec auf einheitliche Ein-Ansicht-Darstellung (kein Varianten-Tab) aktualisieren + `schweinchenGespielt` in die Statistik-Felder-Liste aufnehmen. **Erste Datei zuerst:** `specs/frontend-spielerprofil.md`. **DoD:** Spec beschreibt den aktuellen Stand ohne Widerspruch zum Code. **Risiko:** null (reine Doku).

- [ ] **FEAT-RECHT-SEITEN-GERUEST** (Full-Stack/Feature, autonom, mittel — **M2-Gate**) — `/impressum`, `/datenschutz` und `/agb` fehlen im Code vollständig (weder Spring-Route noch statische Seite noch FE-Link). Spec `specs/recht-impressum-datenschutz.md` enthält die vollständige Struktur mit Platzhaltern (`[Vollständiger Name]`, `[E-Mail]` etc.) für den Hobby-Betrieb. **Umsetzung:** (1) Drei statische HTML-Seiten mit den Pflichtabschnitten aus der Spec erstellen (canvas-freie HTML außerhalb von Phaser), Platzhalter `[BETREIBER-NAME]` / `[BETREIBER-EMAIL]` etc. als `<!-- TODO: vor Go-Live ausfüllen -->`-Kommentare markieren; (2) Spring-Controller oder `WebMvcConfigurer`-Ressource für `/impressum`, `/datenschutz`, `/agb`; (3) Footer-Links in `frontend/index.html` (unter dem Canvas) eintragen. **Erste Datei zuerst:** `src/main/resources/static/impressum.html`. **DoD:** alle drei URLs liefern 200, Footer-Links erreichbar, Platzhalter klar markiert, `mvn clean test` + FE-Suite/Build grün. **Hinweis für Mensch:** vor Go-Live `[BETREIBER-…]`-Platzhalter mit echten Daten füllen und Texte juristisch prüfen. **Risiko:** niedrig (additiv, kein bestehender Code betroffen).

### Empfohlene Build-Reihenfolge (Block A — neue Runde ab S142)

> Nimm den **obersten noch offenen** Task. Alle autonom; bei Vision-Tasks fährt Ralph das Backend selbst headless hoch.

1. **BUG-FE-STANDARD-KONFIG** (winzig, sofortiger Bugfix — guter Einstieg)
2. **DOC-METRICS-REFRESH** (winzig — direkt danach, damit frische Zahlen vorliegen)
3. **BUG-BE-FE-SCHWEINCHEN-STATISTIK** (klein — additives Feld, BE + FE)
4. **DOC-SPEC-SPIELERPROFIL-UPDATE** (winzig — Spec-Hygiene, kein Code-Risiko)
5. **FEAT-RECHT-SEITEN-GERUEST** (mittel — M2-Gate, isolierter neuer Code)

_Vorrunde S129/130 erledigt (→ Archiv beim nächsten Slim-Down): QA-VISION-MOBILE-LANDSCAPE, CLEANUP-VISION-SCREENSHOT-DUBLETTE, SEC-DEPS-FE-DEV-AUDIT, QA-METRICS-REFRESH, QA-METRICS-TOOLING, QA-FE-BIOME-COMPLEXITY, PERF-FE-BUNDLE-SPLIT-2._

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

- **S129 — `Tisch`-Klasse (de.locodoko.partie) hat 0% Line-Coverage** (25 LOC laut JaCoCo): Domänen-Klasse im Partie-Kern ohne eigene Tests. Wenn nicht durch Integrationstests abgedeckt → Unit-Test-Task ergänzen. **S142-Update:** Kein direkter `TischTest.java` gefunden; Gesamtcoverage `de.locodoko.partie` bei 89% → wird durch Integrationstests mitabgedeckt. Akzeptiertes Restrisiko — kein eigener Task.
- **S129 — `partie.ereignisse`-Paket: 50% Coverage** (10 Lines): Ereignis-Klassen im Partie-Kern nur halb abgedeckt. **S142-Update:** Die 9 Ereignis-Records (+ package-info) sind reine Datenträger ohne Business-Logik; 50% bedeutet einige Records wurden nie instanziiert in Tests. Akzeptiertes Restrisiko (Null-Logik-Records) — kein eigener Task.
- **S129 — `tisch.persistenz`-Paket: 68% Coverage** (206 Lines): knapp unter 70%-Schwelle. `JsonbConverter` (55%, 45 LOC) ist Haupttreiber. **S142-Update:** Bleibt offen. Kein kritischer Pfad unabgedeckt — Infrastruktur-Code, nicht Business-Logik. Akzeptiertes Restrisiko.
- **S142 — `docs/metrics.md` ist Pre-REFACTOR-Stand (2026-06-15, vor Session 131-Refactoring):** Zeigt veraltete CCN-Zahlen (u.a. `KiTischOrchestrator` CCN 20, `TischInputHandler` CCN 35, `SpielerProfilModal` CCN 33). Nach REFACTOR-BE-KI-ORCHESTRATOR, REFACTOR-FE-COMPLEXITY-HOTSPOTS und QA-FE-BIOME-LOWER sind die realen Werte deutlich niedriger. → **DOC-METRICS-REFRESH** (neu in Block A).
- **S129 — FE-Komplexitäts-Hotspot neu: `TischInputHandler::verarbeiteTastatureingabe` CCN 35** (vorher als 27 geschätzt — ESLint cyclomatic, nicht kognitiv). Realer Messwert aus aktuellem ESLint-Lauf.

- **S137 — DEPS-FE-TOOLING-MAJORS Breaking Changes:** (a) Vitest 4: `Reflect.construct(arrowFn)` schlägt fehl — `vi.fn(() => ...)` in Test-Mocks, die mit `new` aufgerufen werden, muss `vi.fn(function() { return ...; })` sein. (b) Vite 8 (Rolldown-Backend): `manualChunks` als Objekt entfernt, nur noch Funktion. Build-Zeit ~6× schneller. Kein Vite 7.x. (c) ESLint 10: `no-useless-assignment` in `js.configs.recommended` aufgenommen. (d) `openapi-typescript@7.x` requiert `typescript@^5.x` — mit TS6 braucht `npm install` `--legacy-peer-deps`, aber keine funktionale Einschränkung (Dev-only-Tool).

- **S135 — Vollständige Verstöße bei Biome-Schwelle 15 (für QA-FE-BIOME-LOWER):** AnimationenPrimitiven.ts:37 (CCN 18), SpielverwaltungApi.ts:76 (16), BestenlisterSzene.ts:113 (18), TischAnimationOrchestrator.ts:105 (35), TischHudRenderer.ts:26 `erstellePhaserButton` (38), TischInputHandler.ts:53 `verarbeiteTastatureingabe` (36), TischInputHandler.ts:219 `verarbeiteKartenTaste` (17), TischKartenRenderer.ts:362 `aktualisiereNameplate` (19), TischRundenEndeController.ts:32 (16), TischRundenEndeController.ts:146 (16), layout.ts:71 `nameplatePositionFuer` (17), SpielerProfilModal.ts:132 (30), SpielprotokollOverlay.ts:127 (19).

- **S138 — DEPS-FE-PHASER4-SPIKE: Phaser 4.1.0 weitgehend kompatibel.** Migration Phaser 3.90→4.1.0 erfordert nur eine Zeile in `package.json` (`npm install --legacy-peer-deps` wegen openapi-typescript@7+TS6-Peer-Dep). Ergebnis: 0 TS-Fehler, 467/467 Tests, 0 ESLint-Warnungen, Complexity unverändert grün. Bundle +13% (gzip 319→352 kB). **Korrektur S139:** der Vision-Smoke (desktop) fand sehr wohl einen Breaking Change im Laufzeitverhalten (s. u.) — die ursprüngliche Einstufung „0 Breaking Changes im API-Footprint" galt nur für Compile/Build, nicht für WebGL-Runtime.

- **S139 — FIX-FE-PHASER4-MASK-WEBGL: Geometry-Masken im WebGL-Renderer gebrochen (behoben).** Der Phaser-4-Vision-Smoke (desktop, gegen frisch gestartetes Backend) deckte einen realen Laufzeit-Bruch auf, den Build/Tests/Lint **nicht** fangen: `Phaser.GameObjects.Components.Mask.setMask` ist in Phaser 4 im WebGL-Renderer ein No-op (nur Konsolenwarnung) — Geometry-Masken (`createGeometryMask` + `setMask`) funktionieren dort nicht mehr. Betraf die zwei scrollbaren Listen mit Clipping: `SpielprotokollOverlay` und `PhaserList` (Ranglisten/Tischliste). Bei wenigen Einträgen unsichtbar, bei vielen Einträgen Überlauf aus dem Panel. **Fix:** neuer Helfer `frontend/src/ui/rechteckMaske.ts` kapselt die Phaser-4-native Variante (`enableFilters()` + externer Mask-Filter mit weißer Rechteck-Shape durch die Haupt-Kamera) — verhaltensgleich zur alten Geometry-Mask, WebGL-konform; Headless/Canvas (Unit-Tests) kehrt sauber ohne Maske zurück. **Verifiziert:** 467/467 Tests, build/lint/complexity grün, Vision-Loop 3/3 grün mit **0 `setMask`-Warnungen**, Tischliste mit 3 Einträgen + interaktiven Buttons korrekt geklippt. **Lehre:** WebGL-Maskenverhalten wird weder kompiliert noch unit-getestet — solche Brüche nur über den (Video-/Screenshot-)Vision-Loop gegen laufendes Backend erkennbar.

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
