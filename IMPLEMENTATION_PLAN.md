# IMPLEMENTATION_PLAN — Plan-Run #101

> Stand: 2026-05-04. Fokus: Balatro-Design-System — Flash-Text, Nameplates, Spielprotokoll, Font-Einheitlichkeit.

## Notiz

**Was wurde implementiert?** Task 1 (FEAT-DESIGN-TOKENS): `frontend/src/ui/designTokens.ts` erstellt mit vollständiger Balatro-UI-Palette — Spieltisch-Palette (grün), Overlay-Palette (purpur), Akzentfarben, Teamfarben (RE/KONTRA jeweils in Spieltisch- und Overlay-Variante), Event-Farben (Fuchs=Orange, Schweinchen=Pink, Karlchen=Gold, Doppelkopf=Gold, SpielGestartet=Cyan), Glow-Schatten-Strings, Typography-Konstanten (FONT_XS–XL, FONT_FAMILY), Animations-Timings.

**Nächster logischer Schritt:** Task 2 (FEAT-FONT) — `PressStart2P-Regular.ttf` herunterladen und in `frontend/public/assets/fonts/` ablegen, dann in BootSzene (nicht PreloadSzene — die gibt es nicht) als CSS-Font laden. Danach direkt Task 3 (FlashTextManager) da designTokens.ts jetzt verfügbar ist.

**Wichtige Beobachtungen:**
- `frontend/src/ui/` Verzeichnis existierte nicht — wurde neu angelegt.
- Es gibt keine PreloadSzene — Font-Laden muss in `BootSzene.ts` erfolgen.
- Pink (`#ff55cc`) = Schweinchen (nicht Karlchen). Karlchen und Doppelkopf nutzen beide Gold.
- Lint hat 92 pre-existierende `no-explicit-any` Fehler in TischSzene.ts — nicht von diesem Task.

Dieser Run setzt das Design-Handoff vom Design-Büro pixel-genau in Phaser 3 um. Strategie: einheitliche visuelle Sprache über alle UI-Elemente (Press Start 2P, Balatro-Neon-Palette), keine DOM-Abhängigkeiten. Plan #100-Tasks (DOM-Elimination, PhaserModal) laufen parallel weiter — sie profitieren direkt von den neuen Design-Tokens.

---

## Legende

- [ ] Offen
- [~] In Arbeit
- [x] Erledigt

---

## Analyse-Stand (Pre-Planning, 2026-05-04)

5-Kontext-Analyse abgeschlossen. Wesentliche Befunde:

**Plan #101 (Balatro-Design-System)**: Kein einziger Task gestartet. `FlashTextManager`, `Nameplate`, `designTokens`, Press-Start-2P-Font alle fehlend. `TischSzene` nutzt noch inline-Nameplates und DOM-Overlays (~30% DOM-Anteil). Bestehende Toast/Feedback-Mechanismen sind Phaser-nativ, aber kein Balatro-Styling.

**Neu entdeckte Lücken (→ P5)**:
- Solist-Nachgeben Anspielrecht: `solistDesLetztenSpiels` wird bei Spielstart nicht in `solistAufspieler` übernommen (Bug in `Spiel.java`, Spec `spielablauf.md` Z. 105–106)
- Regelkatalog Factory-Methoden: `locoBlatRegeln()` + `dkvRegeln()` fehlen in `Spielregeln.java` (Spec `regelkatalog.md` DoD Z. 88–89)
- Armut Frontend-Dialog: `ArmutAktionAnsicht`-Typ definiert, kein Phaser-Rendering vorhanden
- Dreißig-Augen-Pflicht: `kannAnsagen()` lässt Grundpartei-Check bei Pflichtansage möglicherweise nicht korrekt aus
- Spec-Inkonsistenz: `tischkonfiguration.md` nennt `hochzeitAktiv/armutAktiv`, Code nutzt `hochzeitErlaubt/armutErlaubt`

**Keine Blocker aus Plan #100** — alle Voraussetzungen weiterhin gültig.

---

## P0 — Design Foundation

### FEAT-DESIGN-TOKENS: Zentrale Konstanten-Datei
- [x] Neue Datei `frontend/src/ui/designTokens.ts` mit allen Farben aus `specs/frontend-visuelles-design.md` (Balatro-UI-Palette) als TypeScript-Konstanten.
  - Farben als `0x`-Hex-Zahlen für Phaser und als CSS-Hex-Strings für DOM-Elemente.
  - Beispiel: `export const FARBE_GOLD = 0xffd700; export const FARBE_GOLD_CSS = '#ffd700';`
  - Kategorien: `PANEL_BG`, `CARD_BG`, `BORDER_*`, `TEXT_*`, Teamfarben `RE_*` / `KONTRA_*`, Event-Farben `FUCHS_*`, `KARLCHEN_*` etc.

