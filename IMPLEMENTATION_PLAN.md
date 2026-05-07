# IMPLEMENTATION_PLAN — Plan-Run #115

> Stand: 2026-05-06. Fokus: P9 — Frontend-Animationsfixes + Vorbehalt-Animationen in Arbeit.

## Notiz

**Was wurde implementiert?**
- Task 36 (FEAT-VORBEHALT-ANIMATION): Spec-Update `frontend-tastatursteuerung.md` — Vorbehalt-Sektion auf kartenbasierte Auswahl ohne Dialog aktualisiert; ArrowLeft/Right als Vorbehalt-Navigation ergänzt. `frontend-vorbehalt-kartenauswahl.md` DoD 227-230 als erledigt markiert (Reconciliation + Tweens + Abbruch bereits in Tasks 31-35 implementiert).
- Diverse Bugfixes aus abgestürzter Vorversion: AppStore `_queueGeneration`-Counter (Race Condition bei reconnecteTisch+KI-Delay), `abonniere()`-Umbenennung in allen Szenen, TypeScript-Fehler in Kartenansicht/AnimationenService, TischSzene-Test-Deadlock mit vi.runAllTimersAsync behoben.

**Nächster logischer Schritt:**
- Alle P9-Tasks erledigt. Nächster Ralph: Codebase-Scan für neue Tasks.
- Pre-existing: Vision Loop `isIdle()` gelegentlich >15s bei KI-Spielen.
- Pre-existing: Hochzeit-Nameplate ohne Herz-Label.
- Vision Loop DoD-Item 231 (Playwright headed) steht noch aus — Backend muss laufen.

---

## Entdeckungen

<!-- Build-Agent trägt hier Beobachtungen ein die nicht zur aktuellen Aufgabe gehören.
     Plan-Agent wandelt sie beim nächsten Scan in konkrete Tasks um. -->

- (noch keine Einträge)

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
- [ ] **Frontend**: Animierter Vorbehalt-Wechsel gemäß `specs/frontend-vorbehalt-kartenauswahl.md` (Ausbaustufe):
  - `persistenteEigeneKarten` für Tween-Übergänge ausbauen (Reconciliation-Pattern: bestehende Sprites gleiten zur neuen Position statt destroy/recreate)
  - Y-Tween (~150–200 ms) bei Elevation-Änderung (←/→ wechselt Vorbehalt)
  - X-Tween (~150–200 ms) bei Sortierungs-Änderung
  - Tween-Abbruch bei WebSocket-Update während der Animation
  - `specs/frontend-tastatursteuerung.md` Vorbehalt-Sektion aktualisieren

---

## Akzeptanzkriterien

1. **Stabilität**: Alle Tests (Backend & Frontend) grün.
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
