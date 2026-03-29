# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-03-29

## Notiz

**2026-03-29:** XSS-Fix im Frontend: Spieler- und Tischnamen in allen 7 innerHTML-Stellen durch `escapeHtml()` geschützt. Plan bereinigt, alle 4.19/4.21 Items als erledigt markiert.

**Was wurde implementiert:**
- `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts` (6+1 Stellen geschützt)

**Nächster logischer Schritt:**
- **Spring Boot 4 / Java 25 Migration** (Sektion 0) ODER
- **KI Armut-Validierung** (KI bietet teils zu viele Trümpfe an)

**Bekannte offene Fragen:**
- KI Armut-Validierung: genaue Ursache noch unklar (welche `KiArmutStrategie`-Methode betroffen?)

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

- [x] **4.19 Kritische Bugfixes & Regeltreue** ✓ 2026-03-29
  - [x] **Stilles Solo Fix**: Exception in `Parteien.ausNormalspielHaenden` behoben.
  - [x] **Variable Trumpfsoli**: Herz-Solo, Pik-Solo, Kreuz-Solo implementiert.
  - [x] **KI Timeout Single-Player**: In `VerbindungsabbruchService` implementiert.
  - [x] **Armut-Einwurf**: `Spiel.eingeworfenesSpiel()` — Neumischen wenn Armut abgelehnt. Test: `wirftNeuEinWennNiemandDieArmutAnnimmt()`.
  - [x] **Punkte-Reihenfolge**: `PunkteRechner.bewerteAbsagen()` DKV-konform (Verschärfungspunkte als flache Zusatzpunkte nach Verdopplung). Tests: `PunkteRechnerTest`.

- [x] **4.21 DKV-Regeln & API-Bereinigung** ✓ 2026-03-29
  - [x] Punkte-Berechnungsreihenfolge: DKV-konform implementiert.
  - [x] Siegbedingung bei misslungenen Absagen: `bewerteAbsagen()` korrekt (Gegenpartei erhält Punkte bei fehlgeschlagener Ansage).
  - [x] WebSocket-Topic-Namen: Konsistent (`/topic/tische` Backend + Frontend).

- [x] Tests: SpielTest (22), PunkteRechnerTest (3), AnsagenTest (3), SonderpunktBewerterTest (2), PartieTest (1)

## 4. Offene Aufgaben (priorisiert)

### Priorität 0 — TischSzene spielbar & vollständig Phaser

- [x] **4.20 TischSzene: Phaser-Migration & kritische UI-Bugs** ✓ 2026-03-28

  Alle Bug-Fixes und Phaser-Migration abgeschlossen. 62 Tests grün, Build+Lint clean.

### Priorität 1 — Tech-Upgrade

- [ ] **0.1 Spring Boot 4 / Java 25**: Siehe Sektion 0.

### Priorität 2 — Sicherheit & Qualität

- [x] **XSS-Fix Frontend**: `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts` — alle 7 User-Input-Interpolationen geschützt. ✓ 2026-03-29
- [ ] **KI Armut-Validierung**: KI bietet teils zu viele Trümpfe an — `KiArmutStrategie` prüfen.

---

## 5. Bekannte Probleme & Risiken

### 5.1 Sicherheit

- ~~**XSS-Risiko im Frontend**~~: Behoben durch `escapeHtml()` in `TischSzene.ts` und `SpielverwaltungsSzene.ts`.

### 5.2 Bugs / Latente Fehler

- **Armut-Validierung**: KI bietet teils zu viele Trümpfe an.
- **Karten-Rendering**: Beim allerersten Seitenaufruf evtl. nicht gerendert (Browser-Reload nötig — durch Canvas-only-Approach entschärft).

---

## 6. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
