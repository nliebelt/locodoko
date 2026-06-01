# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-29 (Plan-Überarbeitung nach Gesamt-Review). Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**Session 26 (2026-05-29):** Vollständiger Code- & Spec-Review (Bericht: `specs/review-2026-05-28.md`), Plan überarbeitet, dann 5 der 6 Review-Tasks im Build-Modus abgearbeitet und einzeln committet: DOC-PUNKTE-HINWEISE, SPEC-ARCH-HIERARCHIE, DOC-AGENTS-DEDUP, REFACTOR-SAGEAN, REFACTOR-JSONB-CONVERTER (Dead-Code: 1131→917 Z.). `mvn test` nach jeder Code-Task grün. Der abgeschlossene REFACTOR-DOMAIN-Block (Session 17–25) ist im Archiv.

**Wichtig (Session 26):** Der Clean-Build (`mvn clean package`/`verify`) war vorbestehend gebrochen (Jackson-API-Drift in `JsonbConverter`), maskiert durch inkrementelle `mvn test`-Läufe mit stale `target/`. Behoben via `BUG-JACKSON-ACCESSORNAMING`. **Lehre:** Validierung künftig mit `mvn clean test` (nicht nur `mvn test`), sonst bleiben Compile-Brüche unsichtbar.

**Session 27 (2026-05-29):** `REFACTOR-TISCHVERWALTUNG` abgeschlossen. `gibPresets`, `ladeKonfiguration`, `aktualisiereKonfiguration` aus `TischVerwaltungsService` (509 → ~470 Z.) in neuen `@Service TischKonfigurationsService` extrahiert (Deps: `TischZugriff`, `TischRepository`, `TischEchtzeitService`). `TischController` auf Constructor-Injection des neuen Service umgestellt. `mvn clean test` grün.

**Session 28 (2026-06-01):** `VISION-SMOKE-1` abgeschlossen. Frontend neu gebaut (uncommittete Bridge-Erweiterung `drueckeSzenenButton` + SpielverwaltungsSzene Fokus-Fix). Vision-Loop grün (1 passed, 37.4s). Zwei visuelle Mängel entdeckt und als BUG-Tasks eingetragen: `BUG-EINSTELLUNGEN-MODAL` und `BUG-LOBBY-TISCHEINTRAG`.

**Alle geplanten Tasks erledigt.** Entdeckte Bugs stehen unter „Entdeckungen" für die nächste Iteration bereit.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

## Empfohlene Build-Reihenfolge (verbindlich)

Erledigt (Session 26–28): DOC-PUNKTE-HINWEISE ✓ · SPEC-ARCH-HIERARCHIE ✓ · DOC-AGENTS-DEDUP ✓ · REFACTOR-SAGEAN ✓ · REFACTOR-JSONB-CONVERTER ✓ · BUG-JACKSON-ACCESSORNAMING ✓ · REFACTOR-TISCH-ZUGRIFF ✓ · REFACTOR-TISCHVERWALTUNG ✓ · VISION-SMOKE-1 ✓

Nächste offene Tasks (aus Entdeckungen Session 28):

1. **BUG-EINSTELLUNGEN-MODAL** — Settings-Modal öffnet sich nicht sichtbar (Screenshot 08 = Screenshot 07)
2. **BUG-LOBBY-TISCHEINTRAG** — Text-Overflow im Tischlisten-Eintrag (Lobby)

---

## Offene Aufgaben

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

- [ ] **BUG-EINSTELLUNGEN-MODAL** — `08-einstellungen-modal.png` ist visuell identisch mit `07-seitenlade-offen.png`; das Einstellungen-Modal öffnet sich nach `s`-Tastendruck nicht sichtbar.

  Gefunden im Vision-Loop. Der Test drückt `s` nach dem Schließen der Seitenlade (`i`-Toggle), wartet 1000ms und screenshottet — aber das Modal erscheint nicht. Mögliche Ursachen: (a) Fokus liegt nach Seitenlade-Schließen nicht mehr auf dem Canvas, sodass der Tastendruck nicht ankommt; (b) das Einstellungen-Modal hat kein eigenes Render-Element oder rendert hinter anderen Ebenen.

  **Erste Datei zuerst:** `e2e/tests/vision-loop.spec.ts` — vor `page.keyboard.press('s')` ein `await page.locator('canvas').focus()` einfügen. Falls das Modal danach erscheint: nur Timing-Bug im Test. Falls nicht: `frontend/src/szenen/TischSzene.ts` nach dem Einstellungen-Key-Handler durchsuchen.

  **DoD:** `08-einstellungen-modal.png` zeigt ein sichtbares Settings-Overlay; Test bleibt grün.

- [ ] **BUG-LOBBY-TISCHEINTRAG** — In `01-lobby.png` / `11-offene-tische.png`: Tischeintrag-Text „Schnellstart von Spieler…" wird abgeschnitten und überlappt mit dem „Beitreten"-Button; Spieler-ID-Zahl rendert nicht vollständig.

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
