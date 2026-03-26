# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-27: Rundenende-Overlay-Funktionalität angepasst.

## Notiz

**2026-03-27:** Task 4.14 (Rundenende-Overlay) Funktionalität angepasst.

**Was wurde implementiert:**
- **Rundenende-Modal**: Funktionalität für Schließen per Button/Enter angepasst, Escape-Schließung entfernt gemäß Spezifikation. Button-Text zu 'Weiter →' geändert.
- **Styling**: HTML-Struktur des Overlays ist bereit für Design-System-Anpassungen (CSS).

**Nächster logischer Schritt:**
- **4.17 Phaser-Migration UI-Overlays** — Spielaktions-UI in Phaser-GameObjects.

**Bekannte offene Fragen:**
- Finales Styling des Rundenende-Overlays gemäß Design-System (CSS-Anpassungen).
- Untersuchung der `Not implemented: HTMLCanvasElement's getContext()` Warnungen in `TischSzene.test.ts`.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## 0. Infrastruktur & Tech-Upgrade

### 0.1 Spring Boot 4.0.4 + Java 25 (tech-migration.md)

- [ ] `pom.xml`: Spring Boot Parent auf `4.0.4` hochziehen
- [ ] `pom.xml`: `<java.version>25</java.version>`
- [ ] Prüfen ob Breaking Changes aus SB 4.x Migration Guide relevant sind
- [ ] `mvn clean verify` grün

---

## 1. Backend — Domain & Persistence

### 1.1 Karten (Bounded Context: `de.locodoko.karten`)
- [x] Karte, Hand, Stich — immutable Value Objects
- [x] Kartendeck (48 / ohne Neunen 40) mit Mischen und Austeilen
- [x] TrumpfOrdnung-Interface + NormaleTrumpfOrdnung
- [x] DamensoloTrumpfOrdnung, BubensoloTrumpfOrdnung, FleischlosTrumpfOrdnung
- [x] Bedienpflicht (Stich.spieleKarte validiert gueltigeKarten)
- [x] Zweite-Dulle-sticht konfigurierbar
- [x] Spielregeln (immutable Record mit allen Optionen + Builder-Methoden)
- [x] Bedienfarbe (Trump vs. Fehlfarbe)
- [x] Tests: SoloTrumpfOrdnungenTest

### 1.2 Partie (Bounded Context: `de.locodoko.partie`)
- [x] Spiel — 7 Phasen (KARTEN_AUSTEILEN → GESAMTSTAND_AKTUALISIEREN)
- [x] Partie — Geber-Rotation, Gesamtpunktestand, istBeendet
- [x] Parteien — Re/Kontra-Zuordnung (Normal, Solo, Hochzeit, Armut)
- [x] Vorbehalt-Ansage mit Priorisierung (Solo > Hochzeit > Armut)
- [x] Ansagen (RE/KONTRA + Absagen KEINE_90..SCHWARZ) mit Mindestkartenanzahl
- [x] PunkteRechner — Augen, Grundwert, Absagen, Gegen-die-Alten, Solo-3x, Nullsumme
- [x] SonderpunktBewerter — Fuchs, Karlchen, Doppelkopf (konfigurierbar)
- [x] HochzeitStatus — Partnerfindung in 3 Stichen, stilles Solo
- [x] ArmutStatus — Kartentausch-Mechanik mit Ablehnungskaskade
- [x] Spielergebnis (immutable Record, 240-Augen-Validierung)
- [x] Tests: SpielTest, PunkteRechnerTest, AnsagenTest, SonderpunktBewerterTest, PartieTest

### 1.3 Persistence (Spring Data JDBC + Liquibase)
- [x] PartieEntity, SpielEntity, StichEntity, HandEntity, GespielteKarteEntity
- [x] @MappedCollection für Aggregate-Grenzen
- [x] JSON-Spalten für Vorbehalte, Ansagen, Armut-Karten
- [x] Liquibase 001-initiales-schema.yaml (672 Zeilen)
- [x] SpielPersistenzAdapter (Domain ↔ Entity bidirektionale Konvertierung)

