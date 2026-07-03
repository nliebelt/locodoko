#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ralph.sh — Autonomous coding loop for Claude Code
#
# Usage:
#   ./ralph.sh plan [max_iterations]    # Planning mode
#   ./ralph.sh build [max_iterations]   # Building mode (default)
#   ./ralph.sh [max_iterations]         # Building mode (shortcut)
#
# Examples:
#   ./ralph.sh plan          # Plan mode, 5 iterations
#   ./ralph.sh plan 3        # Plan mode, max 3 iterations
#   ./ralph.sh build         # Build mode, 10 iterations
#   ./ralph.sh build 20      # Build mode, max 20 iterations
#   ./ralph.sh               # Build mode, 10 iterations
#   ./ralph.sh 15            # Build mode, 15 iterations
#
# Environment:
#   MODEL=claude-opus-4-8 ./ralph.sh build 10     # Override model
#   RALPH_TIMEOUT=3600 ./ralph.sh build           # Timeout pro Iteration in Sekunden (Default 7200)
#
# Model defaults:
#   plan  → claude-sonnet-4-6   (default)
#   build → claude-sonnet-4-6   (default)
#
# max_iterations=0 bedeutet: keine Obergrenze (läuft bis COMPLETE/BLOCKED).
#
# With Pro account: authenticate via `claude login` (no API key needed).
# With API key: set ANTHROPIC_API_KEY and use claude-haiku-4-5-20251001
#               for cheap testing of the loop approach.
# ============================================================

# --- Dirty-Worktree-Hinweis (kein Abbruch) ---
# Ein unsauberer Tree ist meist der Rest einer abgebrochenen Iteration (z.B. Rate-Limit
# mitten im Task). PROMPT_build.md Schritt 0b2 weist Ralph an, diese Reste dem
# unterbrochenen Task zuzuordnen und regulär fertigzustellen (oder zu stashen) —
# manuelles Committen von Halbfertigem ist nicht mehr nötig.
if git rev-parse --is-inside-work-tree &>/dev/null && [[ -n "$(git status --porcelain)" ]]; then
    echo "HINWEIS: Worktree ist nicht sauber — Ralph übernimmt Recovery (PROMPT_build 0b2):"
    git status --short
    echo ""
fi

MODE="build"
PROMPT_FILE="PROMPT_build.md"
MAX_ITERATIONS=10

if [ "${1:-}" = "plan" ]; then
    MODE="plan"
    PROMPT_FILE="PROMPT_plan.md"
    MAX_ITERATIONS=${2:-5}
elif [ "${1:-}" = "build" ]; then
    MODE="build"
    PROMPT_FILE="PROMPT_build.md"
    MAX_ITERATIONS=${2:-10}
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
    MAX_ITERATIONS=$1
fi

ITERATION=0
RETRY_COUNT=0
ITER_OUTPUT=".ralph-iter.tmp"
# Eigenes Unterverzeichnis: logs/ liegt auch das App-Log (logs/locodoko.log),
# auf das der Debugging-Workflow grept — Ralph-Logs sollen dort nicht reingeraten.
mkdir -p logs/ralph
LOG_FILE="logs/ralph/ralph-$(date +%Y%m%d-%H%M%S).log"

# Timeout pro claude-Aufruf — ein hängender CLI-Prozess soll die Loop nicht ewig blockieren.
RALPH_TIMEOUT="${RALPH_TIMEOUT:-7200}"

# --- Model selection ---
# Default: sonnet für beide Modi (Pro account via `claude login`)
# Override: MODEL=claude-opus-4-8 für maximale Qualität bei komplexen Planungsaufgaben
if [ -n "${MODEL:-}" ]; then
    EFFECTIVE_MODEL="$MODEL"
else
    EFFECTIVE_MODEL="claude-sonnet-4-6"
fi

# --- Header ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ralph Loop - Locodoko (Claude Code)"
echo "  Modus:      $MODE"
echo "  Prompt:     $PROMPT_FILE"
echo "  Max:        $MAX_ITERATIONS Iterationen"
echo "  Modell:     $EFFECTIVE_MODEL"
echo "  Log:        $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Verify prerequisites ---
if ! command -v claude &>/dev/null; then
    echo "FEHLER: 'claude' CLI nicht gefunden."
    echo "Installiere mit: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

for f in "$PROMPT_FILE" "CLAUDE.md"; do
    if [ ! -f "$f" ]; then
        echo "FEHLER: $f nicht gefunden"
        exit 1
    fi
done

# Ensure specs/ exists
mkdir -p specs

# Ensure git is initialized
if [ ! -d ".git" ]; then
    echo "WARNUNG: Kein Git-Repository gefunden. Initialisiere..."
    git init
    git add -A
    git commit -m "Initial commit" --allow-empty
fi

# --- Cleanup on exit ---
cleanup() {
    rm -f "$ITER_OUTPUT"
}
trap cleanup EXIT

