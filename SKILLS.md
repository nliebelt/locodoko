# Projekt-Skills (Debugging)

Wir nutzen ein zentrales Script für das Management der Fullstack-Umgebung.
Pfad: `./scripts/debug-helper.sh`

### Befehle für die KI:
- **Session starten:** `./scripts/debug-helper.sh start`
- **Fehler prüfen:** `./scripts/debug-helper.sh logs` (Nutze dies IMMER, wenn ein Fehler gemeldet wird!)
- **Status checken:** `./scripts/debug-helper.sh status`
- **Reset:** `./scripts/debug-helper.sh stop && ./scripts/debug-helper.sh start`

### Workflow bei Problemen:
1. Lies die Logs mit dem Script.
2. Analysiere Stacktraces im Backend oder Proxy-Fehler im Frontend.
3. Editiere den Code.
4. Starte ggf. die betroffene Komponente neu oder nutze das Hot-Reloading der Logs.