# Spieler-Session

| Feld           | Wert                                        |
|----------------|---------------------------------------------|
| Status         | Stabil |
| Priorität      | Hoch                                        |
| Abhängigkeiten | Keine                                       |

## Beschreibung

Spieler registrieren sich mit einem Anzeigenamen und einem Passwort. Die Authentifizierung erfolgt über Spring Security mit BCrypt-Passwort-Hashing; das Session-Cookie ist der Transportmechanismus nach erfolgreichem Login. Diese Spec definiert, wie Spieler identifiziert, Sessions verwaltet und KI-Spieler von menschlichen Spielern unterschieden werden.

## Anforderungen

1. Beim erstmaligen Besuch der Anwendung wird ein Spieler aufgefordert, einen **Namen** und ein **Passwort** einzugeben (Registrierung).
2. Name und **BCrypt-Passwort-Hash** werden serverseitig gespeichert; nach erfolgreichem Login wird eine **Session-ID** (Cookie) ausgestellt.
3. Das **Passwort** (BCrypt) ist das primäre Authentifizierungsmittel; das Session-Cookie ist der **Transportmechanismus** für nachfolgende Requests.
4. Bei erneutem Besuch mit aktiver Session wird der Spieler automatisch wiedererkannt; nach Session-Ablauf ist ein erneutes Login mit Name und Passwort erforderlich.
5. KI-Spieler haben ein Flag `istKI = true` und brauchen kein Cookie.
6. KI-Spieler erhalten automatisch generierte Namen (z.B. „KI Anna", „KI Bob", „KI Clara").
7. Der Spielername muss **nicht eindeutig** sein (verschiedene Spieler können den gleichen Namen haben).
8. Eine Session hat ein konfigurierbares **Timeout** (Standard: 60 Minuten Inaktivität).
9. Nach Session-Timeout übernimmt die KI den Spieler in laufenden Spielen (siehe `verbindungsabbruch.md`); der Spieler kann sich ab der nächsten Runde wieder einloggen.
10. Der Spieler kann seinen **Namen ändern**, solange er keinem Tisch zugeordnet ist.

## Akzeptanzkriterien

- Ein neuer Spieler kann sich mit Name und Passwort registrieren und erhält eine Session.
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
- `Spieler`-Entity mit: id, name, passwortHash, istKI, erstelltAm
- Session-Cookie: HttpOnly, Secure (in Produktion), SameSite=Strict
- KI-Spieler-Factory für automatische Namensgenerierung
- Authentifizierung via Spring Security + BCrypt (`PasswordEncoder`); Session-Cookie als Transportmechanismus nach Login
- Session-Validierung als Filter/Interceptor implementieren
