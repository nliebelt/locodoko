# Ralph Build Mode — Locodoko

## Kernregeln (immer gültig)

- **Keine Platzhalter, keine Stubs.** Implementiere vollständig oder gar nicht.
- **Single Source of Truth.** Keine Adapter, keine Duplikate. Wenn fremde Tests brechen, fixe sie direkt.
- **Vertraue deinen Subagenten.** Wenn ein Subagent eine Datei bereits zusammengefasst hat,
  lies sie nicht nochmal selbst. Arbeite mit der Zusammenfassung.
- **Tests müssen echte Fehler finden können.** Schreibe dazu kurz auf WARUM jeder Test wichtig ist.
- **Architekturprinzipien einhalten.** Siehe `specs/architektur.md` — die kompakte Referenz
  für Domain Model, Module, Event-Vertrag und Coding-Prinzipien.
- **Deutsch.** Code, Klassennamen, Methoden, Kommentare, Tests, Commit-Messages auf Deutsch
  (Ubiquitous Language — siehe AGENTS.md).
- **Niemals destruktiv ohne Anweisung.** Kein `--no-verify`, kein `--force-push`, kein `git reset --hard`,
  kein `@Disabled`/`@Ignore` auf Tests. Bei Hook-Fehler: Wurzelursache fixen, nicht umgehen.
