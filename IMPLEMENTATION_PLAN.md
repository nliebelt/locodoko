# IMPLEMENTATION_PLAN — Plan-Run #99

> Stand: 2026-04-30. Fokus: Integrations-Lücken & Polishing (Statistiken, Security, UX).
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Notiz

Was wurde implementiert:
- **FEAT-KEYBOARD-NAV** — Keyboard-Navigation für Lobby-Modal vollständig:
  - `SpielverwaltungsSzene.ts`: `zeigeErstelleTischModal()` erhält Auto-Fokus (erstes Element), Tab-Trap, Escape-Handler, Focus-Return zum auslösenden Element.
  - ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` auf `.ui-modal`.
  - `accessibility.css`: Expliziter `:focus-visible`-Stil für `input[type="checkbox"]` und `input[type="radio"]` (gold outline + glow).

Nächster logischer Schritt: Alle offenen Aufgaben erledigt. Plan-Run #99 abgeschlossen.

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

### ~~SPEC-SYNC~~: Veraltete Spezifikationen aktualisieren ✅

**Priorität:** Niedrig
**Status:** Erledigt (2026-05-02)
**Fix:** `spieler-session.md`: „keine Benutzerkonten"-Aussage entfernt, Anforderung 9 (KI-Übernahme statt Entfernen) korrigiert, technischer Hinweis auf Spring-Security aktualisiert. `verbindungsabbruch.md`: BUG-ANIM-03-Referenz entfernt (behoben). `frontend-ui-logik.md`: Widerspruch in Technische Hinweise behoben — Meta-UI-Elemente sind DOM-basiert (TischUIManager), Hybrid-Ansatz offiziell festgeschrieben. Alle drei Specs Status → Stabil.

### ~~FEAT-KEYBOARD-NAV~~: Vollständige Tastatursteuerung ✅

**Priorität:** Niedrig
**Status:** Erledigt (2026-05-02)
**Fix:** `SpielverwaltungsSzene.zeigeErstelleTischModal()`: Auto-Fokus auf erstes Element, Tab-Trap, Escape-Handler, Focus-Return zum Auslöser. ARIA-Attribute (`role="dialog"`, `aria-modal`, `aria-labelledby`). `accessibility.css`: Expliziter `:focus-visible` für Checkbox und Radio.

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
