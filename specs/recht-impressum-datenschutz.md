# Recht — Impressum, Datenschutz, AGB

| Feld   | Wert                                                                                             |
|--------|----------------------------------------------------------------------------------------------------|
| Status | Spezifikation — Gerüst implementiert (FEAT-RECHT-SEITEN-GERUEST S144); konkrete Texte vor Live-Gang anwaltlich oder via Generator prüfen |
| Gate   | Muss vor M2 (Public Go-Live) vollständig umgesetzt sein; minimaler Datenschutzhinweis bereits für M1 (Closed Beta) empfohlen |

---

## Rechtliche Anforderungen

Für einen öffentlich betriebenen Dienst in Deutschland gelten:

| Dokument | Rechtsgrundlage | Zeitpunkt |
|---|---|---|
| Impressum | § 5 DDG (Digitale-Dienste-Gesetz, ehem. TMG) | Vor öffentlicher Erreichbarkeit |
| Datenschutzerklärung | DSGVO Art. 13/14, BDSG | Vor öffentlicher Erreichbarkeit |
| AGB/Nutzungsbedingungen | Empfohlen (Haftungsbegrenzung, Verhaltensregeln) | Vor öffentlicher Erreichbarkeit |

---

## Impressum (§ 5 DDG)

### Pflichtangaben

```
Anbieter: [Vollständiger Name]
Anschrift: [Straße und Hausnummer], [PLZ] [Ort], Deutschland
E-Mail: [Kontakt-E-Mail-Adresse]
Telefon: [optional, aber empfohlen]
```

Nicht zutreffend für private Nicht-Gewerbetreibende (entfällt):
- Umsatzsteuer-ID (§ 27a UStG) — nur bei gewerblicher Tätigkeit
- Berufsbezeichnung / Aufsichtsbehörde — nur bei reglementierten Berufen
- Handelsregisternummer — nur bei Kaufleuten/Gesellschaften

### Hinweise

- Das Impressum muss von jeder Seite der App mit **maximal 2 Klicks** erreichbar sein.
- Bei Phaser-3-Frontend: Link im HTML-Overlay (`index.html`) oder als dedizierte Canvas-freie HTML-Seite unter `/impressum`.
- Entspricht einem privaten Hobby-Betrieb — keine unternehmerische Tätigkeit.

---

## Datenschutzerklärung (DSGVO)

### Verantwortlicher (Art. 13 Abs. 1a DSGVO)

```
Name: [wie Impressum]
Anschrift: [wie Impressum]
E-Mail: [wie Impressum]
```

### Verarbeitete personenbezogene Daten

#### 1. Registrierung und Authentifizierung

| Datenkategorie | Felder in DB | Rechtsgrundlage |
|---|---|---|
| Benutzername | `spieler.benutzername` | Art. 6 Abs. 1b (Vertragserfüllung) |
| Passwort-Hash (bcrypt) | `spieler.passwort_hash` | Art. 6 Abs. 1b |
| Anzeigename | `spieler.anzeige_name` | Art. 6 Abs. 1b |
| Avatar-Farbe | `spieler.avatar_farbe` | Art. 6 Abs. 1b |
| Registrierungsdatum | `spieler.erstellt_am` | Art. 6 Abs. 1b |

#### 2. Google OAuth2 (nur bei Wahl „Mit Google anmelden")

Empfangene Daten von Google (`scope=openid,email,profile`):
- `sub` (Google-Subject-ID — pseudonymer, persistenter Bezeichner) → gespeichert in `spieler.external_id`
- `email` → gespeichert in `spieler.email`
- `name` (Vor- und Nachname oder Anzeigename) → bei Erstregistrierung als `spieler.anzeige_name`

Rechtsgrundlage: Art. 6 Abs. 1b DSGVO (Vertragserfüllung) oder Art. 6 Abs. 1a (Einwilligung durch Klick auf OAuth-Button).

