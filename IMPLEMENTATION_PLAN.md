# IMPLEMENTATION_PLAN — Plan-Run #99

> Stand: 2026-04-30. Fokus: Integrations-Lücken & Polishing (Statistiken, Security, UX).
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Notiz

Was wurde implementiert:
- `AppStore.ts`: 800ms KI-Verzögerung in `_verarbeiteEventQueue` implementiert. Bei `KARTE_GESPIELT`-Events eines KI-Spielers (`istKi: true`) und wenn Menschen am Tisch sitzen, wird `kiVerzoegerungMs` (Standard: 800ms) gewartet. `setzeKiKartenVerzögerung(0)` deaktiviert den Delay (für E2E-Tests).
- Spec-Korrektur: Delay ist Frontend-Verantwortung (AppStore), nicht Backend — entgegen dem alten Plan wurde Option B (Frontend) umgesetzt, da `ki-strategie.md` dies klar vorschreibt.
- 2 neue Tests hinzugefügt: Delay greift für KI-Züge, Delay=0 deaktiviert ihn.

Nächster logischer Schritt: **BUG-ANIM-03** — Reload-State Stabilität: `AppStore.ts` und `TischSzene.ts` müssen beim Snapshot-Laden Overlays (Rundenauswertung) initialisieren.

Offene Fragen: Pre-existing TypeScript-Fehler in AppStore.ts Zeile 545 (`_darfPartieStandAktualisieren` mit 3 statt 2 Argumenten) — war schon vor dieser Iteration fehlerhaft.

---

## Zusammenfassung Plan-Run #99

Nach der umfassenden Analyse des IST-Standes gegen die Specs konzentrieren wir uns auf die Schließung technischer Lücken zwischen den Bounded Contexts und die Verfeinerung der UX.
1. **Event-Kette schließen:** Das `SpielBeendet`-Event muss gefeuert werden, damit Statistiken und Profil-Updates funktionieren.
2. **Security-Härtung:** Die `SecurityConfig` wird an die Authentifizierungs-Spec angepasst.
3. **UX-Polishing:** Implementierung der 800ms KI-Verzögerung und Verbesserung der Tastatursteuerung.
4. **Stabilität:** Behebung des Reload-Problems (BUG-ANIM-03).

---

## P1 — Integration & Security

### ~~BUG-STAT-01~~: Event-Kette für Statistiken schließen ✅

**Priorität:** Hoch
**Status:** Erledigt (2026-05-02)
**Problem war:** `PartieErgebnisEintrag` wurde nie gespeichert; `SpielerStatistik` wurde korrekt aktualisiert.
**Fix:** `SpielBeendet` um `partieBeendet` + `kumulativePartiePunkte` erweitert; `SpielerProfilService` speichert jetzt `PartieErgebnisEintrag` am Partie-Ende mit Rotation.

### ~~SEC-REFINEMENT~~: Security-Härtung ✅

**Priorität:** Hoch
**Status:** Erledigt (2026-05-02)
**Fix:** `anyRequest().permitAll()` durch `anyRequest().authenticated()` ersetzt; alle Game-Endpunkte explizit aufgeführt; Sicherheitsmodell dokumentiert (Controller-/Interceptor-Ebene für Game-APIs).

---

## P2 — UX, UX-Logik & Clean Code

### ~~FEAT-AI-DELAY~~: KI-Verzögerung implementieren ✅

**Priorität:** Mittel
**Status:** Erledigt (2026-05-02)
**Fix:** 800ms Delay in `AppStore._verarbeiteEventQueue` implementiert (Option B Frontend, laut `ki-strategie.md`). Bei KI-`KARTE_GESPIELT`-Events mit menschlichen Mitspielern wird `kiVerzoegerungMs` gewartet. `setzeKiKartenVerzögerung(0)` für Tests.

### BUG-ANIM-03: Reload-State Stabilität

**Priorität:** Mittel
**Problem:** Bei einem Browser-Reload gehen Informationen über aktive Overlays oder laufende Animationen verloren, was zu einem inkonsistenten UI-Zustand führen kann.
**Umsetzung:**
1. `AppStore.ts` muss beim Laden des Snapshots prüfen, ob das Spiel in einer Phase ist, die ein Overlay erfordert (z.B. Rundenauswertung).
2. `TischSzene.ts` muss Overlays basierend auf dem geladenen State initialisieren, nicht nur auf Events reagieren.

