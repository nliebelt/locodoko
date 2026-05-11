# IMPLEMENTATION_PLAN — Plan-Run #121

> Stand: 2026-05-10. Fokus: P13 — Frontend Build & Typescript Bereinigung.

## Notiz

**Was wurde implementiert?**
- **Lint-Fix (TischSzene.ts:557)**: `eslint-disable-next-line` Kommentar für E2E-Bridge-Pattern ergänzt — der `interim`-Commit hatte `(window as any).__locodoko` ohne den erforderlichen Suppress-Kommentar eingebaut.
- **Plan-Konsistenz**: Task 47 Body-Checkbox `[ ]` → `[x]` korrigiert (war im TODO bereits korrekt).
- Alle Frontend-Validierungen grün: 191 Tests, `npm run build`, `npm run lint`.

**Nächster logischer Schritt:**
- Alle Aufgaben P0–P13 sind erledigt. Eine vollständige E2E-Validierung mit laufendem Backend (`cd e2e && npx playwright test`) wäre der sinnvolle Abschlusscheck — erfordert aber ein gestartetes Backend.

**Offene Fragen oder Probleme:**
- Keine. Frontend ist vollständig grün.

---

## Entdeckungen

- **Frontend TS Build-Fehler**: `tsc --noEmit` im `frontend`-Ordner bricht mit 58 Fehlern ab (z.B. `istKi` fehlt in `SpielverwaltungApi.test.ts`, ungenutzte `@ts-expect-error` in `AppStore.test.ts`, Parameter-Mismatches in Fake-Objekten in Phaser-Szenen-Tests, und ein Überladungsfehler in `vite.config.ts`).
- **E2E Tests**: Die E2E Tests sind vorbereitet, aber da das Frontend nicht baut, muss zunächst der Build repariert werden, bevor die vollständige lokale Validierung via `playwright test` abgeschlossen werden kann.

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

---

## P12 — E2E-Stabilität & Doku (Plan-Run #120)

### FEAT-ANIMATION-LOGGING (Task 46)
- [x] **Frontend**: `AnimationenService.ts` anpassen, sodass Start und Ende jeder Animationssequenz (z.B. Ausspielen, Einziehen) mittels `Logger.szene` sauber protokolliert werden. Dies dient der besseren Überwachung der Zustandssynchronisation für E2E-Tests und Debugging.

### BUG-E2E-VISION-LOOP-TIMEOUT (Task 44b)
- [x] **E2E**: `vision-loop.spec.ts` Stabilität fixen. Die Hauptursache ist eine ineffiziente Polling-Schleife. Der Test muss so refaktorisiert werden, dass er auf definierte Spielzustände (`warteAufEigenenZug`, `warteAufPhase`, etc.) wartet, statt blind zu pollen. Ziel: Laufzeit < 2 Minuten und kein Timeout.

### FEAT-E2E-SOLO (Task 44c)
- [x] **E2E**: `e2e/tests/solo-spielfluss.spec.ts` vervollständigen. Der Test prüft bereits den Spieltyp und Multiplikator. Ergänze die fehlende Assertion, um zu verifizieren, dass der Geber nach einer Solo-Runde nicht wechselt. Anschließend DoD in `specs/e2e-tests.md` abhaken.

### DOC-SPEC-CLEANUP (Task 45)
- [x] **Dokumentation**: In `specs/frontend-rundenauswertung.md` die DoD-Einträge für das "Spielprotokoll (DKV-Scorecard)" als `[x]` markieren, da die Implementierung im `AppStore` und der `TischSzene` bereits vorhanden ist.

---

## P13 — Frontend Build & TypeScript Bereinigung (Plan-Run #121)

### FIX-FRONTEND-TS-ERRORS (Task 47)
- [x] **Frontend**: `tsc --noEmit && vite build` im `frontend` Ordner reparieren.
  - Typisierungsfehler in `SpielverwaltungApi.test.ts` beheben (`istKi` Property ergänzen).
  - Ungenutzte Direktiven (`@ts-expect-error`) in `AppStore.test.ts` entfernen.
  - Parameter in Fake-Objekten (z.B. in `TischSzene.test.ts`, `FlashTextManager.test.ts`, `PhaserModal.test.ts`, etc.) anpassen (z.B. `add()`, `setStrokeStyle()`).
  - Überladungsfehler in `vite.config.ts` (Coverage Istanbul/v8) fixen.
  - Ungenutzte Variablen und Typparameter (`w`, `h`, `t`, `opt`) in diversen Tests (`TischSzene.test.ts`, `tischFormatierer.test.ts`) bereinigen oder entfernen.
  - Sicherstellen, dass `cd frontend && npm run build` am Ende fehlerfrei durchläuft.

---

## Akzeptanzkriterien

1. **Stabilität**: Alle Tests (Backend & Frontend) grün. Frontend linter fehlerfrei. `cd frontend && npm run build` läuft fehlerfrei durch.
2. **Architektur**: Keine verbotenen Abhängigkeiten (KI -> Tisch).
3. **Spec-Konsistenz**: Code und Specs stimmen überein; abweichende Specs sind aktualisiert.
4. **Sicherheit**: ABAC-Regeln sind aktiv und Gäste können keine privaten Tische betreten.

---

## TODO Liste

**P12 (E2E-Stabilität & Doku, Plan-Run #120):**
- [x] Task 46: FEAT-ANIMATION-LOGGING
- [x] Task 44b: BUG-E2E-VISION-LOOP-TIMEOUT
- [x] Task 44c: FEAT-E2E-SOLO
- [x] Task 45: DOC-SPEC-CLEANUP

**P13 (Frontend Build, Plan-Run #121):**
- [x] Task 47: FIX-FRONTEND-TS-ERRORS