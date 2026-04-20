# Ralph Planning Mode — Locodoko

## Ziel

Spielbares Doppelkopf-Spiel im Browser — Spring Boot Backend + Phaser Frontend,
auslieferbar als einzelnes JAR.

## Vorbereitung

0a. Studiere @IMPLEMENTATION_PLAN.md (falls vorhanden) um den bisherigen Stand zu verstehen.
    Hintergrundkontext für alle Subagenten: specs/architektur-ddd.md

0b. Starte 5 PARALLELE Subagenten, jeder analysiert einen Bounded Context.
    Lies ZUERST `specs/README.md` (Domain-Landkarte), um zu wissen, welche Specs zu welchem Kontext gehören.
    Jeder Subagent gibt zurück: was implementiert ist, was fehlt, was zwischen Spec und Code inkonsistent ist — max. 20 Zeilen.
    Zuerst suchen, nicht annehmen dass etwas fehlt.

    Specs mit Status "Zu prüfen" immer vollständig lesen. Specs mit Status
    "Aktive Vorgabe" / "Finalisierte Vorgabe" / "Abgeschlossen" nur überfliegen.

    - Subagent 1 — Tisch/Spieler: `src/main/java/de/locodoko/` (alle Packages)
      Fokus: `tisch/` und `spieler/` vs. zugehörige Specs laut `specs/README.md`
    - Subagent 2 — Partie/Regeln: `src/main/java/de/locodoko/partie/`
      Fokus: Spielkern, Regeln vs. zugehörige Specs laut `specs/README.md`
    - Subagent 3 — API/Events/KI: `src/main/java/de/locodoko/ki/` und Infrastruktur
      Fokus: KI, Events, API vs. zugehörige Specs laut `specs/README.md`
    - Subagent 4 — Frontend: `frontend/src/`
      Fokus: UI und Animationen vs. Frontend-Specs laut `specs/README.md`
    - Subagent 5 — Sonderspiele: Betroffener Code in `src/` und `frontend/`
      Fokus: Sonderspiel-Implementierungen vs. Sonderspiel-Specs laut `specs/README.md`

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