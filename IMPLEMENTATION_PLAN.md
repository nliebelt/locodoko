# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Letzte Aktualisierung: 2026-04-05 (Plan-Run #26)

## Notiz

**2026-04-05 (Plan-Run #28):** 9.2 Flip-Animation für Letzter-Stich-Overlay implementiert. 9.3 per Grep verifiziert — alle Shortcuts (R/K/1-5/A/N/I/S + ArrowLeft/Right+Enter/Space+Escape) bereits vollständig in TischSzene.ts implementiert, kein Code-Change nötig. 9.4 specs/hochzeit.md um Abschnitt "Stilles Solo" erweitert (Definition, Bedingung, Wertung, Solo-Multiplikator ×3). Alle 9.x Aufgaben abgeschlossen. Alle offenen Aufgaben erledigt.

---

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

---


---

## 7. Architektur-Notizen

- **Phaser vs. HTML**: Ziel ist die Migration aller Spiel-relevanten Dialoge (Armut, Vorbehalt) nach Phaser. Meta-UI bleibt HTML. Armut- und Vorbehalt-Dialoge bereits migriert. KONFLIKT mit `frontend-ui-logik.md:17` (fordert auch Meta-UI in Phaser) — siehe Task 8.6.
- **Transaktionalität**: WebSocket-Broadcasts in `TischEchtzeitService` sind transaktional gebunden.
- **Pragmatisches DDD**: Domain Model = Persistence Model. Spring Data JDBC (kein JPA) + Liquibase.
