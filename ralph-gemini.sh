#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ralph-gemini.sh — Autonomous coding loop for Gemini CLI
#
# Usage:
#   ./ralph-gemini.sh plan [max_iterations]    # Planning mode
#   ./ralph-gemini.sh build [max_iterations]   # Building mode (default)
#   ./ralph-gemini.sh [max_iterations]         # Building mode (shortcut)
#
# Examples:
#   ./ralph-gemini.sh plan          # Plan mode, 5 iterations
#   ./ralph-gemini.sh plan 3        # Plan mode, max 3 iterations
#   ./ralph-gemini.sh build         # Build mode, 10 iterations
#   ./ralph-gemini.sh build 20      # Build mode, max 20 iterations
#   ./ralph-gemini.sh               # Build mode, 10 iterations
#   ./ralph-gemini.sh 15            # Build mode, 15 iterations
#
# Environment:
#   MODEL=gemini-2.5-pro ./ralph-gemini.sh build 10     # Override model
#   gemini-3.1-pro-preview-0326, gemini-3-flash, gemini-3-deep-think-v1,
#   gemini-3.1-flash-lite-preview, gemini-3-flash-preview
# 
# Model defaults:
#   plan  → gemini-2.5-pro          (default for better planning)
#   build → gemini-2.0-flash        (default for fast/cheap building)
# ============================================================

# --- Check for uncommitted changes in Git worktree ---
if git rev-parse --is-inside-work-tree &>/dev/null; then
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "FEHLER: Der Git-Worktree ist nicht sauber. Bitte committe oder stash deine Änderungen, bevor du Ralph startest."
        echo "Abbruch. Keine Iteration ausgeführt."
        exit 1
    fi
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
ITER_OUTPUT=".ralph-iter.tmp"
ITER_FORMATTED=".ralph-iter-fmt.tmp"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="ralph-gemini-${TIMESTAMP}.log"
RAW_FILE="ralph-gemini-${TIMESTAMP}-raw.json"

# --- Model selection ---
# Default models optimized for cost/performance in their respective modes.
if [ -n "${MODEL:-}" ]; then
    EFFECTIVE_MODEL="$MODEL"
elif [ "$MODE" = "plan" ]; then
    EFFECTIVE_MODEL="gemini-2.5-pro"
else
    EFFECTIVE_MODEL="gemini-3.1-flash-lite-preview" # The "cheap flash model"
fi

# --- Header ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ralph Loop - Locodoko (Gemini CLI)"
echo "  Modus:      $MODE"
echo "  Prompt:     $PROMPT_FILE"
echo "  Max:        $MAX_ITERATIONS Iterationen"
echo "  Modell:     $EFFECTIVE_MODEL"
echo "  Log:        $LOG_FILE"
echo "  Raw JSON:   $RAW_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Verify prerequisites ---
if ! command -v gemini &>/dev/null; then
    echo "FEHLER: 'gemini' CLI nicht gefunden."
    echo "Installiere mit: npm install -g @google/gemini-cli"
    exit 1
fi

if [ ! -f "$PROMPT_FILE" ]; then
    echo "FEHLER: $PROMPT_FILE nicht gefunden"
    exit 1
fi

# Ensure GEMINI.md exists (fallback to CLAUDE.md if it exists)
if [ ! -f "GEMINI.md" ] && [ -f "CLAUDE.md" ]; then
    echo "WARNUNG: GEMINI.md nicht gefunden. Erstelle Kopie von CLAUDE.md..."
    cp CLAUDE.md GEMINI.md
fi

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
    rm -f "$ITER_OUTPUT" "$ITER_FORMATTED"
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

    # Run Gemini CLI iteration.
    # GEMINI.md wird vom Gemini CLI automatisch als System-Kontext geladen.
    # --approval-mode yolo: akzeptiert alle Tool-Calls automatisch.
    # -o stream-json: liefert strukturierte Events für Echtzeit-Parsing.
    gemini -p "$(cat "$PROMPT_FILE")" \
        --model "$EFFECTIVE_MODEL" \
        --approval-mode yolo \
        --output-format stream-json \
        2>&1 \
        | grep --line-buffered '^{' \
        | tee "$ITER_OUTPUT" "$RAW_FILE" \
        | jq --unbuffered -rj '
            if .type == "message" and .role == "assistant" then .content
            elif .type == "tool_use" then
              "\u001b[36m[→ \(.tool_name): \(.parameters | to_entries | map("\(.key)=\(.value | tostring | .[0:80])") | join(", "))]\u001b[0m\n"
            elif .type == "tool_result" then
              if .status == "error" then
                "\u001b[31m[✗ \(.output // .error // "error" | tostring | .[0:120] | gsub("\n";" "))]\u001b[0m\n"
              elif .output != null and (.output | tostring) != "" and (.output | tostring) != "null" then
                "\u001b[32m[✓ \(.output | tostring | .[0:120] | gsub("\n";" "))]\u001b[0m\n"
              else empty end
            elif .type == "result" then
              "\nTokens: \(.stats.input_tokens) in / \(.stats.output_tokens) out\n"
            else empty end
          ' 2>/dev/null \
        | tee "$ITER_FORMATTED" \
        || true

    # Append iteration output to log (Prompt + human-readable output, ANSI stripped)
    {
        echo "--- Iteration $ITERATION ($MODE) $(date) ---"
        echo "--- Prompt ($PROMPT_FILE) ---"
        cat "$PROMPT_FILE"
        echo ""
        echo "--- Output ---"
        sed $'s/\033\\[[0-9;]*[mK]//g' "$ITER_FORMATTED"
        echo ""
    } >> "$LOG_FILE"

    # Check for completion signal (only in assistant messages)
    if jq -e 'select(.type == "message" and .role == "assistant" and (.content | contains("<promise>COMPLETE</promise>")))' "$ITER_OUTPUT" >/dev/null 2>&1; then
        echo ""
        echo "━━━ Ralph meldet: COMPLETE ━━━"
        break
    fi

    # Check for blocked signal (only in assistant messages)
    if jq -e 'select(.type == "message" and .role == "assistant" and (.content | contains("<promise>BLOCKED</promise>")))' "$ITER_OUTPUT" >/dev/null 2>&1; then
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
