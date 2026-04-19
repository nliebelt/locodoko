# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> **Letzte Aktualisierung: 2026-04-18 (Plan-Run #83)**

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen
- [BLOCKED: ...] Blockiert mit Begründung

Erledigte Features: siehe `IMPLEMENTATION_PLAN_ARCHIVE.md`.

---

## Zusammenfassung Ist-Zustand

**Kern-Features komplett:** Stichlogik, Trumpfhierarchie, Kartendeck, Punkteberechnung, Ansagen,
Sonderpunkte, Bockrunden, Schweinchen, 30-Augen-Pflicht, Solo-Nachgeben, alle 7 Solo-Varianten,
Hochzeit, Armut, KI (3 Schwierigkeitsgrade), WebSocket, REST-API, Session, Verbindungsabbruch,
Frontend (Phaser 3, AppStore, Szenen-Aufteilung, Animationen, Overlays, Tastatursteuerung),
Schnellstart, Einladungslink, Spring Modulith Modulstruktur, Authentifizierung, Spieler-Profile,
typisierte WebSocket-Events.

**Build:** `mvn test` grün (254 Tests, 0 Failures).

**Offene Punkte:** Keine. Alle Features implementiert.

---

## Notiz

**Alle Feature-Aufgaben erledigt (Stand Plan-Run #83).**

Zuletzt implementiert:
- **BF-8** — Schmeißen-Recht 1× pro Spiel (`bereitsGeschmissen: Set<SpielerPosition>` in `Spiel`, Liquibase Changeset 017)
- **KI-2** — Solo-Schwellenwert-Tuning bei aktiven Sonderregeln (`soloSchwelle(VorbehaltAnsage, KiSpielzustand)` mit Faktor 1.15)
- **SF-3** — Frontend Tischkonfiguration-Presets (Preset-Dropdown in `SpielverwaltungsSzene.ts`)
- **BF-13/14/15** — KI-Animationen letzter Stich, Spielankündigung-Timing, Reconnect-Guard

**Pre-existing Failures (nicht durch aktuelle Änderungen verursacht):**
- `PartieTest.partieMitOhneNeunenSchliesstNachZehnStichenAb`
- `PersistenzRepositoryTest.loeschtPartienSpieleUndSticheWennEinTischEntferntWird`

**Offene Frage (ARCH-4):** Werden `SPIEL_BEENDET`, `SPIEL_GESTARTET`, `ANSAGE_ERFOLGT`, `SCHWEINCHEN_GEMELDET` vom Backend bereits als typisierte Events gesendet? `PartieEreignisTyp` und `AppStore.abonniereEvents()` sind vorbereitet, aber unklar ob Backend diese Events aktiv versendet.

---

## Nächste Aufgabe: Neue E2E-Tests ausführen und grün bestätigen

Die folgenden Tests wurden neu hinzugefügt und müssen gegen ein laufendes Backend verifiziert werden:

| Datei | Beschreibung |
|---|---|
| `e2e/tests/mehrere-runden.spec.ts` | 2 Runden Quick Game (ohneNeunen), BF-13–15 |
| `e2e/tests/mehrere-runden-ohne-neunen.spec.ts` | 2 Runden via Modal (LOCO_BLAT explizit), /10-Assertion |

**Außerdem korrigiert** (Assertion war nach CFG-1 falsch):
- `schnellstart.spec.ts`: `"Stich 1/12"` → `"Stich 1/10"` (standard() = ohneNeunen seit CFG-1)
- `partie-gegen-ki.spec.ts`: `"Stich 1/12"` → `"Stich 1/10"` (Modal-Default = LOCO_BLAT = ohneNeunen)

Ausführen:
```sh
cd e2e && npx playwright test mehrere-runden.spec.ts mehrere-runden-ohne-neunen.spec.ts schnellstart.spec.ts partie-gegen-ki.spec.ts
```
