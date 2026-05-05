# IMPLEMENTATION_PLAN — Plan-Run #102

> Stand: 2026-05-05. Fokus: Balatro-Design-System — Flash-Text-Verdrahtung, Nameplate Event-Mapping, Spielprotokoll-Integration, und neu entdeckte Frontend-Lücken.

## Notiz

**Was wurde implementiert (Run #107)?**
- Task 19 (FIX-ARMUT-BESTIMMUNG): Armut-Spieler wird jetzt direkt vom Server geliefert.
  - `PartieStandAntwort.java` (`LaufendesSpielAntwort` Record): Neues Feld `armutSpielerPosition: SpielerPosition | null` ergänzt. Wird aus `laufendesSpiel.armutStatus().map(ArmutStatus::armutSpieler).orElse(null)` befüllt — exakt der Backend-Domainwert statt Heuristik.
  - `SpielverwaltungDto.ts`: `armutSpielerPosition?: SpielerPosition | null` (optional, damit alte Test-Payloads nicht brechen).
  - `TischAnsichtModell.ts` (`bestimmeArmutAktion()`): reduce-Heuristik (kleinste Handkartenzahl) ersetzt durch direkten Feldvergleich. ANBIETEN-Fall: `armutSpielerAbsolut === bezugPosition`. ANTWORTEN-Fall: Spieler per `absolutePosition`-Lookup.
  - Tests angepasst: `TischAnsichtModell.test.ts` (beide Armut-Szenarien), `TischSzene.test.ts` (lehnt-Armut-ab-Test).
- 94 Unit-Tests und Build grün. 90 pre-existing ESLint `any`-Fehler unverändert.

**Nächster logischer Schritt:** Task 20 (FEAT-SCHMEISSEN-FRONTEND) — Schmeissen-Button im Vorbehalt-Dialog.

**Offene Fragen:**
- 90 pre-existing ESLint `any`-Fehler in AppStore.ts und TischSzene.ts — Cleanup-Task ausstehend.
- Hochzeit-Nameplate: Kein Herz-Label implementiert (WebSocket-Snapshot müsste `spieltyp: 'HOCHZEIT'` liefern — noch nicht geprüft).

---

## Legende

- [ ] Offen
- [~] In Arbeit
- [x] Erledigt

---

## Analyse-Stand (Pre-Planning, 2026-05-05)

5-Kontext-Analyse (Plan-Run #102) abgeschlossen. Wesentliche Befunde:

**Tisch/Spieler**: Core-Funktionalität (Auth, Tischverwaltung, Session-Recovery, Verbindungsabbruch) vollständig. Schmeissen: Backend-Tracking vorhanden, Frontend-Dialog fehlt. "Meine laufenden Tische"-UI: nicht implementiert (low priority).

**Partie/Regeln**: Spielkern vollständig. solistAufspieler, locoBlatRegeln/dkvRegeln, Dreißig-Augen-Pflicht alle implementiert. Schmeissen-WENIG_TRUMPF-Semantik unklar (Spec sagt „< 2 Trümpfe" — Code-Parameter prüfen).

**API/Events/KI**: ~85% implementiert. 11 REST-Endpunkte, 7 WebSocket-Mappings, 12 E2E-Tests vorhanden. Lücken: 19 fehlende data-testid-Attribute, PartieEreignisBatch (low-priority advanced feature).

**Frontend**: AppStore-Spielprotokoll und SpielprotokollOverlay.ts angelegt, nicht integriert. Flash-Text 6/9 verdrahtet, Nameplate-Klasse 90%, Event-Mapping 0%.

**Sonderspiele**: Backend vollständig (Hochzeit, Armut, alle 8 Solos). Armut-Frontend-Dialog implementiert. Hochzeit-Partnerfindungs-Status fehlt im Frontend; Armut-Bestimmung fehleranfällig.

---

## P0 — Design Foundation

### FEAT-DESIGN-TOKENS: Zentrale Konstanten-Datei
- [x] Neue Datei `frontend/src/ui/designTokens.ts` mit allen Farben aus `specs/frontend-visuelles-design.md` (Balatro-UI-Palette) als TypeScript-Konstanten.
  - Farben als `0x`-Hex-Zahlen für Phaser und als CSS-Hex-Strings für DOM-Elemente.
  - Kategorien: `PANEL_BG`, `CARD_BG`, `BORDER_*`, `TEXT_*`, Teamfarben `RE_*` / `KONTRA_*`, Event-Farben `FUCHS_*`, `KARLCHEN_*` etc.

### FEAT-FONT: Press Start 2P lokal bundeln
- [x] Font-Datei `PressStart2P-Regular.ttf` in `frontend/public/assets/fonts/` abgelegt.
- [x] In BootSzene: CSS-FontFace + Phaser-Laden konfiguriert.

---

## P1 — Flash-Text-Animationssystem

### FEAT-FLASH-TEXT: FlashTextManager
- [x] Neue Klasse `frontend/src/ui/FlashTextManager.ts` (Spec: `specs/frontend-flash-text.md`).
  - Methode `zeigeSpielevent(event, payload)` dispatcht auf event-spezifische Animations-Methoden.
  - Hilfsmethoden: `konfetti(x, y, menge)`, `shockwaveRing(x, y, farbe)`, `screenShake()`, `cameraFlash(r, g, b)`.
  - Foil-Shimmer für `DoppelkopfGestochen` + `SpielBeendet`.
  - 6 von 9 Events implementiert: SpielGestartet, SchweinchenGemeldet, FuchsGefangen, KarlchenGespielt, DoppelkopfGestochen, SpielBeendet.
- [x] Integration in `TischSzene.ts`: bisherige Sonderpunkt-Toasts durch `FlashTextManager`-Aufrufe ersetzt.
- [x] `destroy()` in `TischSzene.shutdown()` aufgerufen.
- [ ] 3 fehlende Events verdrahten: `NaechsterSpielerErwartet`, `VorbehaltErwartet`, `StichAbgeschlossen`. → Siehe Task 16.

---

## P2 — Nameplates

### FEAT-NAMEPLATES: HUD-Bar Spieler-Anzeige
- [x] Klasse `frontend/src/ui/Nameplate.ts` implementiert (Spec: `specs/frontend-nameplates.md`).
  - Phaser Container mit Farbbalken + Haupt-Bar.
  - States: `default`, `amZug` (Glow + Blink + Pulse-Ring), `geber` (Krone floating).
  - `showAnsage('re' | 'kontra')`: Badge mit Bounce-Animation.
  - `showVorbehalt()` / `clearVorbehalt()`: Pulsierendes Sub-Label.
  - `shake()`: Wackel-Tween implementiert.
- [x] 4 Nameplate-Instanzen in `TischSzene.ts` ersetzen bisherige inline-Spielernamen-Anzeige.
- [ ] Event-Mapping in `TischSzene.ts` verdrahten: `setState('amZug')` bei `NAECHSTER_SPIELER_ERWARTET`, `setState('geber')` bei `SPIEL_GESTARTET`, `showVorbehalt()`/`clearVorbehalt()` bei `VORBEHALT_ERWARTET`, `showAnsage(partei)` bei `ANSAGE_ERFOLGT`, `shake()` bei `FUCHS_GEFANGEN`/`KARLCHEN_GESPIELT`. → Siehe Task 16.
- [ ] Teamfarbe: `setTeamfarbe('re' | 'kontra')` nach Vorbehalt-Auflösung (VorbehaltAufloesung-Event o.ä.) für alle 4 Spieler aufrufen. → Siehe Task 16.
- [ ] Referenz-HTML visuell prüfen: `design_handoff/Doppelkopf Nameplates.html`.

---

## P3 — Spielprotokoll

### FEAT-SPIELPROTOKOLL: DKV-Scorecard
- [x] Protokoll-State im AppStore: `spielProtokollEintraege: SpielprotokollEintrag[]` hinzugefügt.
- [x] State wird pro `SPIEL_BEENDET`-Event erweitert (AppStore.ts).
- [x] `SpielprotokollOverlay.ts` als neue Datei im Working Tree vorhanden.
- [ ] Overlay-Integration in `TischSzene.ts`:
  - Button „Protokoll" auf der Spielfläche hinzufügen, der `SpielprotokollOverlay` öffnet/schließt.
  - AppStore-Daten (`spielProtokollEintraege`) in das Overlay übergeben und Tabelle rendern.
  - `prevStand`-Logik in AppStore.ts prüfen: sicherstellen dass kumulativer Stand korrekt berechnet wird (ggf. `ereignis.partieStand.laufendesSpiel` nutzen statt `prevStand`).
  - Scrolling via Masking implementieren (falls `PhaserList` aus Task 7 noch nicht verfügbar: direkt mit Phaser Masking umsetzen).
- [ ] Protokoll-Persistenz über Szenen-Wechsel verifizieren (AppStore-basiert, sollte automatisch funktionieren).

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
- [ ] Entfernung aller DOM-Elemente in `SpielverwaltungsSzene.ts` (`appendChild`, `innerHTML`, `querySelector` — bestätigt durch Analyse).
- [ ] Navigation via `PhaserButton`, „Tisch erstellen"-Modal als `PhaserModal`.

### REFACTOR-EVALUATION: Rundenauswertung 2.0
- [ ] Re-Implementierung des Rundenende-Modals als `PhaserModal` (Balatro-Stil).
- [ ] Dynamische Anzeige der `punkteAufschluesselung`.
- [ ] Count-up-Animation der Punkte.

### REFACTOR-UI-CLEANUP: DOM Elimination
- [ ] `TischUIManager`: vollständige Entfernung der DOM-Abhängigkeiten (Overlays, Modal-HTML in `TischSzene.ts` Z. 270–621).
- [ ] `ToastManager`: finale Bereinigung (sollte bereits Phaser-nativ sein).
- [ ] E2E-Tests: Umstellung auf JavaScript-Bridge (`window.__locodoko`).

---

## P5 — Bereits bekannte Aufgaben (aus Plan #101)

### FIX-SOLIST-AUFSPIELER: Solist-Anspielrecht nach letztem Solo
- [x] `Spiel.neuMitSolistAufspieler()` + `Partie.starteNaechstesSpiel()` korrekt implementiert. Geber bleibt nach Solo gleich (Partie.schliesseAktuellesSpielAb). Keine Aktion erforderlich.

### FIX-REGELKATALOG: Spielregeln Factory-Methoden
- [x] `Spielregeln.locoBlatRegeln()` und `Spielregeln.dkvRegeln()` in `Spielregeln.java` vorhanden und korrekt belegt. Keine Aktion erforderlich.

### FIX-DREISSIG-AUGEN-PFLICHT: Pflichtansage-Validierung
- [x] `effektiveKartenAnzahlFuer()` setzt `Integer.MAX_VALUE` bei Pflichtansagen — `kannAnsagen()` umgeht Kartengrenzen korrekt. Keine Aktion erforderlich.

### FEAT-ARMUT-FRONTEND: Armut-Kartentausch-Dialog
- [x] `renderArmutBereich()` mit Dialog (Annehmen/Ablehnen/Trumpfkarten anbieten), Tastatur-Shortcuts (A/N), Card-Selection implementiert. Keine Aktion erforderlich.
  - Offene Sub-Lücke: Armut-Angebots-Status-Anzeige (für wartende Spieler) — siehe Task 19.

### FIX-SPEC-TISCHKONFIGURATION: Feldnamen-Inkonsistenz bereinigen
- [ ] `specs/tischkonfiguration.md` auf Code-Feldnamen aktualisieren:
  - `hochzeitAktiv` → `hochzeitErlaubt`
  - `armutAktiv` → `armutErlaubt`
  - `soloBubeAktiv` → `bubensoloErlaubt`
  - `soloDameAktiv` → `damensoloErlaubt`
  - Entscheidung: **Code ist die Wahrheit** (Spec ist veraltet).

---

## P6 — Neu entdeckte Aufgaben (Plan-Run #102)

### FEAT-VERDRAHTUNG: Flash-Text + Nameplate Event-Mapping (Task 16)
In `frontend/src/szenen/TischSzene.ts` die fehlenden Event-Callbacks verdrahten.

**Flash-Text (3 fehlende Events):**
- Bei `NAECHSTER_SPIELER_ERWARTET`-Event: `this.flashTextManager.zeigeSpielevent('NaechsterSpielerErwartet', { spielerName })` aufrufen.
- Bei `VORBEHALT_ERWARTET`-Event: `this.flashTextManager.zeigeSpielevent('VorbehaltErwartet', { spielerName })` aufrufen.
- Bei `STICH_ABGESCHLOSSEN`-Event: `this.flashTextManager.zeigeSpielevent('StichAbgeschlossen', { stichGewinner })` aufrufen.
- Payload-Felder aus dem jeweiligen WebSocket-Event-Objekt entnehmen (Typen in `frontend/src/modell/` prüfen).

**Nameplate Event-Mapping (alle fehlen in TischSzene):**
- Bei `NAECHSTER_SPIELER_ERWARTET`: vorherige `amZug`-Nameplate auf `'default'` zurücksetzen; Nameplate des neuen aktiven Spielers auf `'amZug'` via `this.nameplates[position].setState('amZug')`.
- Bei `SPIEL_GESTARTET`: Geber-Nameplate via `setState('geber')`, alle anderen via `setState('default')`.
- Bei `VORBEHALT_ERWARTET`: `this.nameplates[position].showVorbehalt()` für den wartenden Spieler.
- Nach Vorbehalt-Auflösung (entsprechendes Event oder Snapshot): `clearVorbehalt()` für alle; `setTeamfarbe('re' | 'kontra')` für alle 4 Spieler anhand `partei`-Feld.
- Bei `ANSAGE_ERFOLGT`: `this.nameplates[position].showAnsage(partei)` für den ansagenden Spieler.
- Bei `FUCHS_GEFANGEN` / `KARLCHEN_GESPIELT`: `this.nameplates[gefangenerPosition].shake()`.
- Referenz: `frontend/src/ui/Nameplate.ts`, `frontend/src/ui/FlashTextManager.ts`, `frontend/src/szenen/TischSzene.ts`.

**Nach Implementierung:** Visuelle Verifikation via Vision Loop (`e2e && npx playwright test vision-loop.spec.ts --headed`). Referenz-HTMLs: `design_handoff/Doppelkopf Flash Text v3.html`, `design_handoff/Doppelkopf Nameplates.html`.

### FIX-HOCHZEIT-ANIMATION: Dedizierte Hochzeit-Darstellung (Task 17)
Aktuell zeigt TischSzene `HOCHZEIT_PARTNER_GEFUNDEN` mit `SchweinchenGemeldet`-Animation — falsch semantisch.

- In `FlashTextManager.ts` für das `HochzeitPartnerGefunden`-Event eine eigene Animation implementieren (eigene Farbe/Text, z.B. `FARBE_GOLD` + Text „Hochzeit! Partner: X").
- In `TischSzene.ts` das `HOCHZEIT_PARTNER_GEFUNDEN`-Event-Handling auf den korrekten FlashTextManager-Event-Typ umstellen (aktuell fälschlicherweise `'SchweinchenGemeldet'`, lt. Analyse TischSzene Zeile ~450).
- Prüfen ob WebSocket-Snapshots einen `spieltyp: 'HOCHZEIT'`-Hinweis liefern, den man in der Nameplate des Hochzeits-Spielers anzeigen kann (z.B. kleines Herz-Label).
- Referenz: `frontend/src/szenen/TischSzene.ts`, `frontend/src/ui/FlashTextManager.ts`, `specs/hochzeit.md`.

### FIX-E2E-TESTIDS: Fehlende data-testid-Attribute (Task 18)
29 von 48 data-testid-Attributen aus `specs/e2e-tests.md` implementiert; 19 fehlen.

- `specs/e2e-tests.md` vollständig lesen und alle fehlenden Attribute identifizieren (bestätigt: rundenauswertung-spieltyp, rundenauswertung-punktemultiplikator, weitere Rundenauswertungs-Attribute fehlen).
- In den entsprechenden Phaser-Szenen/Komponenten bzw. DOM-Elementen die fehlenden `data-testid`-Attribute ergänzen.
  - Phaser-Objekte: via `gameObject.name` + JavaScript-Bridge (`window.__locodoko`) für Playwright zugänglich machen.
  - DOM-Elemente: direkt `dataset.testid` setzen.
- E2E-Testfälle in `e2e/` anpassen/erweitern, um die neuen Attribute zu nutzen.
- Nach Änderung: `cd e2e && npx playwright test` ausführen und alle Tests grün machen.

### FIX-ARMUT-BESTIMMUNG: Armut-Spieler vom Server empfangen (Task 19)
In `frontend/src/modell/TischAnsichtModell.ts` Zeile ~590–597: `bestimmeArmutAktion()` ermittelt Armut-Spieler anhand kleinster Handkartenzahl — fehleranfällig bei gleichem Kartenstand.

- WebSocket-Payload von `VORBEHALT_AUFGELOEST` oder Snapshot prüfen: enthält `armutSpieler` oder `spieltyp: 'ARMUT'` mit entsprechendem Spieler? Falls ja: direkt vom Server-Payload lesen.
- Falls Server kein direktes Feld liefert: Backend-DTO (`VorbehaltAufloesungEreignis` o.ä.) um Armut-Spieler-Position erweitern.
- Armut-Angebots-Status-Anzeige: Wenn Spieler im ANBIETEN-Modus wartet, Status-Toast o.ä. anzeigen.
- Referenz: `frontend/src/modell/TischAnsichtModell.ts`, Backend-WebSocket-Payload-Typen in `src/main/java/de/locodoko/`.

### FEAT-SCHMEISSEN-FRONTEND: Schmeissen-Vorbehalt im Frontend (Task 20)
Backend: `bereitsGeschmissen Set`, `VorbehaltAnsage.SCHMEISSEN_WENIG_TRUMPF`, `istSchmeissen()` vorhanden. Frontend-Dialog fehlt.

- Prüfen ob `VorbehaltErwartet`-WebSocket-Event ein `schmeissenMoeglich`-Flag enthält oder ob es aus der Spielerkonfiguration ableitbar ist.
- In `TischSzene.ts` Vorbehalt-Dialog: „Schmeissen"-Button anzeigen wenn `tischkonfiguration.schmeissenAktiv === true` und Spieler ≤ 1 Trumpf hat (WENIG_TRUMPF) oder ≥ 5 Neunen (laut Spec klären: `VorbehaltAnsage.SCHMEISSEN_FUENF_NEUNEN` auch prüfen).
- WebSocket-Nachricht senden: `{ typ: 'VORBEHALT', vorbehalt: 'SCHMEISSEN_WENIG_TRUMPF' }` an `/app/tische/{id}/vorbehalt`.
- Spec-Referenz: `specs/regelkatalog.md` (Schmeissen-Regeln), `specs/spielablauf.md` (Vorbehalt-Phase). Backend-Referenz: `src/main/java/de/locodoko/partie/VorbehaltAnsage.java`.

---

## Akzeptanzkriterien

1. **Font**: `Press Start 2P` lädt lokal, kein CDN-Aufruf, erscheint in Nameplates + Flash-Text + Modals.
2. **Flash-Text**: Alle 9 Events animiert, pixel-genau nach `design_handoff/Doppelkopf Flash Text v3.html`.
3. **Nameplates**: Am-Zug-Glow, RE/KONTRA-Badge, Geber-Krone, Vorbehalt-Pulse, Teamfarbe — alle korrekt verdrahtet und sichtbar.
4. **Spielprotokoll**: Wächst nach jeder Runde, kumulativer Stand korrekt, scrollbar, persistiert über Szenen-Wechsel.
5. **Stabilität**: Alle 94+ Unit-Tests und E2E-Tests grün.
6. **Kein DOM in Spiel-Szenen**: Keine `document.createElement`-Aufrufe in TischSzene und SpielverwaltungsSzene.
7. **Solist-Aufspieler**: Implementiert (bereits erfüllt).
8. **Regelkatalog**: `locoBlatRegeln()` und `dkvRegeln()` implementiert (bereits erfüllt).

---

## TODO Liste

**P0 (Design Foundation):**
- [x] Task 1: Design-Tokens-Datei erstellen (`frontend/src/ui/designTokens.ts`)
- [x] Task 2: Press Start 2P Font lokal bundeln + in BootSzene laden

**P1 (Flash-Text):**
- [x] Task 3: `FlashTextManager` implementieren — alle 9 Events verdrahtet (Task 16 erledigt)

**P2 (Nameplates):**
- [x] Task 4: `Nameplate`-Klasse implementieren — Klasse fertig, Event-Mapping vollständig (Task 16 erledigt)

**P3 (Spielprotokoll):**
- [x] Task 5: Spielprotokoll vollständig — State im AppStore + Overlay-Integration in TischSzene (📋-Button, Scrolling, Cleanup)

**P4 (Plan #100):**
- [ ] Task 6: Backend Punkte-Labels + DTO (`FEAT-POINT-LABELS`)
- [ ] Task 7: `PhaserModal` + `PhaserList` Basis-Komponenten
- [ ] Task 8: `SpielverwaltungsSzene` Phaser-native (`REFACTOR-LOBBY`)
- [ ] Task 9: Rundenauswertung 2.0 als `PhaserModal` (`REFACTOR-EVALUATION`)
- [ ] Task 10: DOM Elimination + E2E-Bridge (`REFACTOR-UI-CLEANUP`)

**P5 (Bereits bekannte Aufgaben):**
- [x] Task 11: FIX-SOLIST-AUFSPIELER — bereits implementiert
- [x] Task 12: FIX-REGELKATALOG — `locoBlatRegeln()` + `dkvRegeln()` bereits implementiert
- [x] Task 13: FIX-DREISSIG-AUGEN-PFLICHT — bereits implementiert
- [x] Task 14: FEAT-ARMUT-FRONTEND — `renderArmutBereich()` bereits implementiert
- [ ] Task 15: FIX-SPEC-TISCHKONFIGURATION — Feldnamen in Spec an Code angleichen

**P6 (Neu entdeckt, Plan-Run #102):**
- [x] Task 16: FEAT-VERDRAHTUNG — Flash-Text (3 fehlende Events) + Nameplate Event-Mapping in TischSzene
- [x] Task 17: FIX-HOCHZEIT-ANIMATION — Dedizierte Hochzeit-FlashText-Animation statt SchweinchenGemeldet-Style
- [x] Task 18: FIX-E2E-TESTIDS — 19 fehlende data-testid-Attribute ergänzen
- [x] Task 19: FIX-ARMUT-BESTIMMUNG — Armut-Spieler direkt vom Server empfangen, Angebots-Status anzeigen
- [ ] Task 20: FEAT-SCHMEISSEN-FRONTEND — Schmeissen-Button im Vorbehalt-Dialog
