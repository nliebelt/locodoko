# IMPLEMENTATION_PLAN — Plan-Run #111

> Stand: 2026-05-06. Fokus: Analyse der Bounded Contexts und Planung neuer Aufgaben.

## Notiz

**Was wurde implementiert (Run #111, dritte Iteration)?**
- Task 21 (FIX-ABAC-AUTHORIZATION): `@PreAuthorize`-Annotationen in `TischController` für Gastgeber-Endpunkte (`starten`, `PUT konfiguration`, `DELETE spieler/{id}`) und Mitglieds-Endpunkt (`neue-partie`). `TischSicherheit` erweitert: Session-Fallback für Gast-Spieler (via `RequestContextHolder`) und OAuth2-Principal-Support. `TischControllerTest` auf `springSecurity()` umgestellt. 307 Backend-Tests grün.
- Task 25 (FIX-KI-ARCHITECTURE-VIOLATION): `KiTischOrchestrator` im `tisch`-Kontext erstellt; `KiEventAdapter` auf leere Klasse reduziert; `tisch.KiSchwierigkeit`-Duplikat gelöscht; `ki/package-info.java` allowedDependencies bereinigt (kein `tisch` mehr). 307 Backend-Tests grün.

**Nächster logischer Schritt:**
- Task 26 (FEAT-EVENT-GAP-DETECTION): Event-Gap-Detection im Frontend implementieren.
- Task 27 (REFACTOR-E2E-KEYBOARD): E2E-Tests auf Tastatureingaben umstellen.

**Offene Fragen:**
- Vision Loop Spielschleife: `leseSpielZustand` wartet auf `isIdle()` das bei KI-Spiel gelegentlich >15s dauert (pre-existing).
- 96 ESLint `any`-Fehler — Cleanup-Task ausstehend.
- Hochzeit-Nameplate: Kein Herz-Label implementiert.

---

## Legende

- [ ] Offen
- [~] In Arbeit
- [x] Erledigt

---

## Analyse-Stand (Plan-Run #111)

5-Kontext-Analyse abgeschlossen. Wesentliche Befunde:

**Tisch/Spieler**:
- Implementiert: Entities, Lobby, Auth (OAuth2, BCrypt), Session, Disconnect (120s), Statistiken.
- Fehlt: `@PreAuthorize` ABAC-Durchsetzung in Controllern (Spezifikation fordert dies); Tisch-Status WARTEND nach Abbruch (Code löscht Tisch). Private Tische blocken Gäste nicht.
- Inkonsistenzen: `spieler-session.md` veraltet, URL-Pluralisierung inkonsistent (`tische` vs `tisch`).

**Partie/Regeln**:
- Spielkern und Sonderspiele vollständig. Sonderspiele (Hochzeit, Armut, 8 Solos) funktionieren exakt nach Spec. TrumpfOrdnung korrekt, KI bewertet Soli (Solo 46/28/30) nach Spec.

**API/Events/KI**:
- Implementiert: KI reagiert auf Domain-Events, 800ms Frontend-Delay, Solo-Schwellen korrekt.
- Fehlt: `KI_ZUG_SEQUENZ` Event (es werden individuelle `KARTE_GESPIELT`-Events gesendet, was aber konsistent mit `ki-strategie.md` ist). `PartieEreignisBatch` für Gap-Detection fehlt.
- Inkonsistent: Architektur-Bruch im Code (`KiEventAdapter` hängt direkt von `tisch`-Entitäten ab). Spec-Status fehlerhaft bzgl. Schweinchen/Hochzeit-Events.

**Frontend**:
- Projekt ist vollständig auf Pure Phaser umgestellt. Die Hybrid-Architektur-Specs sind veraltet.
- Modale, Nameplates, Flash-Text vollständig.
- Minor-Defizit: E2E-Tests nutzen teilweise noch Klicks statt reiner Tastaturbedienung.

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
- [ ] Task 5: Spielprotokoll vollständig — State im AppStore + Overlay-Integration in TischSzene (📋-Button, Scrolling, Cleanup)

---

## P4 — Plan #100 Tasks (parallel laufend)
- [ ] Task 6: FEAT-POINT-LABELS: Backend Punkte-Labels + DTO
- [ ] FEAT-QUICK-PLAY-SYNC: Schnellstart Lade-Status
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
- [ ] **Backend**: Abhängigkeiten im KI-Modul auflösen. `KiEventAdapter`/`Service` dürfen laut `architektur-ddd.md` nicht `tisch` importieren. Umbau auf reine DTOs/IDs im Event.

### FEAT-EVENT-GAP-DETECTION (Task 26)
- [ ] **Backend/Frontend**: Implementierung von `PartieEreignisBatch` für zuverlässigere WebSocket-Synchronisation.

### REFACTOR-E2E-KEYBOARD (Task 27)
- [ ] **E2E**: E2E-Tests auf ausschließliche Nutzung von Tastatur-Shortcuts (gemäß `frontend-tastatursteuerung.md`) umstellen; Mausklicks entfernen.

### DOC-SPEC-UPDATES (Task 28)
- [ ] **Dokumentation**:
  - `spieler-session.md` aktualisieren (Passwort/Login erwähnen).
  - `architektur-domain-events.md` aktualisieren (Schweinchen/Hochzeit sind implementiert, `KI_ZUG_SEQUENZ` klären).
  - `frontend-ui-logik.md` auf Pure Phaser aktualisieren.
  - Verantwortlichkeit für `SPIEL_BEENDET` in Spec klären (Code: `PartieLifecycleService`).

---

## Akzeptanzkriterien

1. **Stabilität**: Alle Tests (Backend & Frontend) grün.
2. **Architektur**: Keine verbotenen Abhängigkeiten (KI -> Tisch).
3. **Spec-Konsistenz**: Code und Specs stimmen überein; abweichende Specs sind aktualisiert.
4. **Sicherheit**: ABAC-Regeln sind aktiv und Gäste können keine privaten Tische betreten.

---

## TODO Liste

**P3 / P4 (Offene Restaufgaben vorheriger Runs):**
- [ ] Task 5: Spielprotokoll vollständig
- [ ] Task 6: FEAT-POINT-LABELS
- [ ] FEAT-QUICK-PLAY-SYNC

**P7 (Neu entdeckt, Plan-Run #111):**
- [x] Task 21: FIX-ABAC-AUTHORIZATION
- [x] Task 22: FIX-TISCH-STATUS-ABBRUCH
- [x] Task 23: FIX-PRIVATE-TISCH-GUESTS
- [x] Task 24: REFACTOR-URL-CONSISTENCY
- [x] Task 25: FIX-KI-ARCHITECTURE-VIOLATION
- [ ] Task 26: FEAT-EVENT-GAP-DETECTION
- [ ] Task 27: REFACTOR-E2E-KEYBOARD
- [ ] Task 28: DOC-SPEC-UPDATES
