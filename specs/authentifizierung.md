# Authentifizierung

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Zu implementieren                                           |
| Priorität      | Hoch — Blocker für echten Multiplayer                       |
| Abhängigkeiten | spieler-profil.md, datenbankmodell.md, spieler-session.md   |

## Beschreibung

Locodoko wird öffentlich betrieben. Spieler benötigen persistente Identität damit Spielverlauf,
Statistiken und private Tische (Einladungslinks) funktionieren. V1 nutzt ausschließlich
HTTP-Session ohne Account — diese Schicht wird durch Spring Security ergänzt, nicht ersetzt.

## Anforderungen

### Authentifizierungsmethoden

1. **OAuth2 / Social Login** — Google (weitere Provider optional, z.B. GitHub).
   - Spieler die einen Google-Account haben, nutzen „Mit Google anmelden".
   - Spring Security OAuth2 Client (`spring-boot-starter-oauth2-client`).
   - Nach erfolgreichem OAuth2-Flow: Spring Security Principal → interne `Spieler`-Entität laden
     oder neu anlegen (`findOrCreate` per `email` oder `sub`).

2. **Username + Passwort** — für Spieler ohne Google-Account.
   - Felder: `benutzername` (eindeutig, 3–20 Zeichen) + `passwort` (bcrypt-gehashed, min. 8 Zeichen).
   - Kein E-Mail-Pflichtfeld für Basisfunktion (optional für Passwort-Reset).
   - Spring Security `UserDetailsService` mit eigenem `Spieler`-Repository.
   - Passwort-Reset: erst in V2, nicht im initialen Scope.

3. **Gast-Modus** (optional, V2) — aktueller Session-Ansatz bleibt als Fallback erhalten,
   aber Gast-Accounts können keinen Spielverlauf speichern und keine privaten Tische erstellen.

### Spieler-Entität (Account-Felder)

4. `Spieler`-Entität erhält neue Felder (Details: `spieler-profil.md`):
   - `authentifizierungsMethode: OAUTH2_GOOGLE | PASSWORT`
   - `externalId: String` (OAuth2 sub / Google ID, nullable bei Passwort-Auth)
   - `benutzername: String` (eindeutig, Anzeigename wählbar, siehe spieler-profil.md)
   - `passwortHash: String` (nullable bei OAuth2)
   - `email: String` (nullable, optional)

### Session-Integration

5. Nach Login erstellt Spring Security eine authentifizierte Session.
   Die bisherige `SpielerSessionService`-Logik (Tisch-Zuordnung, KI-Flag) bleibt erhalten —
   sie nutzt nun die authentifizierte `SpielerId` aus dem Security-Principal statt aus
   einer manuell gesetzten Session-Eigenschaft.
6. `SpielerSessionValidierungsInterceptor` prüft weiterhin ob der Spieler einem Tisch zugeordnet
   ist — Spring Security übernimmt nur die Authentifizierung, nicht die Spielzustand-Validierung.

### Sicherheitsanforderungen (OWASP)

7. Passwörter: **BCrypt** mit Kostenfaktor ≥ 12.
8. OAuth2 State-Parameter: Spring Security generiert CSRF-sicheren State automatisch.
9. Session-Fixation: Spring Security `session-fixation: change-session-id` (Standard).
10. CSRF: Für REST-Endpoints deaktiviert (stateless API + SameSite-Cookie), für HTML-Formulare aktiv.
11. Brute-Force-Schutz: Rate-Limiting auf `/api/auth/login` — max. 10 Versuche pro Minute pro IP
    (z.B. via `Bucket4j` oder einfachem `@RateLimiter`).

### Autorisierungs-Modell (ABAC)

Locodoko nutzt **ABAC — Attribute-Based Access Control** via Spring Method Security.
Zugriffsregeln vergleichen Attribute von Spieler, Ressource und Kontext — keine statischen
Rollen-Tabellen, keine ACL-Datenbanktabellen.

**Systemrollen** (RBAC-Schicht, einfach):
- `ROLE_SPIELER` — jeder eingeloggte Account
- `ROLE_ADMIN` — Moderation (z.B. Tische löschen, Spieler sperren)

**Tisch-bezogene Policies** (ABAC via `@PreAuthorize`):

```java
// Nur Gastgeber darf kicken / Config ändern:
@PreAuthorize("@tischSicherheit.istGastgeber(#tischId, authentication)")

// Spieler darf nur seine eigene Position bedienen (bereits via Session):
@PreAuthorize("@spielSicherheit.istAnPosition(#tischId, authentication)")

// Privater Tisch: nur Mitglieder dürfen Spielzustand sehen:
@PreAuthorize("@tischSicherheit.hatZugang(#tischId, authentication)")
```

`TischSicherheit` ist ein `@Component` das die Beziehung `Spieler → ist_gastgeber_von → Tisch`
direkt aus dem `Tisch`-Aggregat prüft (`tisch.erstelltVonSpielerId == currentSpielerId`).
Keine eigenen ACL-Tabellen nötig.

**ReBAC-Migration (Zukunft):** Wenn Delegierung (Gastgeber-Rechte übertragen), Zuschauer-Rollen
oder Ligen/Organisationen nötig werden, ist eine Migration auf ReBAC (z.B. OpenFGA) möglich —
das `@PreAuthorize`-Interface bleibt gleich, nur das dahinterliegende `@Component` ändert sich.

### Frontend

12. Neuer Screen **Login/Register** (vor SpielverwaltungsSzene):
    - „Mit Google anmelden"-Button (OAuth2-Redirect).
    - Formular für Username + Passwort.
    - Link zu „Registrieren" (neuer Account via Passwort).
13. Nach erfolgreichem Login: Redirect zur SpielverwaltungsSzene (bisheriger Startscreen).
14. Logout-Button in der Seitenlade.
15. Anzeigename und Avatar im HUD (Details: `spieler-profil.md`).

## Akzeptanzkriterien

- Spieler kann sich mit Google-Account anmelden.
- Spieler kann sich mit Username + Passwort registrieren und anmelden.
- Passwörter werden bcrypt-gehashed gespeichert (niemals Plaintext).
- Nach Login ist der Spieler persistent identifiziert — Spielverlauf wird gespeichert.
- Fehlerhafte Anmeldeversuche werden nach 10 Versuchen/Minute gedrosselt.
- Logout invalidiert die Session korrekt.

## Definition of Done

- [ ] `spring-boot-starter-security` + `spring-boot-starter-oauth2-client` in `pom.xml`
- [ ] Google OAuth2 konfiguriert (`application.properties`: client-id, client-secret)
- [ ] `UserDetailsService`-Implementierung für Username/Passwort-Auth
- [ ] `Spieler`-Entität um Auth-Felder erweitert (Liquibase-Migration)
- [ ] `SpielerSessionService` nutzt authentifizierten Principal statt manueller Session-Eigenschaft
- [ ] Login/Register-Screen im Frontend
- [ ] Rate-Limiting auf Login-Endpoint
- [ ] Tests: erfolgreicher Login, fehlerhafter Login, OAuth2-Flow (Mock)

## Technische Hinweise

- **Bounded Context**: `spieler/`
- Google-Credentials als Umgebungsvariablen (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`),
  nie im Repository.
- `SecurityConfig`: `http.oauth2Login()` + `http.formLogin()` parallel konfiguriert.
- OAuth2 Callback-URL: `/login/oauth2/code/google` (Spring Security Standard).
- `Spieler.findOrCreateByOauth2(sub, email, name)` — idempotent, safe für parallele Aufrufe.
