# IMPLEMENTATION_PLAN — Plan-Run #119

> Stand: 2026-05-09. Fokus: P11 — E2E Vision Loop Stabilität & Bugfixes, Rundenende-Workflow.

## Notiz

**Was wurde implementiert?**
- Task 42a-c: Sämtliche ESLint-Fehler (`any`, ungenutzte Variablen) in den Frontend-Tests wurden behoben. Das Frontend-Projekt ist nun linter-frei (`npm run lint` grün).
- Task 43a: Platzhalter- und Duplikat-Texte in der `TischSzene.ts` wurden entfernt. `statusText` wurde aus dem Modell und den Tests gelöscht.
- Task 43b: Layout für OST/WEST Spieler in `layout.ts` korrigiert, um Overflow zu verhindern. Nameplate-Positionen gemäß Spec angepasst.
- Task 43c: Stich-Karten in der Mitte werden nun leicht überlappend (gestapelt) und mit gejitterten Winkeln gerendert (per Vision Loop verifiziert).
- Task 44a: E2E-Helper `screenshot` und `screenshotKeyframes` implementiert. `setzeAnimationsGeschwindigkeit` Bridge-Hook ergänzt.
- `FlashTextManager` wurde an die globale Animationsgeschwindigkeit gekoppelt.

**Nächster logischer Schritt:**
- [ ] Vision Loop Timeout (Task 44b) beheben. Der Test hängt aktuell beim Warten auf `isIdle()`.
- [ ] Task 44c (Solo E2E) und Task 45 (Spec-Cleanup) abschließen.
- [ ] Task 46 (Animation-Logging) für bessere Traceability implementieren.
- [ ] `isIdle()` Logik in `TischSzene.ts` und `AppStore.ts` auf potenzielle Deadlocks prüfen.

---

## Entdeckungen

- **Vision Loop Timeout**: Der E2E Vision Loop Test benötigt aktuell > 6 Minuten und schlägt mit einem Timeout fehl. Ursache scheint der `isIdle()` Sensor zu sein, der in bestimmten Zuständen (möglicherweise während der Rundenende-Auswertung oder bei überlappenden Flash-Texten) nicht auf `true` zurückkehrt.

---

## Legende

- [ ] Offen
- [~] In Arbeit
- [x] Erledigt

---

## Analyse-Stand (Plan-Run #114)

Vollständiger Codebase-Scan abgeschlossen. Wesentliche Befunde:

**Tisch/Spieler**:
- Implementiert: Entities, Lobby, Auth (BCrypt/Passwort), Session, Disconnect (120s), Statistiken, ABAC, privater-Tisch-Schutz.
- `spieler-session.md` ist noch veraltet (beschreibt nur Name+Cookie, nicht Passwort/Login).

**Partie/Regeln**:
- Spielkern und Sonderspiele vollständig. Sonderspiele (Hochzeit, Armut, 8 Solos) exakt nach Spec.

**API/Events/KI**:
- `PartieEreignisBatch` für Gap-Detection implementiert (Task 26 erledigt).
- `KiEventAdapter` ist leer und kann entfernt werden (Task 29).
- `architektur-domain-events.md` ist veraltet: `KI_ZUG_SEQUENZ` existiert nicht im Code; `PartieEreignisBatch` fälschlicherweise als „Geplant" markiert.

**Frontend**:
- Spielprotokoll, Punkte-Labels, Schnellstart-Sync vollständig implementiert.
- 96 ESLint `any`-Fehler ausstehend (Task 30).
- `frontend-ui-logik.md` und `ki-strategie.md` sind korrekt und aktuell.

---

## P0 — Design Foundation

### FEAT-DESIGN-TOKENS: Zentrale Konstanten-Datei
- [x] Neue Datei `frontend/src/ui/designTokens.ts`

### FEAT-FONT: Press Start 2P lokal bundeln
- [x] Font-Datei `PressStart2P-Regular.ttf` in `frontend/public/assets/fonts/` abgelegt.

---

## P1 — Flash-Text-Animationssystem
- [x] Task 3: `FlashTextManager` implementieren.

---

## P2 — Nameplates
- [x] Task 4: `Nameplate`-Klasse implementieren.

---

