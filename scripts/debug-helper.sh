#!/bin/bash

# Konfiguration
BACKEND_LOG="./logs/backend.log"
FRONTEND_LOG="./logs/frontend.log"
LOG_DIR="./logs"

mkdir -p $LOG_DIR

# 1. Brutale Bereinigung
cleanup() {
    echo "Stoppe alle Prozesse auf 8081 und 5173..."
    fuser -k 8081/tcp 5173/tcp 2>/dev/null
    # Zusätzlich alle Node/Maven Prozesse, die hängen geblieben sein könnten
    pkill -f "spring-boot:run"
    pkill -f "vite"
    sleep 2
}

case "$1" in
  start)
    cleanup
    echo "Starte Services auf 8081 und 5173..."
    
    # Backend
    nohup mvn spring-boot:run > "$BACKEND_LOG" 2>&1 &
    
    # Frontend - Vite zwingen auf 5173 zu bleiben
    cd frontend && nohup npm run dev -- --host --port 5173 > "../$FRONTEND_LOG" 2>&1 &
    cd ..
    
    echo "Services gestartet. Logs unter ./logs/"
    ;;

  status)
    echo "Port 8081 (Spring): $(lsof -t -i:8081 >/dev/null && echo 'AKTIV' || echo 'OFFLINE')"
    echo "Port 5173 (Vite):   $(lsof -t -i:5173 >/dev/null && echo 'AKTIV' || echo 'OFFLINE')"
    ;;

  stop)
    cleanup
    echo "Done."
    ;;

  *)
    echo "Usage: $0 {start|status|stop}"
    exit 1
    ;;
esac
