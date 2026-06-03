# Locodoko Spezifikationen (Domain-Landkarte)

Dieses Verzeichnis enthält alle funktionalen und nicht funktionalen Anforderungen in Form einzelner Spezifikationen für das Locodoko-Projekt. Sie dienen als **Single Source of Truth** für die Umsetzung im Code.

WICHTIG: Die Spezifikationen beschreiben das *Was* und *Warum* (Fachlichkeit und Regeln), aber nicht zwingend das exakte *Wie* (konkrete Variablennamen oder Code-Strukturen, sofern nicht architektonisch relevant).

## 0. Projektstatus & Fertigstellung
Der Spielkern ist feature-complete (alle fachlichen Specs *Implementiert/Stabil/Abgeschlossen*).
Was noch zum **öffentlichen Betrieb** fehlt (Deployment, Ops, Recht, Reife, offene Entscheidungen):
- **`fertigstellung.md`**: Fertigstellungs- & Betriebs-Roadmap (fachliche Heimat des Backlogs).
  Operative Task-Liste mit Umsetzungshinweisen → `../IMPLEMENTATION_PLAN.md`.

## 1. Übergreifende Architektur & Prinzipien
- **`architektur.md`**: **Single Source of Truth** — Domain Model, Module, Event-Vertrag, Coding-Prinzipien. **Wird bei jedem Scan/Build geladen.** Die übrigen `architektur-*.md` sind Detail-Specs; bei Widersprüchen gilt `architektur.md`.
- **`architektur-ddd.md`**: Detail-Spec für Spring Modulith Konfiguration & Persistenz-Strategie.
- **`architektur-unified.md`**: Hybrides Snapshot+Hint-Modell, Optimistic Locking, Transaktionsgarantien und Quiescence Pattern.
- **`architektur-spielkern.md`**: Glossar (DKV-Begriffe), Typed IDs, Spielkern-Prinzipien.
- **`architektur-domain-events.md`**: Event-Tabellen, Transaktions-Garantien, Frontend-Queue.
- **`datenbankmodell.md`**: Relationales Schema und Persistenzvorgaben (Domain Model = Persistence Model via Spring Data JDBC).

## 2. Spielkern (partie/ + karten/)
Der Kern des Spiels. Hier lebt die eigentliche Doppelkopf-Logik, streng getrennt von Infrastruktur und Frontend.
- **Basis-Ablauf:** `spielablauf.md`, `kartendeck.md`.
- **Mechanik:** `stichlogik.md`, `trumpfhierarchie.md`, `punkteberechnung.md`, `ansagen.md`.
- **Sonderregeln (Normalspiel):** `schweinchen.md`, `dreissig-augen-pflicht.md`, `bockrunden.md`, `sonderpunkte.md`.
- **Sonderspiele (integraler Teil des Spielkerns):** `hochzeit.md`, `armut.md`, `solo-bube.md`, `solo-dame.md`, `solo-farbsolo.md`, `solo-fleischlos.md`, `solo-trumpf.md`.
- **Meta-Regeln:** `regelkatalog.md` (Presets wie "Loco Blatt").

## 3. Lobby, Spieler & Infrastruktur (tisch/ + spieler/)
Verwaltung der Spieler, ihrer Sessions und der virtuellen "Räume" (Tische).
Application Layer: Orchestrierung, Delivery (REST, WebSocket).
- **Tisch-Logik:** `lobby.md`, `tischkonfiguration.md`.
- **Spieler-Logik:** `spieler-profil.md`, `authentifizierung.md`, `spieler-session.md`, `verbindungsabbruch.md`.
- **Statistik & Ranking:** `statistik-ranking.md` (Plattform-Benchmark + Greenfield-Schema für Rating/Saison).
- **API & Kommunikation:** `websocket-kommunikation.md`, `rest-api.md`.
- **Betrieb & Diagnose:** `bugreport.md` (In-App-Bugreport + Sentry + correlationId-Kette).

## 4. KI (ki/)
Autonomer Agent der auf Events reagiert und regelkonforme Züge spielt.
- **KI-Verhalten:** `ki-strategie.md`.
- **Testing:** `e2e-tests.md`.

## 5. Frontend (Phaser 3 & UI)
Alle Vorgaben zur visuellen Repräsentation und Nutzerinteraktion im Browser.
Konsumiert den Event-Vertrag des Backends per Snapshot+Hint Modell.
- **Architektur:** `frontend-architektur.md`, `frontend-ui-logik.md`, `frontend-logging.md`.
- **Szenen & Ansichten:** `frontend-startscreen.md`, `frontend-tischansicht.md`, `frontend-rundenauswertung.md`.
- **UX & Design:** `frontend-visuelles-design.md`, `frontend-animationen.md`, `frontend-tastatursteuerung.md`.
- **Vorbehalt-UI:** `frontend-vorbehalt-kartenauswahl.md`.
- **Balatro-Design-System (Plan #101):** `frontend-flash-text.md` (FlashTextManager, 9 Events), `frontend-nameplates.md` (HUD-Bar Spieler-Anzeige). Design-Referenzen: `design_handoff/`.