## P3 — Spielprotokoll
### FEAT-SPIELPROTOKOLL: DKV-Scorecard
- [x] Task 5: Spielprotokoll vollständig — `SpielprotokollOverlay.ts` mit Scrolling; `spielProtokollEintraege` im AppStore; 📋-Button in TischSzene; Befüllung bei `SPIEL_BEENDET`.

---

## P4 — Plan #100 Tasks (parallel laufend)
- [x] Task 6: FEAT-POINT-LABELS: Backend `PunkteKomponenteAntwort` (typ/label/punkte) + DTO im Frontend
- [x] FEAT-QUICK-PLAY-SYNC: Schnellstart Lade-Status via `wirdGeladen`-Flag in `erstelleQuickGame()`
- [x] Task 7: FEAT-PHASER-MODAL / PHASER-LIST
- [x] Task 8: REFACTOR-LOBBY
- [x] Task 9: REFACTOR-EVALUATION
- [x] Task 10: REFACTOR-UI-CLEANUP

---

## P5 — Bereits bekannte Aufgaben (aus Plan #101)
- [x] Task 11: FIX-SOLIST-AUFSPIELER
- [x] Task 12: FIX-REGELKATALOG
- [x] Task 13: FIX-DREISSIG-AUGEN-PFLICHT
- [x] Task 14: FEAT-ARMUT-FRONTEND
- [x] Task 15: FIX-SPEC-TISCHKONFIGURATION

---

## P6 — Neu entdeckte Aufgaben (Plan-Run #102)
- [x] Task 16: FEAT-VERDRAHTUNG
- [x] Task 17: FIX-HOCHZEIT-ANIMATION
- [x] Task 18: FIX-E2E-TESTIDS
- [x] Task 19: FIX-ARMUT-BESTIMMUNG
- [x] Task 20: FEAT-SCHMEISSEN-FRONTEND

---

## P7 — Neu entdeckte Aufgaben (Plan-Run #111)

### FIX-ABAC-AUTHORIZATION (Task 21)
- [x] **Backend**: `@PreAuthorize`-Annotationen in Controllern für ABAC-Durchsetzung ergänzen (Specs fordern dies, aktuell manuelle Service-Prüfungen).

### FIX-TISCH-STATUS-ABBRUCH (Task 22)
- [x] **Backend**: Nach Verbindungsabbruch den Tisch-Status auf `WARTEND` setzen, anstatt den Tisch zu löschen (`VerbindungsabbruchService.java`).

### FIX-PRIVATE-TISCH-GUESTS (Task 23)
- [x] **Backend**: Überprüfung beim Beitritt zu privaten Tischen implementieren, um Gast-User abzulehnen (Login-Pflicht gemäß Spec).

### REFACTOR-URL-CONSISTENCY (Task 24)
- [x] **Backend**: Alle REST-Endpunkte für Tische auf Plural (`/api/tische/...`) vereinheitlichen. (Bereits konsistent — keine Änderungen nötig.)

### FIX-KI-ARCHITECTURE-VIOLATION (Task 25)
- [x] **Backend**: Abhängigkeiten im KI-Modul aufgelöst. `KiEventAdapter` ist leer, Logik wurde in `de.locodoko.tisch.KiTischOrchestrator` verschoben. KI importiert nur noch `partie` und `karten`.

### FEAT-EVENT-GAP-DETECTION (Task 26)
- [x] **Backend/Frontend**: Implementierung von `PartieEreignisBatch` für zuverlässigere WebSocket-Synchronisation.

### REFACTOR-E2E-KEYBOARD (Task 27)
- [x] **E2E**: E2E-Tests auf ausschließliche Nutzung von Tastatur-Shortcuts (gemäß `frontend-tastatursteuerung.md`) umstellen; Mausklicks entfernen.

### DOC-SPEC-UPDATES (Task 28)
- [x] **Dokumentation** (2 Dateien — `frontend-ui-logik.md` und `ki-strategie.md` sind bereits korrekt):
  - `spieler-session.md` aktualisieren: Passwort/Login (BCrypt) als primäres Authentifizierungsmittel beschreiben; Session-Cookie bleibt Transportmechanismus.
  - `architektur-domain-events.md` aktualisieren:
    - Zeile mit `KI_ZUG_SEQUENZ` entfernen — dieses Event existiert nicht im Code; KI-Timing ist rein Frontend-seitig (800ms Queue-Delay).
    - `PartieEreignisBatch`-Abschnitt von „Geplant" auf „Implementiert" ändern.
    - Fehlende Events in Tabelle ergänzen: `AKTION_ABGELEHNT`, `SNAPSHOT`.
    - `SPIEL_BEENDET` Verantwortlichkeit korrigieren: Produzent ist `PartieLifecycleService`.

