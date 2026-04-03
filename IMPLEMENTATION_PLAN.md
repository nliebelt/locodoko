# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-03

## Notiz

**2026-04-03 (Plan-Run #12):**
- **5.1 Solo-Punkte-Multiplikation verifiziert und getestet**: Multiplikation (Faktor 3) war bereits korrekt in `PunkteRechner.verteileSpielpunkte()` (Zeilen 163-167) implementiert. Zwei neue Tests belegen Solo-Sieger (+3/-1/-1/-1) und Solo-Verlierer (-3/+1/+1/+1) inkl. Nullsummen-Prüfung. 136 Tests grün.
- **Nächster Schritt**: 5.2 KI Hochzeit-Partnerstrategie — `StandardKiStrategie` und `SchwerKiStrategie` werten `hochzeitStatus` in `waehleKarte()` nicht aus.
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

## 0. Infrastruktur & Tech-Upgrade

### 0.1 Spring Boot 4.0.4 + Java 25

- [x] `pom.xml`: Spring Boot Parent auf `4.0.4` hochgezogen ✓ 2026-03-29
- [x] `pom.xml`: `<java.version>25</java.version>` ✓ 2026-03-29
- [x] Breaking Changes behoben (AutoConfigureMockMvc, TestRestTemplate, Jackson 3, Liquibase-Starter) ✓ 2026-03-29
- [x] `mvn test` grün (128 Tests) ✓ 2026-03-29

---

## 1. Backend — Domain & Persistence

**Status: Vollständig implementiert.**

- [x] **Lobby/Tisch**: GET/POST/PUT `/api/tische`, Beitreten/Verlassen/Starten, WebSocket-Events, TischkonfigurationEmbeddable mit allen 12 Flags + Ansagegrenzen, KI-Schwierigkeit, Tischhintergrund ✓
- [x] **Partie/Regeln**: Spielphasen, Stichlogik, Trumpfhierarchie (Normal + Solo-Varianten), Parteien (RE/KONTRA), Ansagen, Vorbehalt/Auflösung (Solo > Hochzeit > Armut), Sonderpunkte (Fuchs/Karlchen/Doppelkopf), Punkteberechnung DKV-konform ✓
- [x] **Session/API**: SpielerEntity, SpielerSessionService, KI-Spieler-Fabrik, alle REST-Endpunkte, WebSocket/STOMP (Karte/Ansage/Vorbehalt/Armut-Antwort/Snapshots), Exception-Handling (@RestControllerAdvice), Session-Cleanup, KI-Übernahme bei Abbruch ✓
- [x] **Sonderspiele**: 5 Solo-Varianten (Trumpfsolo, Damensolo, Bubensolo, Herz/Pik/Kreuz, Fleischlos), Hochzeit mit Klärungsfrist + stillem Solo, Armut mit Uhrzeigersinn-Abfrage ✓
- [x] **Verbindungsabbruch**: VerbindungsabbruchService mit DisconnectInfo-Tracking, konfigurierb. Timeout (120s), KI-Übernahme via @Scheduled, Reconnect-Wiederherstellung ✓
- [x] **4.19 Kritische Bugfixes**: Stilles Solo, Variable Trumpfsoli, KI Timeout, Armut-Einwurf, Punkte-Reihenfolge ✓ 2026-03-29
- [x] **4.21 DKV-Regeln & API-Bereinigung** ✓ 2026-03-29

---

## 2. Frontend

### 2.1 Vollständig implementiert

- [x] TischSzene: Layout, HUD Top-Bar, Spieler-Nameplates, Kartenfächer (alle 4 Spieler), Kartenrücken für Gegner ✓
- [x] Karten-Rendering: vectorized-playing-cards, Grayout für nicht spielbare Karten, Stichmitte ✓
- [x] Spielaktionen: Karte ausspielen, Ansage-Buttons, Vorbehalt-Dialog (Phaser), Armut-Dialog (2-Phasen) ✓
- [x] Animationen: Karte ausspielen (400ms), Stich einziehen (500-700ms), Austeilen (gestaffelt), Ansage-Banner, Geschwindigkeitsfaktor ✓
- [x] Tastatursteuerung: Pfeiltasten, Enter, Zifferntasten ✓
- [x] Fehlermeldungen als Toasts ✓
- [x] Seitenlade mit Spieler, Punktestand, Ansagehistorie ✓
- [x] Debug-Modus (gegnerische Karten aufgedeckt) ✓
- [x] XSS-Fix: `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts` ✓ 2026-03-29
- [x] 4.20 TischSzene: Phaser-Migration & kritische UI-Bugs ✓ 2026-03-28
- [x] **4.24 Nameplate-Highlight aktiver Spieler**: gold+glow (`TischSzene.ts:800–809`, `istAktivHervorgehoben`) ✓ 2026-03-29

### 2.2 Offene Frontend-Aufgaben (priorisiert)

#### Priorität 1 — UX-Verbesserungen

- [x] **4.22 Stich-Stapel-Visualisierung**: `renderStichStapel()` — gestapelter Fächer mit Badge neben jedem Spieler. ✓ 2026-03-29
- [x] **4.23 Letzter Stich anzeigen**: Klick auf SUED-Stapel → Phaser-Overlay mit 4 Karten, Auto-Close 4s. ✓ 2026-03-29
- [x] **4.26 Gewinn-Flash**: Nameplate des Stich-Gewinners leuchtet kurz auf (goldenes Overlay-Rechteck, 400ms gesamt). ✓ 2026-03-29

#### Priorität 2 — Kleinere UI-Korrekturen

- [x] **4.25 HUD Stichzähler Format**: Anzeige `„Stich X/12"` statt `„X Stiche"` (`TischSzene.ts:714`). ✓ 2026-03-29

---

## 3. KI

### 3.1 Vollständig implementiert

- [x] `StandardKiStrategie`, `LeichteKiStrategie`, `SchwerKiStrategie` ✓
- [x] Handstärke-Berechnung, Schmieren, Partnerunterstützung ✓
- [x] Vorbehalt, Armut-Angebot, Armut-Antwort, Ansagen, Kartenwahl ✓

### 3.2 Offene KI-Aufgaben

- [x] **KI Armut-Antwort validieren**: Fehlkarten-Rückgabe ist strategisch korrekt. `abwurfKosten()` (+30-Offset) sichert Trumpf > Fehlkarte immer. 3 Tests beweisen das Verhalten. ✓ 2026-03-29
- [x] **4.27 KI-Timeout für Einzelspieler-Tische deaktivieren**: `humanPlayerCount == 1`-Check in `pruefeReconnectTimeouts()` verhindert KI-Übernahme. Abgesichert durch `VerbindungsabbruchEinzelspielerTest`. ✓ 2026-03-29

---

## 4. Offene Aufgaben — Gesamtübersicht (priorisiert)

### Priorität 1 — Tech-Upgrade

- [x] **0.1 Spring Boot 4 / Java 25**: Siehe Sektion 0. ✓ 2026-03-29

### Priorität 2 — Frontend UX

- [x] **4.22 Stich-Stapel-Visualisierung** ✓ 2026-03-29
- [x] **4.23 Letzter Stich anzeigen** ✓ 2026-03-29
- [x] **4.26 Gewinn-Flash** (Nameplate aufleuchten bei Stichgewinn) ✓ 2026-03-29
- [x] **4.25 HUD Stichzähler Format** (`„Stich X/12"`, `TischSzene.ts:714`) ✓ 2026-03-29

### Priorität 3 — KI-Qualität & Robustheit

- [x] **KI Armut-Antwort Strategie validieren** — korrekt, Tests vorhanden ✓ 2026-03-29
- [x] **4.27 KI-Timeout Einzelspieler** (Spec §4.18) ✓ 2026-03-29
- [x] **KI-Schwierigkeitsgrade differenzieren**: Alle 6 Ansage-Schwellen (RE/KONTRA/KEINE_90-SCHWARZ) durch Tests belegt. Leicht/Standard/Schwer klar abgegrenzt. ✓ 2026-03-29

---

## 5. Neue Aufgaben (identifiziert 2026-04-03)

### Priorität 1 — Potenzieller Regelverstoß

- [x] **5.1 Solo-Punkte-Multiplikation verifizieren**: Multiplikation korrekt in `PunkteRechner.verteileSpielpunkte()`. Zwei Tests für Solo-Sieg (+3/-1/-1/-1) und Solo-Niederlage (-3/+1/+1/+1) ergänzt. ✓ 2026-04-03

### Priorität 2 — KI-Qualität

- [ ] **5.2 KI Hochzeit-Partnerstrategie**: `StandardKiStrategie` und `SchwerKiStrategie` haben keine Logik, den Hochzeit-Partner zu erkennen und zu unterstützen. `KiSpielzustand` trägt bereits `hochzeitStatus`, wird aber in `waehleKarte()` nicht ausgewertet.
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

## 6. Bekannte Probleme & Risiken

### 6.1 Sicherheit

- ~~**XSS-Risiko im Frontend**~~: Behoben durch `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts`.

### 6.2 Bugs / Latente Fehler

- **Karten-Rendering**: Beim allerersten Seitenaufruf evtl. nicht gerendert (Browser-Reload nötig — durch Canvas-only-Approach entschärft).

---

## 7. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML. Armut- und Vorbehalt-Dialoge bereits migriert.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