- **Bleibe auf `main`.** Keine Feature-Branches anlegen, kein `git checkout -b`. Falls eine Task
  einen Mega-Commit erfordert (mehrere Sub-Tasks zusammen — markiert im Plan als „MEGA-COMMIT"),
  alle Working-Tree-Änderungen sammeln und EINEN gemeinsamen `git commit` machen. Vor und nach
  dem Commit müssen Tests grün sein.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md. Lies in dieser Reihenfolge:
    - `## Notiz`-Sektion (Stand der letzten Iteration)
    - `## Build-Modus-Leitfaden`-Sektion (falls vorhanden) — generelle Regeln
    - `## Empfohlene Build-Reihenfolge`-Sektion (falls vorhanden) — verbindliche Task-Ordnung
    - `## Stoppregeln`-Sektion (falls vorhanden) — wann abbrechen
    - `## Entdeckungen`-Sektion — was bisher gefunden wurde
    - Verbindliche Tabellen im Master-Plan (z.B. „VO bleibt VO", Daten-Modell)

0b. Prüfe was sich seit der letzten Iteration geändert hat:
    `git diff --stat HEAD~1` — damit weißt du sofort welche Dateien der letzte Ralph berührt hat.

0c. **Vor-Validierung**: Stelle sicher dass der Baseline grün ist, bevor du anfängst:
    - `cd /home/agent/workspace && mvn test -q` (Backend)
    - `cd /home/agent/workspace/frontend && npm test --silent` (Frontend)
    Falls einer ROT ist: das ist nicht dein Bug — markiere als `[BLOCKED: Baseline rot — <kurzer Fehler>]`
    in @IMPLEMENTATION_PLAN.md und gib `<promise>BLOCKED</promise>` aus.

0d. **Wähle die nächste Aufgabe** in dieser Reihenfolge:
    1. Falls der Plan eine `## Empfohlene Build-Reihenfolge` enthält: **folge ihr strikt**, nimm den nächsten offenen Schritt.
    2. Sonst: wähle die EINE wichtigste offene Aufgabe (höchste Priorität, keine Vorbedingung offen).
    3. Prüfe „Vorbedingung:"-Hinweise im Task-Text. Falls eine Vorbedingung-Task noch offen ist:
       überspringe diese Task, nimm die nächste ohne offene Vorbedingung.

0e. Starte PARALLEL zwei Subagenten:
    - Subagent A: Konsultiere `specs/README.md` (Domain-Landkarte), finde die relevantesten Detail-Specs
      für die Aufgabe (typisch 1–3). Lies sie und fasse kompakt zusammen (max. 25 Zeilen je nach Komplexität).
      Was sagen die Specs zu dieser Aufgabe?
    - Subagent B: Betroffener Code in `src/`, `frontend/`, `e2e/`, `pom.xml`, `package.json`,
      `src/main/resources/db/changelog/`. Kompakte Zusammenfassung — max. 25 Zeilen je nach Komplexität.
      Was existiert bereits? Wichtig: zuerst suchen, nicht annehmen dass etwas fehlt.
      Maximal 10 Tool-Calls (je komplexer die Task, eher mehr nutzen).

    Warte auf beide Ergebnisse.

    Danach: Arbeite ausschließlich mit diesen Zusammenfassungen.
    Lies keine Dateien nach die die Subagenten bereits abgedeckt haben —
    es sei denn du brauchst einen konkreten Zeilenwert zum Editieren.

0f. Prüfe kurz: Sind die relevanten Specs konsistent mit dem was Subagent B im Code
    gefunden hat? Falls nicht, korrigiere die Spec vor der Implementierung.

## Implementierung

1. Implementiere ausschließlich diese eine Aufgabe — vollständig, keine Platzhalter.
   Baue auf bestehendem Code auf statt neu zu schreiben.
   Falls die Task einen „Erste Datei zuerst"-Hinweis hat: dort starten.

2. Validierung — abhängig vom Task-Prefix und davon, was tatsächlich geändert wurde:
   - `FEAT-` / `BUG-` / `DB-` (Backend-Aufgaben): `cd /home/agent/workspace && mvn test`
     - Bei `DB-`-Tasks die DTOs ändern: zusätzlich `cd /home/agent/workspace/frontend && npm run generate-types`
       (OpenAPI-Schema-Synchronisierung) + `npm test && npm run build && npm run lint`.
   - `FE-` / `UI-` (Frontend-Aufgaben): `cd /home/agent/workspace/frontend && npm run generate-types && npm test && npm run build && npm run lint`
   - `REFACTOR-` (potenziell beides): prüfe per `git status -s` was geändert wurde,
     dann Backend-Validation (falls `src/` geändert) UND/ODER Frontend-Validation (falls `frontend/src/` geändert).
   - `DOC-` / `SPEC-` (nur Specs/Markdown, keine Code-Änderung): Keine Tests nötig, nur Konsistenz prüfen mit `grep`.

   **CWD-Reset zwischen Validierungen**: nach jedem `cd frontend && ...` explizit
   `cd /home/agent/workspace` ausführen, bevor du Backend-Commands fährst.

   Orientiere dich zusätzlich an @AGENTS.md > „Validation nach Implementierung".
   - Grün → weiter zu Schritt 2b.
   - Rot → max. 2 Debug-Versuche.
   - Nach dem dritten fehlgeschlagenen Versuch (1 Implementation + 2 Debug): **stop.** Nicht weiter versuchen.
     Markiere die Aufgabe als `[BLOCKED: <Fehler-Output-Auszug + vermutete Wurzelursache>]`
     in @IMPLEMENTATION_PLAN.md und wechsle zur nächsten offenen Aufgabe (siehe 0d-Auswahl-Regeln).
     Falls ALLE verbleibenden Aufgaben blockiert sind: gib `<promise>BLOCKED</promise>` aus.

2b. **Nur bei Frontend-UI-Änderungen** (Dateien in `frontend/src/szenen/`, `frontend/src/assets/`,
    `frontend/src/components/`, `frontend/src/ui/`):
    - Prüfe zuerst ob das Backend läuft (`curl -s http://localhost:8081/actuator/health`).
    - Falls ja: führe Vision Loop aus (`cd e2e && npx playwright test vision-loop.spec.ts --headed`),
      lese alle Screenshots in `e2e/screenshots/` mit dem Read-Tool ein und prüfe visuell auf
      Fehler (Positionen, Alpha-Werte, Überlappungen, fehlende Elemente).
      Wenn Fehler sichtbar: sofort korrigieren, dann weiter zu Schritt 3.
    - Falls Backend nicht läuft: Vision Loop überspringen, weiter zu Schritt 3.
      Notiere in der Commit-Message dass ein manueller Vision-Check empfohlen wird.

3. **Bei grünen Tests — Plan-Update + Notizen schreiben, BEVOR der Commit kommt**:
   3a. Aktualisiere @IMPLEMENTATION_PLAN.md — Aufgabe als `[x]` markieren (statt `[ ]`).
   3b. Schreibe eine **„Notiz an den nächsten Ralph"** unter `## Notiz` in @IMPLEMENTATION_PLAN.md
       (direkt nach der Überschrift, überschreibt die letzte Notiz):
       - Was wurde implementiert?
       - Was ist der nächste logische Schritt?
       - Offene Fragen oder Probleme?
   3c. Falls während der Implementierung etwas außerhalb der Aufgabe entdeckt wurde
       (unerwarteter Bug, Inkonsistenz, fehlende Spec): trage es unter `## Entdeckungen`
       in @IMPLEMENTATION_PLAN.md ein (**append, nicht überschreiben** — neue Punkte unten).
       Der Plan-Agent wandelt es beim nächsten Scan in einen konkreten Task um.

4. **EIN gemeinsamer Commit für Code + Plan + Notizen + Entdeckungen**:
   ```
   git add src/ frontend/ e2e/ specs/ pom.xml \
           frontend/package.json frontend/package-lock.json \
           IMPLEMENTATION_PLAN.md AGENTS.md CLAUDE.md
   git commit -m "<präzise Beschreibung mit Task-ID, z.B. 'DB-3: JSONB-Converter eingeführt'>"
   ```
   Falls eine der Dateien nicht geändert wurde, ist das OK — `git add` ignoriert nicht-existente
   Pfade nicht, daher prüfe vorher mit `git status -s` welche Pfade wirklich geändert sind.

---

Wenn alle Aufgaben erledigt sind: `<promise>COMPLETE</promise>`
