# IMPLEMENTATION_PLAN — Plan-Run #97

> Stand: 2026-04-30. Basis: 5 parallele Subagenten-Analysen aller Bounded Contexts.
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Notiz

**Was wurde implementiert (diese Iteration):**
- FEAT-BENUTZERDEFINIERT: „Benutzerdefiniert"-Option im Preset-Select hinzugefügt. Bei Auswahl: Panel mit 16 Bool-Toggles + 5 Ansagegrenzen-Inputs erscheint, vorbelegt aus dem API-Konfigurationsobjekt des zuletzt gewählten Presets. `erstelleKonfiguriertenTisch()` wird aufgerufen. `createBtn`-Validierung auf Name+presetsGeladen umgestellt. `TischPresetAntwort` um `konfiguration?` erweitert. Tests 88/88 grün, Build ok.
- Spec-DoD: `regelkatalog.md` Zeile 108 und `tischkonfiguration.md` Zeile 65 auf `[x]` gesetzt.

**Nächster logischer Schritt:**
- VISUAL-REVIEW: Backend starten und Vision Loop ausführen. Alle P1-Features (FEAT-TESTID, FEAT-BENUTZERDEFINIERT) sind jetzt erledigt — guter Zeitpunkt für visuellen Abgleich.
- Danach: Plan-Run als vollständig markieren (`<promise>COMPLETE</promise>`).

**Offene Fragen:**
- Lint-Fehler im Projekt sind pre-existing (nicht durch diese Iteration verursacht) — 101 Fehler in SpielverwaltungDto.ts, TischSzene.test.ts etc.

---

## Zusammenfassung Plan-Run #97

Alle Kernfunktionen des Spiels sind vollständig implementiert: alle Solos, Hochzeit, Armut,
Schmeißen (alle 3 Varianten), Bockrunden, Schweinchen, Ansagen — alles grün.
Dieser Plan adressiert:
1. **2 echte Feature-Lücken** (data-testid Attribute, Benutzerdefiniert-Modus)
2. **Visuelles Review** (4 Specs warten darauf)
3. **8 Spec-Inkonsistenzen** (Code ist voraus, Specs müssen nachziehen)

---

## P1 — Features (echte Code-Lücken)

### FEAT-TESTID: 3 `data-testid`-Attribute im Tisch-Konfigurations-Modal fehlen — ✅ ERLEDIGT

**Priorität:** Hoch (blockiert UI-basierten E2E-Testfall laut `specs/e2e-tests.md`)

**Problem:** Das Modal in `SpielverwaltungsSzene.ts` (`zeigeErstelleTischModal()`) verwendet
`id`-Attribute statt `data-testid`. Die E2E-Spec (`specs/e2e-tests.md`, Tabelle Zeilen 35–37
und Testfall 1 Schritte Zeilen 96–99) verlangt:

| Benötigtes `data-testid` | Aktuelles Äquivalent im Code |
|--------------------------|------------------------------|
| `tisch-config-modal`     | `modal.id = 'erstelle-tisch-modal'` (äußeres Modal-Div via `id`) |
| `input-tischname`        | `<input id="tisch-name" ...>` (im innerHTML-Template) |
| `btn-tisch-erstellen`    | `<button id="btn-erstellen" ...>` (im innerHTML-Template) |

**Fix:** In `frontend/src/szenen/SpielverwaltungsSzene.ts`, Methode `zeigeErstelleTischModal()`:
1. Nach `document.body.appendChild(modal)` (Zeile 167): `modal.setAttribute('data-testid', 'tisch-config-modal');`
2. Im innerHTML-Template: `<input ... id="tisch-name" data-testid="input-tischname" ...>`
3. Im innerHTML-Template: `<button id="btn-erstellen" data-testid="btn-tisch-erstellen" ...>`

Danach: `cd frontend && npm test && npm run build && npm run lint`

---

### FEAT-BENUTZERDEFINIERT: „Benutzerdefiniert"-Modus im Tisch-Konfigurations-Modal — ✅ ERLEDIGT

**Priorität:** Mittel
**Spec-Ref:** `specs/regelkatalog.md` (DoD `[ ]`-Zeilen 106–108), `specs/tischkonfiguration.md`
(DoD `[ ]` Zeile 65)

**Problem:** Das Modal bietet nur Preset-Auswahl. Es fehlt die Möglichkeit, individuelle
Regeloptionen zu setzen wenn der Spieler „Benutzerdefiniert" wählt.

**Umsetzung:**

1. **Frontend** (`SpielverwaltungsSzene.ts`, `zeigeErstelleTischModal()`):
   - Preset-Select: „Benutzerdefiniert"-Option ergänzen (`value="BENUTZERDEFINIERT"`)
   - Bei Wahl von „Benutzerdefiniert": Detailbereich einblenden mit Toggles für:
     `bockrundenAktiv`, `schweinchenAktiv`, `dreissigAugenPflichtAktiv`,
     `schmeissenAktiv`, `ohneNeunen`, `fuchsAktiv`, `karlchenAktiv`,
     `doppelkopfAktiv`, `hochzeitAktiv`, `armutAktiv`
   - Bei einem Preset: Detailbereich ausblenden (Felder schreibgeschützt als Info-Text)
   - Statt `appStore.erstelleTischMitPreset()` bei BENUTZERDEFINIERT:
     `appStore.erstelleKonfiguriertenTisch(name, konfiguration, privat)` aufrufen

