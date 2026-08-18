#!/usr/bin/env bash
# Locodoko — Server-Setup (idempotent)
# Abgeleitet aus specs/betrieb-deployment.md
#
# Voraussetzungen:
#   - Debian 13 (Trixie)
#   - Root-Zugriff via SSH
#   - SSH-Key bereits im Panel hinterlegt
#
# Verwendung:
#   ssh root@prod1.locodoko.de 'bash -s' < scripts/setup-server.sh
#   oder mit --dry-run zum Vorab-Check:
#   ssh root@prod1.locodoko.de 'bash -s' < scripts/setup-server.sh --dry-run

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY-RUN] Kein Befehl wird ausgeführt — nur Ausgabe."
fi

run() {
    if $DRY_RUN; then
        echo "  >> $*"
    else
        "$@"
    fi
}

log() { echo "[$(date -Iseconds)] $*"; }

# ─── 0. Grundkonfiguration ────────────────────────────────────────────────────

log "0. Hostname + Locale + Timezone"
run hostnamectl set-hostname prod1
run timedatectl set-timezone Europe/Berlin
run localectl set-locale LANG=en_US.UTF-8

# ─── 1. System-User ───────────────────────────────────────────────────────────

log "1. System-User 'locodoko'"
if ! id locodoko &>/dev/null; then
    run useradd --system --no-create-home --shell /usr/sbin/nologin locodoko
else
    log "   User 'locodoko' existiert bereits — übersprungen."
fi

# ─── 2. Paketquellen ──────────────────────────────────────────────────────────

log "2. Paketquellen einrichten"
run apt-get update -q

# PostgreSQL 17 (pgdg)
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
    run apt-get install -y -q curl gnupg lsb-release
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
fi

# Caddy
if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] \
https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
        > /etc/apt/sources.list.d/caddy-stable.list
fi

# Java 25 (Adoptium/Temurin)
if [[ ! -f /etc/apt/sources.list.d/adoptium.list ]]; then
    curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public \
        | gpg --dearmor -o /usr/share/keyrings/adoptium.gpg
    echo "deb [signed-by=/usr/share/keyrings/adoptium.gpg] \
https://packages.adoptium.net/artifactory/deb $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/adoptium.list
fi

run apt-get update -q

# ─── 3. Pakete installieren ───────────────────────────────────────────────────

log "3. Pakete installieren"
run apt-get install -y -q \
    temurin-25-jre \
    postgresql-17 \
    caddy \
    unattended-upgrades \
    apt-listchanges \
    cron

# ─── 4. PostgreSQL tunen & einrichten ────────────────────────────────────────

log "4. PostgreSQL konfigurieren (2 GB RAM-Budget)"
PG_CONF="/etc/postgresql/17/main/postgresql.conf"
run sed -i "s/^#*shared_buffers.*/shared_buffers = 256MB/" "$PG_CONF"
run sed -i "s/^#*max_connections.*/max_connections = 50/" "$PG_CONF"
run systemctl enable --now postgresql

log "4b. Datenbank + User anlegen (idempotent)"
if ! $DRY_RUN; then
    # User anlegen (idempotent)
    su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='locodoko'\"" \
        | grep -q 1 || \
        su - postgres -c "psql -c \"CREATE USER locodoko WITH PASSWORD 'BITTE_ERSETZEN';\""
    # Datenbank anlegen (CREATE DATABASE nicht in Transaktionsblock möglich)
    su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='locodoko'\"" \
        | grep -q 1 || \
        su - postgres -c "createdb --owner=locodoko locodoko"
    su - postgres -c "psql -c \"ALTER DATABASE locodoko OWNER TO locodoko;\""
else
    echo "  >> su - postgres: User + DB anlegen (idempotent)"
fi

# ─── 5. Verzeichnisstruktur ───────────────────────────────────────────────────

log "5. Verzeichnisse anlegen"
run mkdir -p /opt/locodoko/{logs,backups,scripts}
run chown -R locodoko:locodoko /opt/locodoko

