#!/usr/bin/env bash
# Locodoko PostgreSQL Restore-Skript
# Stellt einen pg_dump-Dump in einer (leeren) locodoko-DB wieder her.
#
# Verwendung:
#   ./scripts/restore-db.sh <backup-datei.sql.gz>
#
# Vorbedingung: App ist gestoppt, Postgres läuft.
# Warnung: Löscht alle bestehenden Daten in der DB!
#
# Beispiel:
#   docker compose --profile prod stop app
#   ./scripts/restore-db.sh backups/locodoko_20260602_030001.sql.gz
#   docker compose --profile prod start app

set -euo pipefail

BACKUP_DATEI="${1:-}"
DB_USER="${LOCODOKO_DB_USERNAME:-locodoko}"
DB_PASS="${LOCODOKO_DB_PASSWORD:-locodoko}"
DB_HOST="${LOCODOKO_DB_HOST:-localhost}"
DB_PORT="${LOCODOKO_DB_PORT:-5432}"
DB_NAME="locodoko"

if [[ -z "${BACKUP_DATEI}" ]]; then
    echo "Fehler: Backup-Datei fehlt." >&2
    echo "Verwendung: $0 <backup-datei.sql.gz>" >&2
    exit 1
fi

if [[ ! -f "${BACKUP_DATEI}" ]]; then
    echo "Fehler: Datei nicht gefunden: ${BACKUP_DATEI}" >&2
    exit 1
fi

echo "[$(date -Iseconds)] Restore aus: ${BACKUP_DATEI}"
echo "[$(date -Iseconds)] WARNUNG: Alle Daten in '${DB_NAME}' werden überschrieben!"
read -rp "Fortfahren? (ja/nein): " BESTAETIGUNG
if [[ "${BESTAETIGUNG}" != "ja" ]]; then
    echo "Abgebrochen."
    exit 0
fi

echo "[$(date -Iseconds)] Leere Datenbank..."
PGPASSWORD="${DB_PASS}" psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[$(date -Iseconds)] Spiele Backup ein..."
zcat "${BACKUP_DATEI}" | PGPASSWORD="${DB_PASS}" psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${DB_NAME}" \
    --no-password \
    --quiet

echo "[$(date -Iseconds)] Restore abgeschlossen. App neu starten und Liquibase prüfen."