2. **AppStore / API:** `erstelleKonfiguriertenTisch` existiert bereits (`api-types.ts:217`).
   Sicherstellen dass alle Regelfelder übergeben werden (nicht nur die 4 aus dem Quick-Game-Preset).

3. **Validation:** Erstellen-Button bleibt deaktiviert bis Tischname ausgefüllt.

Danach: `mvn test` + `cd frontend && npm test && npm run build && npm run lint`

---

## P2 — Visuelles Review

### VISUAL-REVIEW: 4 Specs warten auf visuellen Review (Vision Loop)

**Priorität:** Mittel
**Voraussetzung:** Backend läuft (`mvn spring-boot:run`)

```bash
cd e2e && npx playwright test vision-loop.spec.ts --headed
```
Screenshots landen in `e2e/screenshots/`. Visuell prüfen, dann DoD-Checkboxen setzen
und ggf. Spec-Status von „Zu prüfen" auf „Implementiert" aktualisieren.

| Spec | Offen | Zu prüfen |
|------|-------|-----------|
| `frontend-tischansicht.md` | `[ ] Visuelles Review / Plausibilitätsprüfung` | Spielfeld-Layout, 4 Spieler ohne Überlappung, OST/WEST kein Canvas-Overflow, Stich-Karten in Mitte |
| `frontend-animationen.md` | `[ ] Visuelles Review nach 4.16` | Stich-Stapel, Letzter-Stich-Overlay, Solo-Ankündigung |
| `frontend-visuelles-design.md` | `[ ] Visuelles Review` | Font, Farben, Schatten, Karten-Sprites |
| `rundenauswertung.md` | `[ ] Visuelles Review` | Rundenauswertungs-Overlay, Parteien-Zuordnung bei Hochzeit/Armut |

---

## P3 — Spec-Korrekturen (Code ist korrekt, Specs müssen nachgezogen werden) — ✅ ALLE ERLEDIGT

> **Entscheidung:** In allen folgenden Fällen ist der **Code die Wahrheit**. Specs sind veraltet.

### SPEC-01: spielablauf.md — Schmeißen-Tabelle aktualisieren

**Datei:** `specs/spielablauf.md`
**Problem:** Zeilen 58–59: „Fünf Neunen" und „Wenig Trumpf" als Status „Offen" markiert.
**Wahrheit:** Beide vollständig implementiert in `VorbehaltAnsage.java` (Zeilen 121–143):
`SCHMEISSEN_FUENF_NEUNEN` mit ohneNeunen-Schwelle, `SCHMEISSEN_WENIG_TRUMPF` mit
NormaleTrumpfOrdnung-Check.
**Fix:** Status-Spalte beider Zeilen von „Offen" → „Implementiert" ändern.

---

### SPEC-02: sonderpunkte.md — KI-Hänger-Bug-Text bereinigen

**Datei:** `specs/sonderpunkte.md`
**Problem:** Zeile 80: „Bekannter Bug (2026-04-15): KI hängt nach Fuchs gefangen…"
**Wahrheit:** Bug wurde in Plan-Run #96 als behoben archiviert. `KiOrchestrierungService.java`
publiziert `NaechsterSpielerErwartet` nach Sonderpunkt-Auswertung (Zeilen 318–320).
**Fix:** Bug-Text Zeile 80 entfernen oder als „Behoben in Plan-Run #96" kennzeichnen.

---

### SPEC-03: regelkatalog.md — DoD nachziehen

**Datei:** `specs/regelkatalog.md`
**Fix:** 3 Checkboxen als `[x]` markieren:
- `[ ] Unit-Tests für locoBlatRegeln() und dkvRegeln()` → `SpielregelnTest.java` hat 5 vollständige Tests
- `[ ] Frontend: Preset-Dropdown im Tisch-Konfigurations-Modal` → `SpielverwaltungsSzene.ts` hat `<select id="tisch-preset">` mit API-Load
- `[ ] Frontend: Vorbelegen aller Felder bei Preset-Wechsel` → Beschreibungstext wird aktualisiert (Einzelfelder folgen mit FEAT-BENUTZERDEFINIERT)

---

### SPEC-04: frontend-tischansicht.md — DoD abgleichen

**Datei:** `specs/frontend-tischansicht.md`
**Fix:** Folgende `[ ]` als `[x]` markieren (Code-Referenz in Klammern):

