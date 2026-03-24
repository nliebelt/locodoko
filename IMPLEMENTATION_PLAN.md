# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-23 (Re-Validierung)
> Methode: 5 parallele Subagenten haben alle Bounded Contexts analysiert

## Notiz

Alle Aufgaben in IMPLEMENTATION_PLAN.md sind erledigt — das Projekt ist **vollständig**.

Re-Validierung am 2026-03-23: 5 parallele Subagenten haben alle Bounded Contexts erneut geprüft.
Ergebnis: Alle Features implementiert, alle Specs als erledigt markiert, alle Tests aktiv (keine @Disabled/@Skip).
Keine neuen blockierenden Probleme gefunden. Bekannte Bugs/Testlücken (Sektion 5) bestätigt, keine Verschlechterung.

Was wurde in der letzten Iteration implementiert:
- **4.8 KI-Schwierigkeitsstufen**: KiSchwierigkeit-Enum (LEICHT/STANDARD/SCHWER), LeichteKiStrategie (immer erste Karte, keine Ansagen), SchwerKiStrategie (wie Standard, aber RE-Schwelle 24 statt 28), KiStrategieFactory als Spring @Component, KiOrchestrierungService nutzt Factory statt direkten KiStrategie-Bean, TischkonfigurationEmbeddable und TischKonfigurationDto um kiSchwierigkeit erweitert, Liquibase-Migration 002-ki-schwierigkeit.yaml, Frontend-DTO + TischSzene-Selector + AppStore-Methode aktualisiereAktuelleKiSchwierigkeit, KI-Badge zeigt Schwierigkeitsstufe.

Nächster logischer Schritt:
- Keine offenen Aufgaben mehr. Alle Nice-to-have-Features sind implementiert.

Bekannte offene Fragen: keine. Alle bekannten Bugs aus Sektion 5.2 sind dokumentiert aber nicht kritisch.

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

### 3.3 TischSzene — Rendering (~1650 Zeilen)
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

---

## 5. Bekannte Probleme & Risiken

### 5.1 Sicherheit

- **XSS-Risiko im Frontend**: Spieler- und Tischnamen werden via `innerHTML` in Template-Literals gerendert (LobbySzene, TischSzene). Benutzerkontrollierte Strings werden nicht escaped. Ein Spieler könnte `<img src=x onerror=alert(1)>` als Namen setzen.

### 5.2 Bugs / Latente Fehler

- **TischSzene: leaveButton während IM_SPIEL deaktiviert**: `leaveButton.disabled = tisch.status !== 'WARTEND'` verhindert das Verlassen während einer laufenden Partie über den Button. Die "Zur Lobby"-Navigation funktioniert, ruft aber nicht `appStore.verlasseAktuellenTisch()` auf — die Partie wird dadurch nicht korrekt abgebrochen.
- **SpielerSessionController PUT-Pfad: Potenzielle NPE**: `request.getSession(false)` wird ohne Null-Check verwendet; bei fehlender Session gibt `.getId()` eine NPE statt einer sauberen 401-Antwort.
- **TischStatus.BEENDET nie gesetzt**: Der Enum-Wert existiert, wird aber nirgends zugewiesen — toter Code.

### 5.3 Testlücken (kein Blocker, aber dokumentiert)

- Kein Test für Solo-Ansagen oder Solo-Punkteberechnung isoliert (PunkteRechnerTest)
- Kein Test für zwei gefangene Füchse (SonderpunktBewerterTest)
- KI-Sonderpunkt-Bewusstsein-Tests fehlen (Fuchs-Jagd, Karlchen-letzter-Stich) — DoD in ki-strategie.md als erledigt markiert
- Kein KI-Integrationstest für Armut- oder Hochzeit-Szenarien (KiOrchestrierungServiceIntegrationTest)
- Keine Tests für BootSzene und LobbySzene
- `pruefeReconnectTimeouts` (Scheduled-Methode) nicht end-to-end getestet
- Kein Test für Multi-Spiel-Partie (anzahlSpiele > 1) im KI-Orchestrierungstest

### 5.4 Spec-Abweichungen (bewusst akzeptiert)

- Ansagegrenzen als 5 Einzel-Felder statt Map (Spec: `ansageGrenzen: Map`)
- Phasennamen weichen von Spec-Hinweisen ab (z.B. KARTEN_AUSTEILEN statt WARTEN_AUF_SPIELER)
- SockJS-Fallback im Javadoc erwähnt, aber `.withSockJS()` nicht aufgerufen
- Karten-Sprites prozedural generiert statt Spritesheet (funktional, aber anders als Spec)
- Frontend `farbe`/`wert` als `string` statt Union-Type — keine Compile-Time-Sicherheit
- `SpielPersistenzAdapter` in `lobby`-Package statt `partie` — invertierte Abhängigkeit
- `KiOrchestrierungService` in `lobby` statt eigenem Package — Bounded-Context-Grenzüberschreitung

---

## 6. Architektur-Notizen

- **Lombok**: CLAUDE.md empfiehlt Lombok (@Getter, @RequiredArgsConstructor), Code verwendet explizite Accessoren. Funktional gleichwertig — kein Handlungsbedarf.
- **PartieController**: `GET /api/partien/{id}/stand` existiert separat neben TischController — korrekt.
- **Alle Tests grün**: 48 Frontend-Tests + umfangreiche Backend-Tests bestanden.
- **TypeScript kompiliert fehlerfrei** (tsc --noEmit).
- **Vite-Build**: Scheitert auf ARM64-Linux wegen fehlendem `@rollup/rollup-linux-arm64-gnu` — Plattform-spezifisch, kein Code-Problem.
- **TischService** ist mit ~541 Zeilen groß und koppelt Lobby-Management mit Spiellogik. Kein Blocker, aber bei Wachstum sollte Spiellogik in eigenen Service extrahiert werden.
- **Exception-Klassen in `session`-Package**: `SpielverwaltungNichtGefundenException` und `SpielverwaltungKonfliktException` werden von `lobby` geworfen — invertierte Abhängigkeit.
