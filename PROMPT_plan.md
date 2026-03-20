# Ralph Planning Mode — Locodoko

0a. Studiere `specs/*` um die Spezifikationen des Doppelkopf-Spiels zu verstehen.
0b. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden), um den bisherigen Plan zu verstehen.
0c. Der Quellcode der Anwendung liegt in `src/`.
0d. Das Frontend liegt in `frontend/` (falls vorhanden).

1. Studiere @IMPLEMENTATION_PLAN.md (er kann fehlerhaft sein) und untersuche den bestehenden Quellcode in `src/` und `frontend/`. Vergleiche ihn mit den Spezifikationen in `specs/*`. Erstelle oder aktualisiere @IMPLEMENTATION_PLAN.md als priorisierte Aufgabenliste (Bullet Points), sortiert nach Priorität der noch umzusetzenden Punkte. Denke gründlich nach. Suche nach TODO, minimalen Implementierungen, Platzhaltern, übersprungenen oder instabilen Tests und inkonsistenten Patterns. Halte @IMPLEMENTATION_PLAN.md aktuell mit Einträgen, die als erledigt oder offen gelten.

WICHTIG: Nur planen. NICHTS implementieren. NICHT annehmen, dass Funktionalität fehlt — zuerst per Code-Suche bestätigen.

ZIEL: Wir wollen ein spielbares Doppelkopf-Spiel im Browser erreichen (Spring Boot Backend + Phaser Frontend, auslieferbar als einzelnes JAR). Berücksichtige fehlende Elemente und plane entsprechend. Falls ein Element fehlt, suche zuerst, ob es nicht doch existiert. Falls es wirklich fehlt, erstelle die Spezifikation unter specs/DATEINAME.md.

Wenn alle Planungsaufgaben erledigt sind und @IMPLEMENTATION_PLAN.md vollständig ist, gib <promise>COMPLETE</promise> aus.
