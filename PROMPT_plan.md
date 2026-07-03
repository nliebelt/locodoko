# Ralph Planning Mode — Locodoko

## Ziel

Spielbares Doppelkopf-Spiel im Browser — Spring Boot Backend + Phaser Frontend,
auslieferbar als einzelnes JAR.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden) um den bisherigen Stand zu verstehen.
    Lies die `## Notiz`-Sektion und die `## Entdeckungen`-Sektion — sie enthalten den Stand der letzten Iterationen.
    Hintergrundkontext für alle Subagenten: `specs/architektur.md`

0b. Scanne die Codebase gegen die Specs.
    Führe zuerst `python3 check_specs.py` aus — gibt tote Klassenreferenzen, Enum-Konstanten
    und Dateipfade in den Specs aus (Exit-Code ≠ 0 = Befunde). Befunde als DOC-Tasks einplanen.
    Lies dann `specs/README.md` als Landkarte. Lies `specs/architektur.md` als Kompass.
    Prüfe den Code (`src/`, `frontend/src/`) gegen die zugehörigen Specs.

    Ziel-Frage: **Wo weicht der Code von den Specs ab, und wo fehlt Implementierung?**

    Regeln:
    - Zuerst suchen, nicht annehmen dass etwas fehlt.
    - Ignoriere Bereiche die im IMPLEMENTATION_PLAN als `[x] Erledigt` markiert sind,
      es sei denn `## Entdeckungen` deutet auf ein Problem dort hin.
    - Specs mit Status "Zu prüfen" vollständig lesen.
    - Max. 20 Zeilen Ergebnis pro analysiertem Bereich.

0c. Für jede gemeldete Inkonsistenz zwischen Spec und Code: entscheide ob die Spec oder
    der Code die Wahrheit ist, und trage die Korrektur als eigene Aufgabe in den Plan ein.

## Planung

1. Erstelle oder aktualisiere @IMPLEMENTATION_PLAN.md als priorisierte Aufgabenliste:
   - Blockierende Abhängigkeiten zuerst
   - Erledigte `[x]`-Einträge abgeschlossener Runden nach `IMPLEMENTATION_PLAN_ARCHIVE.md`
     verschieben (Slim-Down) — der Plan enthält nur die aktive Runde plus Blöcke B/C/D
   - Es existiert genau EINE `### Empfohlene Build-Reihenfolge`-Sektion: Reihenfolge-Sektionen
     abgeschlossener Runden entfernen bzw. in die aktuelle zusammenführen
   - Jeden `[BLOCKED: ...]`-Eintrag neu bewerten: ist der Blocker noch gültig?
     Falls nicht, entsperren und neu einordnen. Falls ja, dokumentiere warum.
   - `## Entdeckungen`-Einträge in konkrete Tasks umwandeln oder als erledigt markieren.
   - Status-Zeile jeder gelesenen Spec gegen den Code-Stand prüfen (z.B. „Entwurf", obwohl
     implementiert) — Abweichungen als `DOC-`-Task einplanen.

2. Jede Aufgabe bekommt:
   - Einen Prefix: `FEAT-`, `FE-`/`UI-`, `BUG-`, `REFACTOR-`, `DOC-`/`SPEC-`, `SCHEMA-`/`DB-`,
     `SECURITY-`/`SEC-`, `QA-`, `DEPS-`, `CLEANUP-`, `TEST-`, `OPS-`, `DECISION-`
     (dieselbe Liste kennt der Build-Modus für seine Validierungswahl)
   - Genug Kontext dass der Build-Modus sie ohne Rückfragen umsetzen kann
   - Keine vagen Einträge wie "Frontend verbessern"

WICHTIG: Nur planen. NICHTS implementieren.

---

Wenn @IMPLEMENTATION_PLAN.md vollständig und aktuell ist: `<promise>COMPLETE</promise>`