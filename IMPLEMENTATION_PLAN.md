# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-29

## Notiz

**2026-03-29 (Build-Run #8):**
- **4.27 KI-Timeout Einzelspieler** abgeschlossen: `VerbindungsabbruchService.pruefeReconnectTimeouts()` überspringt KI-Übernahme wenn `humanPlayerCount == 1` (Spec §4.18). Fix war bereits vorhanden; `VerbindungsabbruchEinzelspielerTest` (neuer Integrationtest, `reconnect-timeout-sekunden=-1`) bestätigt das Verhalten. 129 Tests grün.
- **Nächster Schritt**: **KI Armut-Antwort Strategie validieren** — `StandardKiStrategie.waehleArmutAntwort()` gibt bevorzugt Fehlkarten zurück. Strategisch prüfen ob das korrekt ist.
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

- [ ] **KI Armut-Antwort validieren**: `StandardKiStrategie.waehleArmutAntwort()` gibt bevorzugt Fehlkarten zurück (günstigste Karten per Kosten-Comparator). Technisch regelkonform, aber strategisch prüfen: Soll KI beim Annehmen der Armut wirklich bevorzugt eigene Trümpfe behalten und Fehlkarten zurückgeben? Ursache: `vergleicheAbwurfKosten()` (~Zeilen 355–404, StandardKiStrategie).
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

- [ ] **KI Armut-Antwort Strategie validieren** (strategisch suboptimal?)
- [x] **4.27 KI-Timeout Einzelspieler** (Spec §4.18) ✓ 2026-03-29
- [ ] **KI-Schwierigkeitsgrade differenzieren**: Leicht/Standard/Schwer implementiert aber nicht klar kalibriert/getestet.

---

## 5. Bekannte Probleme & Risiken

### 5.1 Sicherheit

- ~~**XSS-Risiko im Frontend**~~: Behoben durch `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts`.

### 5.2 Bugs / Latente Fehler

- **KI Armut-Antwort**: Gibt bevorzugt Fehlkarten zurück — technisch korrekt, strategisch fraglich.
- **Karten-Rendering**: Beim allerersten Seitenaufruf evtl. nicht gerendert (Browser-Reload nötig — durch Canvas-only-Approach entschärft).

---

## 6. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML. Armut- und Vorbehalt-Dialoge bereits migriert.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
