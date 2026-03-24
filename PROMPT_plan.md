# Ralph Planning Mode — Locodoko

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden), um den bisherigen Plan zu verstehen.
0b. Starte 5 PARALLELE Subagenten, jeder analysiert einen Bounded Context. Jeder gibt zurück: was implementiert ist, was fehlt, was inkonsistent ist — max. 20 Zeilen. Nicht annehmen, dass etwas fehlt — zuerst suchen.
    - Subagent 1 — Lobby/Tisch: `src/main/java/de/locodoko/lobby/` + specs/lobby.md, specs/tischkonfiguration.md
    - Subagent 2 — Partie/Regeln: `src/main/java/de/locodoko/partie/` + specs/spielablauf.md, specs/stichlogik.md, specs/trumpfhierarchie.md, specs/punkteberechnung.md, specs/ansagen.md, specs/sonderpunkte.md
    - Subagent 3 — Session/API: `src/main/java/de/locodoko/session/` + specs/spieler-session.md, specs/websocket-kommunikation.md, specs/rest-api.md
    - Subagent 4 — Frontend: `frontend/src/` + specs/frontend-tischansicht.md, specs/frontend-ui-logik.md, specs/frontend-animationen.md
    - Subagent 5 — Sonderspiele/KI: specs/hochzeit.md, specs/armut.md, specs/solo-*.md, specs/ki-strategie.md, specs/verbindungsabbruch.md + betroffener Code
    Warte auf alle 5 Ergebnisse.

## Planung

1. Erstelle oder aktualisiere @IMPLEMENTATION_PLAN.md als priorisierte Aufgabenliste.
   - Sortiert nach Priorität (blockierende Abhängigkeiten zuerst)
   - Erledigte Einträge als Referenz behalten
   - Jeden `[BLOCKED: ...]`-Eintrag aus der letzten Iteration neu bewerten

WICHTIG: Nur planen. NICHTS implementieren.

ZIEL: Spielbares Doppelkopf-Spiel im Browser (Spring Boot Backend + Phaser Frontend, auslieferbar als einzelnes JAR).

Wenn @IMPLEMENTATION_PLAN.md vollständig und aktuell ist, gib `<promise>COMPLETE</promise>` aus.
