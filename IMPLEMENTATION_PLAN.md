# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-14. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## Offene Aufgaben

### BUG-KIANSAGE (Task 53)
- [x] **Backend** (Hohe Priorität): Ansage-Multiplikator in `StandardKiStrategie.java` korrigieren.
  - `src/main/java/de/locodoko/ki/StandardKiStrategie.java:118`: Faktor `1.18` auf `1.38` ändern.
  - `ki-strategie.md` Zeile 99 verlangt 1.38 (38 % Aufschlag) als Sonderregel-Malus für Ansage-Entscheidungen.
    Mit 1.18 macht die KI Re/Kontra-Ansagen bei aktiven Sonderregeln (Schweinchen, 30-Augen-Pflicht) zu früh.
  - Solo-Schwellenwert in derselben Datei nutzt bereits korrekt 1.38 — nur der Ansage-Zweig ist falsch.
  - Validation: `mvn test`

### FE-FLASHTEXT-FERTIGSTELLEN (Task 54)
- [~] **Frontend** (Hohe Priorität): `FlashTextManager.ts` vollständig implementieren und validieren.
  - **Kontext**: Spec `frontend-flash-text.md` trägt Status "Noch nicht begonnen", ist aber veraltet —
    `frontend/src/ui/FlashTextManager.ts` existiert bereits, alle 9 Events sind definiert und die Klasse
    ist in `TischSzene.ts` integriert. Die Spec-DoD wurde nie aktualisiert.
  - **Foil-Shimmer** verifizieren/fertigstellen: Tint-Cycling auf `DoppelkopfGestochen` + `SpielBeendet`
    (`colors = [0xffd700, 0xff88ff, 0x44ffee, 0xff8833, 0x44aaff]`, `delay: 80`, `repeat: -1`,
    stoppt nach Animations-Dauer; Spec Z. 44–50).
  - **Konfetti-Emitter** verifizieren: Standard 70 Partikel, `SpielBeendet` 150 Partikel (Spec Z. 54–59).
  - **Shockwave-Ringe, Screen Shake, Camera Flash** gegen Spec verifizieren (Spec Z. 62–74).
  - **`destroy()`-Lifecycle** prüfen: `tweens.killTweensOf` + `time.addEvent`-Callbacks stoppen.
  - **Unit-Tests** für Event-Routing: welcher `SpieleventTyp` ruft welche internen Methoden auf.
  - **Vision Loop** ausführen (`cd e2e && npx playwright test vision-loop.spec.ts --headed`),
    Screenshots prüfen.
  - **Spec aktualisieren**: Status-Feld und alle erledigten DoD-Checkboxen in `specs/frontend-flash-text.md`.
  - Design-Referenz für fehlende Details: `design_handoff/Doppelkopf Flash Text v3.html`
  - Validation: `cd frontend && npm test && npm run build`; dann Vision Loop.

### FE-NAMEPLATES-FERTIGSTELLEN (Task 55)
- [~] **Frontend** (Hohe Priorität): `Nameplate.ts` vollständig implementieren und validieren.
  - **Kontext**: Spec `frontend-nameplates.md` trägt Status "Noch nicht begonnen", ist veraltet —
    `frontend/src/ui/Nameplate.ts` existiert, States (`default`/`amZug`/`geber`), RE/KONTRA-Badges,
    Geber-Krone, Vorbehalt-Label und Shake-Effekt sind laut Code-Scan implementiert.
    Alle DoD-Checkboxen sind noch `[ ]` weil sie nie abgehakt wurden.
  - **Teamfarbe dynamisch**: `setTeamfarbe('re' | 'kontra')` muss Farbbalken (5 px links) auf
    Gold (`#ffd700`) bzw. Rot (`#ff4455`) setzen, ausgelöst nach Vorbehalt-Auflösung
    (`SpielGestartet`-Event liefert Parteizuordnung, Spec Z. 83–84).
  - **Event-Mapping vollständig prüfen**: `ANSAGE_ERFOLGT` → `showAnsage()`,
    `FuchsGefangen`/`KarlchenGespielt` → `shake()`, `SpielGestartet` → Reset + Geber setzen
    (Spec Z. 87–93).
  - **Unit-Tests** für State-Logik: State-Übergänge, Tween-Stopp beim Zustandswechsel.
  - **Vision Loop** bestätigt visuell: Glow + Blink + Pulse-Ring bei `amZug`, Krone bei Geber,
    Badges bei Re/Kontra.
  - **Spec aktualisieren**: Status-Feld und erledigte DoD-Checkboxen in `specs/frontend-nameplates.md`.
  - Design-Referenz: `design_handoff/Nameplate_C_Prompt.md` (exakte Tween-Werte).
  - Validation: `cd frontend && npm test && npm run build`; dann Vision Loop.

### BUG-E2E-TIMEOUT (Task 56)
- [ ] **E2E** (Mittlere Priorität): Fehlendes `test.setTimeout` in Rundenauswertungs-Test ergänzen.
  - `e2e/tests/rundenauswertung.spec.ts`: Am Anfang des langen Spielablauf-Tests
    `test.setTimeout(90_000)` setzen.
  - Ohne explizites Timeout greift der playwright.config.ts-Standard (300 s) — Hänger im Test
    werden erst nach 5 Minuten erkannt statt nach 90 s.
  - Validation: `cd e2e && npx playwright test rundenauswertung.spec.ts`

