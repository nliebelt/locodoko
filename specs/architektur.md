# Locodoko Architektur

| Feld           | Wert                                      |
|----------------|-------------------------------------------|
| Status         | Aktive Vorgabe                            |
| Priorität      | Kritisch                                  |
| Letztes Update | 2026-05-06 — Konsolidiert (architektur-ddd.md, Frontend-Modell, Prinzipien) |

Dieses Dokument ist der architektonische Kompass für jeden Agent und Entwickler.
Es wird bei JEDEM Scan und Build in den Kontext geladen.

---

## Domain Model

```
Partie (Aggregate Root, @Version, PartieId)
  └── Spiel (Entity innerhalb Partie, SpielId)
        ├── Stich (Value Object, immutable — Bedienpflicht, Gewinner, Reihenfolge)
        ├── Hand (Value Object — Karten eines Spielers)
        ├── Ansagen (Value Object — Re/Kontra-Stufen + Zeitfenster)
        ├── Parteien (Value Object — Re/Kontra-Zuordnung)
        ├── HochzeitStatus / ArmutStatus (Value Objects — Sonderspiel-Zustand)
        └── Spielergebnis (Value Object — Auswertung nach Spielende)
```

- **Partie** = geordnete Folge von Spielen. Verwaltet Gesamtpunktestand, Geberrotation, Bockrunden.
- **Spiel** = eine Runde (Austeilen → Vorbehalte → Stiche → Auswertung). Immutable: jede Mutation → neue Instanz via `toBuilder()`.
- **Stich** = 4 Karten. Kapselt die zentrale Spiellogik: Bedienpflicht, Stichgewinner, Reihenfolge.

Sonderspiele (Hochzeit, Armut, Solos) sind integraler Teil des Spielkerns — kein separates Modul.

---

## Module

| Modul | Rolle | Enthält |
|---|---|---|
| `karten/` | Shared Kernel | Karte, Hand, TrumpfOrdnung, Spielregeln, Kartendeck — Value Objects, keine Domain-Logik |
| `partie/` | Domain-Kern | Spiellogik inkl. Sonderspiele, Punkte, Stichlogik, Domain-Events |
| `spieler/` | Domain | Identität, Auth, Session, Profil, Statistik |
| `ki/` | Autonomer Agent | Konsumiert Events → trifft Entscheidung → sendet Kommando zurück |
| `tisch/` | Application Layer | Orchestriert partie + spieler + ki; Delivery (REST, WebSocket, DTOs, Persistenz-Adapter) |
| `system/` | Querschnittlich | Basis-Klassen, globale Konfiguration |

**Abhängigkeitsrichtung (erlaubt):**
```
tisch → partie, karten, spieler, ki.orchestrierung
ki    → partie (Typen + Events), karten
partie → karten
spieler → partie.ereignisse (nur Event-Listener)
```

**tisch/ ist bewusst kein eigenständiger Bounded Context** — es ist der Application Layer
der Domain-Module orchestriert und die Delivery-Infrastruktur (Controller, WebSocket, DTOs) beherbergt.

---

## Event-Vertrag (Modulgrenzen)

`partie.ereignisse.*` ist ein Spring Modulith Named Interface. Nur diese Events überqueren Modulgrenzen:

| Event | Produzent | Konsument(en) | Trigger |
|---|---|---|---|
| `NaechsterSpielerErwartet` | SpielAktionsService | KiTischOrchestrator | Nach jedem Kartenzug |
| `VorbehaltErwartet` | SpielAktionsService | KiTischOrchestrator | In VORBEHALT_ANSAGE-Phase |
| `SpielBeendet` | KiTischOrchestrator | SpielerProfilService | Nach Auswertung |
| `SpielGestartet` | Partie | — | Bei Spielbeginn |
| `StichAbgeschlossen` | SpielAktionsService | — | Stich vollständig |

Alle Listener mit Seiteneffekten: `@TransactionalEventListener(phase = AFTER_COMMIT)`.

---

## Event→Frontend Pipeline

```
partie/ produziert Domain-Events
  → tisch/ wandelt in PartieEreignisTyp (WebSocket-DTOs)
    → OpenAPI-Spec (target/openapi.json, generiert)
      → api-types.ts (npm run generate-types)
        → AppStore konsumiert per Snapshot+Hint Modell
```

---

## Frontend-Modell (Phaser 3 + TypeScript strict)

```
AppStore (Zentraler Zustand — einzige Wahrheitsquelle im Frontend)
  ├── Session, Tisch, Partie, Aktionen
  └── nimmt Snapshots entgegen → benachrichtigt Szenen

TischAnsichtModell (abgeleitete Sicht — Sitzordnung relativ zum Spieler)

Szenen:  BootSzene → SpielverwaltungsSzene (Lobby) → TischSzene (Spiel)
Services: SpielverwaltungApi (REST), SpielverwaltungEchtzeit (STOMP-WS), AnimationenService
```

**Synchronisation (Snapshot+Hint):**
- Jedes WS-Event enthält vollständigen `partieStand` (Snapshot NACH Event) + Hint für Animation.
- Frontend-Queue: Seriell — Animation → State-Apply → nächstes Event.
- Version-Tracking: Lücke erkannt → HTTP-Snapshot-Request (Self-Healing).
- `window.__locodoko.isIdle()` = Quiescence-Signal für E2E-Tests.

**Type-Brücke:** `npm run generate-types` erzeugt `api-types.ts` aus `target/openapi.json`.
Canonical Enum: `PartieEreignisTyp` (Java) ↔ `ereignisTyp` (TypeScript).

Detail-Specs: `frontend-architektur.md`, `frontend-animationen.md`, `frontend-tischansicht.md`

---

## Prinzipien

1. **Deutsch.** Ubiquitous Language: DKV-Fachbegriffe in Code, Klassen, Methoden, Kommentaren.
2. **Immutable.** Value Objects geben neue Instanzen zurück. Spiel via `toBuilder().build()`.
3. **Fail Fast.** Invarianten sofort im Aggregat per Exception schützen. Guard Clauses statt Arrow Code.
4. **Tell, Don't Ask.** Logik im Domain-Objekt, nicht im Service. Business-Methoden statt Getter+externe Logik.
5. **DB = Source of Truth.** Kein In-Memory-State. `@Version` für Optimistic Locking.
6. **Domain Model = Persistence Model.** Keine separaten Entity-Klassen. `@Table` direkt auf Aggregaten.
7. **Typed IDs.** `TischId`, `PartieId`, `SpielId`, `SpielerId` — nie nackte UUID in Signaturen.
8. **YAGNI.** Einfachster Weg der das Problem vollständig löst. Keine vorzeitigen Abstraktionen.
9. **Kleine Einheiten.** Klassen und Methoden mit einem klar definierten Zweck. Methoden idealerweise < 30 Zeilen.
10. **Tests als Spezifikation.** Testnamen beschreiben fachliche Szenarien auf Deutsch.

---

## Detail-Specs (bei Bedarf lesen)

- Modulith-Konfiguration & Spring Data JDBC: `architektur-ddd.md`
- Synchronisation, Optimistic Locking, Quiescence: `architektur-unified.md`
- Event-Details, Queue, Transaktionen: `architektur-domain-events.md`
- Glossar & Spielkern-Prinzipien: `architektur-spielkern.md`
- Datenbankschema: `datenbankmodell.md`
- Frontend-Architektur & Dateien: `frontend-architektur.md`
- Animationen & Tweens: `frontend-animationen.md`
- Tisch-UI-Layout: `frontend-tischansicht.md`
