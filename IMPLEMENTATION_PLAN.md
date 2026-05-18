# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-18. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

Task 60 erledigt: `renderVorbehaltLabel()` → `renderVorbehaltButtons()` — jede Vorbehalt-Option ist nun ein direkter Phaser-Button. Nächster logischer Schritt: Task 61 (REFACTOR-SPIEL) — `Spiel.java` aufteilen, Domain-Kern bleibt, Armut/Vorbehalt/Persistenz in separate package-private Helfer auslagern. Vision Loop empfohlen (Backend-State nach letztem Testlauf war nicht clean).

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## Offene Aufgaben

### FE-VORBEHALT-BUTTONS (Task 60)
- [x] **Frontend** (Hohe Priorität): Vorbehalt-Overlay von Label+Pfeilen auf individuelle Phaser-Buttons pro Option umstellen.
  - `renderVorbehaltLabel()` → `renderVorbehaltButtons()` in `TischSpieleventRenderer.ts`
  - Jede Option als eigener Phaser-Button via `erstellePhaserButton()`, direkter Click → `appStore.meldeVorbehalt()`
  - Tastatur-Highlight via `tastaturVorbehaltIndex` → `hv=true`-Parameter
  - Max. 4 Buttons pro Reihe; bei mehr Optionen: zwei Reihen
  - Vision Loop manuell empfohlen (letzter Run scheiterte an veralteter Backend-Spielsitzung)

---

### REFACTOR-SPIEL (Task 61)
- [ ] **Backend-Refactoring** (Hohe Priorität): `Spiel.java` (942 Zeilen) aufteilen — deutlich über dem 300-Zeilen-Richtwert.
  - **Analyse**: Die Klasse enthält vier logisch trennbare Bereiche:
    1. **Domain-Logik** (Zeilen ~147–442): Factory-Methoden, Spielphasen, `spieleKarte()`, `werteAus()` — Kern, bleibt in `Spiel.java`.
    2. **Persistenz-Mapping** (Zeilen ~488–554): DB-Accessoren (`haendeAlsJson()`, `sticheAlsJson()`, etc.) und Schreibmethoden (`fuegeHandHinzu()`, `ersetzeHaende()`, etc.) — kandidiert für Auslagerung in `SpielPersistenzMapper` (static helper class oder inner class).
    3. **Armut-Tausch-Logik** (Zeilen ~264–312): `legeArmutTrumpfkarten()`, `lehneArmutAb()`, `nimmArmutAn()` — komplex genug für eigene Klasse `SpielArmutTausch` (package-private).
    4. **Vorbehalt-Auflösung** (Zeilen ~219–262): `meldeVorbehalt()`, `loeseVorbehalteAuf()` — kandidiert für `SpielVorbehaltAufloesung`.
  - **Constraint**: Architekturprinzip "Domain Model = Persistence Model" — kein separates Entity, `@Table` bleibt auf `Spiel`.
  - Ziel: `Spiel.java` auf ≤ 400 Zeilen reduzieren (Domain-Kern + Accessors), Rest in fokussierte package-private Helfer/Builder auslagern.
  - Alle bestehenden Tests müssen weiterhin grün sein: `mvn test`.

---

### REFACTOR-TISCHANSICHTMODELL (Task 62)
- [ ] **Frontend-Refactoring** (Mittlere Priorität): `TischAnsichtModell.ts` (825 Zeilen) aufteilen.
  - View-Modell kapselt zu viele unabhängige Verantwortlichkeiten.
  - Mögliche Aufteilung:
    - `TischAnsichtModell.ts`: Kern-Daten (Spieler, Karten, Spieltyp) ≤ 300 Zeilen.
    - `TischVorbehaltModell.ts`: Vorbehalt-Kartenauswahl-Logik (`sortiereKartenFuerVorbehalt()`, `istHervorgehobeneKarteImVorbehalt()`).
    - `TischArmutModell.ts`: Armut-Aktion-Berechnung (`calcArmutAktion()` o.ä.).
  - Tests: `cd frontend && npm test`.

---

### REFACTOR-ANIMATIONEN-SERVICE (Task 63)
- [ ] **Frontend-Refactoring** (Mittlere Priorität): `AnimationenService.ts` (807 Zeilen) aufteilen.
  - Mögliche Aufteilung:
    - `AnimationenService.ts`: Öffentliche API + Queue-Orchestrierung ≤ 300 Zeilen.
    - `KartenAnimationen.ts`: `animiereKarteAusspielen()`, `animiereKartenAusteilen()`, Stich-Einziehen.
    - `SpieleffektAnimationen.ts`: Flash-Effekte, Shake, Kamera-Effekte (Delegation an FlashTextManager trennen).
  - Tests: `cd frontend && npm test`.

