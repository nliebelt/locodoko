# Spieler-Session

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Zu prüfen |
| Priorität      | Hoch                                        |
| Abhängigkeiten | Keine                                       |

## Beschreibung

In der V1 gibt es keine Benutzerkonten. Spieler identifizieren sich durch Eingabe eines Namens und werden über eine serverseitig geführte Session erkannt. Diese Spec definiert, wie Spieler identifiziert, Sessions verwaltet und KI-Spieler von menschlichen Spielern unterschieden werden.

## Anforderungen

1. Beim erstmaligen Besuch der Anwendung wird ein Spieler aufgefordert, einen **Namen** einzugeben.
2. Der Name wird zusammen mit einer **Session-ID** (Cookie) serverseitig gespeichert.
3. Die Session-ID dient als **einzige Identifikation** des Spielers (kein Login/Passwort).
4. Bei erneutem Besuch (gleiche Session) wird der Spieler automatisch wiedererkannt.
5. KI-Spieler haben ein Flag `istKI = true` und brauchen kein Cookie.
6. KI-Spieler erhalten automatisch generierte Namen (z.B. „KI Anna", „KI Bob", „KI Clara").
7. Der Spielername muss **nicht eindeutig** sein (verschiedene Spieler können den gleichen Namen haben).
8. Eine Session hat ein konfigurierbares **Timeout** (Standard: 60 Minuten Inaktivität).
9. Nach Session-Timeout wird der Spieler aus aktiven Tischen entfernt (siehe `verbindungsabbruch.md`).
10. Der Spieler kann seinen **Namen ändern**, solange er keinem Tisch zugeordnet ist.

## Akzeptanzkriterien

- Ein neuer Spieler kann einen Namen eingeben und erhält eine Session.
- Ein wiederkehrender Spieler (gleiche Session) wird automatisch erkannt.
- KI-Spieler werden korrekt als KI markiert.
- KI-Spieler haben automatische Namen.
- Die Session wird serverisseitig geführt und validiert.
- Nach Session-Timeout ist der Spieler nicht mehr aktiv.
- Eine Session ohne gültigen Server-Eintrag wird abgelehnt.

## Definition of Done

- [x] Alle Anforderungen implementiert
- [x] Unit-Tests für Session-Erstellung und -Erkennung geschrieben und bestanden
- [x] Unit-Tests für KI-Spieler-Erkennung geschrieben und bestanden
- [x] Session-Timeout getestet
- [x] Integrationstests für Session-Management bestanden
- [x] Code-Review / Plausibilitätsprüfung

## Technische Hinweise

- **Bounded Context**: Spielverwaltung
- Spring Session oder einfaches HttpSession-basiertes Management
- `Spieler`-Entity mit: id, name, sessionId, istKI, erstelltAm
- Session-Cookie: HttpOnly, Secure (in Produktion), SameSite=Strict
- KI-Spieler-Factory für automatische Namensgenerierung
- Kein Authentifizierungsmechanismus (V1) — Session-Cookie reicht zur Identifikation
- Session-Validierung als Filter/Interceptor implementieren