### REFACTOR-APPSTORE (Task 57)
- [ ] **Frontend** (Mittlere Priorität): `AppStore.ts` (856 Zeilen) auf fokussierte Module aufteilen.
  - Ziel: Keine Klasse > 300 Zeilen (Architektur-Richtwert, `specs/architektur.md` Z. 124).
  - Zieldatei `AppStore.ts` soll als schlanke Fassade (~100 Zeilen) bestehen bleiben und an
    fokussierte Sub-Module delegieren. Vorschlag (nicht bindend — vor Umsetzung analysieren):
    - `SessionStore.ts`: `initialisiereSession()`, Session-Check, Redirect-Logik
    - `PartieStore.ts`: `verarbeitePartieSnapshot()`, Spielphasen-Mapping auf UI-Zustand
    - `TischStore.ts`: `verarbeiteTischSnapshot()`, Tischliste, Tisch-State
  - Die **öffentliche API des AppStore** darf sich nicht ändern — Szenen und Echtzeit-Service
    nutzen AppStore direkt; kein Breaking Change erlaubt.
  - Referenz: `specs/frontend-architektur.md` (AppStore-Verantwortlichkeiten, JSDoc-Vorgaben).
  - Validation: `cd frontend && npm test && npm run build && npm run lint`

### REFACTOR-TISCHSZENE-WEITER (Task 58)
- [ ] **Frontend** (Mittlere Priorität): `TischSzene.ts` (609 Zeilen nach Task 51) weiter aufteilen.
  - Nach den Extraktionen aus Task 51 (`TischKartenRenderer`, `TischAnimationOrchestrator`,
    `TischEreignisHandler`, `TischRundenEndeController`) hat `TischSzene.ts` noch 609 Zeilen.
    Ziel: < 300 Zeilen.
  - **Erst analysieren**: Welche Render-Verantwortlichkeiten verbleiben in `TischSzene.ts`?
    Kandidaten laut `specs/frontend-architektur.md`: HUD-Rendering, Stichmitte-Rendering,
    Dialog-Orchestrierung (Armut-Dialog, Vorbehalt-Label).
  - Analog zu Task 51: Extraktion in dedizierte Klassen per Komposition, `TischSzene.ts`
    als dünner Orchestrator.
  - Alle bestehenden Tests müssen grün bleiben; kein Funktionsänderung.
  - Validation: `cd frontend && npm test && npm run build && npm run lint`

### FE-VORBEHALT-VISIONLOOP (Task 59)
- [ ] **Frontend** (Niedrige Priorität): Vision-Loop-Validierung für Vorbehalt-Kartenauswahl.
  - Letzter offener DoD-Punkt in `specs/frontend-vorbehalt-kartenauswahl.md`.
  - Alle Implementierungs-DoD-Punkte sind abgehakt (Reconciliation-Pattern, animierter Wechsel,
    Tween-Abbruch) — nur visuelle Bestätigung fehlt noch.
  - Voraussetzung: Backend läuft (`mvn spring-boot:run`).
  - `cd e2e && npx playwright test vision-loop.spec.ts --headed`; Screenshots in `e2e/screenshots/`
    prüfen: Karten-Elevation, Vorbehalt-Label, animierter Kartenwechsel bei ←/→.
  - Letzten DoD-Checkbox und Status-Feld in `specs/frontend-vorbehalt-kartenauswahl.md` aktualisieren.

### FEAT-BITMAPFONT (Task 52)
- [ ] **Frontend** (Niedrige Priorität): Press Start 2P als Phaser BitmapFont laden statt als Web-Font.
  - Bitmap-Atlas erzeugen (z.B. mit Phaser Font Builder oder `msdf-bmfont-xml`) für die benötigten Größen (8, 10, 14, 20, 28 px).
  - `AssetLoader.ts`: `this.load.bitmapFont('pressStart2P', ...)` in `preload()`.
  - Alle `this.add.text(x, y, t, { fontFamily: FONT_FAMILY })` in `TischSzene.ts` und anderen Dateien auf `this.add.bitmapText(x, y, 'pressStart2P', t, size)` umstellen.
  - Aufwand: hoch (30+ Aufrufstellen). Nur umsetzen wenn messbare Performance-Probleme auf Schwachgeräten auftreten.

---

## Notiz

**Implementiert (Task 53):** Ansage-Multiplikator in `StandardKiStrategie.java:118` von `1.18` auf `1.38` korrigiert — jetzt konsistent mit dem Solo-Schwellenwert in derselben Datei.

**Nächster logischer Schritt:** FE-FLASHTEXT-FERTIGSTELLEN (Task 54) — FlashTextManager.ts Foil-Shimmer und Konfetti-Emitter gegen Spec verifizieren. Code existiert bereits, es geht um Verifikation und ggf. Korrekturen. Dann Vision Loop.

**Offene Fragen:** Keine.

## Entdeckungen
