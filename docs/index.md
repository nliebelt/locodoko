# Locodoko

Locodoko ist ein server-seitiger Doppelkopf-Spielserver für 4 Spieler mit Echtzeit-Multiplayer und KI-Gegnern.

**Stack:** Spring Boot 3 · Spring Data JDBC · PostgreSQL · Phaser 3 · TypeScript · WebSocket (STOMP)

## Schnell-Orientierung

| Frage | Antwort |
|---|---|
| Was ist Doppelkopf? | [Spielablauf](specs/spielablauf.md) · [Trumpfhierarchie](specs/trumpfhierarchie.md) · [Regelkatalog](specs/regelkatalog.md) |
| Wie ist der Code aufgebaut? | [Architektur](specs/architektur.md) |
| Wie kommuniziert Frontend/Backend? | [WebSocket](specs/websocket-kommunikation.md) · [REST-API](specs/rest-api.md) |
| Wie funktioniert die KI? | [KI-Strategie](specs/ki-strategie.md) |
| Was ist noch zu tun? | [Fertigstellung](specs/fertigstellung.md) |

## Modulstruktur

```
partie/   — Domain-Kern (Spielkern, PunkteRechner, Stich-Logik)
karten/   — Shared Kernel (Kartentypen, Trumpfhierarchie)
spieler/  — Identität, Authentifizierung, Statistik
ki/       — Autonomer KI-Agent
tisch/    — Application Layer, REST/WebSocket-Delivery
```

## Fachbegriffe (Ubiquitous Language)

Stich · Trumpf · Dulle · Fuchs · Karlchen · Re · Kontra · Armut · Hochzeit

## Spezifikations-Überblick

Alle funktionalen und nicht-funktionalen Anforderungen sind als Markdown-Specs im Verzeichnis [`specs/`](specs/README.md) abgelegt.
Sie dienen als **Single Source of Truth** für die Code-Implementierung.

Der Spielkern ist feature-complete. Alle fachlichen Specs sind umgesetzt.
Offen: Fertigstellung für den öffentlichen Betrieb — Details in [Fertigstellung](specs/fertigstellung.md).