- HUD Top-Bar (`TischUIManager.ts`: `hud-stichzaehler`, `hud-spieltyp`, `hud-btn-einstellungen`)
- Spieler-Nameplates (`TischSzene.ts:871` `renderNameplate()`)
- Nameplate-Positionierung (`TischSzene.ts:94` `nameplatePositionFuer()`)
- vectorized-playing-cards (`AssetLoader.ts:40` `karteZuDateiname()` + `public/assets/cards/*.png`)
- Weißer Karten-Hintergrund (`Kartenansicht.ts:62` `fillStyle(0xffffff, 1)`)
- Kartengröße 110×165px (`TischSzene.ts:74–75`)
- Floating Action Bar (`TischUIManager.ts:77` `floating-action-bar` Marker)
- Seitenlade (`TischSzene.ts:185,624,746` `seitenladeOffen` + `renderHud()`)
- Einstellungs-Modal (`TischSzene.ts` `renderEinstellungsModal()`)
- Debug-Modus (`TischSzene.ts:913` `modell.debugModus`)
- Stich-Stapel beim Gewinner und Letzten Stich umdrehen (aus `frontend-animationen.md` übernehmen, dort bereits `[x]`)

Bleibt `[ ]` bis nach VISUAL-REVIEW: Stich-Karten gestampelt, OST/WEST kein Overflow,
Alle 4 Spieler ohne Überlappung, Visuelles Review.

---

### SPEC-05: frontend-startscreen.md — DoD abgleichen

**Datei:** `specs/frontend-startscreen.md`
**Fix:** Folgende `[ ]` als `[x]` markieren:
- „▶ Quick Game"-Button (`SpielverwaltungsSzene.ts:91` `data-testid="btn-quick-game"`)
- „Neuen Tisch erstellen" Modal (`SpielverwaltungsSzene.ts:136` `zeigeErstelleTischModal()`)
- Tisch-Erstellung schließt Modal (`createBtn.onclick` → `modal.remove()`)
- Session-Recovery-Button (`SpielverwaltungsSzene.ts:77–84` bei `aktiverTischId`)
- Spielverwaltungs-Szene implementiert (`SpielverwaltungsSzene.ts` als DOM-basierte Szene)

Bleibt `[ ]`: Keyboard-Navigation (Tab/Enter), Visuelles Review.

---

### SPEC-06: frontend-visuelles-design.md — DoD abgleichen

**Datei:** `specs/frontend-visuelles-design.md`
**Fix:** Folgende `[ ]` als `[x]` markieren:
- Space Grotesk (`index.html:8–10` via Google Fonts)
- Farbpalette CSS Custom Properties (`css/variables.css:3–18`: `--farbe-gold`, `--farbe-blau`, etc.)
- vectorized-playing-cards heruntergeladen (`public/assets/cards/`)
- Karten-Mapping (`AssetLoader.ts:40` `karteZuDateiname()`)
- Harter Schlagschatten (`variables.css:16–17` `--schatten-karte`/`--schatten-button`)
- Sonderpunkt-Animationen (`AnimationenService.ts:346` `animiereSonderpunktFeedback()`)
- Ansage-Banner (`AnimationenService.ts:139` `animiereAnsageBanner()`)
- Solo-Ankündigung (`AnimationenService.ts:174` `animiereSoloAnkuendigung()`)
- Focus-Styles (`accessibility.css:1–10` `:focus-visible`)

Bleibt `[ ]`: Visuelles Review.
Spec-Status von „Zu prüfen" → „Aktive Vorgabe" (alle funktionalen Punkte erledigt).

---

### SPEC-07: verbindungsabbruch.md — DoD-Zeile 146 abgleichen

**Datei:** `specs/verbindungsabbruch.md`
**Problem:** Zeile 146: `[ ] Laufende eigene Tische in Spielverwaltungs-Szene mit „Zurückkehren"-Button`
**Wahrheit:** `SpielverwaltungsSzene.ts:214` filtert eigene laufende Tische; `frontend-startscreen.md:117`
hat dies bereits als `[x]` markiert.
**Fix:** Zeile 146 als `[x]` markieren.

---

### SPEC-08: spielablauf.md DoD — Schmeißen-Checkboxen ergänzen

**Datei:** `specs/spielablauf.md`
**Problem:** DoD-Sektion enthält keinen expliziten Eintrag für alle 3 Schmeißen-Varianten.
**Fix:** In der DoD-Sektion (nach Zeile 100) ergänzen:
```
- [x] Schmeißen: Fünf Könige implementiert und getestet
- [x] Schmeißen: Fünf Neunen implementiert (VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN, ohneNeunen-Schwelle)
- [x] Schmeißen: Wenig Trumpf implementiert (VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF, NormaleTrumpfOrdnung)
```

---

## Abhängigkeiten

```
SPEC-01..08     → unabhängig, knnnnnnnen parallel bearbeitet werden (nur Textänderungen)
FEAT-TESTID     → unabhängig (3 Zeilen Frontend-Code)
VISUAL-REVIEW   → idealerweise nach FEAT-TESTID (Modal hat dann korrekte testids)
FEAT-BENUTZERDEFINIERT → unabhängig, aber nach VISUAL-REVIEW sinnvoll
```

## Abarbeitungsreihenfolge (empfohlen)

1. SPEC-01 bis SPEC-08 (reine Textänderungen in Spec-Dateien)
2. FEAT-TESTID (3 Zeilen Code + Frontend-Tests)
3. VISUAL-REVIEW (nach FEAT-TESTID)
4. FEAT-BENUTZERDEFINIERT (umfangreichster Task: Backend + Frontend)
