# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

## Notiz
Stand: 2026-04-27 (Plan-Run #63 — Analyse-Durchlauf: 2 neue Bugs, Präzisierungen)

**Was wurde implementiert:**

FEAT-6/7/8 — `data-testid` Marker für Phaser-Buttons (Vorbehalt, Ansage, Armut):
- `erstellePhaserButton()`: optionaler `testId?`-Parameter; ruft `aktualisiereE2EMarker()` auf → unsichtbarer DOM-Div als Playwright-Handle.
- `renderVorbehaltDialog()`: `btn-vorbehalt-{typ}` (z.B. `btn-vorbehalt-solo-trumpf`, `btn-vorbehalt-hochzeit`)
- `renderAnsageButtons()`: `btn-ansage-{typ}` (z.B. `btn-ansage-re`, `btn-ansage-keine-90`)
- `renderArmutBereich()`: `btn-armut-anbieten`, `btn-armut-annehmen`, `btn-armut-ablehnen`, `btn-armut-annahme-bestaetigen`, `btn-armut-abbrechen`
- Cleanup in `renderTisch()` + `aufraeumen()` scoped auf `#ui-root`, damit keine Marker leaken.
- 58 Tests grün, Build clean.

**Nächster logischer Schritt:** BUG-KI-HAENGER-FUCHS (Backend) — KI hängt nach Fuchs gefangen, da `triggereKi()` nach Sonderpunkt-Ereignissen nicht aufgerufen wird.

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

### BUG-KI-HAENGER-FUCHS (Backend): KI hängt nach Fuchs gefangen
**Root Cause:** `KiOrchestrierungService.veroeffentlicheSpielKarteEreignisse()` (Z. 282) ruft `triggereKi()` NICHT auf nach Sonderpunkt-Ereignissen (Fuchs gefangen, Karlchen, Doppelkopf). `triggereKi()` wird nur direkt nach der Kartenphase aufgerufen (Z. 196). Die KI bleibt stehen, da kein Folge-Event den nächsten Zug anstößt.
- [ ] Backend: In `veroeffentlicheSpielKarteEreignisse()` nach jedem publizierten Sonderpunkt-Ereignis `triggereKi()` aufrufen (analog zu Z. 196 im Kartenspiel-Flow)
- [ ] Backend: Sicherstellen dass `NaechsterSpielerErwartet`-Event korrekt nach `zieheStichEin()` für alle Stiche ausgelöst wird
- [ ] Validation: `mvn test` — reproduzierbarer Test-Case mit Fuchs-Stich

### BUG-HERZ-DURCHGEGANGEN (Backend): Bockrunden-Trigger "Herz durchgegangen" zu permissiv
**Root Cause:** `Spiel.java:787` — Bedingung `gk.karte().farbe() == Farbe.HERZ && !trumpfOrdnung.istTrumpf()` trifft auf ALLE non-trump Herz-Karten zu (Neun, Bube, Dame, König, As). Spec (`bockrunden.md`) fordert: "Herz durchgegangen" nur wenn der Stich ausschließlich aus Herz-As oder Herz-König besteht (keine niedrigen Herzkarten).
- [ ] Backend: Bedingung in `Spiel.java` um `karte.wert() == Wert.AS || karte.wert() == Wert.KOENIG` ergänzen, sodass nur hochwertige Herzkarten als Trigger zählen
- [ ] Backend: Bestehende Tests in `BockrundenTest.java` auf neue Semantik prüfen; Test für Herz-Neun-Stich (kein Trigger) hinzufügen
- [ ] Validation: `mvn test`

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

- [x] FEAT-6 (Frontend): Vorbehalt-Auswahl-Overlay — `btn-vorbehalt-{typ}` ✅
- [x] FEAT-7 (Frontend): Armut-Dialog — `btn-armut-{aktion}` ✅
- [x] FEAT-8 (Frontend): Floating Action Bar — `btn-ansage-{typ}` ✅

Für alle drei: `erstellePhaserButton()` mit `testId?`-Parameter; Cleanup in `renderTisch()` + `aufraeumen()`.

---

## Phase 4 — Multiplayer-Vorbereitung (FEAT)

### FEAT-NEUE-PARTIE (Backend + Frontend): Neue Partie nach Ende mit Countdown
Komplett fehlend: nach `PartieLifecycleService.java:55-59` (`markiereAlsBeendet()`) gibt es keinen Autostart.
- [ ] Backend: `TischEreignisTyp` um `NEUE_PARTIE_GESTARTET` erweitern
- [ ] Backend: nach Countdown-Ablauf neue Partie automatisch starten (gleiche Spieler, gleiche Konfiguration)
- [ ] Frontend: Countdown-Overlay im Rundenauswertungs-Screen (10s, abbrechbar durch „Tisch verlassen")
- [ ] Validation: `mvn test` + `npm test` + E2E

### FEAT-KI-SCHWELLEN (Backend): Solo-Schwellen für Loco-Blatt-Kontext
`StandardKiStrategie.waehleVorbehalt()` (Z. 55) ruft die veraltete 1-Parameter-Signatur `soloSchwelle(vorbehaltAnsage)` auf, statt die bereits vorhandene 2-Parameter-Version `soloSchwelle(vorbehaltAnsage, zustand)`. Die 2-Param-Version mit 13%-Erhöhung bei `schweinchenAktiv || dreissigAugenPflichtAktiv` (Spec: `ki-strategie.md`, 46→52 für SOLO_TRUMPF) existiert ab Z. 411, wird aber nie gerufen.
- [ ] Backend: `waehleVorbehalt()` auf `soloSchwelle(vorbehaltAnsage, zustand)` umstellen
- [ ] Validation: `mvn test`

---

## Phase 5 — Offen / Nice-to-Have

- [ ] FEAT-9 (Frontend): Tisch-Konfigurations-Modal im Startscreen (HTML-Overlay)
- [ ] FEAT-10 (Frontend): Offene-Tische-Liste mit 5-Sekunden-Polling
- [ ] TEST-1 (Backend): Unit-Test für Dulle-Verhalten im Herzsolo (`VariableTrumpfsoloTrumpfOrdnung`) — möglicherweise bereits in `SoloTrumpfOrdnungenTest.java:105-106` abgedeckt; erst verifizieren, dann ggf. als erledigt markieren

---

## Spec-Bereinigung

- [ ] SPEC-SOLO: Widerspruch in `ki-strategie.md` auflösen — Text sagt „15–20%" aber Kalibrierungsbeispiel zeigt 46→52 (= 13%). Code folgt 13%. Text anpassen.
- [ ] SPEC-AUTH: `authentifizierung.md` + `spieler-profil.md` — Status auf „Abgeschlossen" aktualisieren. OAuth2, Registrierung, Profil, Statistik, Partie-Verlauf sind zu ~90% im Code vorhanden (`OAuth2Handler`, `AuthentifizierungsController`, `SpielerProfilService`, `SpielerStatistik`, `PartieErgebnisEintrag`).
- [ ] SPEC-VERBINDUNG: `verbindungsabbruch.md` — Event-Name `NEUE_PARTIE_GESTARTET` ist falsch; tatsächlicher Event-Name im Code ist `SPIEL_GESTARTET` (`PartieEreignisTyp.java`). Spec-Text anpassen.

