# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-20. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

Task 64 erledigt: 18 Specs von `Zu prüfen` auf `Implementiert` gesetzt. `frontend-ui-logik.md` DoD: 8 Items abgehakt (Vorbehalt-Overlay, Armut-Dialog, Seitenlade, Einstellungs-Modal, Toast-Notifications, Rundenende-Overlay, Tastatursteuerung, Frontend-Tests). `FE-VORBEHALT-BUTTONS` (Task 60) auf spec-konforme Label+Pfeile-Darstellung zurückgesetzt — Buttons-Variante war gegen `specs/frontend-vorbehalt-kartenauswahl.md`. Einzige verbleibende offene Aufgabe: Task 52 (FEAT-BITMAPFONT, Niedrige Prio, nur bei Performance-Bedarf).

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## Offene Aufgaben

### FE-VORBEHALT-BUTTONS (Task 60)
- [x] **Frontend**: Vorbehalt-Overlay auf spec-konforme Label+Pfeile-Darstellung zurückgesetzt.
  - `renderVorbehaltButtons()` → `renderVorbehaltLabel()` in `TischSpieleventRenderer.ts`
  - Buttons-Variante war gegen `specs/frontend-vorbehalt-kartenauswahl.md` — revertiert auf Label (`#ffd166`), `◄`/`►`-Pfeile, `(X von Y)`-Indikator

---

### REFACTOR-SPIEL (Task 61)
- [x] **Backend-Refactoring** (Hohe Priorität): `Spiel.java` (942 Zeilen) aufteilen.
  - `Spiel.java`: 942 → 587 Zeilen (Domain-Kern + Persistenz-Accessoren)
  - `SpielBuilder.java`: 72 Zeilen (package-private Builder)
  - `SpielHydrierer.java`: 238 Zeilen (DB → Domain Rekonstruktion)
  - `SpielPersistenzSync.java`: 89 Zeilen (Domain → DB Sync)
  - `SpielVorbehaltAufloesung.java`: 134 Zeilen (Vorbehalt-Auflösung + TrumpfOrdnung-Fabrik)
  - `SpielArmutTausch.java`: 83 Zeilen (Armut-Tausch-Logik)
  - 307 Tests grün.

---

### REFACTOR-TISCHANSICHTMODELL (Task 62)
- [x] **Frontend-Refactoring** (Mittlere Priorität): `TischAnsichtModell.ts` (825 Zeilen) aufteilen.
  - `TischAnsichtModell.ts`: 825 → 637 Zeilen (Typen + Mapper + Factories)
  - `TischKartenSortierung.ts`: 130 Zeilen (Trumpf-/Fehlrang, `istTrumpfFuerSpieltyp`, `vergleicheKarten`)
  - `TischVorbehaltModell.ts`: 52 Zeilen (Vorbehalt-Kartenauswahl-Logik)
  - `TischArmutModell.ts` nicht erstellt — zirkuläre Abhängigkeit verhindert Auslagerung von `bestimmeArmutAktion()`.
  - 202 Tests grün.

---

### REFACTOR-ANIMATIONEN-SERVICE (Task 63)
- [x] **Frontend-Refactoring** (Mittlere Priorität): `AnimationenService.ts` (807 Zeilen) aufteilen.
  - `AnimationenService.ts`: 807 → 151 Zeilen (Queue-Orchestrierung + Delegation)
  - `AnimationenPrimitiven.ts`: 165 Zeilen (Tween-Primitiven, Timer, `flipperZaehler`)
  - `KartenAnimationen.ts`: 94 Zeilen (`animiereKarteAusspielen`, `animiereKartenAusteilen`, `animiereStichEinziehen`)
  - `SpieleffektAnimationen.ts`: 374 Zeilen (Banner, Solo, Gewinner, Bockrunde, Sonderpunkte, Rundenauswertung)
  - Vollständige Rückwärtskompatibilität via Re-Exports. 202 Tests grün.

---

### DOC-SPEC-STATUS (Task 64)
- [x] **Dokumentation** (Niedrige Priorität): Spec-Statusfelder und DoDs auf aktuellen Stand bringen.
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

- **Große Klassen (Backend)**: `Spiel.java` 942 Z., `PartieStandAntwort.java` 547 Z., `TischVerwaltungsService.java` 541 Z., `StandardKiStrategie.java` 504 Z., `Partie.java` 426 Z., `Spielregeln.java` 421 Z., `SpielAktionsService.java` 391 Z. — alle über Richtwert. `Spiel.java` am dringlichsten (→ Task 61).
- **Große Klassen (Frontend)**: `TischAnsichtModell.ts` 825 Z., `AnimationenService.ts` 807 Z., `FlashTextManager.ts` 582 Z., `TischKartenRenderer.ts` 346 Z. — über Richtwert (→ Tasks 62–63).
- **Spec-Status**: 18 Specs auf "Zu prüfen" — Implementierung vollständig, Statusfelder veraltet (→ Task 64).
- **frontend-ui-logik.md DoD**: Viele Einträge bereits implementiert (Seitenlade, Einstellungen, Toast, Rundenende, Armut) aber noch als offen markiert (→ Task 64).
- **Alle Spielregeln implementiert**: Schweinchen, 30-Augen-Pflicht, Bockrunden, Sonderpunkte, Ansagen, alle Sonderspiele (Hochzeit, Armut, alle Solo-Varianten) — Backend vollständig.
- **KI, WebSocket, REST, E2E, Logging**: Alle vollständig implementiert und mit Tests abgedeckt.