---

## P8 — Neu entdeckte Aufgaben (Plan-Run #114)

### REFACTOR-KI-ADAPTER-CLEANUP (Task 29)
- [x] **Backend**: Leere Klasse `de.locodoko.ki.orchestrierung.KiEventAdapter` entfernen. Sie enthält nur einen Kommentar und einen leeren Body — kein produktiver Code, keine Tests referenzieren sie. Sicherstellen dass `mvn test` danach grün ist.

### FIX-ESLINT-ANY (Task 30)
- [x] **Frontend**: TypeScript ESLint `any`-Fehler in `frontend/src/` bereinigen. Schrittweise: zuerst `npm run lint` ausführen um aktuelle Liste zu erhalten, dann Typen präzisieren (bevorzugt `unknown` + Type Guards oder spezifische Typen aus `api-types.ts`). Nach jeder Datei `npm test` ausführen. Kein `eslint-disable`-Kommentar ohne Begründung.

---

## P9 — Neu entdeckte Aufgaben (Plan-Run #115)

### FIX-ANIMATION-POSITIONS (Tasks 31–32)
- [x] **Frontend**: Drei Positions-Bugs in `TischSzene.ts` behoben:
  - `KARTE_GESPIELT` (Zeile 421): `eigPos` (relativ) → `eigAbsPos` (absolut) für Vergleich
  - `animiereGegnerKarte` (Zeile 426): absolute `e.spielerPosition` → relative `relPos` für Layout/Slot-Lookup
  - `HOCHZEIT_PARTNER_GEFUNDEN` (Zeile 474): `s.position` → `s.absolutePosition` für Partner-Name

### FIX-RENDER-GUARDS (Task 33)
- [x] **Frontend**: Stabilitätsfixes in `TischSzene.ts` und `AppStore.ts`:
  - `triggerRender()`: `stichEinziehenAktiv` im Guard ergänzt
  - `aufraeumen()`: `partieCountdownInterval` sofort am Anfang stoppen
  - AppStore `_verarbeiteEventQueue`: `shift()!` durch null-sichere Variante ersetzt
  - AppStore `abonniereEvents`: `_verpassterSpielBeendet` beim letzten Listener-Abmelden leeren

### FIX-PROMISE-HANDLING (Task 34)
- [x] **Frontend**: Fire-and-forget Promises in `AnimationenService.ts:417` und `TischSzene.ts:217` mit `.catch()` versehen.

### REFACTOR-RENDER-KARTEN (Task 35)
- [x] **Frontend**: `renderKartenFaecher()` (115 Zeilen, zyklom. Komplexität ~14) aufgeteilt in:
  - `bereinigePersistenteEigeneKarten()` — Sprite-Cleanup
  - `erstelleOderAktualisiereKartenSprite()` — Sprite-Erstellung/Wiederverwendung
  - `setzeKartenInteraktion()` — Handler-Management

### FEAT-VORBEHALT-ANIMATION (Task 36)
- [x] **Frontend**: Animierter Vorbehalt-Wechsel gemäß `specs/frontend-vorbehalt-kartenauswahl.md` (Ausbaustufe):
  - `persistenteEigeneKarten` für Tween-Übergänge ausbauen (Reconciliation-Pattern: bestehende Sprites gleiten zur neuen Position statt destroy/recreate)
  - Y-Tween (~150–200 ms) bei Elevation-Änderung (←/→ wechselt Vorbehalt)
  - X-Tween (~150–200 ms) bei Sortierungs-Änderung
  - Tween-Abbruch bei WebSocket-Update während der Animation
  - `specs/frontend-tastatursteuerung.md` Vorbehalt-Sektion aktualisieren

---

## P10 — Frontend-Stabilität & Bugfixes (Plan-Run #116)

