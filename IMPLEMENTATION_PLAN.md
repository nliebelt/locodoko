# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-27 (Plan-Run #57 — BUG-1 implementiert)

**Was wurde implementiert:**
`HOCHZEIT_PARTNER_GEFUNDEN` als WebSocket-Event vollständig implementiert:
- Backend: `PartieEreignisTyp`, `PartieEreignisAntwort` (Record + Factory mit `partnerPosition`), Broadcast in `KiOrchestrierungService` UND `SpielAktionsService` (beide Pfade waren betroffen)
- Frontend: `PartieEreignisTyp`, `HochzeitPartnerGefundenEreignis`-Interface, AppStore-Handler, TischSzene-Banner „Partner gefunden!"

**Nächster logischer Schritt:** BUG-2 (Browser-Reload zeigt alten State) — `AppStore.reset()` vor Snapshot-Verarbeitung.

**Offene Fragen:**
- KI-Blockade vollständig behoben? Der Broadcast war das offensichtlichste fehlende Stück; integrations-Tests für KI nach Hochzeit laufen grün. Bei Reproduktion: `KiEventAdapter`-Listener-Registrierung prüfen.

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

### BUG-2 (Frontend): Browser-Reload zeigt alten State
**Root Cause:** `AppStore` wird vor Snapshot-Verarbeitung nicht zurückgesetzt. Overlays und Animations-State des vorherigen Spiels bleiben bestehen (`verbindungsabbruch.md:70` fordert vollständigen Reset).
- [ ] Frontend: `AppStore.reset()` (oder äquivalent) vor Snapshot-Verarbeitung in Session-Recovery aufrufen
- [ ] Frontend: `AnimationenService.abbrechen()` sicherstellen (existiert, aber wird nicht immer aufgerufen)
- [ ] Frontend: alle Overlay-Sichtbarkeiten (`rundenEndeModal`, `partieEndeModal`) auf hidden setzen
- [ ] Validation: `npm test` + manueller Test: Strg+R während laufendem Spiel

### BUG-SCHMEISSEN (Backend): Schmeißen-Validierung korrigieren
**Root Cause:** `VorbehaltAnsage.java` — `SCHMEISSEN_FUENF_NEUNEN` prüft auf 5 (statt 5 mit / 4 ohne Neunen) und `SCHMEISSEN_WENIG_TRUMPF` hat keine Bedingung `< 2 Trümpfe` implementiert.
- [ ] Backend: `VorbehaltAnsage.istZulaessig()` für `SCHMEISSEN_FUENF_NEUNEN` korrigieren (Spec schweinchen.md:58)
- [ ] Backend: `VorbehaltAnsage.istZulaessig()` für `SCHMEISSEN_WENIG_TRUMPF` implementieren (Spec:59)
- [ ] Validation: `mvn test` (neue Unit-Tests für beide Fälle)

### BUG-DKV (Backend): DKV-Preset schließt Spiel nicht ab
**Root Cause:** Reproduzierbar mit DKV-Preset (alle Sonderregeln false). Fehler in `Spiel.werteAus()` oder `PunkteRechner` — konnte durch Analyse nicht eindeutig lokalisiert werden, muss debuggt werden.
- [ ] Backend: `Spiel.werteAus()` und `PunkteRechner` mit DKV-Preset durchspielen, Logging aktivieren
- [ ] Backend: Ursache identifizieren und fixen
- [ ] Validation: `mvn test` mit DKV-Preset-Integration-Test

---

## Phase 2 — Bockrunden-Frontend (FEAT-BOCK)

### FEAT-BOCK-1 (Backend + Frontend): bockrundenZaehler als number statt boolean
`PartieStandAntwort.java:120` sendet `istBockrunde: boolean` — Spec fordert `bockrundenZaehler: number`.
- [ ] Backend: `PartieStandAntwort.LaufendesSpielAntwort` — `istBockrunde: boolean` → `bockrundenZaehler: int`
- [ ] Backend: `PartieStandAntwort.aus()` — `bockrundenZaehlerAusDb()` direkt übergeben (bereits als int vorhanden, `Partie.java:46`)
- [ ] Frontend: `SpielverwaltungDto.ts:153` — `istBockrunde: boolean` → `bockrundenZaehler: number`
- [ ] Validation: `mvn test` + `npm test`

### FEAT-BOCK-2 (Frontend): animiereBockrunde() verdrahten
`AnimationenService.animiereBockrunde()` ist implementiert aber nirgends aufgerufen.
- [ ] Frontend: `animiereBockrunde(anzahl: number)` — Parameter statt void (N Schafe: 1×🐑, 2×🐑🐑 „Doppelbock!", N×🐑)
- [ ] Frontend: `TischSzene.ts` im `SPIEL_GESTARTET`-Handler nach Karten-Austeilen-Animation aufrufen wenn `bockrundenZaehler > 0`
- [ ] Validation: `npm test` + visueller Vision-Loop-Test

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

