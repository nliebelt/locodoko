# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-29

## Notiz

**2026-03-29 (Planning-Run):** 5 Bounded-Context-Analysen durchgeführt. Neue Frontend-Lücken identifiziert (Stich-Stapel, HUD-Format, Nameplate-Highlight). Backend vollständig. Plan aktualisiert.

**Vorheriger Stand:**

- XSS-Fix Frontend: `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts` ✓
- Spring Boot 4 / Java 25 Migration noch offen

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---

## 0. Infrastruktur & Tech-Upgrade

### 0.1 Spring Boot 4.0.4 + Java 25

- [ ] `pom.xml`: Spring Boot Parent auf `4.0.4` hochziehen
- [ ] `pom.xml`: `<java.version>25</java.version>`
- [ ] Prüfen ob Breaking Changes aus SB 4.x Migration Guide relevant sind
- [ ] `mvn clean verify` grün

---

## 1. Backend — Domain & Persistence

**Status: Vollständig implementiert.**

- [x] **Lobby/Tisch**: GET/POST/PUT `/api/tische`, Beitreten/Verlassen/Starten, WebSocket-Events, TischkonfigurationEmbeddable mit allen 12 Flags + Ansagegrenzen, KI-Schwierigkeit, Tischhintergrund ✓
- [x] **Partie/Regeln**: Spielphasen, Stichlogik, Trumpfhierarchie (Normal + Solo-Varianten), Parteien (RE/KONTRA), Ansagen, Vorbehalt/Auflösung (Solo > Hochzeit > Armut), Sonderpunkte (Fuchs/Karlchen/Doppelkopf), Punkteberechnung DKV-konform ✓
- [x] **Session/API**: SpielerEntity, SpielerSessionService, KI-Spieler-Fabrik, alle REST-Endpunkte, WebSocket/STOMP (Karte/Ansage/Vorbehalt/Armut-Antwort/Snapshots), Exception-Handling (@RestControllerAdvice), Session-Cleanup, KI-Übernahme bei Abbruch ✓
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

### 2.2 Offene Frontend-Aufgaben (priorisiert)

#### Priorität 1 — UX-Verbesserungen

- [ ] **4.22 Stich-Stapel-Visualisierung**: `renderStichStapel()` — gestapelter Fächer neben Kartenfächer des Stich-Gewinners. Spec: Stich 4.16 pending.
- [ ] **4.23 Letzter Stich anzeigen**: Klick auf eigenen Stich-Stapel öffnet Ansicht des letzten Stichs.
- [ ] **4.24 Nameplate-Highlight aktiver Spieler**: Akzentfarbe/Glow für den Spieler, der am Zug ist (Spec: Tischansicht).

#### Priorität 2 — Kleinere UI-Korrekturen

- [ ] **4.25 HUD Stichzähler Format**: Anzeige `„Stich X/12"` statt `„X Stiche"` (Spec: Tischansicht 5.x).

---

## 3. KI

### 3.1 Vollständig implementiert

- [x] `StandardKiStrategie`, `LeichteKiStrategie`, `SchwerKiStrategie` ✓
- [x] Handstärke-Berechnung, Schmieren, Partnerunterstützung ✓
- [x] Vorbehalt, Armut-Angebot, Armut-Antwort, Ansagen, Kartenwahl ✓

### 3.2 Offene KI-Aufgaben

- [ ] **KI Armut-Antwort validieren**: `StandardKiStrategie.waehleArmutAntwort()` gibt bevorzugt Fehlkarten zurück (günstigste Karten per Kosten-Comparator). Technisch regelkonform, aber strategisch prüfen: Soll KI beim Annehmen der Armut wirklich bevorzugt eigene Trümpfe behalten und Fehlkarten zurückgeben? Oder soll sie eine bestimmte Anzahl Trümpfe zurückgeben? Ursache liegt in `vergleicheAbwurfKosten()` (Zeilen ~355–404, StandardKiStrategie).

---

## 4. Offene Aufgaben — Gesamtübersicht (priorisiert)

### Priorität 1 — Tech-Upgrade

- [ ] **0.1 Spring Boot 4 / Java 25**: Siehe Sektion 0.

### Priorität 2 — Frontend UX

- [ ] **4.22 Stich-Stapel-Visualisierung** (kein `renderStichStapel()`)
- [ ] **4.23 Letzter Stich anzeigen** (Klick-Interaktion)
- [ ] **4.24 Nameplate-Highlight aktiver Spieler**
- [ ] **4.25 HUD Stichzähler Format** (`„Stich X/12"`)

### Priorität 3 — KI-Qualität

- [ ] **KI Armut-Antwort Strategie validieren** (strategisch suboptimal?)
- [ ] **KI-Schwierigkeitsgrade differenzieren**: Leicht/Standard/Schwer sind implementiert aber nicht klar kalibriert/getestet.

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
