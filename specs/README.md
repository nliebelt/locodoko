# Locodoko Spezifikationen (Domain-Landkarte)

Dieses Verzeichnis enthält alle funktionalen und nicht funktionalen Anforderungen in Form einzelner Spezifikationen für das Locodoko-Projekt. Sie dienen als **Single Source of Truth** für die Umsetzung im Code.

WICHTIG: Die Spezifikationen beschreiben das *Was* und *Warum* (Fachlichkeit und Regeln), aber nicht zwingend das exakte *Wie* (konkrete Variablennamen oder Code-Strukturen, sofern nicht architektonisch relevant).

## 1. Übergreifende Architektur & Methodik
Diese Dokumente bilden das Fundament des Projekts und müssen von allen Entwicklern/Agenten verinnerlicht werden:
- **`methodik-clean-code.md`**: Richtlinien zu Clean Code, DDD-Prinzipien (Ubiquitous Language) und Technikunabhängigkeit.
- **`architektur-ddd.md`**: Definition der Bounded Contexts (`tisch`, `spieler`, `partie`, `ki`) und der Modulgrenzen (Ziel-Modulstruktur).
- **`datenbankmodell.md`**: Relationales Schema und Persistenzvorgaben (Domain Model = Persistence Model via Spring Data JDBC).

## 2. Bounded Context: Partie (Spielkern & Regeln)
Der Kern des Spiels. Hier lebt die eigentliche Doppelkopf-Logik, streng getrennt von Infrastruktur und Frontend.
- **Basis-Ablauf:** `spielablauf.md`, `architektur-spielkern.md`, `kartendeck.md`.
- **Mechanik:** `stichlogik.md`, `trumpfhierarchie.md`, `punkteberechnung.md`, `ansagen.md`.
- **Sonderregeln (Normalspiel):** `schweinchen.md`, `dreissig-augen-pflicht.md`, `bockrunden.md`, `sonderpunkte.md`.
- **Sonderspiele (Abweichungen vom Normalspiel):** `hochzeit.md`, `armut.md`, `solo-bube.md`, `solo-dame.md`, `solo-farbsolo.md`, `solo-fleischlos.md`, `solo-trumpf.md`.
- **Meta-Regeln:** `regelkatalog.md` (Presets wie "Loco Blatt").

## 3. Bounded Context: Tisch & Spieler
Verwaltung der Spieler, ihrer Sessions und der virtuellen "Räume" (Tische), in denen die Partien stattfinden.
- **Tisch-Logik:** `lobby.md`, `tischkonfiguration.md`.
- **Spieler-Logik:** `spieler-profil.md`, `authentifizierung.md`, `spieler-session.md`, `verbindungsabbruch.md`.

## 4. Bounded Context: KI & System (Events / API)
Infrastruktur, externe Schnittstellen und die künstliche Intelligenz, die als Event-Subscriber agiert.
- **Events & API:** `architektur-domain-events.md`, `websocket-kommunikation.md`, `rest-api.md`.
- **KI-Verhalten:** `ki-strategie.md`.
- **Testing:** `e2e-tests.md`.

## 5. Frontend (Phaser 3 & UI)
Alle Vorgaben zur visuellen Repräsentation und Nutzerinteraktion im Browser.
- **Architektur:** `frontend-architektur.md`, `frontend-ui-logik.md`, `frontend-logging.md`.
- **Szenen & Ansichten:** `frontend-startscreen.md`, `frontend-tischansicht.md`, `frontend-rundenauswertung.md`.
- **UX & Design:** `frontend-visuelles-design.md`, `frontend-animationen.md`, `frontend-tastatursteuerung.md`.