### FEAT-FONT: Press Start 2P lokal bundeln
- [ ] Font-Datei `PressStart2P-Regular.ttf` herunterladen (Google Fonts, OFL-Lizenz) und in `frontend/public/assets/fonts/` ablegen.
- [ ] In PreloadSzene laden:
  - Als CSS-Font für DOM-Elemente: `new FontFace('Press Start 2P', "url('/assets/fonts/PressStart2P-Regular.ttf')").load()`
  - Als BitmapFont für Phaser: `this.load.bitmapFont('pressStart2p', ...)` (Bitmap-Sheet und XML generieren oder Phaser dynamisch via `WebFontLoader` laden).
  - Hinweis: Phaser `add.text` mit `fontFamily: 'Press Start 2P'` funktioniert sobald der CSS-Font geladen ist — BitmapFont-Route für kritische Performance-Pfade (Flash-Text).

---

## P1 — Flash-Text-Animationssystem

### FEAT-FLASH-TEXT: FlashTextManager
- [ ] Neue Klasse `frontend/src/ui/FlashTextManager.ts` (Spec: `specs/frontend-flash-text.md`).
  - Methode `zeigeSpielevent(event, payload)` dispatcht auf event-spezifische Animations-Methoden.
  - Hilfsmethoden: `konfetti(x, y, menge)`, `shockwaveRing(x, y, farbe)`, `screenShake()`, `cameraFlash(r, g, b)`.
  - Foil-Shimmer für `DoppelkopfGestochen` + `SpielBeendet` via `time.addEvent` + tint-cycling.
  - 9 Events vollständig: SpielGestartet, NaechsterSpielerErwartet, VorbehaltErwartet, StichAbgeschlossen, SchweinchenGemeldet, FuchsGefangen, KarlchenGespielt, DoppelkopfGestochen, SpielBeendet.
- [ ] Integration in `TischSzene.ts`: bisherige Sonderpunkt-Toasts (Fuchs, Karlchen, Doppelkopf) durch `FlashTextManager`-Aufrufe ersetzen.
- [ ] `destroy()` in `TischSzene.shutdown()` aufrufen.
- [ ] Referenz-HTML für visuelle Verifikation: `design_handoff/Doppelkopf Flash Text v3.html`.

---

## P2 — Nameplates

### FEAT-NAMEPLATES: HUD-Bar Spieler-Anzeige
- [ ] Neue Klasse `frontend/src/ui/Nameplate.ts` (Spec: `specs/frontend-nameplates.md`, Referenz: `design_handoff/Nameplate_C_Prompt.md`).
  - Phaser Container mit Farbbalken (5px) + Haupt-Bar.
  - States: `default`, `amZug` (Glow + Blink + Pulse-Ring), `geber` (Krone floating).
  - `showAnsage('re' | 'kontra')`: Badge mit Bounce-Animation, permanent sichtbar.
  - `showVorbehalt()` / `clearVorbehalt()`: Pulsierendes Sub-Label.
  - `shake()`: Wackel-Tween für Fuchs/Karlchen-Feedback.
- [ ] 4 Nameplate-Instanzen in `TischSzene.ts` ersetzen bisherige inline-Spielernamen-Anzeige (`renderNameplate()`-Methode).
- [ ] Event-Mapping: `NaechsterSpielerErwartet`, `VorbehaltErwartet`, `SpielGestartet`, `ANSAGE_ERFOLGT`, `FuchsGefangen`, `KarlchenGespielt`.
- [ ] Teamfarbe via `setTeamfarbe()` nach Vorbehalt-Phase setzen.
- [ ] Referenz-HTML für visuelles Review: `design_handoff/Doppelkopf Nameplates.html`.

---

## P3 — Spielprotokoll

### FEAT-SPIELPROTOKOLL: DKV-Scorecard
- [ ] Protokoll-State im AppStore: `spielProtokollEintraege: SpielprotokollEintrag[]`.
  - `SpielprotokollEintrag`: `{ nr, geber, spieltyp, istBockrunde, punkteProSpieler: Map<SpielerPosition, {pkt, stand}> }`.
- [ ] State wird pro `SpielBeendet`-Event um eine Zeile erweitert.
  - Geber: aus Spielnummer mod 4 ableiten (Rotation SUED→WEST→NORD→OST oder nach Tischkonfiguration).
  - Bock-Marker: aus `bockrundenZaehler > 0` in `LaufendesSpielAntwort` ableiten falls nicht direkt in `SpielBeendet`.
