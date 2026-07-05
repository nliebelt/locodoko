# Fertigstellung & Betriebs-Roadmap

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe — Roadmap (lebendes Dokument)                |
| Priorität      | Hoch                                                        |
| Letztes Update | 2026-07-05 (Session 149)                                    |
| Abhängigkeiten | architektur.md, authentifizierung.md, datenbankmodell.md    |

## Zweck

Der **Spielkern und alle fachlichen Specs sind feature-complete** (alle Specs Status
*Implementiert / Stabil / Abgeschlossen*, `mvn clean test` grün). Dieses Dokument hält fest,
**was noch zur Fertigstellung für den öffentlichen Betrieb fehlt** — Themen, die in keiner
fachlichen Spec stehen (Deployment, Ops, Recht, Reife) sowie offene Produktentscheidungen.

Es ist die **fachliche Heimat** des Fertigstellungs-Backlogs. Die operative, klein-granulare
Task-Liste mit „Erste Datei zuerst"-Hinweisen lebt in `IMPLEMENTATION_PLAN.md` (Sektion
„Fertigstellung — Öffentlicher Betrieb"); bei Abweichung gilt für *Tasks* der Plan, für
*fachliche Zielsetzung* dieses Dokument.

## Zielbild

**Locodoko öffentlich betrieben** — echtes Deployment, Spieler:innen spielen über das Netz
gegeneinander (und gegen KI). Hosting-Anforderung: **europäisch, Server in der EU/Deutschland**
(Datenresidenz). US-Anbieter (Fly.io, Railway) ausgeschlossen, auch mit EU-Region.
Hosting-Favorit: **hosting.de** (DE-Anbieter, Account vorhanden); Alternativen: Hetzner 🇩🇪,
Netcup 🇩🇪, Scaleway 🇫🇷. Plattformwahl bewusst aufgeschoben.

## Meilensteine

