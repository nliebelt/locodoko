# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> **Letzte Aktualisierung: 2026-04-15 (Plan-Run #57)**

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen
- [BLOCKED: ...] Blockiert mit Begründung

Erledigte Features: siehe `IMPLEMENTATION_PLAN_ARCHIVE.md` (Plan-Run #56 und davor).

---

## Zusammenfassung Ist-Zustand

**Kern-Features komplett:** Stichlogik, Trumpfhierarchie, Kartendeck, Punkteberechnung, Ansagen,
Sonderpunkte, Bockrunden, Schweinchen, 30-Augen-Pflicht, Solo-Nachgeben, alle 7 Solo-Varianten,
Hochzeit, Armut, KI (3 Schwierigkeitsgrade), WebSocket, REST-API, Session, Verbindungsabbruch,
Frontend (Phaser 3, AppStore, Szenen-Aufteilung, Animationen, Overlays, Tastatursteuerung),
Schnellstart, Einladungslink, Spring Modulith Modulstruktur.

**Build:** `mvn test` grün (231 Tests, 0 Failures).

**Offene Punkte:** Keine.

---

## Notiz

**Zuletzt erledigt (Plan-Run #57):** Build-Fehler B.1 behoben — `SpielRegistryTest`-Stub implementiert `findByEinladungsCode(String)` mit `return Optional.empty()`. `mvn test` läuft grün (231 Tests).

**Nächster Schritt:** Alle bekannten Aufgaben erledigt. Nächste Iteration kann neue Features oder Refactorings beginnen.

**Offene Fragen:** Keine.


