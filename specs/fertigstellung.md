# Fertigstellung & Betriebs-Roadmap

| Feld           | Wert                                                        |
|----------------|-------------------------------------------------------------|
| Status         | Aktive Vorgabe — Roadmap (lebendes Dokument)                |
| Priorität      | Hoch                                                        |
| Letztes Update | 2026-06-01 (Session 30)                                     |
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

## Backlog

### Deploy-Strang (technisch, blockierend)

1. **BUG-PROD-CHANGELOG** (P0, verifizierter Bug) — prod-Profil lädt eine nicht existierende
   Liquibase-Changelog-Datei (`db.changelog-baseline.yaml` liegt nur unter `archiv/`); App bootet
   nicht gegen Postgres. Blockiert den gesamten Deploy-Strang.
2. **DEPLOY-COMPOSE-SMOKE** — prod-Stack (`docker compose --profile prod`) real hochfahren,
   Liquibase gegen echtes Postgres 17 migrieren, eine Partie durchspielen.
3. **DOC-ENV-DEPLOY** — `.env.example` + README für den Betrieb vervollständigen.
4. **DEPLOY-OAUTH-SENTINEL** — „Mit Google anmelden" nur bei konfigurierten Credentials.
5. **CI/CD** — `CI-BUILD-TEST` → `CI-DOCKER-BUILD` → `CD-DEPLOY` (CD blockiert bis Plattformwahl).

### Produktreife & Specs

6. **SPEC-SQL-REVIEW** — kritisches Schema-/SQL-Review **vor** der ersten echten DB: Normalformen,
   Audit-Spalten (`erstellt_am`/`geaendert_am` als `timestamptz`), Indizes, Constraints, Datentypen,
   JSONB-Strategie, Liquibase-Konsolidierung. Greenfield → jetzt sauber ziehbar. → `datenbankmodell.md`.
7. **OPS-GRAFANA-MONITORING** — Grafana Cloud Free-Tier (Actuator + Micrometer + Prometheus).
   → eigene Spec `betrieb-monitoring.md`.
8. **OPS-DOMAIN** — Domain + DNS + TLS (Reverse-Proxy/Let's Encrypt, OAuth-Redirect, WS-Origins).
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
13. **VERIFY-MULTIPLAYER** — E2E-Verifikation Mensch-gegen-Mensch über mehrere echte Sessions.
    Laut `authentifizierung.md` der „Blocker für echten Multiplayer". Vor Live-Gang.

## Offene Entscheidungen

- **Authentifizierung:** ✅ entschieden (Session 30) — **beide Methoden behalten**
  (Google OAuth2 + Username/Passwort/bcrypt). `authentifizierung.md` bleibt unverändert.
- **Lizenz:** ⏸️ **aufgeschoben.** Tendenz Apache-2.0. Zielkonflikt: mögliche spätere
  **Steam-/kommerzielle Veröffentlichung** — eine permissive Lizenz (Apache/MIT) erlaubt Dritten den
  kommerziellen Nachbau. Wer Verwertung offenhalten will: eher **proprietär** oder **AGPL-3.0**.
  Entscheidung, sobald die Steam-Frage geklärt ist.

## Live-Gang-Blocker (Checkliste vor öffentlichem Betrieb)

- [ ] BUG-PROD-CHANGELOG behoben, prod-Stack verifiziert (1, 2)
- [ ] Impressum + Datenschutzerklärung veröffentlicht (11)
- [ ] Domain + HTTPS aktiv, OAuth-Redirect/WS-Origins gesetzt (8)
- [ ] Mensch-gegen-Mensch verifiziert (13)
- [ ] Lizenz entschieden