### 1.4 KI (Package: `de.locodoko.partie.ki`)
- [x] KiStrategie-Interface (5 Methoden)
- [x] StandardKiStrategie — regelbasiert, deterministisch
- [x] Vorbehalt-Wahl (Solo-Schwellenwerte, Hochzeit/Armut-Erkennung)
- [x] Armut-Angebot und -Antwort (Wertberechnung, Schwellenwert 55)
- [x] Kartenauswahl (Anspieler vs. Folgespieler, Schmier-Logik)
- [x] Hochzeit-Speziallogik: phasenabhängige Partner-Suche
- [x] Ansage-Entscheidung (handstaerke-Schwellenwerte)
- [x] Sonderpunkt-Bewusstsein (Fuchs/Karlchen-Schutz)
- [x] Tests: StandardKiStrategieTest

---

## 2. Backend — Lobby & Orchestrierung

### 2.1 Lobby/Tisch (Bounded Context: `de.locodoko.lobby`)
- [x] TischEntity (Aggregate Root) mit TischStatus-Statemachine
- [x] TischkonfigurationEmbeddable (alle 15+ Optionen, Validierung)
- [x] TischService — erstellen, beitreten, verlassen, starten (mit pessimistischem Lock)
- [x] TischController — REST-Endpoints (GET/POST /api/tische, konfiguration, beitreten, verlassen, starten)
- [x] KI-Spieler auffüllen beim Start (KiSpielerFabrik)
- [x] KiOrchestrierungService — Endlosschleife bis Mensch dran (max 512 Aktionen)
- [x] Partie-Abbruch bei Spieler-Verlassen
- [x] PartieStandAntwort — spielerspezifischer Snapshot mit Hand-Redaktion
- [x] Tests: TischControllerTest (18 Tests), PartieStandAntwortTest, KiOrchestrierungServiceIntegrationTest

### 2.2 Session (Bounded Context: `de.locodoko.session`)
- [x] SpielerEntity (Aggregate Root) — Mensch + KI-Spieler
- [x] SpielerSessionService — Registrierung, Timeout, Namenänderung
- [x] SpielerSessionController — REST (POST/GET/PUT /api/spieler/session)
- [x] Session-Validierung: MVC-Interceptor + WebSocket-Handshake
- [x] HttpOnly/SameSite-Cookie, konfigurierbarer Timeout (60min)
- [x] Tests: SpielerSessionControllerTest (8 Tests), SpielerSessionHandshakeInterceptorTest

### 2.3 WebSocket/Echtzeit
- [x] STOMP-Konfiguration (SockJS im Javadoc erwähnt, aber nicht konfiguriert — kein Blocker)
- [x] SpielverwaltungWebSocketController — alle Spielaktionen (Karte, Ansage, Vorbehalt, Armut)
- [x] TischEchtzeitService — Broadcast + User-spezifische Nachrichten (transaktional)
- [x] Snapshot-Anfragen (Tischliste, Tisch, Partie, Debug-Snapshot)
- [x] Ereignis-DTOs: TischlisteEreignis, TischEreignis, PartieEreignis, VerbindungStatus
- [x] Tests: WebSocketPublikationIntegrationTest, WebSocketSpielaktionIntegrationTest

### 2.4 Verbindungsabbruch
- [x] Disconnect-Erkennung (WebSocket-Lifecycle-Event)
- [x] Reconnect-Fenster (konfigurierbar, Standard: 120s)
- [x] KI-Übernahme nach Timeout (kiUebernommen-Flag in DB)
- [x] Scheduled Timeout-Prüfung (alle 10s)
- [x] Session-Cleanup bei HTTP-Session-Ablauf
- [x] Tests: VerbindungsabbruchServiceTest (6 Tests), SpielerSessionCleanupServiceTest (6 Tests)
- [x] **Session-Recovery bei Tab-Reload**: `GET /api/spieler/session` liefert `aktiverTischId`, BootSzene leitet weiter
- [x] **Tisch-Verlassen-Button**: Bestätigungsdialog, PARTIE_ABGEBROCHEN-Event, Weiterleitung zur Lobby
- [x] **Auto-Neustart nach Partie-Ende**: Countdown + automatische neue Partie

---

## 3. Frontend (TypeScript / Phaser 3)