- [ ] Overlay-Ansicht: Scrollbare Tabelle als Phaser-Overlay (Button „Protokoll" in TischSzene).
  - `PhaserList`-Komponente (aus P4 `FEAT-PHASER-LIST`) für Scrolling nutzen — falls noch nicht implementiert, direkt mit Masking umsetzen.
  - Font: `Press Start 2P` XS (8px) für Stand-Spalten.
- [ ] Protokoll überlebt Szenen-Wechsel (da im AppStore).

---

## P4 — Plan #100 Tasks (parallel laufend)

> Diese Tasks stammen aus Plan #100 und laufen weiter. Sie profitieren von den neuen Design-Tokens aus P0.

### FEAT-POINT-LABELS: Transparente Punkteberechnung
- [ ] **Backend:** `de.locodoko.partie.PunkteRechner` erweitern, fachliche Labels pro Punktwert liefern.
- [ ] **DTO:** `punkteAufschluesselung` in `LetztesSpielergebnisAntwort` vollständig befüllen.

### FEAT-QUICK-PLAY-SYNC:
- [ ] **Frontend:** `appStore.erstelleQuickGame()` verifizieren, `/api/tische/schnellstart` korrekt genutzt.
- [ ] **Frontend:** Lade-Status im Store während Schnellstart setzen.

### FEAT-PHASER-MODAL: Basis-Komponente für Dialoge
- [ ] Neue Klasse `PhaserModal` (Container): Backdrop, Panel im Balatro-Stil (`designTokens.ts`), Titel, Content, Action-Buttons.
- [ ] Fokus-Management (Tastatur-Navigation).

### FEAT-PHASER-LIST: Scrollbare Listen
- [ ] `PhaserList` mit Masking — für Tischliste und Spielprotokoll.

### REFACTOR-LOBBY: SpielverwaltungsSzene rein Phaser
- [ ] Entfernung aller DOM-Elemente in `SpielverwaltungsSzene.ts` (Zeilen 67–102: DOM-Tischliste, Button-Generierung).
- [ ] Navigation via `PhaserButton`, „Tisch erstellen"-Modal als `PhaserModal`.

### REFACTOR-EVALUATION: Rundenauswertung 2.0
- [ ] Re-Implementierung des Rundenende-Modals (`rundenEndeModal.innerHTML`, `partieEndeModal`) als `PhaserModal` (Balatro-Stil).
- [ ] Dynamische Anzeige der `punkteAufschluesselung`.
- [ ] Count-up-Animation der Punkte.

### REFACTOR-UI-CLEANUP: DOM Elimination
- [ ] `TischUIManager`: vollständige Entfernung der DOM-Abhängigkeiten (Overlays, Modal-HTML in `TischSzene.ts` Z. 270–621).
- [ ] `ToastManager`: finale Bereinigung (sollte bereits Phaser-nativ sein).
- [ ] E2E-Tests: Umstellung auf JavaScript-Bridge (`window.__locodoko`).

---

## P5 — Neu entdeckte Aufgaben (aus Pre-Planning-Analyse)

> Diese Tasks wurden durch die 5-Kontext-Analyse in Pre-Planning identifiziert und sind nicht in Plan #100 enthalten.

### FIX-SOLIST-AUFSPIELER: Solist-Anspielrecht nach letztem Solo
- [ ] In `Spiel.java` beim Spielbeginn: `solistAufspieler` aus `solistDesLetztenSpiels` (Partie) initialisieren, damit der Solist des letzten Solos tatsächlich zuerst aufspielt.
  - Spec: `spielablauf.md` Z. 105–106.
  - Aktueller Bug: `sageAn()` setzt `solistAufspieler` auf `null` (Z. 410 Spiel.java), aber keine Initialisierung aus Partie bei Spielstart.
  - Entscheidung: **Code ist falsch, Spec ist die Wahrheit.**

### FIX-REGELKATALOG: Spielregeln Factory-Methoden
- [ ] In `Spielregeln.java` Factory-Methoden `locoBlatRegeln()` und `dkvRegeln()` implementieren.
  - Spec: `regelkatalog.md` DoD Z. 88–89 (Must-Have).
  - Tischkonfiguration-Presets (LOCO_BLATT, DKV_TURNIER) existieren bereits in `TischkonfigurationEmbeddable` — Logik ableiten.
  - Entscheidung: **Spec ist die Wahrheit** (Must-Have DoD, nicht verhandelbar).

### FIX-DREISSIG-AUGEN-PFLICHT: Pflichtansage-Validierung
- [ ] Prüfen ob `kannAnsagen()` bei Pflichtansage die Grundpartei-Zugehörigkeitsprüfung korrekt auslässt.
  - Spec: `dreissig-augen-pflicht.md` Z. 44.
  - Konkret: Spieler mit Pflichtansage soll ansagen dürfen, auch wenn er normalerweise keine Grundpartei-Prüfung bestehen würde.
  - Falls Lücke: explizite Pflichtansage-Weiche in `kannAnsagen()` ergänzen.

### FEAT-ARMUT-FRONTEND: Armut-Kartentausch-Dialog
- [ ] Phaser-nativen Dialog für `ArmutAktionAnsicht` implementieren (Modi: `ANBIETEN` / `ANTWORTEN`).
  - Aktuell: Typ-Definition vorhanden (`ArmutAktionAnsicht` in Frontend-Modellen), aber kein sichtbares Rendering.
  - Nutzt `PhaserModal` aus P4/FEAT-PHASER-MODAL als Basis.
  - Kein DOM — rein Phaser.

### FIX-SPEC-TISCHKONFIGURATION: Feldnamen-Inkonsistenz bereinigen
- [ ] `specs/tischkonfiguration.md` auf Code-Feldnamen aktualisieren:
  - `hochzeitAktiv` → `hochzeitErlaubt`
  - `armutAktiv` → `armutErlaubt`
  - `soloBubeAktiv` → `bubensoloErlaubt`
  - Entscheidung: **Code ist die Wahrheit** (Spec ist veraltet).

---

## Akzeptanzkriterien

1. **Font**: `Press Start 2P` lädt lokal, kein CDN-Aufruf, erscheint in Nameplates + Flash-Text + Modals.
2. **Flash-Text**: Alle 9 Events animiert, pixel-genau nach `design_handoff/Doppelkopf Flash Text v3.html`.
3. **Nameplates**: Am-Zug-Glow, RE/KONTRA-Badge, Geber-Krone, Vorbehalt-Pulse — alle korrekt.
4. **Spielprotokoll**: Wächst nach jeder Runde, kumulativer Stand korrekt, scrollbar.
5. **Stabilität**: Alle 94+ Unit-Tests und E2E-Tests grün.
6. **Kein DOM**: Keine `document.createElement`-Aufrufe in Spiel-Szenen.
7. **Solist-Aufspieler**: Solist des letzten Solos spielt in Folgerunde tatsächlich zuerst auf.
8. **Regelkatalog**: `locoBlatRegeln()` und `dkvRegeln()` liefern korrekte `Spielregeln`-Instanzen.

---

## TODO Liste

**P0 (Design Foundation):**
- [x] Task 1: Design-Tokens-Datei erstellen (`frontend/src/ui/designTokens.ts`)
- [ ] Task 2: Press Start 2P Font lokal bundeln + in PreloadSzene laden

**P1 (Flash-Text):**
- [ ] Task 3: `FlashTextManager` implementieren — alle 9 Events, Hilfsmethoden, Foil-Shimmer

**P2 (Nameplates):**
- [ ] Task 4: `Nameplate`-Klasse implementieren — States, Badges, shake(), Animationen

**P3 (Spielprotokoll):**
- [ ] Task 5: Spielprotokoll-State im AppStore + Phaser-Overlay-Ansicht

**P4 (Plan #100):**
- [ ] Task 6: Backend Punkte-Labels + DTO (`FEAT-POINT-LABELS`)
- [ ] Task 7: `PhaserModal` + `PhaserList` Basis-Komponenten
- [ ] Task 8: `SpielverwaltungsSzene` Phaser-native (`REFACTOR-LOBBY`)
- [ ] Task 9: Rundenauswertung 2.0 als `PhaserModal` (`REFACTOR-EVALUATION`)
- [ ] Task 10: DOM Elimination + E2E-Bridge (`REFACTOR-UI-CLEANUP`)

**P5 (Neu entdeckt):**
- [ ] Task 11: FIX-SOLIST-AUFSPIELER — `solistAufspieler` bei Spielbeginn aus `solistDesLetztenSpiels` initialisieren
- [ ] Task 12: FIX-REGELKATALOG — `locoBlatRegeln()` + `dkvRegeln()` Factory-Methoden
- [ ] Task 13: FIX-DREISSIG-AUGEN-PFLICHT — Pflichtansage-Prüfung in `kannAnsagen()` verifizieren/ergänzen
- [ ] Task 14: FEAT-ARMUT-FRONTEND — Phaser-Dialog für Armut-Kartentausch
- [ ] Task 15: FIX-SPEC-TISCHKONFIGURATION — Feldnamen in Spec an Code angleichen
