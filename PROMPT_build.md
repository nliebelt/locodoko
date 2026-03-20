# Ralph Build Mode — Locodoko

0a. Studiere `specs/*` um die Spezifikationen des Doppelkopf-Spiels zu verstehen.
0b. Studiere @IMPLEMENTATION_PLAN.md.
0c. Der Quellcode der Anwendung liegt in `src/`.
0d. Das Frontend liegt in `frontend/` (falls vorhanden).

1. Deine Aufgabe ist es, Funktionalität gemäß den Spezifikationen zu implementieren. Folge @IMPLEMENTATION_PLAN.md und wähle die wichtigste Aufgabe. Bevor du Änderungen machst, durchsuche die Codebasis (nimm nicht an, dass etwas nicht implementiert ist). Denke gründlich nach.

2. Nach dem Implementieren oder Beheben von Problemen, führe die Tests für den geänderten Code aus. Wenn Funktionalität fehlt, ist es deine Aufgabe, sie gemäß den Spezifikationen hinzuzufügen. Prüfe auch die Logs auf Plausibilität und unerwartete Fehler.

3. Wenn du Probleme entdeckst, aktualisiere sofort @IMPLEMENTATION_PLAN.md mit deinen Erkenntnissen. Wenn das Problem gelöst ist, aktualisiere den Eintrag und entferne ihn.

4. Wenn die Tests bestehen, aktualisiere @IMPLEMENTATION_PLAN.md, dann `git add -A`, dann `git commit` mit einer Nachricht, die die Änderungen beschreibt.

999. Wichtig: Wenn du Dokumentation oder Tests schreibst, halte fest WARUM Tests und die Implementierung wichtig sind.

9999. Wichtig: Wir wollen Single Sources of Truth, keine Migrationen/Adapter. Wenn Tests, die nicht mit deiner Arbeit zusammenhängen, fehlschlagen, ist es deine Aufgabe, sie als Teil der Änderung zu beheben.

99999. Du darfst zusätzliches Logging hinzufügen, um Probleme zu debuggen. Prüfe die Logs auf Plausibilität.

999999. Halte @IMPLEMENTATION_PLAN.md IMMER aktuell mit deinen Erkenntnissen. Besonders nach Abschluss deiner Arbeit.

9999999. Wenn du etwas Neues über den Build-Prozess oder das Projektsetup lernst, aktualisiere @AGENTS.md — aber halte es kurz. Zum Beispiel wenn du Befehle mehrfach ausführst, bevor du den richtigen findest.

99999999. Für alle Bugs die du bemerkst: behebe sie oder dokumentiere sie in @IMPLEMENTATION_PLAN.md, auch wenn sie nichts mit der aktuellen Aufgabe zu tun haben.

999999999. Implementiere Funktionalität vollständig. Platzhalter und Stubs verschwenden Zeit, weil die gleiche Arbeit wiederholt werden muss.

9999999999. Wenn @IMPLEMENTATION_PLAN.md zu groß wird, räume erledigte Einträge regelmäßig auf.

99999999999. Wenn du Inkonsistenzen in specs/* findest, aktualisiere die Specs.

999999999999. WICHTIG: Halte @AGENTS.md rein operativ — Statusupdates und Fortschrittsnotizen gehören in IMPLEMENTATION_PLAN.md. Ein aufgeblähtes AGENTS.md verschmutzt den Context jeder zukünftigen Iteration.

9999999999999. KEINE PLATZHALTER ODER MINIMALE IMPLEMENTIERUNGEN. VOLLSTÄNDIGE IMPLEMENTIERUNGEN.

Wenn alle Aufgaben in @IMPLEMENTATION_PLAN.md erledigt sind, gib <promise>COMPLETE</promise> aus.
