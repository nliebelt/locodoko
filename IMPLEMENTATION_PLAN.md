# IMPLEMENTATION_PLAN — Plan-Run #99

> Stand: 2026-04-30. Fokus: Integrations-Lücken & Polishing (Statistiken, Security, UX).
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Notiz

Was wurde implementiert:
- **REFACTOR-FE-02** — Magic Strings durch typsichere Konstanten ersetzt:
  - `SpielverwaltungDto.ts`: Neue Konstanten `SPIELER_POSITION`, `PARTEI`, `SPIELTYP` mit `as const satisfies Record<...>`.
  - `TischAnsichtModell.ts`: Konstanten importiert und re-exportiert; alle 12 String-Literale (Vergleiche, Fallbacks, Arrays) ersetzt.
  - `TischSzene.ts`: ~20 Vergleiche (`=== 'SUED'`, `=== 'RE'` etc.) auf Konstanten umgestellt.
  - `TischInputHandler.ts`: 8 Vergleiche und API-Aufrufe ersetzt.
  - `AnimationenService.ts`: `siegerPartei`-Feld in `RundenauswertungDaten` auf `Partei`-Typ geändert.
  - `layout.ts`: `case`-Literale in switch-Statements ersetzt.

Nächster logischer Schritt: **SPEC-SYNC** — Veraltete Specs bereinigen (spieler-session.md, verbindungsabbruch.md, frontend-ui-logik.md). Oder **FEAT-KEYBOARD-NAV** für Tastatursteuerung in Modalen.

Offene Fragen: Pre-existing TypeScript-Fehler in AppStore.ts Zeile 545 und TischSzene.test.ts Zeile 190 — unverändert vorhanden, nicht durch diese Iteration verursacht.

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

### ~~BUG-ANIM-03~~: Reload-State Stabilität ✅

**Priorität:** Mittel
**Status:** Erledigt (2026-05-02)
**Fix:** `TischSzene.ts`: Neues Flag `_zeigeOverlayNachSnapshot`. Im SNAPSHOT-Event-Handler wird `laufendesSpiel===null && letztesSpielergebnis!==null` erkannt. Das Overlay (Rundenauswertung oder PartieEnde) wird im Store-Abonnement erst gezeigt, wenn `aktuellerTisch` und das vollständige Modell verfügbar sind.

### ~~REFACTOR-FE-01~~: TischSzene SRP auflösen (God Object) ✅

**Priorität:** Mittel
**Status:** Erledigt (2026-05-02)
**Fix:** Neue `layout.ts` mit allen Layout-/Positions-Funktionen. `tischFormatierer.ts` um `formatiereCountdownText` und `formatiereEreignisSonderpunktFeedback` erweitert. `spielankuendigungstext` ins `TischAnsichtModell` verschoben. TischSzene auf ~1375 Zeilen reduziert.

### ~~REFACTOR-FE-02~~: Magic Strings durch Typensicherheit ersetzen ✅

**Priorität:** Mittel
**Status:** Erledigt (2026-05-02)
**Fix:** `SPIELER_POSITION`, `PARTEI`, `SPIELTYP` Konstanten in `SpielverwaltungDto.ts` angelegt (`as const satisfies`). In `TischAnsichtModell.ts` re-exportiert. Alle ~40 String-Literal-Vergleiche und Fallbacks in TischSzene, TischInputHandler, AnimationenService, layout.ts ersetzt. 94/94 Tests grün.

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
| BUG-ANIM-03 | Bug | Reload-State Konsistenz | Mittel | ✅ |
| FEAT-KEYBOARD-NAV | UX | Tab-Fokus in Modalen | Niedrig |
| SPEC-SYNC | Spec | Veraltete Specs bereinigen | Niedrig |
