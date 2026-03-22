# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-22
> Methode: 5 parallele Subagenten haben alle Bounded Contexts analysiert

## Notiz

Implementiert: 4.4 Spec-Status aktualisieren. 16 Specs wurden von "Noch nicht begonnen" auf "Vollständig implementiert und getestet" gesetzt. rest-api.md auf "Größtenteils implementiert (ohne OpenAPI)" gesetzt (Swagger fehlt noch — das ist Aufgabe 4.7). verbindungsabbruch.md vollständig abgehakt. Alle DoD-Checkboxen aktualisiert.

Nächster logischer Schritt: 4.5 JSDoc-Dokumentation (AppStore.ts, TischSzene.ts, SpielverwaltungEchtzeit.ts, TischAnsichtModell.ts, AnimationenService.ts). Oder 4.6 E2E-Tests (Playwright). Beide sind unabhängig voneinander.

Bekannte offene Fragen: rest-api.md hat noch eine offene Checkbox (Swagger/OpenAPI — Aufgabe 4.7). Die architektur-ddd.md, tech-migration.md und frontend-logging.md stehen noch auf "Neue Vorgabe" — diese könnten ebenfalls als erledigt markiert werden, wurden aber in dieser Iteration bewusst ausgelassen (die Migration ist schon lange fertig).

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [ ] Offen
- [~] Teilweise implementiert

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
- [x] Tests: TischControllerTest (13 Tests), PartieStandAntwortTest, KiOrchestrierungServiceIntegrationTest

### 2.2 Session (Bounded Context: `de.locodoko.session`)
- [x] SpielerEntity (Aggregate Root) — Mensch + KI-Spieler
- [x] SpielerSessionService — Registrierung, Timeout, Namenänderung
- [x] SpielerSessionController — REST (POST/GET/PUT /api/spieler/session)
- [x] Session-Validierung: MVC-Interceptor + WebSocket-Handshake
- [x] HttpOnly/SameSite-Cookie, konfigurierbarer Timeout (60min)
- [x] Tests: SpielerSessionControllerTest (6 Tests), SpielerSessionHandshakeInterceptorTest

### 2.3 WebSocket/Echtzeit
- [x] STOMP-Konfiguration mit SockJS-Fallback
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
- [x] Tests: VerbindungsabbruchServiceTest (8 Tests), SpielerSessionCleanupServiceTest (7 Tests)
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
- [x] Tests: AppStore (Store-Tests), Logger

### 3.2 BootSzene & LobbySzene
- [x] Session-Initialisierung, Name aus localStorage
- [x] Echtzeit-Tischliste (REST + WebSocket)
- [x] Tisch erstellen / beitreten UI
- [x] Status-Anzeige (Verbindung, Laden, Fehler-Toasts)

### 3.3 TischSzene — Rendering (1524 Zeilen)
- [x] Top-Down-Layout mit 4 Spielerpositionen (SUED/WEST/NORD/OST)
- [x] Kartensprites (prozedural generiert, AssetLoader)
- [x] Eigene Hand als Fächer, Gegner als verdeckte Stapel
- [x] Stichmitte-Darstellung (4 Karten im Zentrum)
- [x] Spielernamen + KI-Symbol
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
- [x] Tests: AnimationenService (Geschwindigkeitsstufen, Banner, Stich-Delay)

### 3.6 TischAnsichtModell
- [x] Backend→Frontend-Transformation (Positionsrotation)
- [x] Kartensortierung (Trumpf nach Rang, Fehlfarben)
- [x] UI-State-Ableitung (aktuellerSpieler, spielbareKarten, moeglicheAnsagen)
- [x] Armut-Erkennung (Angebots-/Antwortmodus)
- [x] Letztes Spielergebnis, Gesamtpunktestand
- [x] Tests: TischAnsichtModell

### 3.7 TischSzene Tests
- [x] 16 Tests in TischSzene.test.ts

---

## 4. Offene Aufgaben (priorisiert)

### Priorität 1 — Spielbar machen (fehlende Spielschleifen-Features)

- [x] **4.1 Session-Recovery bei Tab-Reload (Backend + Frontend)**
  - Backend: `GET /api/spieler/session` um `aktiverTischId` erweitern
  - Frontend: BootSzene prüft `aktiverTischId` und leitet zur TischSzene weiter
  - WebSocket-Reconnect + Snapshot-Anfrage nach Redirect
  - Abhängigkeit: keine

- [x] **4.2 Tisch-Verlassen während Partie (Backend + Frontend)**
  - Frontend: "Tisch verlassen"-Button in TischSzene mit Bestätigungsdialog
  - Backend: `PARTIE_ABGEBROCHEN`-Event bei willentlichem Verlassen (bereits teilweise: `brichAktivePartieAb`)
  - Frontend: Alle Spieler nach Abbruch zur Lobby weiterleiten
  - Abhängigkeit: keine

- [x] **4.3 Auto-Neustart nach Partie-Ende**
  - Backend: `POST /api/tische/{id}/neue-partie` — startet neue Partie nach PartieStatus.BEENDET, idempotent
  - Frontend: Partie-Ende-Modal mit Gesamtpunktestand + 10s-Countdown → `starteNeuePartie()`
  - Frontend: `TischAnsichtModell.partieBeendet` signalisiert letztes Spiel der Partie
  - Abhängigkeit: 4.2 (Leave-Button als Alternative zum Neustart)

### Priorität 2 — Qualität & Dokumentation

- [x] **4.4 Spec-Status aktualisieren**
  - 16 Specs auf "Vollständig implementiert und getestet" gesetzt, rest-api.md auf "Größtenteils implementiert (ohne OpenAPI)"
  - verbindungsabbruch.md: alle 10 neuen DoD-Checkboxen abgehakt, Status auf vollständig gesetzt
  - Alle Definition-of-Done-Checkboxen in erledigten Specs abgehakt

- [ ] **4.5 JSDoc-Dokumentation (frontend-architektur.md)**
  - JSDoc für AppStore.ts, TischSzene.ts, SpielverwaltungEchtzeit.ts, TischAnsichtModell.ts, AnimationenService.ts
  - Abhängigkeit: keine

- [ ] **4.6 E2E-Tests (e2e-tests.md)**
  - Playwright-Setup in `e2e/` Verzeichnis
  - Test: Partie gegen KI (Session → Tisch erstellen → Starten → Partie durchspielen)
  - Abhängigkeit: 4.1 (Session-Recovery hilfreich für stabile Tests)

### Priorität 3 — Nice-to-have

- [ ] **4.7 Swagger/OpenAPI-Dokumentation**
  - springdoc-openapi Dependency + Annotationen
  - Abhängigkeit: keine

- [ ] **4.8 KI-Schwierigkeitsstufen**
  - KiStrategieFactory mit Easy/Standard/Hard-Varianten
  - Abhängigkeit: keine

---

## 5. Architektur-Notizen

- **Lombok**: CLAUDE.md empfiehlt Lombok (@Getter, @RequiredArgsConstructor), Code verwendet explizite Accessoren. Funktional gleichwertig — kein Handlungsbedarf.
- **PartieController**: `GET /api/partien/{id}/stand` ist in TischController integriert statt separat — akzeptabel.
- **Alle Backend-Tests grün**: 46 Frontend-Tests + umfangreiche Backend-Tests bestanden.
- **TypeScript kompiliert fehlerfrei** (tsc --noEmit).
- **Vite-Build**: Scheitert auf ARM64-Linux wegen fehlendem `@rollup/rollup-linux-arm64-gnu` — Plattform-spezifisch, kein Code-Problem.
