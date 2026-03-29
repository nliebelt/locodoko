# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-29

## Notiz

**2026-03-29:** Task 4.19 (Kritische Backend-Bugs) vollständig implementiert und getestet.

**Was wurde implementiert:**
- **Stilles Solo Fix**: `Spiel.loeseVorbehalteAuf()` erkennt nun Spieler mit 2 Kreuz-Damen ohne Vorbehalt (GESUND) und erzwingt SOLO_TRUMPF statt Exception. `SpielPersistenzAdapter.parteien()` rekonstruiert stilles Solo korrekt aus DB (sucht 2 Kreuz-Damen in Hand + Stichen).
- **Variable Trumpfsoli**: `VariableTrumpfsoloTrumpfOrdnung` (neue Klasse) für Herz-/Pik-/Kreuzsolo. Neue Enum-Werte `SOLO_TRUMPF_HERZ/PIK/KREUZ` in `VorbehaltAnsage` und `Spieltyp`. Frontend-Typen und TischSzene formatieren die neuen Solos korrekt. `TischAnsichtModell.istTrumpfFuerSpieltyp()` erkennt Trumpf-Karten für alle drei variablen Solos.
- **KI Timeout Single-Player**: War bereits implementiert (VerbindungsabbruchService.java:164-173) — als erledigt markiert.
- 128 Backend-Tests grün, 62 Frontend-Tests grün, Build+Lint clean.

**Nächster logischer Schritt:**
- **4.21 Armut-Einwurf** (Neumischen wenn Armut abgelehnt) oder **Punkte-Reihenfolge** (DKV-Konformität).

**Bekannte Probleme:**
- Karten rendern beim allerersten Seitenaufruf evtl. nicht (Browser-Reload — war vorher bekannt, durch Canvas-only-Approach entschärft).

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
- [~] **4.19 Kritische Bugfixes & Regeltreue**
  - [x] **Stilles Solo Fix**: Exception in `Parteien.ausNormalspielHaenden` beheben (stilles Solo erzwingen, wenn 2 Kreuz-Damen ohne Vorbehalt).
  - [x] **Variable Trumpfsoli**: Auswahl von Herz, Pik oder Kreuz als Trumpf im Solo ermöglichen (statt Hardcoded Karo).
  - [x] **KI Timeout Single-Player**: KI-Timeout bereits in VerbindungsabbruchService implementiert.
  - [ ] **Armut-Einwurf**: Mechanik zum Neumischen, wenn Armut von niemandem angenommen wird.
  - [ ] **Punkte-Reihenfolge**: Absage-Punkte vor der Verdopplung addieren (DKV-Konformität).
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
- [x] Spieler-Nameplates mit relativer Positionierung (SUED/NORD rechts, WEST unten, OST oben)
- [x] Aktiver Spieler hervorgehoben
- [x] Tischhintergrund-Auswahl (3 Optionen)
- [x] Animationsgeschwindigkeit-Umschalter (1x/2x/sofort)

### 3.4 TischSzene — Interaktion
- [x] Karten anklicken zum Ausspielen (mit Animation)
- [x] Spielbare Karten hervorgehoben / nicht-spielbare ausgegraut
- [x] Vorbehalt-Buttons (Gesund, Soli, Hochzeit, Armut) — Phaser-Dialog (Task 4.20)
- [x] Ansage-Buttons (Re, Kontra, Keine 90, etc.) — Phaser-Objekte (Task 4.20)
- [x] Aktions-Hinweis ("Du bist dran…") — Phaser-Text (Task 4.20)
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
- [x] 32 Tests in TischSzene.test.ts (Phaser-UI vollständig getestet)

---

## 4. Offene Aufgaben (priorisiert)

### Priorität 0 — TischSzene spielbar & vollständig Phaser

- [x] **4.20 TischSzene: Phaser-Migration & kritische UI-Bugs** ✓ 2026-03-28

  Alle Bug-Fixes und Phaser-Migration abgeschlossen. 62 Tests grün, Build+Lint clean.

### Priorität 1 — Kritische Backend-Bugs

- [ ] **4.19 Kritische Bugfixes (Backend)**
  - [ ] **Stilles Solo Fix**: `Parteien.ausNormalspielHaenden` wirft Exception wenn 2 Kreuz-Damen ohne Vorbehalt → defensive Behandlung ergänzen.
  - [ ] **Variable Trumpfsoli**: Herz-Solo, Pik-Solo, Kreuz-Solo implementieren (aktuell nur Karo fest verdrahtet).
  - [ ] **KI Timeout Single-Player**: In `KiOrchestrierungService` prüfen ob nur 1 Mensch am Tisch → Reconnect-Timeout nicht ablaufen lassen.

### Priorität 2 — DKV-Konformität

- [ ] **4.21 DKV-Regeln & API-Bereinigung**
  - [ ] Punkte-Berechnungsreihenfolge anpassen.
  - [ ] Siegbedingung bei misslungenen Absagen korrigieren.
  - [ ] WebSocket-Topic-Namen vereinheitlichen (`/topic/tische` vs `/topic/lobby`).

---

## 5. Bekannte Probleme & Risiken

### 5.1 Sicherheit

- **XSS-Risiko im Frontend**: Spieler- und Tischnamen werden via `innerHTML` in Template-Literals gerendert.

### 5.2 Bugs / Latente Fehler

- **Stilles Solo Exception**: `Parteien.ausNormalspielHaenden` wirft Exception bei 2 Kreuz-Damen ohne Vorbehalt.
- **Tastatur-Handler**: `registriereTastaturHandler` fehlt in `TischSzene`.
- **Armut-Validierung**: KI bietet teils zu viele Trümpfe an.

### 5.4 Spec-Abweichungen

- **Ansagegrenzen**: Einzel-Felder statt Map.
- **WS-Payloads**: `spielerId` fehlt (wird über Principal gelöst).
- **DKV-Punkte**: Berechnung weicht bei Absagen ab.

---

## 6. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
