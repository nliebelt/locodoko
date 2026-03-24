# Ralph Build Mode — Locodoko

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md. Lies die `## Notiz`-Sektion (falls vorhanden) — sie enthält den Stand der letzten Iteration.
0b. Wähle die EINE wichtigste offene Aufgabe aus @IMPLEMENTATION_PLAN.md. Nicht mehrere.
0c. Starte PARALLEL zwei Subagenten:
    - Subagent A: Studiere die für diese Aufgabe relevanten Specs aus `specs/` (nur die 1-2 direkt betroffenen, nicht alle). Gib eine kompakte Zusammenfassung zurück — max. 15 Zeilen.
    - Subagent B: Studiere den bestehenden Code in `src/`, `frontend/`, `pom.xml` und `frontend/package.json` für die betroffenen Bereiche. Gib eine kompakte Zusammenfassung zurück — max. 15 Zeilen. Nicht annehmen, dass etwas fehlt — zuerst suchen.
    Warte auf beide Ergebnisse, bevor du weitermachst.

## Implementierung

1. Implementiere AUSSCHLIESSLICH diese eine Aufgabe — vollständig, keine Platzhalter, keine Stubs. Wenn Funktionalität bereits existiert, baue darauf auf statt sie neu zu schreiben.

2. Führe nach der Implementierung die Tests für den geänderten Code aus.
   - Tests grün → weiter zu Schritt 3.
   - Tests rot → Ultrathink. Einmal debuggen und beheben. Wenn nach dem zweiten Versuch immer noch rot: markiere die Aufgabe in @IMPLEMENTATION_PLAN.md als `[BLOCKED: <Grund>]` und wechsle zur nächsten offenen Aufgabe. Falls ALLE verbleibenden Aufgaben blockiert sind: gib `<promise>BLOCKED</promise>` aus.

3. Bei grünen Tests:
   - Aktualisiere @IMPLEMENTATION_PLAN.md (Aufgabe als erledigt markieren).
   - `git add src/ frontend/ specs/ IMPLEMENTATION_PLAN.md AGENTS.md`
   - `git commit -m "<präzise Beschreibung der Änderung>"`

4. Schreibe am Ende der Iteration eine "Notiz an den nächsten Ralph" unter `## Notiz` in @IMPLEMENTATION_PLAN.md (direkt nach der Überschrift, vor allen anderen Sektionen). Überschreibe die Notiz der letzten Iteration. Inhalt:
   - Was wurde implementiert?
   - Was ist der nächste logische Schritt?
   - Bekannte offene Fragen oder Probleme?

---

999. Wenn du Tests schreibst, halte fest WARUM sie wichtig sind.
9999. Single Sources of Truth — keine Migrationen/Adapter. Wenn fremde Tests fehlschlagen, behebe sie als Teil der Änderung.
99999. Du darfst Logging hinzufügen. Prüfe Logs auf Plausibilität.
999999. Halte @IMPLEMENTATION_PLAN.md IMMER aktuell.
9999999. Wenn du etwas Neues über den Build-Prozess lernst, trage es kurz in @AGENTS.md ein.
99999999. Für alle entdeckten Bugs: behebe sie oder dokumentiere sie in @IMPLEMENTATION_PLAN.md.
999999999. Implementiere Funktionalität vollständig. Platzhalter verschwenden Zeit.
9999999999. Wenn @IMPLEMENTATION_PLAN.md zu groß wird, räume erledigte Einträge auf.
99999999999. Wenn du Inkonsistenzen in specs/* findest, aktualisiere die Specs.
999999999999. WICHTIG: @AGENTS.md bleibt rein operativ — Statusupdates gehören in IMPLEMENTATION_PLAN.md.

Wenn alle Aufgaben in @IMPLEMENTATION_PLAN.md erledigt sind, gib `<promise>COMPLETE</promise>` aus.