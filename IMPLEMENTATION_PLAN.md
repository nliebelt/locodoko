# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-04

## Notiz

**2026-04-04 (Plan-Run #14):**
- **5.2 KI Hochzeit-Partnerstrategie behoben**: `Parteien.ausHochzeit()` trägt nur den Hochzeit-Spieler in `offenFuerAlle` ein — `sichtbareParteiVon(partner)` lieferte `Optional.empty()`, Schmier-Logik griff nicht. Fix: neue Hilfsmethode `istHochzeitPartnerGewinner()` nutzt `hochzeitStatus.partner()` statt Parteisichtbarkeit. 1 neuer Test. Alle 135 Backend-Tests grün.
- **Nächster Schritt**: 6.2 Karten-Spielanimation für andere Spieler — Gegner-Karten erscheinen ohne Animation in der Stichmitte.
- **Offene Fragen**: `springdoc-openapi 2.8.6` nutzt Jackson 2 (kompatibel aber heterogen im Classpath) — ggf. auf SB4-kompatible Version updaten falls Probleme auftreten.

**2026-03-29 (Build-Run #10):**
- **KI-Schwierigkeitsgrade differenziert und vollständig getestet**: 2 neue Tests in `SchwerKiStrategieTest` belegen alle relevanten Threshold-Unterschiede: KONTRA (22 vs 26) und KEINE_90 (32 vs 36), zusätzlich zum bestehenden RE-Test (24 vs 28). Damit sind alle 6 Ansage-Schwellen der SchwerKiStrategie vs StandardKiStrategie vollständig abgedeckt. 134 Tests grün.
- **Nächster Schritt**: Alle Aufgaben erledigt — keine offenen Punkte in IMPLEMENTATION_PLAN.md.
- **Offene Fragen**: `springdoc-openapi 2.8.6` nutzt Jackson 2 (kompatibel aber heterogen im Classpath) — ggf. auf SB4-kompatible Version updaten falls Probleme auftreten.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---


### Priorität 2 — KI-Qualität

- [x] **5.2 KI Hochzeit-Partnerstrategie**: `StandardKiStrategie` und `SchwerKiStrategie` haben keine Logik, den Hochzeit-Partner zu erkennen und zu unterstützen. `KiSpielzustand` trägt bereits `hochzeitStatus`, wird aber in `waehleKarte()` nicht ausgewertet.
  - Anforderung (spec/ki-strategie.md §7/§8): KI erkennt Partner über `hochzeitStatus.partner()` und schmiert in Partner-Stiche.
  - Umsetzung: In `waehleKarte()` prüfen ob Hochzeit aktiv und Partner bekannt → Partner-Stich schmieren (analog zur bestehenden Kontra-Partei-Logik). Neuen Test in `StandardKiStrategieTest` oder separatem `HochzeitKiTest` ergänzen.
  - Dateien: `src/main/java/de/locodoko/partie/ki/StandardKiStrategie.java`, `SchwerKiStrategie.java`, `KiSpielzustand.java`

### Priorität 3 — UX / E2E

- [ ] **5.3 Recovery-Button: Tischname anzeigen**: `SpielverwaltungsSzene.ts` zeigt beim Session-Recovery "Zurück zu Spiel" statt "Zurück zu [Tischname]". Spec fordert den echten Tischnamen.
  - Umsetzung: `SpielerSessionAntwort` enthält `aktiverTischId` — Tischnamen per REST laden (`GET /api/tische/{id}`) und in Button-Text einsetzen, oder Tischname direkt im Session-Snapshot mitliefern.
  - Dateien: `frontend/src/scenes/SpielverwaltungsSzene.ts`, ggf. `SpielerSessionAntwort.java`

- [ ] **5.4 E2E Test: Rundenauswertung**: `specs/e2e-tests.md` fordert `rundenauswertung.spec.ts` — prüft ob nach Spielende Punktestand, Sonderpunkte und Rundendetails korrekt angezeigt werden. Datei fehlt vollständig.
  - Umsetzung: Neuen Playwright-Test erstellen der eine Partie gegen KI bis zum Ende spielt und Rundenauswertungs-Modal auf korrekte Inhalte prüft.
  - Datei: `e2e/rundenauswertung.spec.ts`

---

### Priorität 2 — Frontend UI Bugs

> Spec: `specs/frontend-bugfixes-6x.md`

- [x] **6.1 Karten fehlen beim ersten Start** [KRITISCH]: Beim allerersten Seitenaufruf werden Karten nicht gerendert (Browser-Reload nötig). Race Condition: `renderTisch()` läuft vor Phaser `create()` ist fertig.
  - Fix: AppStore-Listener erst in `create()` registrieren; initialen Zustand per `appStore.snapshot()` in `create()` nachziehen.
  - Datei: `frontend/src/szenen/TischSzene.ts`

- [ ] **6.2 Karten-Spielanimation für andere Spieler fehlt**: Gegner-Karten erscheinen ohne Animation in der Stichmitte. Eigene Karte hat Gleit-Animation, fremde nicht.
  - Fix: Bei `KarteGespielt`-Event fremder Spieler: verdeckte Karte an Fächer-Position erstellen → `animiereKarteAusspielen()` aufrufen → Karte aufdecken (verdeckt→offen).
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

- [ ] **6.3 Stichanimation: Punkte + richtiger Stapel**: (a) Popup zeigt "+1 Stich" statt echte Augenzahl. (b) Karten fliegen nicht zum Stapel des Stichgewinners.
  - Fix: `animiereStichEinziehen()` um `augenzahl`-Parameter erweitern; Zielposition = Stapel-Position des Gewinners.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

- [ ] **6.4 Kartenfächer-Ausrichtung (Nord/Süd gedreht, Ost/West flach)**: Nord/Süd-Fächer sind verdreht; Ost/West-Karten liegen nebeneinander statt als vertikaler Fächer.
  - Fix: `renderKartenFaecher()` — Winkel und Offset für alle 4 Sitzpositionen korrigieren. SUED/NORD: horizontaler Fächer. WEST/OST: vertikaler Fächer (90° Basis).
  - Datei: `frontend/src/szenen/TischSzene.ts`

- [ ] **6.5 Ansagen überdecken Karten (Z-Index)**: Ansage-Banner rendern über Handkarten des eigenen Spielers.
  - Fix: Banner-Depth kleiner als Kartenfächer-Depth, oder Banner-Position in oberes Canvas-Drittel (y < 200px).
  - Dateien: `frontend/src/services/AnimationenService.ts`, `frontend/src/szenen/TischSzene.ts`

- [ ] **6.6 Falsche Alpha für nicht-spielbare Karten**: Nicht-spielbare Karten haben Alpha 0.5 statt Spec-Wert 0.45; Edge-Cases nicht abgedeckt.
  - Fix: Alpha-Wert von `0.5` auf `0.45` korrigieren; Edge-Case wenn kein Spielzug möglich (alle Karten Alpha 1.0).
  - Datei: `frontend/src/szenen/TischSzene.ts` (~Zeile 1245)

- [ ] **6.7 Nameplates: Positionen und Größen überarbeiten**: Positionen weichen von Spec ab; WEST/OST-Nameplates (80×80px) zu klein für Inhalt.
  - Fix: Positionen normieren auf Canvas-Prozente: SUED y=85%, NORD y=15%, WEST x=14%, OST x=86%. WEST/OST-Größe auf 120×54px erhöhen.
  - Datei: `frontend/src/szenen/TischSzene.ts`

- [ ] **6.8 Laufende Ansagen dauerhaft anzeigen**: Welche Ansagen in der Runde gelten ist nicht sichtbar.
  - Fix: Nameplate um Ansage-Badge erweitern: `[RE]` (Gold), `[KONTRA]` (Blau), `[K90]`/`[K60]`/`[S]` (Orange) — aus Backend-Zustand `laufendesSpiel.ansagen`.
  - Datei: `frontend/src/szenen/TischSzene.ts`

---

## 7. Bekannte Probleme & Risiken

### Sicherheit

- ~~**XSS-Risiko im Frontend**~~: Behoben durch `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts`.

---

## 8. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML. Armut- und Vorbehalt-Dialoge bereits migriert.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
