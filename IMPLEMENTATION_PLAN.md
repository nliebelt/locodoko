# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-27 (Plan-Run #61 — FEAT-BOCK-2 implementiert)

**Was wurde implementiert:**

FEAT-BOCK-2 — `animiereBockrunde(anzahl)` verdrahten:
- `AnimationenService.animiereBockrunde()`: `anzahl: number` als erster Parameter; Text/Emoji variiert: 1→🐑 Bockrunde!, 2→🐑🐑 Doppelbock!, ≥3→🐑×N Bockrunde ×N.
- `TischSzene` SPIEL_GESTARTET-Handler: nach Austeilen + Spielankündigung `bockrundenZaehler > 0` prüfen und Animation seriell einreihen.
- 3 neue Tests in `AnimationenService.test.ts`. 58 Tests grün.

**Nächster logischer Schritt:** FEAT-6/7/8 — Test-IDs (`data-testid`) für Phaser-Buttons in TischSzene (Vorbehalt, Armut, Ansage).

**Offene Fragen:** Vision-Loop-Check mit laufendem Backend empfohlen (kein Backend im CI).

**Offene Fragen:** keine.

## Legende
- [x] Erledigt
- [~] Teilweise
- [ ] Offen
- [BLOCKED: <Grund>] Blockiert

---

## Phase 1 — Blocking Bugs: Quickplay stabil (BUG)

### BUG-1 (Backend + Frontend): HochzeitPartnerGefunden als WebSocket-Event ✅
**Root Cause:** `SpielAktionsService` und `KiOrchestrierungService` loggten das Domain-Event `HochzeitPartnerGefunden` nur — kein Broadcast. KI-Hänger nach Hochzeit-Klärung war die direkte Folge.
- [x] Backend: `PartieEreignisTyp` um `HOCHZEIT_PARTNER_GEFUNDEN` erweitern
- [x] Backend: `KiOrchestrierungService` + `SpielAktionsService` — Broadcaster analog `SchweinchenGemeldet`, mit `partnerPosition`
- [x] Frontend: `PartieEreignisTyp` in `SpielverwaltungDto.ts` + `HochzeitPartnerGefundenEreignis` + AppStore-Handler + Banner „Partner gefunden!"
- [x] Validation: `mvn test` + `npm test` — beide grün

### BUG-2 (Frontend): Browser-Reload zeigt alten State ✅
**Root Cause:** `AppStore` wird vor Snapshot-Verarbeitung nicht zurückgesetzt. Overlays und Animations-State des vorherigen Spiels bleiben bestehen (`verbindungsabbruch.md:70` fordert vollständigen Reset).
- [x] Frontend: `AppStore.reconnecteTisch()` — `aktuellerTisch: null, partieStand: null` vor Subscription-Aufbau patchen
- [x] Frontend: `AnimationenService.abbrechen()` — bereits korrekt in `TischSzene.aufraeumen()` vorhanden
- [x] Frontend: `TischSzene.aufraeumen()` — `schliesseRundenEndeModal()` ergänzt (war fehlend)
- [x] Validation: `npm test` — 55 Tests grün

### BUG-SCHMEISSEN (Backend): Schmeißen-Validierung korrigieren ✅
**Root Cause:** `VorbehaltAnsage.java` — `SCHMEISSEN_FUENF_NEUNEN` prüfte auf 5 (statt 5 mit / 4 ohne Neunen). `SCHMEISSEN_WENIG_TRUMPF` war bereits korrekt implementiert.
- [x] Backend: `VorbehaltAnsage.istZulaessig()` für `SCHMEISSEN_FUENF_NEUNEN` korrigiert: `ohneNeunen ? 4 : 5`
- [x] Backend: `VorbehaltAnsage.istZulaessig()` für `SCHMEISSEN_WENIG_TRUMPF` — bereits korrekt (kein Fix nötig)
- [x] Validation: `mvn test` — 12 Tests in VorbehaltAnsageTest, BUILD SUCCESS

### BUG-DKV (Backend): DKV-Preset schließt Spiel nicht ab ✅
**Root Cause:** `KiOrchestrierungService.automatisiereTisch()` hatte kein try-catch um den AUSWERTUNG-Block. Exception propagierte und ließ das Spiel hängen. Fix: try-catch in commit `727f472` (2026-04-15).
- [x] Backend: Ursache identifiziert (try-catch fehlend in KiOrchestrierungService)
- [x] Fix bereits in commit 727f472 vorhanden — kein weiterer Fix nötig
- [x] Validation: mvn test — 282 Tests grün

