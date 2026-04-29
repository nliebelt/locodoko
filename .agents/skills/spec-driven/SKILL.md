---
name: spec-driven
description: Before implementing any feature or fixing any bug, find and read the relevant spec(s) in specs/ to ensure faithfulness to the Single Source of Truth. Use when about to implement something, when uncertain what the correct behavior should be, or when the user mentions "laut Spec", "was sagt die Spec" or "spec-driven".
---

# Spec-Driven Implementation

The `specs/` directory is the **Single Source of Truth** for this project. Every implementation decision must be grounded in a spec. Before writing code, always locate and internalize the relevant spec(s).

## Process

1. **Orient yourself** — read `specs/README.md` to understand which spec covers the topic at hand. The README is the map; use it to navigate.

2. **Read the relevant spec(s)** — open the spec file(s) and read them fully. If multiple specs seem relevant (e.g. `stichlogik.md` + `trumpfhierarchie.md`), read all of them.

3. **Quote the spec** — before implementing, cite the specific spec rule(s) your implementation is based on. E.g.:
   > Laut `specs/trumpfhierarchie.md`: "Die Dulle (Kreuz-Dame) ist der höchste Trumpf."

4. **Implement faithfully** — the spec describes the *Was* and *Warum*. You decide the *Wie* (code structure), but must not deviate from the spec's rules.

5. **Flag spec gaps** — if the spec is silent on a relevant edge case, explicitly surface this:
   > ⚠️ Spec-Lücke: `specs/stichlogik.md` beschreibt nicht, was passiert wenn zwei Dullen gespielt werden. Klärung erforderlich.

6. **Never invent rules** — if the spec doesn't say it, don't implement it as if it did. Ask the user instead.

## Spec Map (Kurzreferenz)

| Thema                          | Spec-Datei(en)                                          |
|-------------------------------|----------------------------------------------------------|
| Spielablauf, Phasen            | `spielablauf.md`, `architektur-spielkern.md`            |
| Karten, Deck                   | `kartendeck.md`                                          |
| Stich-Gewinner                 | `stichlogik.md`                                          |
| Trumpfrangfolge                | `trumpfhierarchie.md`                                    |
| Punkte, Auswertung             | `punkteberechnung.md`, `sonderpunkte.md`                |
| Ansagen (Re/Kontra/Absagen)    | `ansagen.md`                                             |
| Schweinchen                    | `schweinchen.md`                                         |
| Bockrunden                     | `bockrunden.md`                                          |
| 30-Augen-Pflicht               | `dreissig-augen-pflicht.md`                              |
| Hochzeit                       | `hochzeit.md`                                            |
| Armut                          | `armut.md`                                               |
| Solo-Varianten                 | `solo-bube.md`, `solo-dame.md`, `solo-farbsolo.md`, `solo-fleischlos.md`, `solo-trumpf.md` |
| Regelkatalog / Presets         | `regelkatalog.md`                                        |
| Tisch, Lobby                   | `lobby.md`, `tischkonfiguration.md`                     |
| Spieler, Session               | `spieler-profil.md`, `spieler-session.md`, `authentifizierung.md`, `verbindungsabbruch.md` |
| Domain Events                  | `architektur-domain-events.md`                           |
| WebSocket-Protokoll            | `websocket-kommunikation.md`                             |
| REST API                       | `rest-api.md`                                            |
| KI-Verhalten                   | `ki-strategie.md`                                        |
| Frontend-Architektur           | `frontend-architektur.md`, `frontend-ui-logik.md`       |
| UI-Szenen                      | `frontend-tischansicht.md`, `frontend-startscreen.md`, `frontend-rundenauswertung.md` |
| Animationen                    | `frontend-animationen.md`                                |
| Tastatursteuerung              | `frontend-tastatursteuerung.md`                          |
| Clean Code, DDD-Methodik       | `methodik-clean-code.md`, `architektur-ddd.md`          |
| Datenbank-Schema               | `datenbankmodell.md`                                     |
| E2E-Tests                      | `e2e-tests.md`                                           |