**Domain-Schema (sticky, da OAuth/Cookies/WS gebunden):** App = **`zock.locodoko.de`** ·
Wiki = **`docs.locodoko.de`** (MkDocs auf GitHub Pages, gratis) · Apex **`locodoko.de`** = Landing/Redirect.
Permanente Wahl (kein „beta."-Umzug, da Daten erhalten bleiben).

**M1 — Closed Beta auf `zock.locodoko.de`** (eingeladene Kollegen, Feedback sammeln). Entscheidungen
(Session 30): Beta-Daten **erhalten** → Schema final + Backups **vor** M1; Zugang via **`zock.locodoko.de`**
(Domain+TLS); **Google OAuth aktiv**. Damit ist M1 ein **erster echter Deploy** (kein Wegwerf-Test).
M1-Blocker: `BUG-PROD-CHANGELOG`, `SPEC-SQL-REVIEW`, `DEPLOY-COMPOSE-SMOKE`, `BACKUP-DB`,
`SESSION-PERSISTENZ`, `OPS-DOMAIN`, `DEPLOY-OAUTH-SENTINEL` + OAuth-Credentials, `DOC-ENV-DEPLOY`,
`OPS-COMPOSE-HARDENING`, `OPS-BUILD-INFO`, `CD-DEPLOY (manuell)`, `FEAT-FEEDBACK`. Empfohlen:
Monitoring + Logs (SaaS EU-Region ok), minimaler Datenschutzhinweis, `SECURITY-REVIEW`.
Optional/zurückgestellt: `BETA-ACCESS` (Beta nicht gated), Admin-Tooling, Rollback-Doku.

**M2 — Public Go-Live.** Voller `SPEC-RECHT` (Impressum/Datenschutz/AGB), `SECURITY-REVIEW`,
automatisiertes CI/CD, `VERIFY-MULTIPLAYER`, `FE-SPIELREGELN-HILFE`, `FEAT-BUGREPORT`,
`DOC-DOCS-SITE`, `QA-CODE-METRICS`, `FE-UI-FINAL-REVIEW`, `FE-MOBILE`, `OPS-EMAIL`, `DECISION-LIZENZ`.

## Backlog

> **Kritische Reihenfolge:** `SPEC-SQL-REVIEW` (6) muss **vor dem ersten echten Deploy** (`CD-DEPLOY`)
> abgeschlossen sein. Solange greenfield, ist das Schema frei umziehbar; nach dem Live-Gang erzwingt
> jede Änderung eine Liquibase-Migration gegen produktive Daten. Daher gehört das Schema-Review
> faktisch in Phase A (direkt nach `BUG-PROD-CHANGELOG`), nicht ans Ende.

### Deploy-Strang (technisch, blockierend)

1. **BUG-PROD-CHANGELOG** (behoben) — prod-Boot via DEPLOY-PLAIN-SMOKE verifiziert (PG 15 Sandbox; PG 17 Prod-Ziel).
2. **DEPLOY-COMPOSE-SMOKE** — prod-Stack (`docker compose --profile prod`) real hochfahren,
   Liquibase gegen echtes Postgres 17 migrieren, eine Partie durchspielen.
3. **DOC-ENV-DEPLOY** (erledigt) — `.env.example` + README für den Betrieb vervollständigt.
4. **DEPLOY-OAUTH-SENTINEL** (erledigt) — „Mit Google anmelden" nur bei konfigurierten Credentials.
5. **CI/CD** — `CI-BUILD-TEST` → `CI-DOCKER-BUILD` → `CD-DEPLOY` (CD blockiert bis Plattformwahl).

### Produktreife & Specs

6. **SPEC-SQL-REVIEW** (erledigt — Sessions 26–128, REFACTOR-DB-1…10) — kritisches Schema-/SQL-Review **vor** der ersten echten DB: Normalformen,
   Audit-Spalten (`erstellt_am`/`geaendert_am` als `timestamptz`), Indizes, Constraints, Datentypen,
   JSONB-Strategie, Liquibase-Konsolidierung. Greenfield → jetzt sauber ziehbar. → `datenbankmodell.md`.
7. **OPS-GRAFANA-MONITORING** — Grafana Cloud Free-Tier (Actuator + Micrometer + Prometheus).
   → eigene Spec `betrieb-monitoring.md`.
7a. **OPS-LOGS-LOKI** — strukturierte JSON-Logs (MDC `tischId`/`partieId`/`correlationId`) nach
   Grafana Cloud Loki (Free, ~14 Tage Retention), per LogQL abfragbar. Versand via Alloy/Promtail-
   Sidecar. Retention begrenzt → relevante Ausschnitte für Tickets snapshotten.
7b. **FEAT-BUGREPORT** (erledigt — Shift+F1, GitHub-Issue via Server-Token, correlationId) — In-App-„Bug melden" mit redigiertem Session-Kontext → GitHub-Issue via
   server-seitigem Token, angereichert mit Log-Ausschnitt (correlationId) + Grafana-Deep-Link.
   Datenschutz/Redaktion kritisch (öffentliches vs. privates Issue-Repo). Sentry (Free, EU) als
   automatische Fehlererfassung empfohlen. GitHub-Issue-Templates mitnehmen. → eigene Spec `bugreport.md`.
8. **OPS-DOMAIN** — `zock.locodoko.de` + DNS + TLS (Reverse-Proxy/Let's Encrypt, **WS-Upgrade durchreichen!**,
   OAuth-Redirect `https://zock.locodoko.de/login/oauth2/code/google`, WS-Origins, Cookie-Domain). Apex→Redirect.
9. **DOC-DOCS-SITE** — Öffentliche Docs-/Wiki-Seite, damit Menschen außerhalb des GitHub-Kontexts
   das Projekt verstehen/„lernen" können; zugleich LLM-tauglich (Karpathy: eindeutige Begriffe,
   flache Hierarchie, explizite Querverweise). Empfohlen **MkDocs Material** (rendert die vorhandenen
   Specs direkt, GitHub-Pages-Deploy); Alternativen Docusaurus/Starlight. Bindet den Metrik-Report ein.