### 3.1 Infrastruktur
- [x] Vite-Build, TypeScript strict, ESLint (max-warnings=0)
- [x] Phaser 3 Game-Config (1280×720, FIT, 3 Szenen)
- [x] SpielverwaltungApi — REST-Client mit Fehlerbehandlung
- [x] SpielverwaltungEchtzeit — STOMP-Client mit Auto-Reconnect
- [x] AppStore — zentraler State mit immutablen Snapshots, reaktive Listener
- [x] Logger (dev-only, tree-shaken in prod)
- [x] Tests: AppStore (15 Tests), Logger (10 Tests)

### 3.2 BootSzene & LobbySzene
- [x] Session-Initialisierung, Name aus localStorage
- [x] Echtzeit-Tischliste (REST + WebSocket)
- [x] Tisch erstellen / beitreten UI
- [x] Status-Anzeige (Verbindung, Laden, Fehler-Toasts)

### 3.3 TischSzene — Rendering (~1850 Zeilen)
- [x] Top-Down-Layout mit 4 Spielerpositionen (SUED/WEST/NORD/OST)
- [x] Kartensprites (prozedural generiert, AssetLoader)
- [x] Eigene Hand als Fächer, Gegner als verdeckte Stapel
- [x] Stichmitte-Darstellung (4 Karten im Zentrum)
- [x] Spielernamen + KI-Symbol (HTML-Panel; fehlt auf Canvas)
- [x] Aktiver Spieler hervorgehoben
- [x] Tischhintergrund-Auswahl (3 Optionen)
- [x] Animationsgeschwindigkeit-Umschalter (1x/2x/sofort)

### 3.4 TischSzene — Interaktion
- [x] Karten anklicken zum Ausspielen (mit Animation)
- [x] Spielbare Karten hervorgehoben / nicht-spielbare ausgegraut
- [x] Vorbehalt-Buttons (Gesund, Soli, Hochzeit, Armut)
- [x] Ansage-Buttons (Re, Kontra, Keine 90, etc.)
- [x] Armut-Antwort-Dialog (Annehmen/Ablehnen, Kartenauswahl)
- [x] Debug-Modus (alle Hände sichtbar)

### 3.5 TischSzene — Animationen
- [x] AnimationenService — alle Methoden implementiert und getestet
- [x] Karte-Ausspielen-Animation
- [x] Stich-Einziehen-Animation
- [x] Karten-Austeilen-Animation
- [x] Ansage-Banner
- [x] Sonderpunkt-Feedback
- [x] Integration in TischSzene-Spielschleife
- [x] Tests: AnimationenService (6 Tests)

### 3.6 TischAnsichtModell
- [x] Backend→Frontend-Transformation (Positionsrotation)
- [x] Kartensortierung (Trumpf nach Rang, Fehlfarben)
- [x] UI-State-Ableitung (aktuellerSpieler, spielbareKarten, moeglicheAnsagen)
- [x] Armut-Erkennung (Angebots-/Antwortmodus)
- [x] Letztes Spielergebnis, Gesamtpunktestand
- [x] Tests: TischAnsichtModell (8 Tests)

### 3.7 TischSzene Tests
- [x] 23 Tests in TischSzene.test.ts

---


## 4. Offene Aufgaben (priorisiert)

### Priorität 0 — E2E-Tests müssen laufen (Build-Blocker)

- [x] **E2E-Tests (Playwright, e2e/)**
  - E2E-Tests müssen nach jedem Commit grün laufen 
  - Backend (Spring Boot) muss für E2E-Tests laufen: `mvn spring-boot:run`
  - E2E-Tests starten: `cd e2e && npx playwright test`
  - Fehler im E2E-Test = höchste Priorität, Blocker für alle anderen Aufgaben
- [x] **Frontend Build & Tests behoben**: Resolved `TS1068` error in `SpielverwaltungApi.ts` by refactoring `fetch` options construction using `Object.assign`.
- [x] **Frontend Build & Tests behoben**: Resolved `TS2339` error in `BootSzene.ts` by correcting Phaser `time` utility access.
- [x] **Frontend Tests passed**: Frontend tests (`npm test`) now run green (5/5 suites, 62/62 tests passed), with known `Not implemented: HTMLCanvasElement's getContext()` warnings in headless mode for `TischSzene.test.ts`.