# --- Main loop ---
while true; do
    if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$ITERATION" -ge "$MAX_ITERATIONS" ]; then
        echo ""
        echo "━━━ Maximale Iterationen erreicht: $MAX_ITERATIONS ━━━"
        break
    fi

    ITERATION=$((ITERATION + 1))
    echo ""
    echo "======================== ITERATION $ITERATION / $MAX_ITERATIONS ========================"
    echo ""

    # Run Claude Code iteration.
    # CLAUDE.md wird von Claude Code automatisch als System-Kontext geladen.
    # --output-format stream-json: erzwingt Echtzeit-Streaming auch in Pipes (kein Buffering).
    # jq extrahiert den lesbaren Text aus den stream-json Chunks für die Terminalausgabe.
    # tee schreibt parallel das rohe JSON nach ITER_OUTPUT (für COMPLETE/BLOCKED-Erkennung).
    # --dangerously-skip-permissions: für sandboxed Docker-Umgebungen geeignet —
    # der Container ist die Security-Grenze; alle Tools inkl. Agent laufen ohne Rückfragen.
    timeout "$RALPH_TIMEOUT" claude -p "$(cat "$PROMPT_FILE")" \
        --model "$EFFECTIVE_MODEL" \
        --output-format stream-json \
        --verbose \
        --dangerously-skip-permissions \
        2>&1 \
        | grep --line-buffered '^{' \
        | tee "$ITER_OUTPUT" \
        | jq --unbuffered -rj '
            if .type == "assistant" then
              .message.content[]? |
              if .type == "text" then .text
              elif .type == "thinking" then "\u001b[2m🧠 " + .thinking + "\u001b[0m\n"
              elif .type == "tool_use" then "\u001b[36m[→ \(.name): \(.input | to_entries | map("\(.key)=\(.value | tostring | .[0:60])") | join(", "))]\u001b[0m\n"
              else empty end
            elif .type == "result" then
              "\nTokens: \(.usage.input_tokens) in / \(.usage.output_tokens) out\n"
            else empty end
          ' 2>/dev/null \
        || true

    # Append iteration output to log
    echo "--- Iteration $ITERATION ($MODE) $(date) ---" >> "$LOG_FILE"
    cat "$ITER_OUTPUT" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"

    # Check for rate limit — schlafe bis zum Reset und wiederhole die Iteration
    resets_at=$(grep '"type":"rate_limit_event"' "$ITER_OUTPUT" 2>/dev/null \
        | jq -r 'select(.rate_limit_info.status == "rejected") | .rate_limit_info.resetsAt // empty' 2>/dev/null | tail -1)
    if [ -n "$resets_at" ]; then
        now=$(date +%s)
        sleep_secs=$(( resets_at - now + 30 ))  # +30s Puffer
        reset_human=$(date -d "@$resets_at" 2>/dev/null || date -r "$resets_at" 2>/dev/null)
        echo ""
        echo "━━━ Rate Limit — Reset um $reset_human (in ${sleep_secs}s) ━━━"
        ITERATION=$((ITERATION - 1))
        sleep "$(( sleep_secs > 0 ? sleep_secs : 60 ))"
        echo "━━━ Quota reset — weiter ━━━"
        echo ""
        continue
    fi

    # Robustheits-Netz: Jede erfolgreiche Iteration endet mit einem result-Event im
    # stream-json. Fehlt es (Rate-Limit ohne sauberes Event, Timeout-Kill, Netzwerkabriss,
    # CLI-Crash), war die Iteration abgebrochen → Backoff + dieselbe Iteration wiederholen.
    # (Beobachtung: Rate-Limits führen in der Praxis oft zu stillem Abbruch statt zum
    #  rate_limit_event oben — dieser Check fängt alle Abbruchsarten.)
    if ! grep -q '"type":"result"' "$ITER_OUTPUT" 2>/dev/null; then
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ "$RETRY_COUNT" -ge 6 ]; then
            echo ""
            echo "━━━ 6 Abbrüche in Folge ohne result-Event — Ralph gibt auf (siehe $LOG_FILE) ━━━"
            break
        fi
        backoff=$((300 * RETRY_COUNT))
        echo ""
        echo "━━━ Iteration abgebrochen (kein result-Event) — Retry $RETRY_COUNT/5 in ${backoff}s ━━━"
        ITERATION=$((ITERATION - 1))
        sleep "$backoff"
        continue
    fi
    RETRY_COUNT=0

    # Check for completion signal
    if grep -q '<promise>COMPLETE</promise>' "$ITER_OUTPUT" 2>/dev/null; then
        echo ""
        echo "━━━ Ralph meldet: COMPLETE ━━━"
        break
    fi

    # Check for blocked signal — ALL remaining tasks are blocked, no progress possible
    # (Single blocked tasks are handled by the agent internally: marked in IMPLEMENTATION_PLAN.md,
    #  agent moves to next task. BLOCKED is only emitted when truly stuck on everything.)
    if grep -q '<promise>BLOCKED</promise>' "$ITER_OUTPUT" 2>/dev/null; then
        echo ""
        echo "━━━ Ralph meldet: BLOCKED — Alle Aufgaben blockiert, manuelle Intervention nötig ━━━"
        echo "    Siehe IMPLEMENTATION_PLAN.md für Details."
        break
    fi

    echo ""
    echo "--- Iteration $ITERATION abgeschlossen ---"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ralph beendet nach $ITERATION Iteration(en)"
echo "  Log: $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