9a. **QA-CODE-METRICS** — Codebase mit Mess-/Analyse-Tooling vermessen (Größe `scc`/`cloc`; Java
   JaCoCo/SpotBugs/PMD/Checkstyle + Modulith/ArchUnit; TS ESLint/`knip`/`madge`/`depcheck`;
   Cross `lizard`; Dashboard SonarQube Community/SonarCloud). Ergebnis: Refactoring-Kandidaten als
   Tasks **und** ein Report für die Docs-Seite.
10. **FE-UI-FINAL-REVIEW** — finales UI/UX-Review; „nicht schöne" Stellen systematisch katalogisieren
    (Vision-Loop → Befunde als `FE-…`-Tasks). → ggf. `frontend-visuelles-design.md` präzisieren.
11. **SPEC-RECHT** — Rechtstexte für DE-Betrieb: **Impressum (§5 DDG) und Datenschutzerklärung
    (DSGVO) sind Pflicht**, AGB empfohlen. **Live-Blocker.** → eigene Spec `recht-impressum-datenschutz.md`.
12. **OPS-EMAIL** — Email-Versand für Registrierungs-Verifizierung + Passwort-Reset (V2); EU-Anbieter
    (Brevo/Mailjet) oder SMTP. Kein Launch-Blocker. → Abschnitt in `authentifizierung.md`.
13. **VERIFY-MULTIPLAYER** (erledigt — E2E grün, ≥2 unabhängige Sessions) — E2E-Verifikation Mensch-gegen-Mensch über mehrere echte Sessions.
    Laut `authentifizierung.md` der „Blocker für echten Multiplayer". Vor Live-Gang.

### Beta/Go-Live (Session 30, Teil 3)

14. **BACKUP-DB** (Skript erledigt: `scripts/backup-db.sh`; Cron + Restore-Test: Vorbedingung MENSCH) — automatische Postgres-Backups (`pg_dump`, rotierend, off-volume) +
    verifizierter Restore.
15. **SESSION-PERSISTENZ** (erledigt — spring-session-jdbc) — Sessions überleben Redeploys;
    Disconnect-Tracking bleibt erhalten.
16. **OPS-COMPOSE-HARDENING** (erledigt) — `app`-Service `restart: unless-stopped` + Healthcheck.
17. **OPS-BUILD-INFO** (erledigt) — `/actuator/info` mit Git-SHA/Version fürs Beta-Debugging.
18. **FEAT-FEEDBACK** (M1, leicht) — „Feedback geben"-Link/Form für die Beta (leichter als FEAT-BUGREPORT).
19. **SECURITY-REVIEW** (M1 empfohlen / M2 Pflicht) — vor öffentlicher Exposition: Auth/Rate-Limit, CORS,
    WS-`allowed-origins` (in prod auskommentiert!), Secrets, Cookie-Flags, OAuth-Redirect, CVEs.
20. **FE-SPIELREGELN-HILFE** (M2) — In-App-Regeln/Onboarding (keine Spielerklärung vorhanden; DoKo komplex).
21. **FE-MOBILE** (M2, evtl. vorziehen) — Mobile-/Touch-/Portrait (`Scale.FIT` skaliert, aber nicht optimiert).
    **Freunde auf iPhone → Beta wird vermutlich mobil/Safari getestet** → Re-Evaluierung empfohlen.
22. **BETA-ACCESS** (optional, zurückgestellt) — Registrierungs-Gating. Beta muss nicht gated sein (Entscheidung Teil 4).
23. **ADMIN-TOOLING / ROLLBACK-DOKU** (zurückgestellt) — hängenden Tisch beenden, User sperren, aktive Tische;
    Image-Tags + Rollback. Erwogen, bei Betriebsproblemen reaktivieren.

## Offene Entscheidungen

- **Authentifizierung:** ✅ entschieden (Session 30) — **beide Methoden behalten**
  (Google OAuth2 + Username/Passwort/bcrypt). `authentifizierung.md` bleibt unverändert.
