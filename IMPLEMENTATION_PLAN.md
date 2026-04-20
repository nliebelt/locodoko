# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
- [Status: STAB-1 Teilweise abgeschlossen]
- Stand: 2026-04-20
- Implementiert: DreissigAugenPflichtTest repariert. HochzeitTest zeigt IndexOutOfBounds, da Test-Setup restkarten nicht korrekt befüllt.
- Nächster Schritt: STAB-1 abschliessen (HochzeitTest fixen).

## Zusammenfassung Ist-Zustand
- Backend: DDD-Struktur teilweise umgesetzt (tisch/, spieler/ vorhanden), aber noch Vermischungen mit alten Strukturen.
- Partie/Regeln: Kernlogik stabil, aber Sonderspiel-Integration (Schweinchen, Hochzeit) noch teils manuell.
- Frontend: Phaser 3 weit fortgeschritten, aber UI-Architektur benötigt noch Aufräumarbeiten (HTML->Phaser Migration).
- KI: KI-Modul benötigt Migration in top-level `ki/` Paket.
- Kritisch: Test-Suite massiv instabil (118 Errors/11 Failures).

## Phase 1 — Stabilität & Test-Fixes (STAB)
- [x] **STAB-1** Test-Suite Stabilisierung: `HochzeitTest` (NoSuchElementException fixen) und `DreissigAugenPflichtTest` repariert.
- [ ] **STAB-1** (Fortsetzung) HochzeitTest: Ursache für leere `restkarten` im Test-Setup identifizieren.
- [ ] **STAB-2** Test-Suite Stabilisierung: `AnsagenTest` und `BockrundenTest` Assertions korrigieren.
- [ ] **STAB-3** Integrationstests: `VerbindungsabbruchServiceTest` und `WebSocketPublikationIntegrationTest` (ApplicationContext-Fehler) beheben.

## Phase 2 — DDD & Architektur (ARCH)
- [ ] **ARCH-1** Refactoring: `lobby/` und `session/` nach `tisch/` bzw. `spieler/` migrieren.
- [ ] **ARCH-2** Konsistenzprüfung: Bounded Contexts gegen `specs/architektur-ddd.md` abgleichen und Datenbank-Relationen `TischSpieler` auf Aggregate-Roots umstellen.
- [ ] **ARCH-3** KI-Modul: Migration von `partie/ki/` nach Top-Level `ki/`.

## Phase 3 — Regel-Feinheiten & Sonderregeln (REGELN)
- [ ] **REGELN-1** Schweinchen-Logik: WebSocket-Broadcast für `SCHWEINCHEN_GEMELDET` Event vervollständigen.
- [ ] **REGELN-2** KI-Hänger: Ursachenforschung für Hänger bei Sonderpunkten im `KiOrchestrierungService` und Fix.
- [ ] **REGELN-3** 10-Stiche-Regel: "Ohne Neunen" Factory-Methoden und dediziertes Preset im Regelkatalog implementieren.

## Phase 4 — Frontend UI-Migration (UI-NATIVE)
- [ ] **UI-NATIVE-1** HTML-Hybrid-Rückbau: Seitenlade und Einstellungsmenüs vollständig auf Phaser-Container umstellen.
- [ ] **UI-NATIVE-2** Preset-Auswahl: "Ohne Neunen" Option in Tisch-Konfiguration (Phaser) hinzufügen.
- [ ] **UI-NATIVE-3** Native UI-Tests: Vision Loop für alle Overlays etablieren.
