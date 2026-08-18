# Betrieb: Deployment & Server-Setup

| Feld           | Wert                                                                 |
|----------------|----------------------------------------------------------------------|
| Status         | Aktiv — Plain Linux + Java (DECISION-DEPLOY-VARIANTE entschieden)    |
| Priorität      | Hoch — M1-Blocker                                                    |
| Letztes Update | 2026-08-14                                                           |
| Abhängigkeiten | fertigstellung.md, betrieb-monitoring.md, authentifizierung.md       |

## Zielinfrastruktur

**Anbieter:** hosting.de (DE, EU-Datenresidenz)
**Tarif:** Cloud Server Small
**Server-ID:** 260814lr7iwooycqtqs
**IPv4:** 213.160.77.250
**Hostname:** prod1.locodoko.de

| Ressource  | Wert        |
|------------|-------------|
| CPU        | 2 Cores     |
| RAM        | 2 GB        |
| Disk       | 40 GB SSD   |
| IOPS       | 300         |

**OS:** Debian 13 (Trixie)
**Deploy-Strategie:** Plain Linux + Java (kein Docker auf dem Server). JAR ist self-contained (Spring Boot Executable JAR). Docker-Artefakte (`Dockerfile.app`, `docker-compose.yml`) bleiben im Repo als Alternative.

## Software-Stack

| Komponente     | Version  | Quelle                                      |
|----------------|----------|---------------------------------------------|
| Java           | 25 LTS (JRE) | `apt` (Temurin via Adoptium-Repository, packages.adoptium.net) |
| PostgreSQL     | 17           | `apt` (pgdg-Repository, apt.postgresql.org)                    |
| Caddy          | 2.x          | `apt` (Caddy-Repository, caddyserver.com)                      |
| Grafana Alloy  | aktuell      | `apt` (Grafana-Repository) — optional                          |

**Build-Tools (lokal, nicht auf dem Server):** Maven 3.x + Java 25 JDK. Der Server führt nur `java -jar locodoko.jar` aus — kein Maven, kein Docker auf dem Server.

## Verzeichnisstruktur

```
/opt/locodoko/
├── locodoko.jar        # aktuelles JAR (deploy.sh kopiert hierher)
├── .env                # Secrets — chmod 600, owner locodoko
├── logs/               # App-Logs (locodoko.log, ECS-JSON)
├── backups/            # pg_dump-Backups (backup-db.sh)
└── scripts/
    ├── backup-db.sh    # aus scripts/backup-db.sh im Repo
    └── deploy.sh       # aus scripts/deploy.sh im Repo
```

System-User: `locodoko` (kein Login-Shell, kein Passwort).

## Speicher-Budget (2 GB RAM)

Auf 2 GB ist explizites Tuning Pflicht:

| Komponente     | Heap/Zuteilung | Notiz                                  |
|----------------|----------------|----------------------------------------|
| JVM Heap       | `-Xmx512m`     | Spring Boot + Overhead ≈ 800 MB gesamt |
| Postgres       | `shared_buffers = 256MB` / `max_connections = 50` | pgdg-Default 100 Connections zu viel |
| OS + sonstige  | ~400 MB        | Alloy, Caddy, sshd                     |
| Reserve        | ~200 MB        | Puffer gegen OOM-Killer                |

## systemd-Unit

Pfad: `/etc/systemd/system/locodoko.service`

```ini
[Unit]
Description=Locodoko Doppelkopf
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=locodoko
WorkingDirectory=/opt/locodoko
EnvironmentFile=/opt/locodoko/.env
ExecStart=/usr/bin/java -Xmx512m -jar /opt/locodoko/locodoko.jar
Restart=on-failure
RestartSec=10
StandardOutput=append:/opt/locodoko/logs/locodoko.log
StandardError=append:/opt/locodoko/logs/locodoko.log

[Install]
WantedBy=multi-user.target
```

## Caddy-Konfiguration

Pfad: `/etc/caddy/Caddyfile`

```
zock.locodoko.de {
    # Actuator nicht öffentlich exponieren — Alloy scrapt intern via localhost:8081
    @actuator path /actuator/*
    respond @actuator 403

    reverse_proxy localhost:8081
    # Caddy 2 leitet WebSocket-Upgrades automatisch weiter (kein extra Header nötig).
    # Pflicht: LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de in .env
}

locodoko.de {
    redir https://zock.locodoko.de{uri} permanent
}
```

TLS wird von Caddy automatisch via Let's Encrypt bezogen (kein manuelles Zertifikat).

## ENV-Variablen auf dem Server

Die Datei `/opt/locodoko/.env` entspricht `.env.example` aus dem Repo. Pflichtfelder für M1:

| Variable                              | Pflicht M1 | Hinweis                                              |
|---------------------------------------|-----------|------------------------------------------------------|
| `SPRING_PROFILES_ACTIVE`              | ✓         | Muss `prod` sein — sonst startet die App mit H2 in-memory (Dev-Profil)! |
| `LOCODOKO_DB_USERNAME`                | ✓         | DB-User (Postgres-Rolle)                             |
| `LOCODOKO_DB_PASSWORD`                | ✓         | Starkes Passwort, mind. 20 Zeichen                   |
| `LOCODOKO_DB_URL`                     | ✓         | `jdbc:postgresql://localhost:5432/locodoko`           |
| `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS`  | ✓         | `https://zock.locodoko.de`                           |
| `GOOGLE_CLIENT_ID`                    | ✓         | Aus Google Cloud Console                             |
| `GOOGLE_CLIENT_SECRET`                | ✓         | Aus Google Cloud Console                             |
| `SENTRY_DSN`                          | empfohlen | Sentry EU-Region, Free-Tier                          |
| `VITE_SENTRY_DSN`                     | empfohlen | Zur Build-Zeit gesetzt (im JAR eingebaut)            |
| `LOCODOKO_BUGREPORT_GITHUB_TOKEN`     | optional  | Shift+F1 In-App-Bugreport → GitHub-Issue             |
| `GRAFANA_*`                           | optional  | Monitoring via Grafana Cloud                         |

Dateirechte: `chmod 600 /opt/locodoko/.env && chown locodoko:locodoko /opt/locodoko/.env`

## Backup-Cron

Das Skript `scripts/backup-db.sh` ist fertig. Einzutragen als `locodoko`-Crontab:

```
0 3 * * * /opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups >> /opt/locodoko/logs/backup.log 2>&1
```

Restore-Verifikation vor M1 (einmalig):

```bash
psql -U locodoko locodoko < /opt/locodoko/backups/locodoko_<datum>.sql
```

## Rollout-Ablauf (deploy.sh)

Das Skript `scripts/deploy.sh` führt folgende Schritte aus:

1. `mvn clean package -DskipTests` — JAR bauen
2. `scp target/locodoko-*.jar locodoko@<server>:/opt/locodoko/locodoko.jar`
3. `ssh locodoko@<server> sudo systemctl restart locodoko`
4. `ssh locodoko@<server> sudo systemctl status locodoko` — Healthcheck

Deployment dauert < 30 Sekunden. Keine Downtime-Strategie für die Closed Beta (kurze Unterbrechung akzeptiert).

## Automatische Sicherheitsupdates

**Paket:** `unattended-upgrades` (Debian-Standard).

Nur Security-Updates automatisch einspielen — keine regulären Updates (zu viel Überraschungspotenzial). Kernel-Updates erfordern einen Reboot; der wird automatisch nachts ausgeführt, **aber nur wenn kein Nutzer eingeloggt ist** (`Automatic-Reboot-WithUsers "false"`).

**Timing-Reihenfolge nachts:**
- `03:00` — Backup-Cron (`backup-db.sh`)
- `04:00` — Reboot-Fenster (falls Kernel-Update ausstehend)

Konfiguration `/etc/apt/apt.conf.d/50unattended-upgrades`:

```
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename},label=Debian-Security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
```

Aktivierung:

```bash
apt install unattended-upgrades
systemctl enable --now unattended-upgrades
```

### Grafana-Sichtbarkeit (via Alloy Node Exporter)

Grafana Alloy exponiert via `prometheus.exporter.unix` (Node Exporter) zwei relevante Metriken:

| Metrik                    | Bedeutung                                              |
|---------------------------|--------------------------------------------------------|
| `node_reboot_required`    | `1` = Kernel-Update eingespielt, Reboot steht aus     |
| `node_boot_time_seconds`  | Epoch-Timestamp des letzten Boots — Reboot erkennbar  |

**Empfohlene Grafana-Alerts:**
- Alert wenn `node_reboot_required == 1` länger als 2h (Reboot hat nicht stattgefunden)
- Panel „Letzter Reboot" aus `node_boot_time_seconds` berechnet

## Monitoring (optional M1)

`betrieb-monitoring.md` beschreibt die Grafana-Cloud-Pipeline. Abweichung zum Docker-Setup:

- Alloy läuft als **systemd-Service** (nicht als Docker-Sidecar).
- Logs werden direkt aus `/opt/locodoko/logs/locodoko.log` gelesen (kein shared Volume).
- Konfiguration: `/etc/alloy/config.alloy` (analog `monitoring/alloy/config.alloy` im Repo).

## Postgres-Setup (einmalig)

```sql
CREATE USER locodoko WITH PASSWORD '<passwort>';
CREATE DATABASE locodoko OWNER locodoko;
```

Liquibase migriert das Schema beim ersten App-Start automatisch.

Postgres-Tuning in `/etc/postgresql/17/main/postgresql.conf`:

```
shared_buffers = 256MB
max_connections = 50
```

## Definition of Done (M1)

- [ ] `https://zock.locodoko.de` erreichbar, TLS-Zertifikat gültig
- [ ] WebSocket-Verbindung durch Caddy (Snapshot+Hint funktioniert)
- [ ] Google OAuth Redirect auf `https://zock.locodoko.de/login/oauth2/code/google`
- [ ] `/actuator/prometheus` von extern → 403
- [ ] `systemctl status locodoko` → active (running)
- [ ] Nachtlicher Backup-Cron aktiv, Restore einmal verifiziert
- [ ] Eine Partie gegen KI durchgespielt (manuell)