### FIX-FLICKER-KARTE-GESPIELT (Task 37)
- [x] **Frontend**: `AppStore.ts` — `KARTE_GESPIELT` Patching vor die Event-Listener verschieben, damit `triggerRender()` am Animationsende sofort den korrekten Folgestatus sieht.

### FIX-GHOST-CARDS (Task 38)
- [x] **Frontend**: `TischSzene.ts` — In `renderKartenFaecher` die Karte mit `this.wartendeKartenId` auf `setVisible(false)` setzen, um Doppel-Rendering während der Animation zu verhindern.

### FEAT-HOCHZEIT-HEART (Task 39)
- [x] **Frontend**: `Nameplate.ts` — Methode `setHochzeitPartner(aktiv: boolean)` für Herz-Icon und `hatAnsageBadge(typ)` für saubere API hinzufügen. `TischSzene.ts` entsprechend anpassen.

### REFACTOR-ANIMATION-CLEANUP (Task 40)
- [x] **Frontend**: `TischSzene.ts` — Redundante `triggerRender(true)` Aufrufe in `finally`-Blöcken von Animationen entfernen.

### FEAT-ANIMATION-TESTS (Task 41)
- [x] **Frontend**: Unit Tests für `FlashTextManager` (`FlashTextManager.test.ts`) zur Absicherung der UI-Overlays und Skalierung.
- [x] **Frontend**: Integration Tests für Animation-Guards und Sequential Processing (`AnimationIntegration.test.ts`).

---

## P11 — Neu entdeckte Aufgaben (Plan-Run #117/119)

### FIX-ESLINT-TESTS-1 (Task 42a)
- [x] **Frontend**: ESLint-Fehler (`any`) in `src/services/` (SpielverwaltungApi.test.ts, SpielverwaltungEchtzeit.test.ts, AnimationenService.test.ts) beheben.

### FIX-ESLINT-TESTS-2 (Task 42b)
- [x] **Frontend**: ESLint-Fehler (`any`) in `src/store/AppStore.test.ts` beheben. (Typisierung in Mock-Daten korrigieren).

### FIX-ESLINT-TESTS-3 (Task 42c)
- [x] **Frontend**: ESLint-Fehler (`any`, ungenutzte Variablen) in `src/assets/Kartenansicht.test.ts` beheben und `npm run lint` grün abschließen.

### FIX-TISCHANSICHT-UI-TEXTE (Task 43a)
- [x] **Frontend**: In `TischSzene.ts` Duplikat-Texte und Placeholders wie "Am Zug", "Noch keine Karte" oder Entwickler-Titeltexte dauerhaft entfernen. (Unbenutzter `statusText` aus Modell und Tests entfernt).

### FIX-TISCHANSICHT-UI-LAYOUT (Task 43b)
- [x] **Frontend**: In `TischSzene.ts` die absoluten Positionen für Spieler OST und WEST anpassen, damit die Karten/Avatare nicht aus dem Canvas (Overflow) herausragen. (Werte in `layout.ts` angepasst und per Vision Loop verifiziert).

### FIX-TISCHANSICHT-UI-STICH (Task 43c)
- [x] **Frontend**: In `TischSzene.ts` die Render-Logik der Stichmitte (4 Karten) so umbauen, dass die Karten leicht überlappend (gestapelt/gestampelt) und passend zur Spielerrichtung (ohne Namenstexte an der Karte) dargestellt werden. (Positionen in `layout.ts` verdichtet und Winkel gejittert).

### FEAT-E2E-HELPERS (Task 44a)
- [x] **E2E**: Datei `e2e/tests/helpers.ts` öffnen und eine neue Funktion `screenshotKeyframes(page, name, animationsMs)` einbauen (gemäß Specs). (Auch generische `screenshot` Funktion ergänzt).

### BUG-E2E-VISION-LOOP-TIMEOUT (Task 44b)
- [ ] **E2E**: `vision-loop.spec.ts` Stabilität fixen. `isIdle()` Logik debuggen: Warum hängt der Test in Phase AUSWERTUNG? Sicherstellen, dass Modals und Flash-Texte den `isIdle` Zustand korrekt freigeben. Ziel: Laufzeit < 2 Minuten.

