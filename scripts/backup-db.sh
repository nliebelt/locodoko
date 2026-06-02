#!/usr/bin/env bash
# Locodoko PostgreSQL Backup-Skript
# Erstellt einen pg_dump-Dump der locodoko-DB und rotiert alte Backups.
#
# Verwendung:
#   ./scripts/backup-db.sh [BACKUP_DIR]
#
# Umgebungsvariablen (Defaults aus .env):
#   LOCODOKO_DB_USERNAME  (default: locodoko)
#   LOCODOKO_DB_PASSWORD  (default: locodoko)
#   BACKUP_RETENTION_TAGE (default: 7)
#
# Empfohlener Cron-Eintrag auf dem Server (täglich 03:00 Uhr):
#   0 3 * * * /opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups >> /opt/locodoko/logs/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
DB_USER="${LOCODOKO_DB_USERNAME:-locodoko}"
DB_PASS="${LOCODOKO_DB_PASSWORD:-locodoko}"
DB_HOST="${LOCODOKO_DB_HOST:-localhost}"
DB_PORT="${LOCODOKO_DB_PORT:-5432}"
DB_NAME="locodoko"
RETENTION_TAGE="${BACKUP_RETENTION_TAGE:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DATEI="${BACKUP_DIR}/locodoko_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starte Backup → ${DATEI}"
PGPASSWORD="${DB_PASS}" pg_dump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --no-password \
    --format=plain \
    --no-acl \
    --no-owner \
    "${DB_NAME}" \
  | gzip -9 > "${DATEI}"

GROESSE="$(du -sh "${DATEI}" | cut -f1)"
echo "[$(date -Iseconds)] Backup fertig: ${DATEI} (${GROESSE})"

# Alte Backups rotieren
echo "[$(date -Iseconds)] Rotiere Backups älter als ${RETENTION_TAGE} Tage"
find "${BACKUP_DIR}" -maxdepth 1 -name "locodoko_*.sql.gz" \
    -mtime "+${RETENTION_TAGE}" -delete -print \
  | sed 's/^/  gelöscht: /'

echo "[$(date -Iseconds)] Backup abgeschlossen."