---

## Phase 2 — Bockrunden-Frontend (FEAT-BOCK)

### FEAT-BOCK-1 (Backend + Frontend): bockrundenZaehler als number statt boolean ✅
`PartieStandAntwort.java:120` sendet `istBockrunde: boolean` — Spec fordert `bockrundenZaehler: number`.
- [x] Backend: `PartieStandAntwort.LaufendesSpielAntwort` — `istBockrunde: boolean` → `bockrundenZaehler: int`
- [x] Backend: `PartieStandAntwort.aus()` — `bockrundenZaehlerAusDb()` direkt übergeben (bereits als int vorhanden, `Partie.java:46`)
- [x] Frontend: `SpielverwaltungDto.ts:153` — `istBockrunde: boolean` → `bockrundenZaehler: number`
- [x] Validation: `mvn test` (282 grün) + `npm test` (55 grün) + `npm run build` (clean)

### FEAT-BOCK-2 (Frontend): animiereBockrunde() verdrahten ✅
`AnimationenService.animiereBockrunde()` ist implementiert aber nirgends aufgerufen.
- [x] Frontend: `animiereBockrunde(anzahl: number)` — Parameter statt void (N Schafe: 1×🐑, 2×🐑🐑 „Doppelbock!", N×🐑)
- [x] Frontend: `TischSzene.ts` im `SPIEL_GESTARTET`-Handler nach Karten-Austeilen-Animation aufrufen wenn `bockrundenZaehler > 0`
- [x] Validation: `npm test` (58 grün) + visueller Vision-Loop-Test empfohlen (Backend nötig)

---

## Phase 3 — E2E-Testbarkeit: Detail-Marker (FEAT)

- [~] FEAT-6 (Frontend): Vorbehalt-Auswahl-Overlay — `btn-vorbehalt-{typ}` fehlen in `TischSzene.ts:1193` (Phaser-Buttons ohne `dataset.testid`)
- [~] FEAT-7 (Frontend): Armut-Dialog — `btn-armut-{aktion}` fehlen in `TischSzene.ts:1223–1235`
- [~] FEAT-8 (Frontend): Floating Action Bar — `btn-ansage-{typ}` fehlen in `TischSzene.ts:1211`

Für alle drei: `erstellePhaserButton()` mit `dataset['testid']`-Zuweisung erweitern.

---

## Phase 4 — Multiplayer-Vorbereitung (FEAT)

### FEAT-NEUE-PARTIE (Backend + Frontend): Neue Partie nach Ende mit Countdown
Komplett fehlend: nach `PartieLifecycleService.java:55-59` (`markiereAlsBeendet()`) gibt es keinen Autostart.
- [ ] Backend: `TischEreignisTyp` um `NEUE_PARTIE_GESTARTET` erweitern
- [ ] Backend: nach Countdown-Ablauf neue Partie automatisch starten (gleiche Spieler, gleiche Konfiguration)
- [ ] Frontend: Countdown-Overlay im Rundenauswertungs-Screen (10s, abbrechbar durch „Tisch verlassen")
- [ ] Validation: `mvn test` + `npm test` + E2E

### FEAT-KI-SCHWELLEN (Backend): Solo-Schwellen für Loco-Blatt-Kontext
`StandardKiStrategie.java:397,418` — keine Erhöhung der Schwellen wenn `schweinchenAktiv || dreissigAugenPflichtAktiv`. Spec (ki-strategie.md) fordert Erhöhung um ca. 13% (46→52 für SOLO_TRUMPF).
- [ ] Backend: Kontextabhängige Schwellen in `StandardKiStrategie.berechneScore()` implementieren
- [ ] Validation: `mvn test`

---

## Phase 5 — Offen / Nice-to-Have

- [ ] FEAT-9 (Frontend): Tisch-Konfigurations-Modal im Startscreen (HTML-Overlay)
- [ ] FEAT-10 (Frontend): Offene-Tische-Liste mit 5-Sekunden-Polling
- [ ] TEST-1 (Backend): Unit-Test für Dulle-Verhalten im Herzsolo (`VariableTrumpfsoloTrumpfOrdnung`)

---

## Spec-Bereinigung

- [ ] SPEC-SOLO: Widerspruch in `ki-strategie.md` auflösen — Text sagt „15–20%" aber Kalibrierungsbeispiel zeigt 46→52 (= 13%). Code folgt 13%. Text anpassen.