# .env nur anlegen wenn nicht vorhanden (Secrets nicht überschreiben)
if [[ ! -f /opt/locodoko/.env ]]; then
    run tee /opt/locodoko/.env > /dev/null <<'ENV'
# Locodoko Produktionskonfiguration — Werte ausfüllen!
SPRING_PROFILES_ACTIVE=prod
LOCODOKO_DB_USERNAME=locodoko
LOCODOKO_DB_PASSWORD=BITTE_ERSETZEN
LOCODOKO_DB_URL=jdbc:postgresql://localhost:5432/locodoko
LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS=https://zock.locodoko.de
GOOGLE_CLIENT_ID=BITTE_ERSETZEN
GOOGLE_CLIENT_SECRET=BITTE_ERSETZEN
# SENTRY_DSN=
# LOCODOKO_BUGREPORT_GITHUB_TOKEN=
# LOCODOKO_BUGREPORT_GITHUB_REPO=
ENV
    run chmod 600 /opt/locodoko/.env
    run chown locodoko:locodoko /opt/locodoko/.env
    log "   .env angelegt — Werte bitte ausfüllen: /opt/locodoko/.env"
else
    log "   .env existiert bereits — nicht überschrieben."
fi

# ─── 6. systemd-Unit ──────────────────────────────────────────────────────────

log "6. systemd-Unit einrichten"
run tee /etc/systemd/system/locodoko.service > /dev/null <<'UNIT'
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
UNIT

run systemctl daemon-reload
run systemctl enable locodoko

# ─── 7. Caddy ─────────────────────────────────────────────────────────────────

log "7. Caddy konfigurieren"
run tee /etc/caddy/Caddyfile > /dev/null <<'CADDY'
zock.locodoko.de {
    @actuator path /actuator/*
    respond @actuator 403

    reverse_proxy localhost:8081
}

locodoko.de {
    redir https://zock.locodoko.de{uri} permanent
}
CADDY

run systemctl enable --now caddy
run caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true

# ─── 8. Automatische Sicherheitsupdates ──────────────────────────────────────

log "8. unattended-upgrades konfigurieren"
run tee /etc/apt/apt.conf.d/50unattended-upgrades > /dev/null <<'UPGRADES'
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename},label=Debian-Security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
UPGRADES

run systemctl enable --now unattended-upgrades

# ─── 9. Backup-Skript ────────────────────────────────────────────────────────

log "9. Backup-Skript einrichten"
# backup-db.sh wird separat via deploy.sh auf den Server kopiert
# Cron-Eintrag für locodoko-User (idempotent)
CRON_JOB="0 3 * * * /opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups >> /opt/locodoko/logs/backup.log 2>&1"
if ! crontab -u locodoko -l 2>/dev/null | grep -qF "backup-db.sh"; then
    (crontab -u locodoko -l 2>/dev/null; echo "$CRON_JOB") | crontab -u locodoko -
    log "   Backup-Cron eingetragen."
else
    log "   Backup-Cron existiert bereits — übersprungen."
fi

# ─── 10. SSH härten ───────────────────────────────────────────────────────────

log "10. SSH: Passwort-Login deaktivieren"
run sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
run sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
run systemctl reload ssh

# ─── Fertig ───────────────────────────────────────────────────────────────────

log ""
log "=== Setup abgeschlossen ==="
log ""
log "Offene manuelle Schritte:"
log "  1. /opt/locodoko/.env befüllen (DB-Passwort, Google OAuth, etc.)"
log "  2. DB-Passwort in PostgreSQL setzen:"
log "     sudo -u postgres psql -c \"ALTER USER locodoko PASSWORD '<passwort>';\""
log "  3. JAR deployen: scripts/deploy.sh"
log "  4. Backup-Skript kopieren: scp scripts/backup-db.sh root@prod1.locodoko.de:/opt/locodoko/scripts/"
log "  5. Restore einmal testen (vor M1)"
log "  6. Google OAuth Redirect-URI setzen: https://zock.locodoko.de/login/oauth2/code/google"