### FEAT-E2E-SOLO (Task 44c)
- [ ] **E2E**: `e2e/tests/solo-spielfluss.spec.ts` prüfen. Testfall 3 entweder implementieren (falls Fachlichkeit klar) oder aus der `e2e-tests.md` DoD entfernen.

### DOC-SPEC-CLEANUP (Task 45)
- [ ] **Dokumentation**: In `specs/datenbankmodell.md` (Tabellen Auth/Profil) und `specs/frontend-rundenauswertung.md` (Protokoll-Store) die bereits implementierten DoD-Einträge als `[x]` markieren.
- [ ] **Dokumentation**: In `specs/frontend-startscreen.md` prüfen, ob Logo und Keyboard-Navigation vorhanden sind, und DoD abhaken.

---

## P12 — Neu entdeckte Aufgaben (Plan-Run #118/119)

### FEAT-ANIMATION-LOGGING (Task 46)
- [ ] **Frontend**: `AnimationenService.ts` anpassen, sodass Start und Ende jedes Tweens und jeder Animationssequenz (z.B. Ausspielen, Einziehen) mittels `Logger.szene` sauber protokolliert werden. Dies dient der besseren Überwachung der Zustandssynchronisation für E2E-Tests und Debugging.

---

## Akzeptanzkriterien

1. **Stabilität**: Alle Tests (Backend & Frontend) grün. Frontend linter fehlerfrei.
2. **Architektur**: Keine verbotenen Abhängigkeiten (KI -> Tisch).
3. **Spec-Konsistenz**: Code und Specs stimmen überein; abweichende Specs sind aktualisiert.
4. **Sicherheit**: ABAC-Regeln sind aktiv und Gäste können keine privaten Tische betreten.

---

## TODO Liste

**P7 (Neu entdeckt, Plan-Run #111):**
- [x] Task 21: FIX-ABAC-AUTHORIZATION
- [x] Task 22: FIX-TISCH-STATUS-ABBRUCH
- [x] Task 23: FIX-PRIVATE-TISCH-GUESTS
- [x] Task 24: REFACTOR-URL-CONSISTENCY
- [x] Task 25: FIX-KI-ARCHITECTURE-VIOLATION
- [x] Task 26: FEAT-EVENT-GAP-DETECTION
- [x] Task 27: REFACTOR-E2E-KEYBOARD
- [x] Task 28: DOC-SPEC-UPDATES

**P8 (Neu entdeckt, Plan-Run #114):**
- [x] Task 29: REFACTOR-KI-ADAPTER-CLEANUP
- [x] Task 30: FIX-ESLINT-ANY

**P9 (Neu entdeckt, Plan-Run #115):**
- [x] Task 31–32: FIX-ANIMATION-POSITIONS
- [x] Task 33: FIX-RENDER-GUARDS
- [x] Task 34: FIX-PROMISE-HANDLING
- [x] Task 35: REFACTOR-RENDER-KARTEN
- [x] Task 36: FEAT-VORBEHALT-ANIMATION

**P10 (Neu entdeckt, Plan-Run #116):**
- [x] Task 37: FIX-FLICKER-KARTE-GESPIELT
- [x] Task 38: FIX-GHOST-CARDS
- [x] Task 39: FEAT-HOCHZEIT-HEART
- [x] Task 40: REFACTOR-ANIMATION-CLEANUP
- [x] Task 41: FEAT-ANIMATION-TESTS

**P11 (Neu entdeckt, Plan-Run #117/119):**
- [x] Task 42a: FIX-ESLINT-TESTS-1
- [x] Task 42b: FIX-ESLINT-TESTS-2
- [x] Task 42c: FIX-ESLINT-TESTS-3
- [x] Task 43a: FIX-TISCHANSICHT-UI-TEXTE
- [x] Task 43b: FIX-TISCHANSICHT-UI-LAYOUT
- [x] Task 43c: FIX-TISCHANSICHT-UI-STICH
- [x] Task 44a: FEAT-E2E-HELPERS
- [ ] Task 44b: BUG-E2E-VISION-LOOP-TIMEOUT
- [ ] Task 44c: FEAT-E2E-SOLO
- [ ] Task 45: DOC-SPEC-CLEANUP

**P12 (Neu entdeckt, Plan-Run #118/119):**
- [ ] Task 46: FEAT-ANIMATION-LOGGING
