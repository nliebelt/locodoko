# Ralph Build Mode — Locodoko

## Kernregeln (immer gültig)

- **Keine Platzhalter, keine Stubs.** Implementiere vollständig oder gar nicht.
- **Single Source of Truth.** Keine Adapter, keine Duplikate. Wenn fremde Tests brechen, fixe sie direkt.
- **Vertraue deinen Subagenten.** Wenn ein Subagent eine Datei bereits zusammengefasst hat,
  lies sie nicht nochmal selbst. Arbeite mit der Zusammenfassung.
- **Tests müssen echte Fehler finden können.** Schreibe dazu kurz auf WARUM jeder Test wichtig ist.
- **Architekturprinzipien einhalten.** Siehe `specs/architektur.md` — die kompakte Referenz
  für Domain Model, Module, Event-Vertrag und Coding-Prinzipien.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md. Lies die `## Notiz`-Sektion UND die `## Entdeckungen`-Sektion.

0b. Prüfe was sich seit der letzten Iteration geändert hat:
    `git diff --stat HEAD~1` — damit weißt du sofort welche Dateien der letzte Ralph berührt hat.

0c. Wähle die EINE wichtigste offene Aufgabe.

0d. Starte PARALLEL zwei Subagenten:
    - Subagent A: Konsultiere `specs/README.md` (Domain-Landkarte), um die 1-2 relevantesten Detail-Specs für die Aufgabe zu finden. Lies diese und fasse sie kompakt zusammen (max. 15 Zeilen). Was sagen die Specs zu dieser Aufgabe?
    - Subagent B: Betroffener Code in `src/`, `frontend/`, `pom.xml`, `package.json`.
      Kompakte Zusammenfassung — max. 15 Zeilen. Was existiert bereits?
      Wichtig: zuerst suchen, nicht annehmen dass etwas fehlt. Maximal 6 Tool-Calls.

    Warte auf beide Ergebnisse.

    Danach: Arbeite ausschließlich mit diesen Zusammenfassungen.
    Lies keine Dateien nach die die Subagenten bereits abgedeckt haben —
    es sei denn du brauchst einen konkreten Zeilenwert zum Editieren.

0e. Prüfe kurz: Sind die relevanten Specs konsistent mit dem was Subagent B im Code
    gefunden hat? Falls nicht, korrigiere die Spec vor der Implementierung.

## Implementierung

1. Implementiere ausschließlich diese eine Aufgabe — vollständig, keine Platzhalter.
   Baue auf bestehendem Code auf statt neu zu schreiben.

2. Validierung — abhängig vom Task-Prefix:
   - `FEAT-` / `R` / `BUG-` (Backend): `mvn test`
   - `FE-` / `UI-` (Frontend): `cd frontend && npm run generate-types && npm test && npm run build && npm run lint`
   - `REFACTOR-` (beides): `mvn test` UND `cd frontend && npm test && npm run build && npm run lint`
   - `DOC-` / `SPEC-` (nur Specs): Keine Tests nötig, nur Konsistenz prüfen.

   Orientiere dich zusätzlich an @CLAUDE.md > Validation nach Implementierung.
   - Grün → weiter zu Schritt 2b.
   - Rot → einmal debuggen und beheben.
   - Nach dem zweiten fehlgeschlagenen Versuch: **stop.** Nicht ein drittes Mal versuchen.
     Markiere die Aufgabe als `[BLOCKED: <Grund>]` in @IMPLEMENTATION_PLAN.md
     und wechsle zur nächsten offenen Aufgabe.
     Falls ALLE verbleibenden Aufgaben blockiert sind: gib `<promise>BLOCKED</promise>` aus.

2b. **Nur bei Frontend-UI-Änderungen** (Dateien in `frontend/src/szenen/`, `frontend/src/assets/`,
    `frontend/src/components/`):
    - Prüfe zuerst ob das Backend läuft (`curl -s http://localhost:8081/actuator/health`).
    - Falls ja: führe Vision Loop aus (`cd e2e && npx playwright test vision-loop.spec.ts --headed`),
      lese alle Screenshots in `e2e/screenshots/` mit dem Read-Tool ein und prüfe visuell auf
      Fehler (Positionen, Alpha-Werte, Überlappungen, fehlende Elemente).
      Wenn Fehler sichtbar: sofort korrigieren, dann weiter zu Schritt 3.
    - Falls Backend nicht läuft: Vision Loop überspringen, weiter zu Schritt 3.
      Notiere in der Commit-Message dass ein manueller Vision-Check empfohlen wird.

3. Bei grünen Tests:
   - Aktualisiere @IMPLEMENTATION_PLAN.md (Aufgabe als erledigt markieren).
   - `git add src/ frontend/ specs/ IMPLEMENTATION_PLAN.md AGENTS.md`
   - `git commit -m "<präzise Beschreibung>"`

4. Schreibe eine "Notiz an den nächsten Ralph" unter `## Notiz` in @IMPLEMENTATION_PLAN.md
   (direkt nach der Überschrift, überschreibt die letzte Notiz):
   - Was wurde implementiert?
   - Was ist der nächste logische Schritt?
   - Offene Fragen oder Probleme?

5. Falls du während der Implementierung etwas entdeckst das nicht zur aktuellen Aufgabe
   gehört (unerwarteter Bug, Inkonsistenz, fehlende Spec), trage es unter
   `## Entdeckungen` in @IMPLEMENTATION_PLAN.md ein (append, nicht überschreiben).
   Der Plan-Agent wandelt es beim nächsten Scan in einen konkreten Task um.

---

Wenn alle Aufgaben erledigt sind: `<promise>COMPLETE</promise>`