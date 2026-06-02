
# Loco Doko: Dullen, Füchse, Wahnsinn

Das latent verrückte Doppelkopf Spiel.

## Starten im Devmode

```bash
mvn spring-boot:run      # Backend auf :8081 (H2 in-memory)
cd frontend && npm run dev   # Frontend-Dev-Server auf :5173
```

## Öffentlicher Betrieb (Produktion)

### Voraussetzungen

- Docker + Docker Compose auf dem Zielserver
- Domain mit DNS-Eintrag (empfohlen: `zock.locodoko.de`)
- Reverse-Proxy mit TLS (Caddy oder Traefik, siehe unten)

### 1. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
# .env bearbeiten: Datenbank-Passwort, LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS, optional Google OAuth2
```

Wichtige Variablen (Details in `.env.example`):

| Variable | Beschreibung |
|---|---|
| `LOCODOKO_DB_USERNAME` | PostgreSQL-Benutzername |
| `LOCODOKO_DB_PASSWORD` | PostgreSQL-Passwort |
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client-ID (oder `disabled`) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client-Secret (oder `disabled`) |
| `LOCODOKO_WEBSOCKET_ALLOWED_ORIGINS` | Erlaubte WebSocket-Origins, z.B. `https://zock.locodoko.de` |

### 2. Prod-Stack starten

```bash
docker compose --profile prod up --build -d
```

Der Stack startet:
- `postgres` — PostgreSQL 17 mit persistentem Volume `pgdata`
- `app` — Spring Boot App auf Port 8081 (intern), startet erst wenn Postgres healthy

Health-Check:
```bash
curl -s http://localhost:8081/actuator/health
# {"status":"UP"}
```

Build-Info (welcher Commit läuft):
```bash
curl -s http://localhost:8081/actuator/info
```

### 3. HTTPS / Reverse-Proxy

Die App erwartet `server.servlet.session.cookie.secure=true` (aktiviert im prod-Profil) → **HTTPS ist Pflicht**.

Caddy-Beispielkonfiguration (`/etc/caddy/Caddyfile`):

```caddy
zock.locodoko.de {
    reverse_proxy localhost:8081 {
        # WebSocket-Upgrade für Snapshot+Hint durchreichen
        header_up Upgrade {http.upgrade}
        header_up Connection {http.connection}
    }
}
```

Traefik-Konfiguration ist analog möglich.

### 4. Google OAuth2 einrichten (optional)

Ohne Google-Credentials wird kein „Mit Google anmelden"-Button angezeigt, Passwort-Login funktioniert.

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth2-Client anlegen
2. Authorized redirect URI: `https://zock.locodoko.de/login/oauth2/code/google`
3. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in `.env` setzen
4. Stack neu starten

### 5. Datenbankbackups

```bash
# Manuelles Backup
./scripts/backup-db.sh /opt/locodoko/backups

# Restore (App vorher stoppen!)
docker compose --profile prod stop app
./scripts/restore-db.sh /opt/locodoko/backups/locodoko_20260602_030001.sql.gz
docker compose --profile prod start app
```

Empfohlener Cron-Eintrag auf dem Server (täglich 03:00 Uhr):
```cron
0 3 * * * /opt/locodoko/scripts/backup-db.sh /opt/locodoko/backups >> /opt/locodoko/logs/backup.log 2>&1
```

### 6. Stack aktualisieren

```bash
git pull
docker compose --profile prod up --build -d
```

---

## Links

[Ralph](https://ghuntley.com/ralph/)
[How to Ralph Wiggum](https://github.com/ghuntley/how-to-ralph-wiggum)
[How to Build a Coding Agent](https://github.com/ghuntley how-to-build-a-coding-agent)
[Ralph Tips](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum#10-pay-to-play)
[Awesome Ralph](https://github.com/snwfdhmp/awesome-ralph)
[Reddit RalphCoding](https://www.reddit.com/r/RalphCoding/)