# Ralph Planning Mode — Locodoko

## Ziel

Spielbares Doppelkopf-Spiel im Browser — Spring Boot Backend + Phaser Frontend,
auslieferbar als einzelnes JAR.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden) um den bisherigen Stand zu verstehen.
    Hintergrundkontext für alle Subagenten: specs/architektur-ddd.md

0b. Starte 5 PARALLELE Subagenten, jeder analysiert einen Bounded Context.
    Jeder gibt zurück: was implementiert ist, was fehlt, was zwischen Spec und Code
    inkonsistent ist — max. 20 Zeilen. Zuerst suchen, nicht annehmen dass etwas fehlt.

    Specs mit Status "Zu prüfen" immer vollständig lesen. Specs mit Status
    "Aktive Vorgabe" / "Finalisierte Vorgabe" / "Abgeschlossen" nur überfliegen.

    - Subagent 1 — Tisch/Spieler: `src/main/java/de/locodoko/` (alle Packages auflisten!)
      Ziel-BCs laut `specs/architektur-ddd.md`: `tisch/`, `spieler/` (aktuell: `lobby/`, `session/`)
      + specs/lobby.md, specs/tischkonfiguration.md, specs/datenbankmodell.md,
        specs/spieler-session.md, specs/verbindungsabbruch.md,
        **specs/architektur-ddd.md** (Ziel-Modulstruktur)

    - Subagent 2 — Partie/Regeln/Architektur: `src/main/java/de/locodoko/partie/`
      + specs/spielablauf.md, specs/stichlogik.md, specs/trumpfhierarchie.md,
        specs/kartendeck.md, specs/punkteberechnung.md, specs/ansagen.md,
        specs/sonderpunkte.md, specs/bockrunden.md, specs/schweinchen.md,
        specs/dreissig-augen-pflicht.md, specs/regelkatalog.md,
        specs/tischkonfiguration.md,
        **specs/architektur-spielkern.md** (Zielzustand Spielkern)

    - Subagent 3 — API/Events/KI-Modul: `src/main/java/de/locodoko/` (partie/ki/, system/)
      Ziel-BC laut `specs/architektur-ddd.md`: `ki/` top-level (aktuell: `partie/ki/`)
      + specs/websocket-kommunikation.md, specs/rest-api.md, specs/e2e-tests.md,
        specs/ki-strategie.md,
        **specs/architektur-domain-events.md** (KI als Event-Subscriber)

    - Subagent 4 — Frontend: `frontend/src/`
      + specs/frontend-*.md, specs/regelkatalog.md

    - Subagent 5 — Sonderspiele/KI: betroffener Code in `src/` und `frontend/`
      + specs/hochzeit.md, specs/armut.md, specs/solo-*.md, specs/ki-strategie.md

    Warte auf alle 5 Ergebnisse.

0c. Für jede gemeldete Inkonsistenz zwischen Spec und Code: entscheide ob die Spec oder
    der Code die Wahrheit ist, und trage die Korrektur als eigene Aufgabe in den Plan ein.

## Planung

1. Erstelle oder aktualisiere @IMPLEMENTATION_PLAN.md als priorisierte Aufgabenliste:
   - Blockierende Abhängigkeiten zuerst
   - Erledigte Einträge als Referenz behalten
   - Jeden `[BLOCKED: ...]`-Eintrag neu bewerten: ist der Blocker noch gültig?
     Falls nicht, entsperren und neu einordnen. Falls ja, dokumentiere warum.

2. Jede Aufgabe bekommt genug Kontext dass der Build-Modus sie ohne Rückfragen
   umsetzen kann — keine vagen Einträge wie "Frontend verbessern".

WICHTIG: Nur planen. NICHTS implementieren.

---

Wenn @IMPLEMENTATION_PLAN.md vollständig und aktuell ist: `<promise>COMPLETE</promise>`