#!/usr/bin/env bash
# Locodoko — Deploy-Skript
# Baut das JAR lokal und kopiert es auf den Produktionsserver.
#
# Verwendung:
#   scripts/deploy.sh
#   scripts/deploy.sh --skip-build   (nur scp + restart, kein mvn)

set -euo pipefail

SERVER="root@prod1.locodoko.de"
REMOTE_DIR="/opt/locodoko"
SKIP_BUILD=false

if [[ "${1:-}" == "--skip-build" ]]; then
    SKIP_BUILD=true
fi

log() { echo "[$(date -Iseconds)] $*"; }

# ─── 1. JAR bauen ─────────────────────────────────────────────────────────────

if ! $SKIP_BUILD; then
    log "1. JAR bauen (mvn clean package)..."
    mvn clean package -DskipTests -q
fi

JAR=$(ls target/locodoko-*.jar 2>/dev/null | head -1)
if [[ -z "$JAR" ]]; then
    echo "FEHLER: Kein JAR in target/ gefunden. Erst bauen: mvn clean package" >&2
    exit 1
fi
log "   JAR: $JAR"

# ─── 2. JAR auf Server kopieren ───────────────────────────────────────────────

log "2. JAR auf Server kopieren..."
scp "$JAR" "${SERVER}:${REMOTE_DIR}/locodoko.jar"

# ─── 3. Service neu starten ───────────────────────────────────────────────────

log "3. locodoko.service neu starten..."
ssh "$SERVER" "systemctl restart locodoko"

# ─── 4. Healthcheck ───────────────────────────────────────────────────────────

log "4. Healthcheck..."
sleep 5
STATUS=$(ssh "$SERVER" "systemctl is-active locodoko 2>/dev/null || echo 'failed'")

if [[ "$STATUS" == "active" ]]; then
    log "   OK — locodoko läuft."
else
    echo "FEHLER: Service-Status: $STATUS" >&2
    ssh "$SERVER" "journalctl -u locodoko -n 30 --no-pager" >&2
    exit 1
fi

log ""
log "=== Deploy erfolgreich ==="
log "   https://zock.locodoko.de"