---

### DOC-SPEC-STATUS (Task 64)
- [ ] **Dokumentation** (Niedrige Priorität): Spec-Statusfelder und DoDs auf aktuellen Stand bringen.
  - **18 Specs** haben Status `Zu prüfen` — Implementierung ist vollständig, Status muss auf `Implementiert` oder `Stabil` aktualisiert werden. Betrifft u.a.: `dreissig-augen-pflicht.md`, `ansagen.md`, `stichlogik.md`, `spielablauf.md`, `trumpfhierarchie.md`, `punkteberechnung.md`, `kartendeck.md`, `lobbby.md`, `rest-api.md`, `websocket-kommunikation.md`, `ki-strategie.md`, `e2e-tests.md`, `frontend-logging.md`, `frontend-rundenauswertung.md`, `frontend-startscreen.md`, `frontend-tischansicht.md`, `regelkatalog.md`, `datenbankmodell.md`.
  - **frontend-ui-logik.md DoD**: Mehrere abgehakte Items noch als offen markiert. Folgendes ist implementiert und muss abgehakt werden:
    - Seitenlade (`renderHud()` in `TischHudRenderer.ts`)
    - Einstellungs-Modal (`renderEinstellungsModal()` in `TischHudRenderer.ts`)
    - Toast-Notifications (`ToastManager.ts`)
    - Rundenende-Overlay (`TischRundenEndeController.ts`)
    - Armut-Dialog (`renderArmutBereich()` in `TischSpieleventRenderer.ts`)
    - Alle Aktionen per Tastatur (`TischInputHandler.ts`)
  - Noch offen bleiben: Vorbehalt-Overlay (→ Task 60), seitliche HTML-Panels prüfen.

---

### FEAT-BITMAPFONT (Task 52)
- [ ] **Frontend** (Niedrige Priorität): Press Start 2P als Phaser BitmapFont laden statt als Web-Font.
  - Bitmap-Atlas erzeugen (z.B. mit Phaser Font Builder oder `msdf-bmfont-xml`) für die benötigten Größen (8, 10, 14, 20, 28 px).
  - `AssetLoader.ts`: `this.load.bitmapFont('pressStart2P', ...)` in `preload()`.
  - Alle `this.add.text(x, y, t, { fontFamily: FONT_FAMILY })` auf `this.add.bitmapText(...)` umstellen.
  - Aufwand: hoch (30+ Aufrufstellen). Nur umsetzen wenn messbare Performance-Probleme auf Schwachgeräten auftreten.

---

## Entdeckungen

- **Vorbehalt-Overlay**: `renderVorbehaltLabel()` zeigt Label+Pfeile statt individuelle Buttons — Spec-Abweichung (→ Task 60).
- **Große Klassen (Backend)**: `Spiel.java` 942 Z., `PartieStandAntwort.java` 547 Z., `TischVerwaltungsService.java` 541 Z., `StandardKiStrategie.java` 504 Z., `Partie.java` 426 Z., `Spielregeln.java` 421 Z., `SpielAktionsService.java` 391 Z. — alle über Richtwert. `Spiel.java` am dringlichsten (→ Task 61).
- **Große Klassen (Frontend)**: `TischAnsichtModell.ts` 825 Z., `AnimationenService.ts` 807 Z., `FlashTextManager.ts` 582 Z., `TischKartenRenderer.ts` 346 Z. — über Richtwert (→ Tasks 62–63).
- **Spec-Status**: 18 Specs auf "Zu prüfen" — Implementierung vollständig, Statusfelder veraltet (→ Task 64).
- **frontend-ui-logik.md DoD**: Viele Einträge bereits implementiert (Seitenlade, Einstellungen, Toast, Rundenende, Armut) aber noch als offen markiert (→ Task 64).
- **Alle Spielregeln implementiert**: Schweinchen, 30-Augen-Pflicht, Bockrunden, Sonderpunkte, Ansagen, alle Sonderspiele (Hochzeit, Armut, alle Solo-Varianten) — Backend vollständig.
- **KI, WebSocket, REST, E2E, Logging**: Alle vollständig implementiert und mit Tests abgedeckt.
