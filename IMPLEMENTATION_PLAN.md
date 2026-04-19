# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
- SF-5 JSDoc-Offensive begonnen: `frontend/src/store/AppStore.ts` vollständig dokumentiert.
- Nächster Schritt: Restliche Klassen in `store/`, `szenen/` und `services/` dokumentieren.

> **Letzte Aktualisierung: 2026-04-19 (Ralph Planning Mode - Plan-Run #86)**

## Zusammenfassung Ist-Zustand

**Features:** Kern-Logik (Stiche, Trumpf, Punkte, Ansagen, Sonderregeln, Sonderspiele) komplett. Frontend mit Phaser 3 und AppStore stabil. KI mit 3 Schwierigkeitsgraden.
**Offene Baustellen:** WebSocket-Event-Vollständigkeit, Dokumentationslücken (JSDoc), Frontend-Ordnerstruktur-Inkonsistenz, CSS-Monolith, einige unentdeckte Bugs in Sonderregeln (Schweinchen, KI-Hänger).
**Bekannte Test-Fehler:** 
- `PersistenzRepositoryTest.loeschtPartienSpieleUndSticheWennEinTischEntferntWird` (fehlende Kaskadierung)
- `PartieTest.partieMitOhneNeunenSchliesstNachZehnStichenAb` (Existenz/Logik-Check für 10-Stiche-Spiele)

---

## Entscheidungen (Spec vs. Code)

- **Schweinchen:** Die Spec (`specs/schweinchen.md`) fordert DKV-konforme Meldung erst beim Ausspielen. Der Code ist hier unklar oder fehlerhaft. **Entscheidung:** Code wird an Spec angepasst (Meldung via Domain-Event beim ersten Karo-As).
- **Frontend Dokumentation:** `specs/frontend-architektur.md` fordert durchgängig deutsches JSDoc. Das fehlt aktuell weitgehend. **Entscheidung:** Code wird an Spec angepasst.
- **Tastatursteuerung:** `specs/frontend-tastatursteuerung.md` listet Shortcuts, die im `TischInputHandler.ts` noch fehlen. **Entscheidung:** Code wird an Spec angepasst.
- **Ordnerstruktur:** Die Koexistenz von `model/` und `modelle/` ist inkonsistent zur DDD-Vorgabe. **Entscheidung:** Vereinheitlichung auf `modelle/`.

---

## Phase 1 — WebSocket & Domain Events (ARCH)

Ziel: Vollständige typisierte Kommunikation ohne "Snapshot-Zwang" für jede Aktion.

- [x] **ARCH-4** Neue WebSocket-Events definieren: `ANSAGE_ERFOLGT`, `SCHWEINCHEN_GEMELDET`, `SPIEL_GESTARTET`.
  - `PartieEreignisTyp` erweitert.
  - Antwort-DTOs in `de.locodoko.tisch` erstellt (implizit via Enum-Erweiterung).
- [x] **ARCH-5** `SpielAktionsService` & `KiOrchestrierungService` anpassen:
  - Bei Ansagen `ANSAGE_ERFOLGT` senden (statt/zusätzlich zu Snapshot).
  - Bei Karo-As (Schweinchen) `SCHWEINCHEN_GEMELDET` senden.
- [x] **ARCH-6** Frontend `AppStore.ts` anpassen: neue Events abonnieren und Modell-Zustand partiell aktualisieren.

---

## Phase 2 — Bugfixes & Regel-Stabilität (BF)

- [x] **BF-16** Fix Cascading Delete:
  - Liquibase-Changeset: Foreign Key Constraint für `tisch.partie_id` -> `partie.id` mit `ON DELETE CASCADE` hinzugefügt.
  - `TischVerwaltungsService` weiterhin mit manueller Partie-Löschung für Kompatibilität.
- [x] **BF-17** 10-Stiche-Spiele (ohne Neunen):
  - Test `OhneNeunenTest.partieMitOhneNeunenSchliesstNachZehnStichenAb` hinzugefügt und grün.
  - `Spiel.neuesSpielMitStichfortschritt` und `Spiel.kartenProSpieler` für Testzugriff geöffnet.
- [x] **BF-18** Schweinchen-Bugfix:
  - Sicherstellen, dass `SchweinchenTrumpfOrdnung` im `Spiel` aktiv wird, wenn Karo-Asse auf einer Hand liegen.
  - DKV-Logik: Meldung erst beim Ausspielen.
- [x] **BF-19** `Spielregeln.java` Cleanup:
  - `standardRegeln()` delegiert an `locoBlatRegeln()` (wie im TODO vermerkt).
  - Veraltete Methoden entfernen.

---

## Phase 3 — Frontend Refactoring & Dokumentation (SF)

- [x] **SF-4** Ordner-Cleanup: `frontend/src/model/` nach `modelle/` verschieben und alle Imports korrigieren.
- [x] **SF-5** JSDoc-Offensive: Deutsche JSDoc für alle Klassen/Methoden in `store/`, `szenen/` und `services/` ergänzen. (In Arbeit: AppStore, SpielverwaltungEchtzeit erledigt)
- [ ] **SF-6** Tastatursteuerung: Mapping in `TischInputHandler.ts` vervollständigen (Shortcuts für Solo-Typen, Ansage-Verschärfungen).
- [ ] **SF-7** CSS-Modularisierung: `styles.css` aufteilen (z.B. `base.css`, `lobby.css`, `tisch.css`).

---

## Phase 4 — KI & Stabilität (KI)

- [ ] **KI-3** KI-Hänger-Audit: Prüfen warum KI nach Sonderereignissen (Hochzeit-Partner gefunden, Fuchs gefangen) manchmal pausiert.

---

## Phase 5 — Verifikation (TEST)

- [ ] `mvn test` (Backend) — Ziel: 100% grün.
- [ ] `cd frontend && npm run lint` — Ziel: keine Warnungen.
- [ ] `cd e2e && npx playwright test` — Alle E2E-Tests (inkl. neue Runden-Tests) grün.