### Priorität 1 — Spielbar machen (fehlende Spielschleifen-Features)

- [x] **4.1 Session-Recovery bei Tab-Reload (Backend + Frontend)**
- [x] **4.2 Tisch-Verlassen während Partie (Backend + Frontend)**
- [x] **4.3 Auto-Neustart nach Partie-Ende**

### Priorität 2 — Qualität & Dokumentation

- [x] **4.4 Spec-Status aktualisieren**
- [x] **4.5 JSDoc-Dokumentation (frontend-architektur.md)**
  - AnimationenService und TischAnsichtModell vollständig dokumentiert
  - AppStore: Klasse + 6/18 öffentliche Methoden haben JSDoc (12 fehlen — nicht-kritisch)
  - SpielverwaltungEchtzeit: Klasse + Interface haben JSDoc (3/5 Methoden fehlen)
  - Spec markiert als erledigt — verbleibende Lücken sind kosmetisch

- [x] **4.6 E2E-Tests (e2e-tests.md)**
  - Playwright-Setup in `e2e/` vorhanden, Test läuft grün
  - Test: `partie-gegen-ki.spec.ts` (Session → Tisch erstellen → Starten → Vorbehalt → Karte → Stich)
  - Phaser-Canvas-Hit-Testing in headless Chromium umgangen via `window.__locodoko.appStore.spieleKarte()`
  - Fehlende Szenarien: Armut, Hochzeit, Solo, Disconnect — Nice-to-have

### Priorität 3 — Nice-to-have

- [x] **4.7 Swagger/OpenAPI-Dokumentation**

- [x] **4.8 KI-Schwierigkeitsstufen**
  - KiSchwierigkeit-Enum (LEICHT/STANDARD/SCHWER)
  - LeichteKiStrategie: erste gültige Karte, immer GESUND, keine Ansagen
  - SchwerKiStrategie: wie Standard, RE-Schwelle 24 statt 28
  - KiStrategieFactory: @Component, erstellt Strategie nach Tischkonfiguration
  - Liquibase-Migration: ki_schwierigkeit-Spalte in tisch-Tabelle
  - Frontend: Selector in TischSzene, KI-Badge zeigt Schwierigkeitsstufe
  - Tests: LeichteKiStrategieTest (5), SchwerKiStrategieTest (3)

### Priorität 4 — Frontend-Redesign (neue/überarbeitete Specs)

> Diese Aufgaben ergeben sich aus 6 Frontend-Specs, die eine visuelle Neugestaltung definieren.
> Die bestehende Funktionalität (Spielschleife, Animationen, State) bleibt erhalten —
> die UI-Architektur wird von seitlichen Panels auf HUD + Overlays umgestellt.
> Specs: frontend-tischansicht.md, frontend-ui-logik.md, frontend-visuelles-design.md,
> frontend-startscreen.md, frontend-tastatursteuerung.md, frontend-rundenauswertung.md

