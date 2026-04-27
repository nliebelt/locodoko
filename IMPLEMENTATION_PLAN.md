# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-27 (FEAT-5 abgeschlossen)

**Was wurde implementiert:** FEAT-5 — alle fehlenden `data-testid`-Attribute ergänzt:
- `rundenauswertung-overlay` auf `rundenEndeModal` (TischUIManager.ts)
- `einstellungen-modal` Marker (TischUIManager.ts)
- `btn-session-recovery` + `btn-offene-tische` Marker (SpielverwaltungsSzene.ts)
- `rundenauswertung-spieltyp` + `rundenauswertung-punktemultiplikator` DOM-Elemente im Modal (TischSzene.ts)

**Nächster Schritt:** FEAT-6/7/8 — Detail-Marker (`btn-vorbehalt-{typ}`, `btn-armut-{aktion}`, `btn-ansage-{typ}`) in den teilimplementierten Overlays setzen.
Danach: FEAT-9 (Tisch-Konfigurations-Modal) oder TEST-1 (Backend Unit-Test Dulle-Verhalten im Herzsolo).

**Offene Fragen:** `btn-offene-tische` und `tisch-config-modal`/`input-tischname`/`btn-tisch-erstellen` sind noch FEAT-9/10-Scope (Elemente existieren noch nicht).

## Legende
- [x] Erledigt
- [~] Teilweise
- [ ] Offen
- [BLOCKED: <Grund>] Blockiert

---

## Phase 1.8 — Architektur-Bereinigung (ARCH-REF)
Ziel: Vollendung der "Unified Architecture" — sauberer Event-Fluss, identitätsbasiertes Rendering und sichere DTOs.

- [x] ARCH-REF-1 (Backend): Löschung der `SpielRegistry.java`.
- [x] ARCH-REF-2 (Domain): `@Version` in `Partie.java`.
- [x] ARCH-REF-3 (Service): Refactoring `SpielAktionsService.java`.
- [x] ARCH-REF-4 (Events): AFTER_COMMIT-Garantie.

- [x] ARCH-REF-5 (Events & Sync): Umstellung auf hybrides Sync-Modell.
  - Backend: Entfernung von `KI_ZUG_SEQUENZ`. Ergänzung von `spielerPosition` und `karteId` in `KARTE_GESPIELT`.
  - Backend: Explizites `SPIEL_GESTARTET` Event nach dem Mischen/Austeilen (inkl. Geber-Rotation).
  - Backend: Implementierung `AKTION_ABGELEHNT` Event für feingranulares Fehler-Feedback.
  - Backend: `LetztesSpielergebnisAntwort` um `punkteAufschluesselung` (Point Provenance) ergänzen.
  - Frontend: `AppStore` implementiert eine serielle Queue, die erst animiert (Hints) und dann den State patcht (Snapshots).
  - Validation: `mvn test` + `cd frontend && npm test` + E2E Suite.

- [x] ARCH-REF-6 (Core & UI): Lifecycle-Verschiebung und Sprite-Persistence.
  - Backend: `PartieLifecycleService` extrahiert aus `KiOrchestrierungService` (lifecycle-Logik spieler-agnostisch).
  - Backend: DTO-Filterung verifiziert und durch Test in `PartieStandAntwortTest` abgedeckt.
  - Frontend: `TischSzene.renderTisch()` auf identitätsbasierte Reconciliation umgestellt (persistent eigene Karten, depth-based Z-order).
  - Validation: `mvn test` (278/278) + `cd frontend && npm test` (54/54) + Build/Lint grün.

- [x] ARCH-REF-7 (Frontend Config): Konfigurierbare Timeouts.
  - Frontend: Einführung einer `UiKonfiguration` im Store.
  - Frontend: `kiVerzoegerungMs` aus der Konfiguration lesen statt Hardcoding (800ms Default).
  - Frontend: JS-Bridge um Methode zum Ändern der Verzögerung erweitern (für E2E).
  - Validation: `cd frontend && npm test` (54/54) + Build grün.

---

## Phase 2 — Spielfeatures & Frontend-UI (FEAT)
Voraussetzung: ARCH-REF-5 und ARCH-REF-6 sind abgeschlossen.

- [x] FEAT-5 (Frontend): Fehlende `data-testid`-Attribute gemäß `specs/e2e-tests.md`.
- [~] FEAT-6 (Frontend): Vorbehalt-Auswahl-Overlay (Detail-Marker `btn-vorbehalt-{typ}` fehlen).
- [~] FEAT-7 (Frontend): Armut-Dialog (Detail-Marker `btn-armut-{aktion}` fehlen).
- [~] FEAT-8 (Frontend): Floating Action Bar (Detail-Marker `btn-ansage-{typ}` fehlen).
- [ ] FEAT-9 (Frontend): Tisch-Konfigurations-Modal im Startscreen (HTML-Overlay).
- [ ] FEAT-10 (Frontend): Offene-Tische-Liste mit 5-Sekunden-Polling im Startscreen.

---

## Phase 3 — Spezifikations-Updates & Cleanup (SPEC)

- [ ] SPEC-1: `specs/schweinchen.md`: Event `SchweinchenGemeldet` Dokumentation.
- [ ] SPEC-2: `specs/spielablauf.md`: Phasen-Namen-Abgleich (`AUSWERTUNG` etc.).
- [x] SPEC-5: `specs/e2e-tests.md`: Quiescence Pattern Dokumentation. (Wurde in architektur-unified.md und architektur-domain-events.md bereits detailliert).

---

## Phase 4 — Test-Coverage (TEST)

- [ ] TEST-1 (Backend): Unit-Test für Dulle-Verhalten im Herzsolo (`VariableTrumpfsoloTrumpfOrdnung`).
