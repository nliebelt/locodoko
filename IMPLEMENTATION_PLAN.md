# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-05 (Plan-Run #23)

## Notiz

**2026-04-05 (Plan-Run #24):** 7.3 Punkte-Einzelschritte vollständig implementiert. `Spielergebnis.java` um 4 Felder erweitert (grundwert, absagePunkte, gegenDieAltenPunkte, soloMultiplikator). `PunkteRechner` berechnet und persistiert Einzelschritte. Liquibase-Migration 003 ergänzt nullable INT-Spalten. `LetztesSpielergebnisAntwort` gibt Aufschlüsselung zurück. Frontend zeigt Punkte-Berechnung-Block im Overlay. 141 Backend + 62 Frontend-Tests grün. Nächste offene Aufgaben: 8.2 (data-testid Attribute), 8.3 (appStore-Hack ersetzen), 8.4 (Sonderpunkte Täter-Opfer), 8.5 ("Du bist dran" entfernen), 8.6 (Phaser vs HTML Design-Entscheidung), 8.7 (SchwerKiStrategie Hochzeit-Test). Empfehlung: 8.5 als nächstes (1-Zeilen-Fix, sehr geringes Risiko).

**2026-04-05 (Plan-Run #23):** Subagenten-Analyse aller 5 Bounded Contexts. Ergebnisse:
- Lobby/Tisch: Vollständig. Alle Endpunkte inkl. `GET /api/tische/{id}` implementiert. Keine Lücken.
- Partie/Regeln: **Gap bestätigt** — `Spielergebnis.java` speichert nur Gesamtspielwert, keine Aufschlüsselung (Grundwert, Absage-Punkte, Gegen-die-Alten, Solo-Multiplikator). `PunkteRechner` berechnet Einzelschritte intern, aber speichert sie nicht. `LetztesSpielergebnisAntwort` (PartieStandAntwort.java:326-373) gibt nur aggregierte Werte zurück. Spec (punkteberechnung.md:86-89) fordert Aufschlüsselung. → Neuer Eintrag 7.3.
- Session/API: E2E-Tests nutzen `window.__locodoko.appStore.spieleKarte()` (alle 3 Testdateien) — Spec e2e-tests.md:20 fordert explizit "Kein appStore-Hack, stattdessen Tastatur". 16 `data-testid`-Attribute fehlen komplett im Frontend-Source (0 Treffer in frontend/src/). `rundenauswertung.spec.ts:75` sucht `/Quick Game/i`-Button der nicht in Spec/Frontend existiert (Test-Bug). → Neue Einträge 8.2, 8.3.
- Frontend: 7.2 unvollständig (Punkte-Einzelschritte fehlen, bestätigt durch Backend-Gap). `formatiereSonderpunkt()` zeigt keine Täter-Opfer-Info ("Fuchs gefangen" statt "Fuchs gefangen (X fängt Y Fuchs)"). Seitenlade und Einstellungs-Modal als HTML-DOM implementiert — CLAUDE.md sagt "Meta-UI bleibt HTML", frontend-ui-logik.md fordert Phaser-Migration; dieser Widerspruch wird als Design-Entscheidungs-Eintrag dokumentiert. `TischAnsichtModell.ts:654` enthält noch "Du bist dran"-Text, den spec-ui-logik.md:19 ersatzlos streichen will. → Neue Einträge 8.4, 8.5, 8.6.
- Sonderspiele/KI: 95% vollständig. Alle Kern-Features implementiert. `SchwerKiStrategieTest.java` hat keinen Hochzeit-Szenario-Test (Code funktioniert via Vererbung von StandardKiStrategie). → Neuer Eintrag 8.7.

**2026-04-05 (Plan-Run #22):** 1.1 Vision Loop (headless), 6.7 Nameplates, 6.8 Ansage-Badges, 5.5 KI-Hochzeit-Vorbehalt, 5.6 GET /api/tische/{id}, 5.3 Recovery-Button, 5.7 Hochzeit-Partner-Anzeige, 7.1 Tastatursteuerung (verifiziert — war bereits vollständig implementiert), 7.2 Rundenauswertung-Overlay (spec-konform mit Parteien-Übersicht, Gesamtstand, kein Escape), 5.4 E2E-Test Rundenauswertung. 6.7: Positionen auf Spec-Prozente normiert, WEST/OST 80px→120px. 6.8: [K90]/[K60]/[K30]/[S] Badges in Orange aus ansageHistorie. 5.5: Code bereits korrekt (Hochzeit nach Solo-Threshold), 3 Tests ergänzt (meldetHochzeitBeiZweiKreuzDamen, meldetKeinHochzeitBeiSehrStarkerTrumpfhand, Bestätigung Solo-Priorität). 134 Backend-Tests grün, 62 Frontend-Tests grün. ALLE offenen Aufgaben erledigt. Nächster Plan-Run: Subagenten-Analyse auf neue Gaps prüfen — besonders Punkte-Berechnung (Einzelschritte) für 7.2 (benötigt Backend-Erweiterung von LetztesSpielergebnisAntwort).

**2026-04-04 (Plan-Run #21):** Subagenten-Analyse aller 5 Bounded Contexts. Ergebnisse:
- Lobby/Tisch: Vollständig implementiert. `GET /api/tische/{id}` fehlt weiterhin (Blocker 5.6 gültig). Mutability von `TischkonfigurationEmbeddable` ist Style-Abweichung, kein Funktionsproblem — kein Plan-Eintrag nötig.
- Partie/Regeln: Vollständig. Alle Specs (spielablauf, stichlogik, trumpf, karten, punkte, ansagen, sonderpunkte) grün.
- Session/API: `rundenauswertung.spec.ts` fehlt weiterhin (5.4). Dedizierter `GET /api/partien/{id}/stand`-Endpunkt fehlt — Minor Gap, da Stand via WebSocket `/app/partie/{id}/snapshot` abrufbar. Kein Blocker.
- Frontend: 6.7 per Code-Check bestätigt noch nicht implementiert (Nameplate-Werte weichen von Spec ab). 6.8 (Ansage-Badges) ebenfalls nicht implementiert. Neue Specs entdeckt: `frontend-tastatursteuerung.md` (→ 7.1) und `frontend-rundenauswertung.md` (→ 7.2) komplett ohne Implementierung. 7.2 ist Voraussetzung für 5.4. Seitenlade `[≡]` und Einstellungs-Modal `[⚙]` ebenfalls nicht implementiert (Teil von 7.1 Tastatur-Spezifikation).
- Sonderspiele/KI: Vollständig. StandardKiStrategie.java Z.309 hat veralteten Kommentar "Schwelle: 34" (Code korrekt: 46) — trivial, kein Plan-Eintrag.

**2026-04-04 (Plan-Run #20):** 6.6 Alpha-Fix implementiert: nicht-spielbare Karten haben jetzt Alpha 0.45 (war 0.5). Edge-Case korrekt: wenn keine Interaktion möglich (hatInteraktion=false), alle Karten Alpha 1.0 — bereits durch bestehende Logik abgedeckt. 62 Frontend-Tests grün. Vision Loop nicht ausführbar (kein Display). Manueller Vision-Check empfohlen. Nächster Schritt: 6.7 Nameplates (Positionen auf Canvas-Prozente normieren, WEST/OST-Breite 80px → 120px).

**2026-04-04 (Plan-Run #18):** Subagenten-Analyse aller 5 Bounded Contexts. Mehrere neue Lücken gefunden. 5.2 bleibt [x] (Stichphase korrekt), aber `waehleVorbehalt()` fehlt → neuer Eintrag 5.5. 5.3 geblockt durch fehlendes `GET /api/tische/{id}` → Blocker-Task 5.6. Frontend-Hochzeit-Dialog komplett fehlend → 5.7. 6.5–6.8 alle offen, bestätigt mit konkreten Zeilen. Nächster Schritt: 6.5 Ansagen Z-Index, dann 6.6 Alpha-Fix. Offene Frage: `StandardKiStrategie.java:343` Kommentar veraltet (soloSchwelle ist 46, nicht 34).

**2026-04-04 (Plan-Run #17):** 6.4 Kartenfächer-Variation für WEST/OST implementiert. Alle 62 Frontend-Tests grün.

**2026-03-29 (Build-Run #10):** KI-Schwierigkeitsgrade differenziert und vollständig getestet. 134 Tests grün.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

### Priorität 1 — E2E Visueller Baseline-Check

- [x] **1.1 Vision Loop: Baseline-Screenshots erstellen und prüfen** [VOR allen anderen Aufgaben]: Der Vision Loop muss zuverlässig durchlaufen und alle UI-Zustände korrekt screenshotten. Er dient als visuelle Baseline vor und nach jedem UI-Fix (6.7–7.2).
  - Umsetzung:
    1. Backend starten falls nicht läuft.
    2. `cd e2e && npx playwright test vision-loop.spec.ts --headed` ausführen.
    3. Alle Screenshots in `e2e/screenshots/` mit Read-Tool einlesen.
    4. Visuell prüfen: Lobby, Vorbehalt-Phase, Stichphase, Karten, Nameplates, Seitenlade.
    5. Jede sichtbare Abweichung von der Spec als Kommentar in der Notiz festhalten.
    6. Erst danach 6.7 ff. implementieren — dann erneut Vision Loop für Vergleich.
  - Falls Vision Loop abbricht (Selektor-Fehler, Timeout): Selektor-Problem in `vision-loop.spec.ts` beheben, dann erneut starten.
  - Datei: `e2e/tests/vision-loop.spec.ts`

---

### Priorität 2 — KI-Qualität

- [x] **5.2 KI Hochzeit-Partnerstrategie**: `StandardKiStrategie` und `SchwerKiStrategie` haben keine Logik, den Hochzeit-Partner zu erkennen und zu unterstützen. `KiSpielzustand` trägt bereits `hochzeitStatus`, wird aber in `waehleKarte()` nicht ausgewertet.
  - Anforderung (spec/ki-strategie.md §7/§8): KI erkennt Partner über `hochzeitStatus.partner()` und schmiert in Partner-Stiche.
  - Umsetzung: In `waehleKarte()` prüfen ob Hochzeit aktiv und Partner bekannt → Partner-Stich schmieren (analog zur bestehenden Kontra-Partei-Logik). Neuen Test in `StandardKiStrategieTest` oder separatem `HochzeitKiTest` ergänzen.
  - Dateien: `src/main/java/de/locodoko/partie/ki/StandardKiStrategie.java`, `SchwerKiStrategie.java`, `KiSpielzustand.java`

### Priorität 3 — UX / E2E

- [x] **5.3 Recovery-Button: Tischname anzeigen**: `SpielverwaltungsSzene.ts` zeigt beim Session-Recovery "Zurück zu Spiel" statt "Zurück zu [Tischname]". Spec fordert den echten Tischnamen.
  - Umsetzung: `SpielerSessionAntwort` enthält `aktiverTischId` (UUID, korrekt befüllt) — Tischnamen per REST laden (`GET /api/tische/{id}`) und in Button-Text einsetzen. Erst 5.6 umsetzen!
  - Dateien: `frontend/src/scenes/SpielverwaltungsSzene.ts`, ggf. `SpielerSessionAntwort.java`

- [x] **5.4 E2E Test: Rundenauswertung**: `specs/e2e-tests.md` fordert `rundenauswertung.spec.ts` — prüft ob nach Spielende Punktestand, Sonderpunkte und Rundendetails korrekt angezeigt werden. Datei fehlt vollständig. Erst 7.2 umsetzen!
  - Umsetzung: Neuen Playwright-Test erstellen der eine Partie gegen KI bis zum Ende spielt und Rundenauswertungs-Modal auf korrekte Inhalte prüft.
  - Hinweis: `data-testid`-Attribute in betroffenen HTML-Elementen noch nicht gesetzt (e2e-tests.md Z. 23-46) — gleichzeitig ergänzen.
  - Datei: `e2e/tests/rundenauswertung.spec.ts`

- [x] **5.5 KI-Vorbehalt-Phase: Hochzeit proaktiv anmelden**: `StandardKiStrategie.waehleVorbehalt()` erkennt NICHT, ob die KI beide Kreuz-Damen hat und Hochzeit anmelden sollte. Hochzeit wird nur als letzter Fallback zurückgegeben, nicht als bewusste Entscheidung.
  - Anforderung (specs/ki-strategie.md §15/§17): KI prüft ob sie beide Kreuz-Damen hat → meldet Hochzeit an, sofern kein Solo über Schwelle. `LeichteKiStrategie` darf weiterhin keine Hochzeit anmelden (Zeile 15, 30-31).
  - Umsetzung: In `waehleVorbehalt()` Zeile 48-49 vor dem Solo-Fallback prüfen: hat KI 2× Kreuz-Dame im Blatt? → `Vorbehalt.HOCHZEIT`. Neuen Test in `StandardKiStrategieTest` ergänzen.
  - Dateien: `src/main/java/de/locodoko/partie/ki/StandardKiStrategie.java` (Z. 48-49), `SchwerKiStrategie.java`

- [x] **5.6 Backend: GET /api/tische/{id} ergänzen** [Blocker für 5.3]: `TischController` hat nur `listeOffeneTische()`, keinen Einzeltisch-Endpunkt. Wird von 5.3 (Recovery-Button) benötigt.
  - Umsetzung: `GET /api/tische/{id}` in `TischController` ergänzen, delegiert an `TischService.findById()`. Tischname + Status zurückgeben (ggf. minimales DTO).
  - Dateien: `src/main/java/de/locodoko/lobby/TischController.java`, `TischService.java`

- [x] **5.7 Frontend: Hochzeit-Partner-Anzeige**: Nach dem Klärungsstich (3 Stiche) muss der gefundene Hochzeit-Partner dem Spieler angezeigt werden. Kein UI-Dialog existiert dafür.
  - Anforderung (specs/hochzeit.md): Nach erfolgreichem Klärungsstich → Anzeige "Partner gefunden: [Spielername]". Bei stillem Solo → entsprechende Meldung.
  - Umsetzung: `KarteGespielt`/`StichGewonnen`-Event auswerten, wenn Hochzeit aktiv und `hochzeitStatus.partner()` neu gesetzt wurde → kurze Einblendung (Toast o.ä.) in TischSzene.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, ggf. `frontend/src/services/AnimationenService.ts`

---

### Priorität 2 — Frontend UI Bugs

> Spec: `specs/frontend-bugfixes-6x.md`

- [x] **6.1 Karten fehlen beim ersten Start** [KRITISCH]: Beim allerersten Seitenaufruf werden Karten nicht gerendert (Browser-Reload nötig). Race Condition: `renderTisch()` läuft vor Phaser `create()` ist fertig.
  - Fix: AppStore-Listener erst in `create()` registrieren; initialen Zustand per `appStore.snapshot()` in `create()` nachziehen.
  - Datei: `frontend/src/szenen/TischSzene.ts`

- [x] **6.2 Karten-Spielanimation für andere Spieler fehlt**: Gegner-Karten erscheinen ohne Animation in der Stichmitte. Eigene Karte hat Gleit-Animation, fremde nicht.
  - Fix: Bei `KarteGespielt`-Event fremder Spieler: verdeckte Karte an Fächer-Position erstellen → `animiereKarteAusspielen()` aufrufen → Karte aufdecken (verdeckt→offen).
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

- [x] **6.3 Stichanimation: Punkte + richtiger Stapel**: (a) Popup zeigt "+1 Stich" statt echte Augenzahl. (b) Karten fliegen nicht zum Stapel des Stichgewinners.
  - Fix: `animiereStichEinziehen()` um `augenzahl`-Parameter erweitern; Zielposition = Stapel-Position des Gewinners.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/services/AnimationenService.ts`

- [x] **6.4 Kartenfächer-Ausrichtung (Nord/Süd gedreht, Ost/West flach)**: Nord/Süd-Fächer sind verdreht; Ost/West-Karten liegen nebeneinander statt als vertikaler Fächer.
  - Fix: `renderKartenFaecher()` — Winkel und Offset für alle 4 Sitzpositionen korrigieren. SUED/NORD: horizontaler Fächer. WEST/OST: vertikaler Fächer (90° Basis).
  - Datei: `frontend/src/szenen/TischSzene.ts`

- [x] **6.5 Ansagen überdecken Karten (Z-Index)**: Ansage-Banner rendern über Handkarten des eigenen Spielers.
  - Fix: Banner-Depth (aktuell `setDepth(100)` in AnimationenService.ts Z. 122) kleiner setzen als Kartenfächer-Depth, oder Banner-Position in oberes Canvas-Drittel (y < 200px).
  - Dateien: `frontend/src/services/AnimationenService.ts` (Z. 122), `frontend/src/szenen/TischSzene.ts`

- [x] **6.6 Falsche Alpha für nicht-spielbare Karten**: Nicht-spielbare Karten haben Alpha 0.5 statt Spec-Wert 0.45; Edge-Cases nicht abgedeckt.
  - Fix: Alpha-Wert von `0.5` auf `0.45` korrigieren (TischSzene.ts Z. 1256); Edge-Case wenn kein Spielzug möglich (alle Karten Alpha 1.0).
  - Datei: `frontend/src/szenen/TischSzene.ts` (Z. 1256)

- [x] **6.7 Nameplates: Positionen und Größen überarbeiten**: Positionen weichen stark von Spec ab; WEST/OST-Nameplates (80px) zu klein. Code-Check bestätigt: aktuelle Werte NORD y=10%, SUED y=94%, WEST x=4%, OST x=96% — Spec fordert andere Prozente; Breite WEST/OST ist `Math.max(80, …)` statt 120px-Minimum.
  - Fix: `nameplatePositionFuer()` (TischSzene.ts Z. 140–151) auf Canvas-Prozente normieren: SUED y=85%, NORD y=15%, WEST x=14%, OST x=86%. WEST/OST-Breite von 80px auf 120px erhöhen (TischSzene.ts Z. 815).
  - Datei: `frontend/src/szenen/TischSzene.ts` (Z. 140–151, Z. 815)

- [x] **6.8 Laufende Ansagen dauerhaft anzeigen**: Welche Ansagen in der Runde gelten ist nicht sichtbar. Partei-Badges ([RE]/[KONTRA]) existieren, aber Ansage-Badges für laufende Runde fehlen komplett (Code-Check: kein `ansageBadge` in TischSzene.ts).
  - Fix: Nameplate um Ansage-Badge erweitern: `[RE]` (Gold), `[KONTRA]` (Blau), `[K90]`/`[K60]`/`[S]` (Orange) — aus Backend-Zustand `laufendesSpiel.ansagen`.
  - Datei: `frontend/src/szenen/TischSzene.ts`

---

### Priorität 3 — Frontend Neue Features

> Neu entdeckt in Plan-Run #21 durch Spec-Analyse.

- [x] **7.1 Tastatursteuerung** [Priorität Mittel]: Das Spiel ist vollständig per Tastatur spielbar. Kein einziger Shortcut ist implementiert. Seitenlade `[≡]` und Einstellungs-Modal `[⚙]` existieren noch nicht.
  - Anforderung (specs/frontend-tastatursteuerung.md): Karten per ArrowLeft/Right navigieren, Enter/Space zum Spielen; Ansagen R/K/1–5; Vorbehalt per Ziffern + Enter; Armut A/N; Seitenlade I, Einstellungen S; Focus-Trap in Modals.
  - Umsetzung:
    1. Keyboard-Event-Handler in `TischSzene.ts` registrieren (Phaser `this.input.keyboard`).
    2. State: `ausgewaehlteKarteIndex: number | null` in AppStore oder lokal in Szene tracken.
    3. Seitenlade- und Einstellungs-Modal-Skeleton in `TischSzene.ts` ergänzen (reicht zunächst als leeres Overlay).
    4. Focus-Trap für alle bestehenden Modals (Vorbehalt, Armut, Rundenende) ergänzen.
    5. E2E-Tests `partie-gegen-ki.spec.ts` auf Tastatureingaben umstellen.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/store/AppStore.ts`
  - Hinweis: Tastatursteuerung ist auch Voraussetzung für zuverlässige E2E-Tests (Canvas-Klick-Probleme umgehen).

- [x] **7.2 Rundenauswertung-Overlay** [Priorität Mittel, Blocker für 5.4]: Nach jedem Spielende erscheint ein modales Overlay mit vollständiger Spielauswertung. Kein UI existiert dafür (nur rudimentäres `rundenEndeModal`/`partieEndeModal` in TischSzene.ts).
  - Anforderung (specs/frontend-rundenauswertung.md): Overlay mit Spieltyp, Spielnummer, Ergebnis-Zeile, Parteien-Übersicht, Punkte-Berechnung (einzeln), Sonderpunkte, Gesamtstand. Partie-Ende zusätzlich mit Gesamtauswertung und Neustart-Countdown.
  - Umsetzung:
    1. `LetztesSpielergebnisAnsicht` in `TischAnsichtModell.ts` um alle nötigen Felder erweitern (Punkte-Einzelschritte, Sonderpunkte mit Beschreibung, Parteien-Zuordnung).
    2. Bestehendes `rundenEndeModal`/`partieEndeModal` in `TischSzene.ts` durch vollständiges Phaser-Overlay ersetzen.
    3. Keyboard-Support: Enter schließt Overlay (nicht Escape).
    4. `data-testid`-Attribute für E2E-Tests setzen.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/model/TischAnsichtModell.ts`
  - Hinweis: Layout-Gerüst implementiert (Kopfzeile, Parteien, Spielpunkte, Gesamtstand). Punkte-Einzelschritte fehlen noch — erst 7.3 umsetzen!

- [x] **7.3 Punkte-Einzelschritte: Backend + Frontend** [Blocker für vollständige 7.2-Anzeige]: `Spielergebnis.java` speichert nur den Gesamtspielwert; `PunkteRechner` berechnet Grundwert, Absage-Punkte und Gegen-die-Alten-Punkte intern, verwirft sie aber. `LetztesSpielergebnisAntwort` gibt keine Aufschlüsselung zurück. `frontend-rundenauswertung.md` Z. 32-40 fordert explizit "Grundwert +1, Re hat angesagt +1, …" als einzelne Zeilen.
  - Umsetzung Backend:
    1. `Spielergebnis.java` (Record): neue Felder `grundwert: int`, `absagePunkte: int`, `gegenDieAltenPunkte: int`, `soloMultiplikator: int` ergänzen.
    2. `PunkteRechner.berechneSpielwert()` (Z. 77-90): Zwischenwerte in lokale Variablen speichern und in erweitertem `Spielergebnis`-Record zurückgeben statt nur addieren.
    3. `LetztesSpielergebnisAntwort` (PartieStandAntwort.java Z. 326-373): neue Felder `grundwert`, `absagePunkte`, `gegenDieAltenPunkte`, `soloMultiplikator` in DTO aufnehmen.
    4. `PunkteRechnerTest.java`: Assertions auf Einzelkomponenten ergänzen (bisher nur Gesamtspielwert geprüft, Z. 82-84, 152-153).
  - Umsetzung Frontend:
    1. `LetztesSpielergebnisAntwort`-Interface in `SpielverwaltungDto.ts` (Z. 167-175) um Einzelschritte-Felder erweitern.
    2. `LetztesSpielergebnisAnsicht` in `TischAnsichtModell.ts` die Felder durchreichen.
    3. `TischSzene.ts` Rundenauswertungs-Overlay: Einzelschritte-Zeilen rendern (nach Parteien-Block, vor Sonderpunkten).
  - Dateien: `src/main/java/de/locodoko/partie/Spielergebnis.java`, `PunkteRechner.java`, `src/main/java/de/locodoko/lobby/PartieStandAntwort.java` (Z. 326+), `frontend/src/modelle/SpielverwaltungDto.ts` (Z. 167), `frontend/src/model/TischAnsichtModell.ts`, `frontend/src/szenen/TischSzene.ts`

---

---

### Betrieb / Ops

- [x] **8.1 Spring Boot Actuator: Health + Build-Info**: `GET /actuator/health` liefert `{ "status": "UP" }`, `GET /actuator/info` liefert Build-Metadaten (artifact, group, version, name, time). `build-info` Goal im Maven-Plugin erzeugt `build-info.properties` beim Build.
  - Dateien: `pom.xml`, `src/main/resources/application.properties`
  - Test: `src/test/java/de/locodoko/system/ActuatorHealthTest.java`

---

### E2E-Tests / Testqualität

- [ ] **8.2 E2E: data-testid Attribute setzen** [Voraussetzung für stabile E2E-Tests]: 16 `data-testid`-Werte aus `specs/e2e-tests.md` Z. 27-45 fehlen vollständig im Frontend-Source (Grep-Ergebnis: 0 Treffer in `frontend/src/`). Nur 2 Attribute in Testdateien selbst sichtbar.
  - Anforderung (specs/e2e-tests.md Z. 27-45): `data-testid="startscreen"`, `btn-neuer-tisch`, `tischszene`, `hud-stichzaehler`, `hud-gesamtpunktestand`, `rundenauswertung-overlay`, `rundenauswertung-spieltyp`, `rundenauswertung-ergebnis`, `rundenauswertung-parteien`, `rundenauswertung-punkte-berechnung`, `rundenauswertung-sonderpunkte`, `rundenauswertung-gesamtstand`, `rundenauswertung-weiter-btn`, `partieende-overlay`, `partieende-gesamtauswertung`, `partieende-neustart-countdown`
  - Umsetzung: Attribute in `TischSzene.ts` (Phaser-DOM-Elemente) und ggf. `SpielverwaltungsSzene.ts` (Lobby-Screen) setzen. Für Phaser-Canvas-Elemente reicht ein unsichtbares HTML-Marker-Element.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, `frontend/src/scenes/SpielverwaltungsSzene.ts`

- [ ] **8.3 E2E: appStore-Hack ersetzen + Test-Bug "Quick Game" beheben**: Alle drei E2E-Testdateien nutzen `window.__locodoko.appStore.spieleKarte()`. Spec `e2e-tests.md:20` fordert explizit: "Kein `__locodoko.appStore`-Hack mehr — Tastatureingaben (ArrowLeft/Right + Enter) statt direktem Store-Zugriff". Zusätzlich: `rundenauswertung.spec.ts:73-76` sucht `/Quick Game/i`-Button der weder in Spec noch im Frontend existiert — wahrscheinlich Test-Bug.
  - Umsetzung:
    1. `partie-gegen-ki.spec.ts:15-31`: `appStore.spieleKarte()`-Aufruf durch `page.keyboard.press('ArrowLeft')` + `page.keyboard.press('Enter')` ersetzen (Tastatursteuerung ist via 7.1 implementiert).
    2. `rundenauswertung.spec.ts:17-44`: analog auf Tastatur umstellen.
    3. `rundenauswertung.spec.ts:73-76`: `/Quick Game/i`-Button-Suche durch normalen Lobby-Flow ersetzen (Tisch erstellen, starten).
    4. `vision-loop.spec.ts`: appStore-Hack kann bleiben (Vision Loop ist kein Spec-Test, sondern Debugging-Tool).
  - Dateien: `e2e/tests/partie-gegen-ki.spec.ts`, `e2e/tests/rundenauswertung.spec.ts`

---

### Frontend-Qualität / Spec-Abweichungen

- [ ] **8.4 Sonderpunkte: Täter-Opfer-Beschreibung in formatiereSonderpunkt()**: `formatiereSonderpunkt()` in `TischSzene.ts` zeigt Sonderpunkte ohne Kontext ("Fuchs gefangen" statt "Fuchs gefangen (Friedhelm fängt Carlossens Fuchs) +1"). Spec `frontend-rundenauswertung.md:44` fordert Täter + Opfer im Text.
  - Umsetzung: Prüfen ob das Sonderpunkt-Domain-Objekt (Backend) Täter/Opfer-Info trägt. Falls ja: in DTO und `LetztesSpielergebnisAntwort` durchreichen, `formatiereSonderpunkt()` anpassen.
  - Dateien: `frontend/src/szenen/TischSzene.ts`, ggf. Backend `Sonderpunkt.java` + `LetztesSpielergebnisAntwort`

- [x] **8.5 "Du bist dran"-Hinweis entfernen**: `TischAnsichtModell.ts:654` gibt `'Du bist dran'` zurück wenn `spieler.istAmZug`. Spec `frontend-ui-logik.md:19` fordert: "Hinweise die lediglich den Spielzug ankündigen **entfallen ersatzlos** — der aktive Spieler ist durch Nameplate-Hervorhebung erkennbar."
  - Umsetzung: `TischAnsichtModell.ts:654` — Text auf Leerstring oder Spielernamen ändern (kein "Du bist dran"). Prüfen ob Nameplate-Hervorhebung des aktiven Spielers bereits implementiert ist.
  - Datei: `frontend/src/model/TischAnsichtModell.ts` (Z. 654)

- [ ] **8.6 Seitenlade + Einstellungs-Modal: Phaser vs. HTML — Design-Entscheidung** [Architektur-Konflikt]: `frontend-ui-logik.md:17` fordert "Meta-UI ebenfalls in Phaser umsetzen". Aktuelle Implementierung nutzt HTML-DOM (`seitenlade.className = 'seitenlade'` in TischSzene.ts:453, `einstellungen-backdrop` in TischSzene.ts:477). `CLAUDE.md` Architektur-Notiz sagt dagegen: "Meta-UI bleibt HTML". Widerspruch muss aufgelöst werden.
  - Handlungsoptionen: (A) Spec umsetzen → Seitenlade + Einstellungs-Modal nach Phaser migrieren. (B) Spec anpassen → `frontend-ui-logik.md` auf HTML-Implementierung korrigieren, CLAUDE.md bestätigen.
  - Empfehlung: Option B — funktional vollständig implementiert, Phaser-Migration hätte keinen Spielwert-Nutzen. Inhalt der Seitenlade (Spieler, Punktestand, Ansagehistorie, letzte 3 Stiche aufklappbar) und Einstellungs-Modal (Tischhintergrund, KI-Schwierigkeit, Animationsgeschwindigkeit, Tisch verlassen, Zur Lobby) auf Vollständigkeit gegen Spec prüfen.
  - Dateien: `frontend/src/szenen/TischSzene.ts` (Z. 437-560), `specs/frontend-ui-logik.md`

---

### KI-Testabdeckung

- [x] **8.7 SchwerKiStrategie: Hochzeit-Test ergänzen** [minor]: `SchwerKiStrategieTest.java` hat keine Test-Methode für Hochzeit-Anmeldung bei 2 Kreuz-Damen. Code funktioniert korrekt via Vererbung von `StandardKiStrategie`, aber die Testabdeckung fehlt für `SchwerKiStrategie` direkt.
  - Umsetzung: Analog zu `StandardKiStrategieTest.meldetHochzeitBeiZweiKreuzDamen()` einen Test in `SchwerKiStrategieTest.java` ergänzen.
  - Datei: `src/test/java/de/locodoko/.../SchwerKiStrategieTest.java`

---

## 7. Bekannte Probleme & Risiken

### Sicherheit

- ~~**XSS-Risiko im Frontend**~~: Behoben durch `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts`.

---

## 8. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML. Armut- und Vorbehalt-Dialoge bereits migriert. KONFLIKT mit `frontend-ui-logik.md:17` (fordert auch Meta-UI in Phaser) — siehe Task 8.6.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
