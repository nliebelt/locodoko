# Betrieb: Monitoring & Logs

| Feld   | Wert                                                                           |
|--------|--------------------------------------------------------------------------------|
| Status | Alloy auf prod1 installiert + als systemd-Service aktiv (Stand 2026-08-27). Metriken + Logs werden lokal gesammelt; es fehlen nur noch die echten Grafana-Cloud-Tokens (Platzhalter in `/etc/default/alloy`). |

Zugehörige Tasks: `OPS-GRAFANA-MONITORING`, `OPS-LOGS-LOKI`, `OBS-CORRELATION-ID` (✓), `OBS-SENTRY` (✓).

## Ziel

Für den öffentlichen Betrieb (M1 Closed Beta → M2) brauchen wir Sichtbarkeit über
**Gesundheit** (läuft die App, wie schnell, wie viele Fehler), **Betrieb** (Auslastung)
und ein „Locodoko in Zahlen"-Bild der **Domäne** (welche Spiele werden gespielt). Alles
läuft kostenlos über **Grafana Cloud Free** (EU-Region, AVV) — Metriken (Prometheus),
Logs (Loki) und Fehler (Sentry, siehe `OBS-SENTRY`).

## Pipeline (Überblick)

```
Spring Boot App ──/actuator/prometheus (:8082)──┐
   │  (Micrometer)                               ├──> Grafana Alloy (systemd) ──> Grafana Cloud
   └──/opt/locodoko/logs/locodoko.log (ECS-JSON)─┘       (remote_write / Loki)        (Free, EU)
```

Deployment ist **plain Linux + Java** (DECISION-DEPLOY-VARIANTE, S152) — Alloy läuft daher als
**systemd-Service**, nicht als docker-compose-Sidecar. Die `docker-compose.yml` bleibt nur als
Alternative im Repo, wird in prod aber nicht genutzt.

- **Metriken:** Spring Boot Actuator + Micrometer exponieren `/actuator/prometheus` auf dem
  internen Management-Port **8082** (`management.endpoints.web.exposure.include=health,info,prometheus`).
  Alloy scrapt `localhost:8082` alle 30 s und schickt per `remote_write` an Grafana Cloud.
  Zusätzlich liefert Alloys `prometheus.exporter.unix` (Node Exporter) Host-Metriken.
- **Logs:** Die App schreibt strukturierte JSON-Logs (ECS) nach `/opt/locodoko/logs/locodoko.log`.
  Alloys `loki.source.file` liest die Datei direkt (world-readable, kein shared Volume nötig) und
  sendet sie an Loki.
- **Konfiguration:** `monitoring/alloy/config.alloy` → deployed nach `/etc/alloy/config.alloy`.
  Tokens/URLs ausschließlich via `/etc/default/alloy` (EnvironmentFile, chmod 600 —
  `GRAFANA_*`, siehe `.env.example`), nie im Repo.

## Infrastruktur-Metriken (Micrometer-Standard)

JVM (Heap, GC, Threads), HTTP-Server-Latenzen/-Statuscodes (`http.server.requests`),
Tomcat-Sessions, HikariCP-Pool, Logback-Eventrate. Diese kommen ohne Zusatzcode aus
Spring Boot Actuator. Alle Metriken tragen das Label `application=locodoko`.

## Loco-Domain-Metriken ("Locodoko in Zahlen")

Implementiert in `de.locodoko.betrieb.SpielMetriken` — ein eigenes Blatt-Modul (nicht `system`,
das wäre ein Modul-Zyklus, da `partie` auf `system` aufbaut). Die Komponente lauscht auf dasselbe
`SpielBeendet`-Domain-Event wie die Spieler-Statistik und führt **aggregierte** Zähler fort:

| Meter | Typ | Labels | Bedeutung |
|-------|-----|--------|-----------|
| `locodoko.spiele.abgeschlossen` | Counter | `regelvariante` | Abgeschlossene Spiele |
| `locodoko.partien.beendet` | Counter | – | Beendete Partien |
| `locodoko.spieltyp` | Counter | `typ` (NORMALSPIEL/HOCHZEIT/ARMUT/SOLO_*) | Spieltyp-Verteilung |
| `locodoko.sieger.partei` | Counter | `partei` (RE/KONTRA) | Siege je Partei |
| `locodoko.sonderpunkt` | Counter | `typ` (fuchs/karlchen/doppelkopf) | Sonderpunkte |
| `locodoko.armut.angesagt` | Counter | – | Spiele mit Armut |
| `locodoko.spiel.re_augen` | DistributionSummary | – | Augen der Re-Partei pro Spiel |

**Harte Regel (Kardinalität):** **kein `spieler_id`-Label** und keine sonstigen hoch-kardinalen
Werte. Alle Label-Werte stammen aus Enums/festen Kategorien. Per-Spieler-Statistik bleibt in
Postgres (siehe `statistik-ranking.md`) — Prometheus ist nur für aggregierte, niedrig-kardinale
Domain-Kennzahlen. Dasselbe `SpielBeendet`-Event speist DB-Statistik **und** diese Counter.

## Logs in Loki

Die ECS-JSON-Logs enthalten MDC-Felder `tischId`, `partieId` und `correlationId`
(via `CorrelationIdFilter`, Task `OBS-CORRELATION-ID`). In Loki bleiben diese als **Loginhalt**
(nicht als Label — Kardinalität!) per LogQL filterbar:

```logql
{job="locodoko"} | json | tischId="<uuid>"
{job="locodoko"} | json | correlationId="<id>"
{job="locodoko"} | json | level="ERROR"
```

`job` und Loglevel eignen sich als Label; IDs bleiben im Body. **Retention** im Free-Tier ist
begrenzt (~14 Tage) → für Bug-Tickets werden relevante Log-Ausschnitte beim Erstellen ins Ticket
**gesnapshottet** (siehe `FEAT-BUGREPORT`), nicht nur verlinkt.

## Sicherheit / offene Punkte (Mensch)

- **`/actuator/prometheus` läuft auf dem internen Management-Port 8082**, den Caddy nicht nach außen
  proxyt (öffentlich ist nur 8081); zusätzlich blockt die Caddy-Regel `/actuator/*` mit 403. Alloy
  scrapt intern via `localhost:8082`.
- **Grafana-Cloud-Tokens** (`GRAFANA_PROM_URL/USER`, `GRAFANA_LOKI_URL/USER`, `GRAFANA_CLOUD_TOKEN`)
  in `/etc/default/alloy` auf prod1 eintragen (Account vorhanden; aktuell noch Platzhalter), dann
  `systemctl restart alloy` — **einziger offener Schritt**, damit Daten in Grafana Cloud ankommen.
- **Dashboards/Alerts** in Grafana Cloud anlegen (Health: Fehlerrate, p95-Latenz, Heap; Domäne:
  Spieltyp-Verteilung, Re/Kontra, Spiele/h). Aktive-Tische-Gauge als spätere Erweiterung
  (benötigt einen Zähler aus dem `tisch`-Modul).