### REFACTOR-FE-01: TischSzene SRP auflösen (God Object)

**Priorität:** Mittel
**Problem:** `TischSzene.ts` umfasst fast 1500 Zeilen und vermischt Phaser-Rendering, Positionsberechnungen und Fachlogik-Auswertungen (z.B. `ermittleSpielankuendigung`). Das verletzt das Single Responsibility Principle laut `methodik-clean-code.md`.
**Umsetzung (Architektur-Entscheidungen aus Plan-Run #99):**
1. **Dumb Scene, Smart State (Option B):** Extrahiere alle rein fachlichen Selektoren und String-Formatierer aus der Szene. Diese Logik wandert *komplett* in das `TischAnsichtModell` (oder dazugehörige Selektoren). Das View-Modell bereitet die Daten mundgerecht vor (z.B. `spielankuendigungstext: "Anna spielt Damensolo"`), sodass die `TischSzene` nur noch rendert.
2. **Funktionales Layout:** Lagere die Positions- und Layout-Berechnung (z.B. `stichSlotPositionen`, `berechneLayout`, `berechneKartenGroesse`) in zustandslose, reine Utility-Funktionen (`export function...`) in einer neuen Datei (z.B. `layout.ts`) aus. Kein stateful Service.
3. Ziel: `TischSzene` orchestriert nur noch Phaser-Objekte und reagiert dumm auf den injizierten Zustand.

### REFACTOR-FE-02: Magic Strings durch Typensicherheit ersetzen

**Priorität:** Mittel
**Problem:** Im Frontend, insb. in der `TischSzene.ts`, werden fachliche Konstrukte (`'SUED'`, `'RE'`, `'NORMALSPIEL'`, `'KONTRA'`) über 60-mal als "Magic Strings" hardcodiert verwendet. Dies verletzt Abschnitt 2 der `methodik-clean-code.md`.
**Umsetzung:**
1. Nutze die bereits in `SpielverwaltungDto.ts` definierten TypeScript-Unions (`SpielerPosition`, `Partei`, `Spieltyp`).
2. Erstelle zentrale Konstanten/Enums für diese Werte, gegen die anstelle von String-Literalen geprüft wird, um Refactorings und Autovervollständigung sicherzustellen.

---

## P3 — Specs & Polish

### SPEC-SYNC: Veraltete Spezifikationen aktualisieren

**Priorität:** Niedrig
**Umsetzung:**
1. `spieler-session.md`: Abschnitt "keine Benutzerkonten" entfernen/korrigieren.
2. `verbindungsabbruch.md` vs. `spieler-session.md`: Timeout-Verhalten (Löschen vs. KI-Übernahme) vereinheitlichen (KI-Übernahme ist Wahrheit).
3. `frontend-ui-logik.md`: Hybrid-Ansatz (Phaser für Spiel, DOM für Overlays) als offiziellen Standard festschreiben.

### FEAT-KEYBOARD-NAV: Vollständige Tastatursteuerung

**Priorität:** Niedrig
**Umsetzung:**
1. Tab-Fokus-Management in Modalen (Lobby, Tisch-Konfiguration).
2. Visueller Fokus-Indikator für alle interaktiven Elemente.

---

## Erledigte Aufgaben (Referenz aus #98)

- [x] **FEAT-ANIM-GUARD**: AnimationGuard implementiert.
- [x] **TEST-WS-CONTRACT**: STOMP-Integrationstest erfolgreich.
- [x] **TEST-E2E-FULLGAME**: Vision Loop verifiziert (Rundenauswertung existiert).
- [x] **TUNING-KI-SOLO**: Solo-Schwellenwerte angepasst.

---

## Offene Punkte (Übersicht)

| ID | Typ | Kurzbeschreibung | Priorität |
|----|-----|-----------------|-----------|
| BUG-STAT-01 | Bug | Statistiken werden nicht aktualisiert | Hoch | ✅ |
| SEC-REFINEMENT| Security | SecurityConfig zu permissiv | Hoch | ✅ |
| FEAT-AI-DELAY | UX | 800ms Verzögerung für KI-Züge | Mittel |
| BUG-ANIM-03 | Bug | Reload-State Konsistenz | Mittel |
| FEAT-KEYBOARD-NAV | UX | Tab-Fokus in Modalen | Niedrig |
| SPEC-SYNC | Spec | Veraltete Specs bereinigen | Niedrig |