- **Beta-Daten:** ✅ **erhalten** — Kollegen-Spiele/Statistiken bleiben → Schema final + Backups vor M1.
- **Domain-Schema:** ✅ App = **`zock.locodoko.de`**, Wiki = **`docs.locodoko.de`** (GitHub Pages),
  Apex = Landing/Redirect. Permanent (kein „beta."-Umzug). OAuth/Cookies/WS an `zock.` gebunden.
- **Beta-Zugang:** ✅ via **`zock.locodoko.de`** im Browser, **Google OAuth aktiv** in der Beta.
  Beta **nicht gated** (kein Site-Gate, SEO später) → `BETA-ACCESS` optional.
- **EU-Ops:** ✅ **pragmatisch** — Grafana/Sentry mit EU-Region + AVV ausreichend (kein Self-Hosting).
  (Hinweis: EU-Regel gilt damit für Server-Standort, nicht Firmen-Jurisdiktion.)
- **Sessions:** ✅ persistieren (`spring-session-jdbc`) + Build-Info; Admin-Tooling/Rollback zurückgestellt.
- **Auth-Provider:** ✅ **Google + Username/Passwort** bleibt; **„Sign in with Apple" verworfen**
  (99 €/Jahr Developer Program + JWT-Client-Secret-Rotation für reine UX; Apple-Nutzer nutzen Google im Safari).
- **Passwort-Reset / Email:** ⏸️ zurückgestellt → Beta-Fallback: manueller Reset durch Betreiber.
- **Mobile:** ⏸️ nominell M2 — **aber Apple/iPhone-Nutzer testen vermutlich mobil** → ggf. vorziehen.
- **Lizenz:** ⏸️ **aufgeschoben.** Tendenz Apache-2.0. Zielkonflikt: mögliche spätere
  **Steam-/kommerzielle Veröffentlichung** — eine permissive Lizenz (Apache/MIT) erlaubt Dritten den
  kommerziellen Nachbau. Wer Verwertung offenhalten will: eher **proprietär** oder **AGPL-3.0**.
  Entscheidung, sobald die Steam-Frage geklärt ist.

## Checklisten

### M1 — Closed Beta (locodoko.de, Daten erhalten)
- [x] BUG-PROD-CHANGELOG behoben, prod-Boot via DEPLOY-PLAIN-SMOKE verifiziert (PG 15 Sandbox; PG 17 Prod-Ziel)
- [x] **Schema final (SPEC-SQL-REVIEW)** — erledigt (Sessions 26–128, REFACTOR-DB-1…10)
- [~] Backup-Skript implementiert (`scripts/backup-db.sh`) ✓; Cron + Restore-Test ausstehend (MENSCH) (14)
- [x] Session-Persistenz aktiv (15) — spring-session-jdbc, Redeploys loggen nicht aus
- [ ] zock.locodoko.de + HTTPS aktiv, Google-OAuth-Redirect/WS-Origins gesetzt (WS-Upgrade im Proxy!) — DEPLOY-OAUTH-SENTINEL ✓, DOC-ENV-DEPLOY ✓; Domain/TLS ausstehend
- [~] app-Service restart/Healthcheck (16) ✓ + Build-Info (17) ✓; erster Deploy auf hosting.de ausstehend
- [~] Feedback-Kanal (FEAT-BUGREPORT ✓, Shift+F1) ✓; minimaler Datenschutzhinweis + SECURITY-REVIEW ausstehend (18/19)

### M2 — Public Go-Live (zusätzlich)
- [ ] Impressum + Datenschutzerklärung + AGB veröffentlicht (11)
- [ ] SECURITY-REVIEW vollständig, kritische Findings behoben (18)
- [ ] Automatisiertes CI/CD (5)
- [x] Mensch-gegen-Mensch verifiziert (13) — E2E grün
- [ ] In-App-Spielregeln/Onboarding (19)
- [ ] Lizenz entschieden
