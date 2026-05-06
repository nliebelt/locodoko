# IMPLEMENTATION_PLAN — Plan-Run #114

> Stand: 2026-05-06. Fokus: Codebase-Scan Run #114 — Statusabgleich offener Tasks, neue Cleanup-Tasks.

## Notiz

**Was wurde gescannt (Run #114)?**
- Task 5 (Spielprotokoll): bereits vollständig implementiert — `SpielprotokollOverlay.ts`, `spielProtokollEintraege` im AppStore, 📋-Button in TischSzene. Als [x] markiert.
- Task 6 (FEAT-POINT-LABELS): bereits vollständig implementiert — `PunkteKomponenteAntwort` (typ/label/punkte) im Backend, DTO im Frontend. Als [x] markiert.
- FEAT-QUICK-PLAY-SYNC: bereits vollständig implementiert — `erstelleQuickGame()` mit `wirdGeladen`-Flag, API-Integration, E2E-Test. Als [x] markiert.
- Task 25 (FIX-KI-ARCHITECTURE-VIOLATION): bestätigt erledigt — `KiEventAdapter` ist leer (deprecated), Logik in `KiTischOrchestrator`. Inkonsistenz im Plan behoben.
- Task 28 (DOC-SPEC-UPDATES): Scope präzisiert — `frontend-ui-logik.md` und `ki-strategie.md` sind bereits korrekt, kein Update nötig. Nur `spieler-session.md` und `architektur-domain-events.md` brauchen Updates.
- Neue Tasks: 29 (leere KiEventAdapter-Klasse entfernen), 30 (ESLint `any`-Fehler beheben).

**Nächster logischer Schritt:**
- Task 28 (DOC-SPEC-UPDATES): Zwei Spec-Dateien aktualisieren.
- Task 29 (REFACTOR-KI-ADAPTER-CLEANUP): Leere KiEventAdapter-Klasse entfernen.
- Task 30 (FIX-ESLINT-ANY): 96 TypeScript `any`-Fehler bereinigen.
- Vision Loop Spielschleife: `leseSpielZustand` wartet auf `isIdle()` das bei KI-Spiel gelegentlich >15s dauert (pre-existing), soll verbessert werden.
- Hochzeit-Nameplate: Kein Herz-Label implementiert.

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
- [ ] **Dokumentation** (2 Dateien — `frontend-ui-logik.md` und `ki-strategie.md` sind bereits korrekt):
  - `spieler-session.md` aktualisieren: Passwort/Login (BCrypt) als primäres Authentifizierungsmittel beschreiben; Session-Cookie bleibt Transportmechanismus.
  - `architektur-domain-events.md` aktualisieren:
    - Zeile mit `KI_ZUG_SEQUENZ` entfernen — dieses Event existiert nicht im Code; KI-Timing ist rein Frontend-seitig (800ms Queue-Delay).
    - `PartieEreignisBatch`-Abschnitt von „Geplant" auf „Implementiert" ändern.
    - Fehlende Events in Tabelle ergänzen: `AKTION_ABGELEHNT`, `SNAPSHOT`.
    - `SPIEL_BEENDET` Verantwortlichkeit korrigieren: Produzent ist `PartieLifecycleService`.

---

## P8 — Neu entdeckte Aufgaben (Plan-Run #114)

### REFACTOR-KI-ADAPTER-CLEANUP (Task 29)
- [ ] **Backend**: Leere Klasse `de.locodoko.ki.orchestrierung.KiEventAdapter` entfernen. Sie enthält nur einen Kommentar und einen leeren Body — kein produktiver Code, keine Tests referenzieren sie. Sicherstellen dass `mvn test` danach grün ist.

### FIX-ESLINT-ANY (Task 30)
- [ ] **Frontend**: 96 TypeScript ESLint `any`-Fehler in `frontend/src/` bereinigen. Schrittweise: zuerst `npm run lint` ausführen um aktuelle Liste zu erhalten, dann Typen präzisieren (bevorzugt `unknown` + Type Guards oder spezifische Typen aus `api-types.ts`). Nach jeder Datei `npm test` ausführen. Kein `eslint-disable`-Kommentar ohne Begründung.

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
- [ ] Task 28: DOC-SPEC-UPDATES

**P8 (Neu entdeckt, Plan-Run #114):**
- [ ] Task 29: REFACTOR-KI-ADAPTER-CLEANUP
- [ ] Task 30: FIX-ESLINT-ANY
