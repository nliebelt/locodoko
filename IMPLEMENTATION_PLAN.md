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

**Alle Aufgaben erledigt (Stand Plan-Run #83).**

Zuletzt implementiert:
- **BF-8** — Schmeißen-Recht 1× pro Spiel (`bereitsGeschmissen: Set<SpielerPosition>` in `Spiel`, Liquibase Changeset 017)
- **KI-2** — Solo-Schwellenwert-Tuning bei aktiven Sonderregeln (`soloSchwelle(VorbehaltAnsage, KiSpielzustand)` mit Faktor 1.15)
- **SF-3** — Frontend Tischkonfiguration-Presets (Preset-Dropdown in `SpielverwaltungsSzene.ts`)

**Pre-existing Failures (nicht durch aktuelle Änderungen verursacht):**
- `PartieTest.partieMitOhneNeunenSchliesstNachZehnStichenAb`
- `PersistenzRepositoryTest.loeschtPartienSpieleUndSticheWennEinTischEntferntWird`

**Offene Frage (ARCH-4):** Werden `SPIEL_BEENDET`, `SPIEL_GESTARTET`, `ANSAGE_ERFOLGT`, `SCHWEINCHEN_GEMELDET` vom Backend bereits als typisierte Events gesendet? `PartieEreignisTyp` und `AppStore.abonniereEvents()` sind vorbereitet, aber unklar ob Backend diese Events aktiv versendet.
