# Ralph Build Mode — Locodoko

## Kernregeln (immer gültig)

- **Keine Platzhalter, keine Stubs.** Implementiere vollständig oder gar nicht.
- **Single Source of Truth.** Keine Adapter, keine Duplikate. Wenn fremde Tests brechen, fixe sie direkt.
- **Vertraue deinen Subagenten.** Wenn ein Subagent eine Datei bereits zusammengefasst hat,
  lies sie nicht nochmal selbst. Arbeite mit der Zusammenfassung.
- **Tests müssen echte Fehler finden können.** Schreibe dazu kurz auf WARUM jeder Test wichtig ist.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md. Lies die `## Notiz`-Sektion — sie enthält den Stand
    der letzten Iteration.

0b. Falls Aufgabe 1.1 (Vision Loop Baseline) noch offen ist: ZUERST diese erledigen.
    Danach wähle die EINE wichtigste offene Aufgabe. Nicht mehrere.

0c. Starte PARALLEL zwei Subagenten:
    - Subagent A: Relevante Specs aus `specs/` (nur die 1-2 direkt betroffenen).
      Kompakte Zusammenfassung — max. 15 Zeilen. Was sagen die Specs zu dieser Aufgabe?
    - Subagent B: Betroffener Code in `src/`, `frontend/`, `pom.xml`, `package.json`.
      Kompakte Zusammenfassung — max. 15 Zeilen. Was existiert bereits?
      Wichtig: zuerst suchen, nicht annehmen dass etwas fehlt. Maximal 6 Tool-Calls.

    Warte auf beide Ergebnisse.

    Danach: Arbeite ausschließlich mit diesen Zusammenfassungen.
    Lies keine Dateien nach die die Subagenten bereits abgedeckt haben —
    es sei denn du brauchst einen konkreten Zeilenwert zum Editieren.

0d. Prüfe kurz: Sind die relevanten Specs konsistent mit dem was Subagent B im Code
    gefunden hat? Falls nicht, korrigiere die Spec vor der Implementierung.

## Implementierung

1. Implementiere ausschließlich diese eine Aufgabe — vollständig, keine Platzhalter.
   Baue auf bestehendem Code auf statt neu zu schreiben.

2. Führe die relevanten Tests aus — Backend, Frontend, oder beide je nach Änderungsbereich.
   Orientiere dich an @CLAUDE.md > Validation nach Implementierung.
   - Grün → weiter zu Schritt 2b.
   - Rot → einmal debuggen und beheben.
   - Nach dem zweiten fehlgeschlagenen Versuch: **stop.** Nicht ein drittes Mal versuchen.
     Markiere die Aufgabe als `[BLOCKED: <Grund>]` in @IMPLEMENTATION_PLAN.md
     und wechsle zur nächsten offenen Aufgabe.
     Falls ALLE verbleibenden Aufgaben blockiert sind: gib `<promise>BLOCKED</promise>` aus.

2b. **Nur bei Frontend-UI-Änderungen** (Dateien in `frontend/src/szenen/`, `frontend/src/assets/`,
    `frontend/src/components/`):
    - Prüfe zuerst ob das Backend läuft (`curl -s http://localhost:8080/actuator/health`).
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

---

Wenn alle Aufgaben erledigt sind: `<promise>COMPLETE</promise>`