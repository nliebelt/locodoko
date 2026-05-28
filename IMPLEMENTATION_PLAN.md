# IMPLEMENTATION_PLAN — Locodoko Doppelkopf

> Stand: 2026-05-27. Erledigte Aufgaben → `IMPLEMENTATION_PLAN_ARCHIVE.md`

## Notiz

**REFACTOR-SPIEL-HYBRID vollständig abgeschlossen (Session 13, 2026-05-26).** Alle 21 Tasks (DB-1..DB-10, FE-1..FE-6, FEAT-52, DOC-65) erledigt und archiviert.

**Nächster logischer Schritt:** Neuer Plan-Run durch User oder weiteres Spec-Review.

**Offene Fragen:** Keine.

## Legende

- [x] Erledigt (Code + Tests vorhanden und grün)
- [~] Teilweise implementiert
- [ ] Offen

## Build-Modus-Leitfaden (gilt für alle DB-Tasks)

Diese Regeln gelten unabhängig vom konkreten Task, damit auch ein kleineres Modell (Sonnet/Haiku) die Refactor-Reihe sicher umsetzen kann:

1. **Erste Datei zuerst:** Jeder Task enthält einen „Erste Datei zuerst"-Hinweis. Mit der starten.
2. **Pro Task ein Commit:** Keine Bündelung mehrerer Tasks in einem PR (Ausnahme: explizit als Mega-Commit dokumentiert).
3. **Bei Unklarheit: kleinste Änderung + `mvn test`.** Nicht spekulativ refaktorieren.
4. **Tests müssen vor jedem Commit grün sein.** Bei Bruch: ROLLBACK des aktuellen Versuchs, Wurzelursache verstehen, neu ansetzen.
5. **Pure-JUnit-Tests bleiben pure JUnit.** `@SpringBootTest` darf NICHT zu einer Test-Klasse hinzugefügt werden, die heute ohne läuft.
6. **VO bleibt VO wo möglich:** Postgres JSONB + Custom Converter ermöglichen, dass Domain-VOs immutable bleiben.
7. **Greenfield-Annahme:** Keine Datenmigration nötig. Lokale Dev-DBs werden frisch aufgesetzt.
8. **Spec-Konsultation:** Bei jedem Task der Specs anpasst: `grep -rn "<altes Konzept>" specs/` als Verifikations-Schritt.

---

## Offene Aufgaben

*Keine offenen Tasks. Nächsten Plan-Run durch User triggern.*

---

## Stoppregeln für Build-Modus

- **Wenn Test-Suite bricht und nicht in 3 Versuchen reparierbar ist**: Stoppen, Iteration abbrechen, Notiz im Plan unter "Entdeckungen" hinterlassen. Nicht stapeln.
- **Wenn unklar zwischen Optionen**: Die *kleinere/risikoärmere* Option wählen. Im Zweifel: dokumentieren als Notiz und nächste Task.
- **Niemals**: `--no-verify` bei Commits, `git push --force` ohne explizite User-Anweisung, Tests `@Disabled` markieren ohne Notiz im Plan.