**Drittland-Transfer (Art. 46 DSGVO):** Google LLC mit Sitz in den USA. Grundlage: EU-Standardvertragsklauseln (SCC) gemäß Googles Datenschutzbedingungen. Weitere Informationen: [Google Privacy Policy](https://policies.google.com/privacy).

#### 3. Spielstatistiken (aggregiert, kein Spielverlauf)

Tabelle `spieler_statistik`: Anzahl Spiele, Siege, Punkte, Solos pro Regelvariante — nicht personenidentifizierend gegenüber Dritten, intern eindeutig dem Account zugeordnet.  
Rechtsgrundlage: Art. 6 Abs. 1b (Vertragserfüllung — Statistik ist Kernfunktion des Dienstes).

#### 4. Spielverlauf-Archiv (letzte 20 Partien)

Tabelle `spielergebnis_archiv`: Platzierung, Punktestand, Zeitstempel, Mitspielende (IDs). Keine Kartenwerte oder Spielzüge — nur Spielergebnis.  
Rechtsgrundlage: Art. 6 Abs. 1b.  
Speicherdauer: rollierende 20 Einträge; ältere werden automatisch überschrieben.

#### 5. Session-Daten

Spring Session (JDBC): Session-ID, Zeitstempel, serialisierte Session-Attribute. Keine zusätzlichen personenbezogenen Daten außer den bereits genannten. Session-Cookie: HttpOnly, SameSite=Lax, Secure=true (Produktion).  
Speicherdauer: Konfigurierbar via `LOCODOKO_SESSION_TIMEOUT`, Standard: 60 Minuten Inaktivität.

#### 6. Server-Logs

Strukturierte JSON-Logs (`logs/locodoko.log`, ECS-Format) mit MDC-Feldern `tischId`, `partieId`. Keine direkt personenbezogenen Daten (keine IP-Adressen, keine Benutzernamen in Logs).  
Speicherdauer: Log-Rotation konfigurierbar; empfohlen: max. 90 Tage.

#### 7. Bug-Reports

Endpoint `/api/bugreport` (nur für eingeloggte Nutzer): Empfängt vom Nutzer geschriebene Fehlerbeschreibung sowie optionale Metadaten (Tisch-ID, Zeitstempel). Bei Konfiguration `LOCODOKO_BUGREPORT_GITHUB_TOKEN` wird der Bericht als GitHub-Issue angelegt (öffentlich). Bei Konfiguration `LOCODOKO_BUGREPORT_LOKI_BASE_URL` wird ein Loki-Deep-Link angehängt.  
Rechtsgrundlage: Art. 6 Abs. 1a DSGVO (Einwilligung durch aktive Übermittlung des Reports).

#### 8. Fehler-Monitoring (Sentry)

Bei Konfiguration `SENTRY_DSN` werden unkontrollierte Exceptions automatisch an Sentry (Sentry, Inc., USA) übermittelt. Konfiguriert mit `send-default-pii=false` — keine personen-bezogenen Felder werden übertragen. Grundlage für Drittland-Transfer: EU-Standardvertragsklauseln (SCC). Weitere Informationen: [Sentry Privacy Policy](https://sentry.io/privacy/).  
Diese Funktion ist optional und kann durch Weglassen von `SENTRY_DSN` vollständig deaktiviert werden.

#### 9. E-Mail-Versand

Bei Konfiguration `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`: Versand von E-Mails für Konto-Verifizierung und Passwort-Reset an die vom Nutzer angegebene E-Mail-Adresse. Ohne SMTP-Konfiguration läuft der Dienst als No-Op (keine E-Mails).  
Rechtsgrundlage: Art. 6 Abs. 1b DSGVO (Vertragserfüllung).

### Weitergabe an Dritte

Keine Weitergabe personenbezogener Daten an Dritte, außer:
- **Google LLC** (OAuth2-Datenfluss — nur bei Nutzung von „Mit Google anmelden", s.o.) — Grundlage: SCC
- **Hosting-Provider** [Name, Land, AVV vorhanden: ja/nein] — zur Auftragsverarbeitung gemäß Art. 28 DSGVO
- **Sentry, Inc., USA** (Fehler-Monitoring — nur bei gesetztem `SENTRY_DSN`) — Grundlage: SCC, PII deaktiviert
- **GitHub, Inc., USA** (Bug-Reports — nur bei gesetztem `LOCODOKO_BUGREPORT_GITHUB_TOKEN`) — Issues werden öffentlich erstellt; keine personenbezogenen Daten außer dem Berichtstext

**Hinweis:** Wenn Grafana Cloud (OPS-GRAFANA-MONITORING) eingesetzt wird: Metriken und Log-Daten (keine personenbezogenen Felder außer aggregierten Zählern) → AVV mit Grafana Labs (EU-Region) abschließen.

### Speicherdauer und Löschung

| Datenkategorie | Löschzeitpunkt |
|---|---|
| Account-Daten | Auf Anfrage (Recht auf Löschung, Art. 17 DSGVO) oder nach 24 Monate Inaktivität (empfohlen) |
| Spielstatistiken | Mit Account-Löschung |
| Spielarchiv | Mit Account-Löschung |
| Session-Daten | Session-Ablauf (automatisch) |
| Logs | Log-Rotation (empfohlen: max. 90 Tage) |
| Bug-Reports (GitHub Issues) | Kein automatischer Ablauf — auf Anfrage oder manuell löschen |
| Sentry-Ereignisse | Gemäß Sentry-Einstellungen (Standard: 90 Tage) |

### Rechte der Betroffenen

Betroffene Personen haben folgende Rechte (Kontakt via Impressum-E-Mail):

- **Auskunft** (Art. 15): Welche Daten werden verarbeitet?
- **Berichtigung** (Art. 16): Falsche Daten korrigieren
- **Löschung** (Art. 17): Account + alle zugehörigen Daten löschen
- **Einschränkung** (Art. 18): Verarbeitung einschränken
- **Datenübertragbarkeit** (Art. 20): Daten in maschinenlesbarem Format erhalten
- **Widerspruch** (Art. 21): Verarbeitung auf Basis berechtigter Interessen widersprechen
- **Beschwerde bei Aufsichtsbehörde**: z.B. Landesbeauftragter für Datenschutz des zuständigen Bundeslandes

### Hosting und Datenresidenz

Alle Daten werden ausschließlich auf Servern in Deutschland oder der EU gespeichert und verarbeitet. US-amerikanische Hosting-Provider werden nicht eingesetzt.

---

## AGB / Nutzungsbedingungen (empfohlen)

### Inhalt (Mindeststruktur)

1. **Geltungsbereich** — Diese AGB gelten für die Nutzung von Locodoko Doppelkopf unter `zock.locodoko.de`.

2. **Leistungsbeschreibung** — Locodoko ist ein kostenloses, browserbasiertes Doppelkopf-Spiel für Einzel- und Mehrspielerbetrieb. Kein Echtgeld, kein Gewinn.

3. **Registrierung** — Account erforderlich für dauerhafte Statistiken; Gastspiel ohne Account möglich. Nutzende müssen mindestens 16 Jahre alt sein (DSGVO Art. 8).

4. **Verhaltensregeln** — Keine beleidigenden Benutzernamen, kein Missbrauch der Plattform, kein Einsatz von Bots außer dem eingebauten KI-Modus.

5. **Verfügbarkeit** — Kein SLA; der Dienst wird ohne Gewähr (Best-Effort) betrieben. Ausfälle sind möglich.

6. **Haftung** — Keine Haftung für Datenverlust durch technische Störungen; regelmäßige Backups werden durchgeführt (BACKUP-DB), aber kein Ersatz für verlorene Spielfortschritte.

7. **Account-Sperrung** — Der Betreiber kann Accounts bei Verstößen gegen die Verhaltensregeln sperren.

8. **Änderungen** — AGB-Änderungen werden 2 Wochen vorher per In-App-Hinweis angekündigt.

9. **Anwendbares Recht** — Deutsches Recht unter Ausschluss des UN-Kaufrechts.

---

## Build-Tasks (Umsetzung, separat)

Folgende konkrete Build-Tasks entstehen aus dieser Spec:

1. **Frontend-Seiten `/impressum`, `/datenschutz`, `/agb`** — Da Phaser 3 keinen HTML-Router hat, als separate HTML-Seiten (serverseitig geroutet durch Spring Boot, `src/main/resources/static/`) implementieren. Alternatively: Overlay-Modal in der Login-Szene.

2. **Footer-Links in `LoginSzene.ts`** — Verlinkung auf `/impressum` und `/datenschutz` im unteren Canvas-Bereich oder im HTML-Layer (`index.html`).

3. **Consent-Hinweis** — Beim ersten Login/Registrierung kurzer Hinweis: „Mit der Nutzung akzeptierst du unsere [Datenschutzerklärung] und [AGB]."

4. **AVV mit Hosting-Provider** — Vor M2 schriftlich mit dem gewählten EU-Hoster abschließen.

5. **AVV Grafana** (falls OPS-GRAFANA-MONITORING umgesetzt) — EU-Region + AVV in Grafana Cloud konfigurieren.

---

## Checkliste vor M2

- [ ] Impressum mit vollständiger Anschrift unter `/impressum` erreichbar
- [ ] Datenschutzerklärung unter `/datenschutz` erreichbar, deckt Google OAuth, Statistiken, Archiv ab
- [ ] AGB unter `/agb` erreichbar
- [ ] Footer-Links in der App (max. 2 Klicks Erreichbarkeit)
- [ ] AVV mit Hosting-Provider abgeschlossen
- [ ] AVV Grafana (falls genutzt) abgeschlossen
- [ ] Anwaltliche oder Generator-Prüfung der Texte (kein Bestandteil dieser Spec)
- [ ] Mindestalter-Hinweis bei Registrierung (16 Jahre)
- [ ] Cookie-Hinweis: Session-Cookie ist technisch notwendig (kein Consent-Banner nötig bei reinem Funktions-Cookie); bei Analytics-Cookies: Consent-Banner vor Einbindung
- [ ] Sentry-DSN: falls aktiv, in Datenschutzerklärung namentlich aufführen und SCC-Nachweis bereithalten
- [ ] Bug-Report-GitHub-Token: falls aktiv, Nutzer darauf hinweisen dass Berichte öffentlich erscheinen
