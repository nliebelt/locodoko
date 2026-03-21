# Ralph Planning Mode — Locodoko

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden), um den bisherigen Plan zu verstehen.
0b. Starte 5 PARALLELE Subagenten, jeder analysiert einen Bounded Context:
    - Subagent 1 — Lobby/Tisch: `src/main/java/de/locodoko/lobby/` + specs/lobby.md, specs/tischkonfiguration.md
    - Subagent 2 — Partie/Regeln: `src/main/java/de/locodoko/partie/` + specs/spielablauf.md, specs/stichlogik.md, specs/trumpfhierarchie.md, specs/punkteberechnung.md, specs/ansagen.md, specs/sonderpunkte.md
    - Subagent 3 — Session/API: `src/main/java/de/locodoko/session/` + specs/spieler-session.md, specs/websocket-kommunikation.md, specs/rest-api.md
    - Subagent 4 — Frontend: `frontend/src/` + specs/frontend-tischansicht.md, specs/frontend-ui-logik.md, specs/frontend-animationen.md
    - Subagent 5 — Sonderspiele/KI: specs/hochzeit.md, specs/armut.md, specs/solo-*.md, specs/ki-strategie.md, specs/verbindungsabbruch.md + betroffener Code
    Jeder Subagent gibt zurück: was implementiert ist, was fehlt, was inkonsistent oder instabil ist (TODOs, Platzhalter, übersprungene Tests, Patterns-Brüche).
    Warte auf alle 5 Ergebnisse.

## Planung

1. Erstelle oder aktualisiere @IMPLEMENTATION_PLAN.md als priorisierte Aufgabenliste aus den Subagenten-Ergebnissen.
   - Sortiert nach Priorität (blockierende Abhängigkeiten zuerst)
   - Erledigte Einträge als Referenz behalten
   - Jeden `[BLOCKED: ...]`-Eintrag aus der letzten Iteration neu bewerten

WICHTIG: Nur planen. NICHTS implementieren. Die Subagenten haben den Code bereits geprüft — nicht nochmal annehmen, dass etwas fehlt, ohne es bestätigt zu haben.

ZIEL: Spielbares Doppelkopf-Spiel im Browser (Spring Boot Backend + Phaser Frontend, auslieferbar als einzelnes JAR).

Wenn @IMPLEMENTATION_PLAN.md vollständig und aktuell ist, gib <promise>COMPLETE</promise> aus.
