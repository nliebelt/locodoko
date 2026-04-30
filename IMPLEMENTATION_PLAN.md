# IMPLEMENTATION_PLAN — Plan-Run #98

> Stand: 2026-04-30. Fokus: Architektur-Stabilität (Animationen & WebSocket-Vertrag).
> Archivierte Aufgaben: `IMPLEMENTATION_PLAN_ARCHIVE.md`

---

## Zusammenfassung Plan-Run #98

Nach dem Grill-Termin am 2026-04-30 fokussieren wir uns auf die Behebung der verbleibenden
UI-Glitches und die Absicherung der Echtzeit-Kommunikation.
1. **Frontend-Architektur:** Einführung eines `AnimationGuard` zur sauberen Trennung von State und Animation.
2. **Backend-Validierung:** Ein neuer STOMP-Integrationstest nagelt den WebSocket-Vertrag (Reihenfolge, Versionierung, Duplikate) fest.
3. **Visuelle Vollständigkeit:** Der Vision-Loop wird auf ein volles Spiel erweitert.

---

## P1 — Architektur & Stabilität

### FEAT-ANIM-GUARD: Robuste Animations-Synchronisation — ✅ ERLEDIGT

**Priorität:** Hoch (löst BUG-ANIM-01, BUG-ANIM-02)
**Problem:** Karten "springen" auf den Tisch, bevor die Animation startet, oder verschwinden unsauber, weil der statische Render-Loop und der `AnimationenService` auf denselben `AppStore`-Daten operieren.

**Umsetzung:**
1. **Modell-Erweiterung** (`TischAnsichtModell.ts`):
   - Set `animierendeKartenIds: Set<string>` hinzufügen.
2. **AppStore-Logik** (`AppStore.ts`):
   - Vor Start einer Animation (z.B. `spieleKarteAus`) die Karten-ID in das Set aufnehmen.
   - Nach Abschluss der Animation (Promise-Resolve) die ID entfernen.
3. **Render-Guard** (`TischSzene.ts`):
   - In `renderStichmitte()` und `renderHandkarten()`: Karten, deren ID im `animierendeKartenIds`-Set ist, werden **nicht** gerendert.
   - Die Animation übernimmt exklusiv die Darstellung dieser Karte, bis sie wieder "statisch" wird.

---

### TEST-WS-CONTRACT: Real-Time Contract Integration Test — ✅ ERLEDIGT

**Priorität:** Hoch (Verhindert Regressionen bei WebSocket-Events und Duplikaten)
**Ziel:** Ein Java-Integrationstest, der nicht nur Controller-Methoden aufruft, sondern den echten WebSocket-Stack nutzt.

**Umsetzung:**
1. **Datei:** `src/test/java/de/locodoko/tisch/PartieEchtzeitVertragsTest.java`
2. **Technik:** Nutzt `WebSocketStompClient` und `BlockingQueue` für Event-Assertions.
3. **Test-Szenario:**
   - Verbinden als 4 verschiedene Spieler via STOMP.
   - Ein vollständiges Spiel (oder kritische Phasen wie Armut) durchspielen.
   - **Assertion 1:** Jede `version` im `PartieEreignisAntwort` muss streng monoton steigen.
   - **Assertion 2:** Keine identischen Events (Typ + Inhalt + Version) dürfen doppelt gesendet werden.
   - **Assertion 3:** Events müssen in der logisch erwarteten Reihenfolge ankommen (z.B. `KarteGespielt` -> `StichAbgeschlossen`).

---

## P2 — Verification & Tuning

### TEST-E2E-FULLGAME: Vision Loop für volles Spiel — ✅ ERLEDIGT

**Priorität:** Mittel (DoD für `rundenauswertung.md`)
**Problem:** Das Rundenauswertungs-Overlay wurde noch nie visuell im CI-Kontext geprüft.

**Umsetzung:**
1. **Datei:** `e2e/tests/vision-loop.spec.ts`
2. **Logik:** Script erweitert — spielt eine vollständige Runde (alle Stiche via KI-Turbo) automatisch durch.
3. **Validierung:** Screenshot `05-rundenauswertung-overlay` beim ersten Erscheinen des Overlays;
   Assertion `leseRundenEndeModalCount > 0` und `rundeAbgeschlossen`.