- [x] **4.9 Visuelles Design-System (frontend-visuelles-design.md)** — 10/10 DoD
  - Space Grotesk via Google Fonts in index.html (400/600/700/900)
  - CSS Custom Properties: --farbe-gold, --farbe-blau, --farbe-rot, --farbe-gruen, --farbe-hintergrund etc.
  - Neo-Brutalism: --schatten-button (4px 4px 0 #000), --rahmen-neo (2px solid #f8f9fa)
  - Focus-Styles: :focus-visible { outline: 2px solid var(--farbe-gold) }
  - vectorized-playing-cards (24 PNGs) aus hayeah/playing-cards-assets in frontend/public/assets/cards/
  - Karten-Mapping: karteZuDateiname() + ladeKartenBilderVorab() in AssetLoader.ts
  - TischSzene.preload() für PNG-Vorladen mit prozeduralem Fallback
  - animiereAnsageBanner: goldener Re-Banner, blauer Kontra-Banner
  - animiereSoloAnkuendigung: Einfahren von oben, verweilen, Ausfahren

- [x] **4.10 HUD Top-Bar + Layout-Umbau (frontend-tischansicht.md)**
  - 40px Top-Bar (Links: Stichzähler, Mitte: Spieltyp + Spielnummer, Rechts: Icons [≡][⚙][🐛])
  - Spieler-Nameplates statt Kreise (Name · KI/Mensch · Partei · Stiche · Geber) mit Rechteck-Shape
  - Kartengröße auf 110×165px erhöht (berechneKartenGroesse angepasst)
  - Seitliche Panels entfernt, Layout auf Canvas + Overlays umgestellt (Seitenlade, Einstellungs-Modal, Spielaktionen-Overlay)
  - Debug-Modus mit aufgedeckten Karten (weiterhin funktional)
  - Bug-Fix: leaveButton während IM_SPIEL klickbar (mit Bestätigungsdialog)

- [x] **4.11 Floating Action Bar + Seitenlade (frontend-ui-logik.md)**
  - Floating Action Bar: Ansage-Buttons zwischen Stichmitte und Hand, kontextabhängig
  - Vorbehalt als modales Vollbild-Overlay (statt inline Panel-Buttons)
  - Seitenlade: Toggle-Panel von links (Spieler, Punkte, Ansagehistorie, letzte Stiche) — bereits vorhanden
  - Einstellungs-Modal (Hintergrund, Animation, Debug) — bereits vorhanden
  - Toast-Notifications — bereits implementiert
  - Abhängigkeit: 4.10 (Layout-Umbau)

- [x] **4.12 Tastatursteuerung (frontend-tastatursteuerung.md)** — 8/9 DoD
  - Karten-Navigation (ArrowLeft/Right, Enter/Space zum Ausspielen)
  - Auto-Fokus auf erste spielbare Karte
  - Ansage-Shortcuts (R, K, 1–5)
  - Vorbehalt-Navigation (Ziffern, ArrowUp/Down, Enter)
  - Armut-Shortcuts (A, N)
  - Seitenlade (I), Einstellungen (S) per Tastatur
  - Focus-Trap in Modals
  - (Offen: Armut-Kartenauswahl ArrowLeft/Right + Space — Nice-to-have)
  - Abhängigkeit: 4.11 (UI-Elemente müssen existieren)

- [x] **4.13 Spielverwaltungs-Szene (frontend-startscreen.md)** — UI-Elemente vorhanden, Backend-Integration + Keyboard-Nav + Tests fehlen
  - Sicherstellen, dass Backend-API-Aufrufe (`appStore.erstelleQuickGame`, `appStore.erstelleKonfiguriertenTisch`, `appStore.betreteTisch`, `appStore.reconnecteTisch`, `appStore.aktualisiereTischliste`) funktional sind.
  - Implementieren der vollständigen Keyboard-Navigation für die Spielverwaltungs-Szene (Fokus-Management, Shortcuts) - Grundlegende Navigation hinzugefügt.
  - Schreiben von Unit-/Integrationstests für die Spielverwaltungs-Szene und ihre Interaktion mit dem AppStore.
  - Überprüfen und ggf. anpassen der Transition von BootSzene zu SpielverwaltungsSzene.
  - Abhängigkeit: 4.9 (Design-System), 4.15 (Showstopper-Fixes)

- [~] **4.14 Rundenauswertung-Overlay (frontend-rundenauswertung.md)** — 0/11 DoD
  - Rundenende-Overlay (bereits funktional, Styling-Anpassung an Design-System)
  - Kopfzeile, Ergebnis-Zeile, Parteien-Übersicht, Punkte-Berechnung
  - Sonderpunkte-Sektion
  - Partie-Ende-Overlay mit Gesamtauswertung + Countdown
  - Keyboard-Support (Enter zum Schließen)
  - Abhängigkeit: 4.9 (Design-System)

- [x] **4.15 Showstopper-Fixes (UI spielbar machen)** — 8/8 DoD
  - [x] Karten-Hintergrund: weißes Rechteck vor jedem Karten-Sprite
  - [x] "Am Zug"-Text entfernt
  - [x] Duplikat-Titeltext entfernt
  - [x] "Noch keine Karte"-Placeholder entfernt
  - [x] Tischname aus HUD Top-Bar entfernt
  - [x] Lobby-Bug: wirdGeladen-State korrekt zurückgesetzt nach Tisch verlassen
  - [x] OST/WEST-Layout: kartenX von 0.06/0.94 auf 0.10/0.90 korrigiert
  - [x] Render-Bug: renderTisch() in starteFolgeanimationen.finally ergänzt

- [x] **4.16 Stich-Visualisierung** — 6/6 DoD
  - **Gestampelte Stich-Karten**: Die 4 Karten im laufenden Stich werden leicht überlappend/rotiert nach Spielerposition abgelegt (SUED unten, NORD oben, WEST links, OST rechts) — keine Spielernamen an den Karten
  - **Stich-Stapel beim Gewinner**: Gewonnene Stiche als kleiner gestapelter Fächer rechts neben den eigenen Karten (bei SUED), analoger Stapel bei Gegnern
  - **Stich-Einzieh-Animation**: Karten fliegen nach Stich-Ende zum Gewinner, kurzes Punkte-Popup (z.B. „+1 Stich“)
  - **Letzten Stich umdrehen**: Klick/Taste (L) auf eigenen Stapel deckt die zuletzt gewonnenen 4 Karten kurz auf (wie im echten Spiel erlaubt)
  - **Stich-Gewinn deutlich machen**: Visuelle Hervorhebung (kurzer Glow/Flash am Gewinner-Nameplate) sodass klar ist wer den Stich gemacht hat
  - Abhängigkeit: 4.15


- [ ] **4.17 Phaser-Migration UI-Overlays** — 0/6 DoD
  - **Architektur-Entscheidung**: Spielaktions-UI = Phaser-GameObjects; Meta-UI (Seitenlade, Einstellungen) = HTML bleibt
  - **Vorbehalt-Auswahl**: Vollbild-Phaser-Overlay statt HTML-Modal — Karten bleiben im Hintergrund sichtbar
  - **Ansage-Buttons**: Floating Action Bar als Phaser-Container statt HTML-Element
  - **Armut-Dialog**: Phaser-Overlay statt HTML
  - **Spieler-Nameplates neu positionieren**: NORD und SUED → Nameplate rechts neben Kartenfächer; WEST → Nameplate unterhalb des Kartenstapels; OST → Nameplate oberhalb des Kartenstapels
  - Abhängigkeit: 4.15

- [ ] **4.18 Single-Player UX** — 0/4 DoD
  - **KI-Übernahme-Timeout deaktivieren** für Tische mit nur einem menschlichen Spieler (Backend: `TischService` / `VerbindungsabbruchService` prüfen ob alle anderen Spieler KI sind)
  - **Laufende Tische in Lobby-Liste** anzeigen: Tische mit Status `IM_SPIEL` erscheinen in der Liste mit „Zurückkehren"-Button statt „Beitreten" (nur für den eigenen Spieler sichtbar)
  - **Kartenrückseiten-Asset** (Nice-to-have): LGPL/Public-Domain Kartenrücken-Design als Ersatz für prozeduralen Rücken
  - Abhängigkeit: 4.13 (Quick Game), 4.15

---

## 5. Bekannte Probleme & Risiken

### 5.1 Sicherheit

- **XSS-Risiko im Frontend**: Spieler- und Tischnamen werden via `innerHTML` in Template-Literals gerendert (LobbySzene, TischSzene). Benutzerkontrollierte Strings werden nicht escaped. Ein Spieler könnte `<img src=x onerror=alert(1)>` als Namen setzen.

### 5.2 Bugs / Latente Fehler

- ~~**TischSzene: leaveButton während IM_SPIEL deaktiviert**~~: Behoben in 4.10 — leaveButton jetzt während IM_SPIEL klickbar mit Bestätigungsdialog.
- **SpielerSessionController PUT-Pfad: Potenzielle NPE**: `request.getSession(false)` wird ohne Null-Check verwendet; bei fehlender Session gibt `.getId()` eine NPE statt einer sauberen 401-Antwort. Risiko gering: MVC-Interceptor validiert vorher, aber defensiver Null-Check wäre sauberer.
- **TischStatus.BEENDET nie gesetzt**: Der Enum-Wert existiert, wird aber nirgends zugewiesen — toter Code.
- ~~**Lobby: Tisch erstellen nach Verlassen nicht möglich**~~: Behoben in 4.15 — `aktualisiereTischliste()` aus `fuehreMitStatus` herausgelöst.
- ~~**TischSzene: Karten-Render-Bug nach KI-Zug**~~: Behoben in 4.15 — `renderTisch()` in `starteFolgeanimationen.finally` ergänzt.
- ~~**TischSzene: OST/WEST-Spieler ragen aus Canvas**~~: Behoben in 4.15 — `kartenX` auf 0.10/0.90 korrigiert.

### 5.3 Testlücken (kein Blocker, aber dokumentiert)

- Kein Test für Solo-Ansagen oder Solo-Punkteberechnung isoliert (PunkteRechnerTest)
- Kein Test für zwei gefahrene Füchse (SonderpunktBewerterTest)
- KI-Sonderpunkt-Bewusstsein-Tests fehlen (Fuchs-Jagd, Karlchen-letzter-Stich) — DoD in ki-strategie.md als erledigt markiert
- Kein KI-Integrationstest für Armut- oder Hochzeit-Szenarien (KiOrchestrierungServiceIntegrationTest)
- Keine Tests für BootSzene und LobbySzene
- `pruefeReconnectTimeouts` (Scheduled-Methode) nicht end-to-end getestet
- Kein Test für Multi-Spiel-Partie (anzahlSpiele > 1) im KI-Orchestrierungstest

### 5.4 Spec-Abweichungen (bewusst akzeptiert, Backend)

- Ansagegrenzen als 5 Einzel-Felder statt Map (Spec: `ansageGrenzen: Map`)
- Phasennamen weichen von Spec-Hinweisen ab (z.B. KARTEN_AUSTEILEN statt WARTEN_AUF_SPIELER)
- SockJS-Fallback im Javadoc erwähnt, aber `.withSockJS()` nicht aufgerufen
- Frontend `farbe`/`wert` als `string` statt Union-Type — keine Compile-Time-Sicherheit
- `SpielPersistenzAdapter` in `lobby`-Package statt `partie` — invertierte Abhängigkeit
- `KiOrchestrierungService` in `lobby` statt eigenem Package — Bounded-Context-Grenzüberschreitung
- KI-Strategie-Interface-Signaturen weichen von Spec-Hinweisen ab (verbessert: einzelner KiSpielzustand-Parameter)

### 5.5 Frontend-Redesign-Specs (Fortschritt)

- 6 Frontend-Specs: 5 abgeschlossen (4.9, 4.10, 4.11, 4.12, 4.13), 1 offen (11 DoD-Items)
- Betroffene offene Specs: frontend-rundenauswertung.md (0/11)
- HUD-Overlay-Architektur steht, Tastatursteuerung vollständig, Showstopper-Fixes erledigt, Start-Screen neu implementiert
- Nächste Schritte: 4.14 Rundenauswertung-Overlay oder 4.17 Phaser-Migration UI

---

## 6. Architektur-Notizen

- **Lombok**: CLAUDE.md empfiehlt Lombok (@Getter, @RequiredArgsConstructor), Code verwendet explizite Accessoren. Funktional gleichwertig — kein Handlungsbedarf.
- **PartieController**: `GET /api/partien/{id}/stand` existiert separat neben TischController — korrekt.
- **Alle Tests grün**: 48 Frontend-Tests + umfangreiche Backend-Tests bestanden.
- **TypeScript kompiliert fehlerfrei** (tsc --noEmit).
- **Vite-Build**: Scheitert auf ARM64-Linux wegen fehlendem `@rollup/rollup-linux-arm64-gnu` — Plattform-spezifisch, kein Code-Problem.
- **TischService** ist mit ~541 Zeilen groß und koppelt Lobby-Management mit Spiellogik. Kein Blocker, aber bei Wachstum sollte Spiellogik in eigenen Service extrahiert werden.
- **Exception-Klassen in `session`-Package**: `SpielverwaltungNichtGefundenException` und `SpielverwaltungKonfliktException` werden von `lobby` geworfen — invertierte Abhängigkeit.
