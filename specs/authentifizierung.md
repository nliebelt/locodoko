# Authentifizierung

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Abgeschlossen (V1)                                          |
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

- [x] `spring-boot-starter-security` + `spring-boot-starter-oauth2-client` in `pom.xml`
- [x] Google OAuth2 konfiguriert (`application.properties`: client-id, client-secret)
- [x] `UserDetailsService`-Implementierung für Username/Passwort-Auth
- [x] `Spieler`-Entität um Auth-Felder erweitert (Liquibase-Migration)
- [x] `SpielerSessionService` nutzt authentifizierten Principal statt manueller Session-Eigenschaft
- [x] Login/Register-Screen im Frontend
- [x] Rate-Limiting auf Login-Endpoint
- [x] Tests: erfolgreicher Login, fehlerhafter Login, OAuth2-Flow (Mock)

## Technische Hinweise

- **Bounded Context**: `spieler/`
- Google-Credentials als Umgebungsvariablen (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`),
  nie im Repository.
- `SecurityConfig`: `http.oauth2Login()` + `http.formLogin()` parallel konfiguriert.
- OAuth2 Callback-URL: `/login/oauth2/code/google` (Spring Security Standard).
- `Spieler.findOrCreateByOauth2(sub, email, name)` — idempotent, safe für parallele Aufrufe.
- **OAuth Account-Linking & Sicherheit:**
  - `OAuth2ErfolgsHandler` verknüpft ein bestehendes Passwort-Konto nur dann mit OAuth, wenn sowohl der Google-Claim `email_verified=true` gesetzt ist als auch das lokale Konto bereits den Status `emailVerifiziert = true` aufweist.
  - Schlägt diese Verknüpfung fehl (z.B. wegen fehlender Verifizierung beider Seiten oder bei Race-Conditions auf dem Unique-Index für E-Mails), wird der Login explizit abgewiesen (Redirect zu `/?fehler=email_konflikt`).
  - Um bei einer solchen Abweisung einen halb-authentifizierten Zustand („Ghost-Session“) zu verhindern, führt der Handler zwingend `SecurityContextHolder.clearContext()` aus und invalidiert die HTTP-Session.

## Implementierungsnotizen (Stand 2026-04-30)

**V1 vollständig implementiert.** Alle DoD-Punkte erfüllt:

- `SecurityConfig.java` — OAuth2-Login (Google) + Formular-Login parallel konfiguriert;
  CSRF für SPA deaktiviert; Session-Fixation-Schutz aktiv.
- `PasswortKonfiguration.java` — `BCryptPasswordEncoder` mit Kostenfaktor 12.
- `OAuth2ErfolgsHandler.java` — erstellt/findet Spieler per OAuth2-Subject-ID nach
  erfolgreichem Google-Login.
- `AuthentifizierungsController.java` — `/api/auth` für Registrierung und Passwort-Login.
- `SpielerEntity.java` — enthält `authentifizierungsMethode`, `externalId`, `benutzername`,
  `passwortHash`, `email`; Factory-Methoden `mitPasswort()` und `mitOauth2()`.
- `LoginSzene.ts` — Frontend-Loginscreen mit Google- und Passwort-Login vor
  SpielverwaltungsSzene.

**V1 vollständig implementiert.** V2 (Email-Verifizierung & Passwort-Reset) folgt unten.

## Email-Verifizierung & Passwort-Reset (V2)

**Anbieter:** Standard-SMTP — kompatibel mit Brevo (🇫🇷), Mailjet (🇫🇷) oder eigenem SMTP.
Configuration via ENV-Variablen (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`).
**Ohne `SMTP_HOST`:** alle Email-Operationen sind No-Ops (kein Test-Bruch, kein Startup-Fehler).

### Email-Verifizierung (Double-Opt-In)

- Beim Registrieren via Passwort-Auth: `emailVerifizierungsToken` (UUID) wird generiert und
  per Email versendet (sofern Email-Adresse angegeben und SMTP konfiguriert).
- OAuth2-Spieler (Google): Email gilt automatisch als verifiziert (`emailVerifiziert = true`).
- Endpoint: `GET /api/auth/email-verifizieren?token=<token>` — setzt `emailVerifiziert = true`,
  löscht Token. Ungültiger Token → 404. Bereits verifiziert → 200 (idempotent).
- Token-TTL: keine serverseitige Ablaufzeit (Link kann jederzeit aktiviert werden).
- UI: Hinweis nach Registrierung, falls Email angegeben. Keine Feature-Gates in M1.

### Passwort-Reset

- Endpoint: `POST /api/auth/passwort-reset-anfragen` — Body `{email}`.
  Immer 200 (kein User-Enumeration-Leak). Bei bekannter Email: Token (UUID) erzeugen,
  `passwordResetTokenAblauf = jetzt + 30 Minuten`, Email senden.
- Endpoint: `POST /api/auth/passwort-reset` — Body `{token, neuesPasswort}`.
  Findet Spieler per Token. Prüft TTL → 400 bei Ablauf. Setzt neues BCrypt-Passwort,
  löscht Token + Ablauf. Ungültiger Token → 404.

### Datenmodell (neue Spalten in `spieler`)

| Spalte | Typ | Default |
|---|---|---|
| `email_verifiziert` | `BOOLEAN NOT NULL` | `FALSE` |
| `email_verification_token` | `VARCHAR(255)` | NULL |
| `password_reset_token` | `VARCHAR(255)` | NULL |
| `password_reset_token_ablauf` | `TIMESTAMP WITH TIME ZONE` | NULL |

### Spring-Mail-Konfiguration

```properties
spring.mail.host=${SMTP_HOST:}
spring.mail.port=${SMTP_PORT:587}
spring.mail.username=${SMTP_USER:}
spring.mail.password=${SMTP_PASSWORD:}
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
locodoko.mail.absender=${MAIL_ABSENDER:noreply@locodoko.de}
locodoko.mail.basis-url=${APP_BASIS_URL:http://localhost:8081}
```

### Implementierungshinweise

- `MailService` in `de.locodoko.spieler`: prüft ob `SMTP_HOST` gesetzt ist; falls nein,
  alle Methoden sind No-Ops (kein `JavaMailSender`-Aufruf).
- Email-Inhalte als einfache HTML-Strings (kein Thymeleaf erforderlich).
- `SpielerRepository`: neue Queries `findByEmailVerificationToken`, `findByPasswordResetToken`.