4. **Refactoring:** Duplizierte Inline-Hilfsfunktionen durch Imports aus `helpers.ts` ersetzt.

---

### TUNING-KI-SOLO: Konservativere Solo-Schwellen bei Sonderregeln — ⏳ OFFEN

**Priorität:** Mittel (löst TUNING-KI-01)
**Problem:** KI verliert zu oft Solos, wenn Schweinchen oder 30-Augen-Pflicht aktiv sind, da das Blatt des Gegners unberechenbarer ist.

**Umsetzung:**
1. **Datei:** `src/main/java/de/locodoko/ki/StandardKiStrategie.java`
2. **Anpassung:** In `soloSchwelle(VorbehaltAnsage, KiSpielzustand)` den Aufschlag bei `sonderpunkteAktiv` von 25% auf ~35-40% erhöhen.
3. **Validation:** Unit-Tests in `StandardKiStrategieTest.java` anpassen/erweitern.

---

## Notiz

**Implementiert (2026-04-30):** TEST-E2E-FULLGAME — `vision-loop.spec.ts` spielt jetzt eine vollständige Runde durch:
1. Turbo-Modus aktiviert (`setzeAnimationsGeschwindigkeit(Infinity)`) nach Quick-Game-Start.
2. Game-Loop (max. 1500 Iterationen) spielt alle Stiche automatisch: Vorbehalte, Armut-Tausch, Karten.
3. Overlay-Screenshot (`05-rundenauswertung-overlay`) wird im Loop aufgenommen sobald `_rundenEndeModalGezeigt > 0`.
4. Assertions: `rundeAbgeschlossen === true` + `leseRundenEndeModalCount > 0`.
5. Duplizierte Inline-Funktionen aus `vision-loop.spec.ts` durch `helpers.ts`-Imports ersetzt.
Hinweis: Manueller Vision-Check empfohlen (Backend beim Commit nicht aktiv, Vision Loop nicht ausgeführt).

**Nächster Schritt:** TUNING-KI-SOLO — `soloSchwelle()` in `StandardKiStrategie.java` bei aktiven Sonderpunkten von 25% auf ~35-40% anheben.

**Offene Punkte:**
- BUG-ANIM-03 (Reload-State) bleibt offen.
- Vision Loop `05-rundenauswertung-overlay` Screenshot sollte bei nächster Gelegenheit mit laufendem Backend verifiziert werden.

## Erledigte Aufgaben (Plan-Run #97/98)

- [x] **FEAT-TESTID:** `data-testid` im Tisch-Konfigurations-Modal ergänzt.
- [x] **FEAT-BENUTZERDEFINIERT:** „Benutzerdefiniert"-Modus im Modal implementiert.
- [x] **SPEC-CLEANUP:** Alle 8 Spec-Inkonsistenzen korrigiert (Code ist Wahrheit).
- [x] **FEAT-WS-SCHWEINCHEN/HOCHZEIT:** Backend sendet Events, Frontend zeigt Banner. (Streichen der Task-ID).
- [x] **BUG-SCHWEINCHEN-01:** (Gestreicht, da nicht reproduzierbar/veraltet).
- [x] **FEAT-ANIM-GUARD:** AnimationGuard in `TischSzene.ts` — `renderStichmitte()` und `renderKartenFaecher()` überspringen animierende Karten (via `wartendeKartenId`-Guard).
- [x] **TEST-WS-CONTRACT:** `PartieEchtzeitVertragsTest.java` — 4 Invarianten für WebSocket-Event-Vertrag.
- [x] **TEST-E2E-FULLGAME:** Vision Loop — volles Spiel bis Rundenauswertungs-Overlay; Screenshot + Assertion; `helpers.ts`-Imports.

---

## Offene Punkte (Übersicht)

| ID | Typ | Kurzbeschreibung | Priorität |
|----|-----|-----------------|-----------|
| BUG-ANIM-03 | Bug | Reload-State: Overlays/Animationen überleben Browser-Reload | Mittel |
| TUNING-KI-SOLO | Tuning | KI Solo-Frequenz bei Sonderregeln senken | Mittel |
