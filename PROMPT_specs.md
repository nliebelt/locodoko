# Phase 1: Spezifikationen erstellen

Du bist ein Requirements Engineer für das Doppelkopf-Spiel "Locodoko" (Spring Boot + Phaser).

## Aufgabe

Erstelle basierend auf der PRD (@PRD.md) detaillierte Spezifikationen als einzelne Markdown-Dateien im Verzeichnis `specs/`.

## Vorgehensweise

1. Studiere die PRD gründlich
2. Studiere bestehende Spezifikationen in `specs/` (falls vorhanden)
3. Identifiziere alle eigenständigen Themen — ein Thema pro Spec-Datei
4. Schreibe für jedes Thema eine Spec-Datei nach dem Schema unten
5. Achte darauf, dass jede Spec unabhängig umsetzbar ist
6. Verwende die deutsche Domänensprache aus der PRD (Stich, Trumpf, Dulle, Fuchs, etc.)
7. Nutze das Internet, um DKV-Doppelkopf-Regeln oder Best Practices zu verifizieren

## Schema für Spec-Dateien

Jede Spec-Datei soll folgendes Schema verwenden:

```markdown
# [Titel der Spezifikation]

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Noch nicht begonnen                         |
| Priorität      | [Hoch / Mittel / Niedrig]                   |
| Abhängigkeiten | [Liste anderer Specs, von denen diese abhängt] |

## Beschreibung

[Was genau soll umgesetzt werden und warum]

## Anforderungen

[Detaillierte, nummerierte Liste der Anforderungen]

## Akzeptanzkriterien

[Konkrete, testbare Kriterien — was muss wahr sein, damit die Spec als erfüllt gilt]

## Definition of Done

- [ ] Alle Anforderungen implementiert
- [ ] Unit-Tests geschrieben und bestanden
- [ ] Integrationstests bestanden (falls relevant)
- [ ] Code-Review / Plausibilitätsprüfung der Logs
- [ ] [Weitere projektspezifische Kriterien]

## Technische Hinweise

[Relevante technische Entscheidungen, Schnittstellen, Patterns, Bounded Context]
```

## Granularität

Teile die PRD in granulare, einzeln umsetzbare Specs auf:

- **Ein Thema pro Spec** — die Spec lässt sich in einem Satz ohne "und" beschreiben
- **Lieber zu granular als zu grob** — z.B. "Hochzeit" als eigene Spec, nicht zusammen mit "Armut"
- **Abhängigkeiten** zwischen Specs explizit benennen

Beispiel-Aufteilung (Orientierung, nicht bindend):

- `kartendeck.md` — Kartentypen, Farben, Werte
- `trumpfhierarchie.md` — Trumpfreihenfolge im Normalspiel
- `stichlogik.md` — Wer gewinnt einen Stich, Bedienpflicht
- `hochzeit.md` — Sonderspiel Hochzeit
- `armut.md` — Sonderspiel Armut
- `solo-dame.md` — Damensolo
- `solo-bube.md` — Bubensolo
- `solo-fleischlos.md` — Fleischlos
- `solo-trumpf.md` — Trumpfsolo
- `ansagen.md` — Re, Kontra, Keine 90/60/30, Schwarz
- `sonderpunkte.md` — Fuchs, Karlchen, Doppelkopf
- `spielablauf.md` — Rundenstruktur, Kartenverteilung, Phasen
- `punkteberechnung.md` — Augen, Spielpunkte, Gesamtstand
- `lobby.md` — Tischverwaltung, Beitreten, Erstellen
- `tischkonfiguration.md` — Regelwerk pro Tisch
- `ki-strategie.md` — Regelbasierte KI-Logik
- `websocket-kommunikation.md` — STOMP-Events, Echtzeit
- `rest-api.md` — REST-Endpunkte für Lobby/Konfiguration
- `frontend-tischansicht.md` — Phaser Top-Down-Ansicht
- `frontend-animationen.md` — Kartenanimationen, UI-Effekte
- `frontend-ui-logik.md` — Spielbare Karten, Ansage-Buttons
- `datenbankmodell.md` — JPA-Entitäten, H2/PostgreSQL
- `spieler-session.md` — Session-basierte Identifikation
- `verbindungsabbruch.md` — Reconnect, KI-Übernahme

## Wichtig

- Alle Specs auf Deutsch verfassen
- Kommentare und Anmerkungen ebenfalls auf Deutsch
- Nutze die Fachbegriffe aus der PRD konsistent
- Stelle sicher, dass die Specs zusammen die gesamte PRD abdecken
- Nimm nicht an, dass eine Spec fehlt — prüfe zuerst `specs/`
