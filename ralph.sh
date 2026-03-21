#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# ralph.sh — Autonomous coding loop for GitHub Copilot CLI
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
#   MODEL=gpt-5 ./ralph.sh build 10   # Override model
# ============================================================

# --- Parse arguments ---

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
CONTEXT_FILE=".ralph-context.tmp"
ITER_OUTPUT=".ralph-iter.tmp"
LOG_FILE="ralph-$(date +%Y%m%d-%H%M%S).log"

# --- Model selection ---
MODEL_FLAG=""
if [ -n "${MODEL:-}" ]; then
    MODEL_FLAG="--model $MODEL"
fi

# --- Header ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ralph Loop - Locodoko"
echo "  Modus:      $MODE"
echo "  Prompt:     $PROMPT_FILE"
echo "  Max:        $MAX_ITERATIONS Iterationen"
echo "  Modell:     ${MODEL:-default}"
echo "  Log:        $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# --- Verify prerequisites ---
if ! command -v copilot &>/dev/null; then
    echo "FEHLER: 'copilot' CLI nicht gefunden."
    echo "Installiere mit: npm install -g @github/copilot"
    exit 1
fi

for f in "$PROMPT_FILE" "AGENTS.md"; do
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

# --- Build context file ---
# Combines all context into a single file for Copilot CLI's @file attachment.
# This keeps the primary context deterministic: same files every iteration.
build_context() {
    : > "$CONTEXT_FILE"

    echo "=== AGENTS.md ===" >> "$CONTEXT_FILE"
    cat AGENTS.md >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"

    echo "=== ANWEISUNGEN ($MODE-Modus) ===" >> "$CONTEXT_FILE"
    cat "$PROMPT_FILE" >> "$CONTEXT_FILE"
    echo "" >> "$CONTEXT_FILE"

    if [ -f "IMPLEMENTATION_PLAN.md" ]; then
        echo "=== IMPLEMENTATION_PLAN.md ===" >> "$CONTEXT_FILE"
        cat IMPLEMENTATION_PLAN.md >> "$CONTEXT_FILE"
        echo "" >> "$CONTEXT_FILE"
    fi

    # List available specs for orientation (not their content — let the agent read them)
    if [ -d "specs" ] && [ "$(ls -A specs/ 2>/dev/null)" ]; then
        echo "=== Verfuegbare Spezifikationen ===" >> "$CONTEXT_FILE"
        ls specs/*.md 2>/dev/null >> "$CONTEXT_FILE" || true
        echo "" >> "$CONTEXT_FILE"
    fi
}

# --- Cleanup on exit ---
cleanup() {
    rm -f "$CONTEXT_FILE" "$ITER_OUTPUT"
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

    # Fresh context each iteration
    build_context

    # Run Copilot CLI iteration
    # Output is shown in real-time via tee and captured for COMPLETE detection
    # shellcheck disable=SC2086
    copilot -p "@${CONTEXT_FILE} Folge den Anweisungen im angehängten Kontext." \
        $MODEL_FLAG \
        --allow-tool write \
        --allow-tool 'shell(mvn:*)' \
        --allow-tool 'shell(npm:*)' \
        --allow-tool 'shell(npx:*)' \
        --allow-tool 'shell(node:*)' \
        --allow-tool 'shell(git:*)' \
        --allow-tool 'shell(java:*)' \
        --allow-tool 'shell(javac:*)' \
        --allow-tool 'shell(cat:*)' \
        --allow-tool 'shell(find:*)' \
        --allow-tool 'shell(grep:*)' \
        --allow-tool 'shell(rg:*)' \
        --allow-tool 'shell(ls:*)' \
        --allow-tool 'shell(mkdir:*)' \
        --allow-tool 'shell(cp:*)' \
        --allow-tool 'shell(mv:*)' \
        --allow-tool 'shell(rm:*)' \
        --allow-tool 'shell(echo:*)' \
        --allow-tool 'shell(chmod:*)' \
        --allow-tool 'shell(sed:*)' \
        --allow-tool 'shell(awk:*)' \
        --allow-tool 'shell(curl:*)' \
        --allow-tool 'shell(head:*)' \
        --allow-tool 'shell(tail:*)' \
        --allow-tool 'shell(wc:*)' \
        --allow-tool 'shell(sort:*)' \
        --allow-tool 'shell(diff:*)' \
        --allow-tool 'shell(touch:*)' \
        --allow-tool 'shell(tee:*)' \
        --allow-tool 'shell(tr:*)' \
        --allow-tool 'shell(xargs:*)' \
        --allow-tool 'shell(bash:*)' \
        --allow-tool 'shell(sh:*)' \
        --allow-tool 'shell(test:*)' \
        --allow-tool 'shell(pwd:*)' \
        --allow-tool 'shell(env:*)' \
        --allow-tool 'shell(which:*)' \
        2>&1 | tee "$ITER_OUTPUT" || true

    # Append iteration output to log
    echo "--- Iteration $ITERATION ($MODE) $(date) ---" >> "$LOG_FILE"
    cat "$ITER_OUTPUT" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"

    # Check for completion signal
    if grep -q '<promise>COMPLETE</promise>' "$ITER_OUTPUT" 2>/dev/null; then
        echo ""
        echo "━━━ Ralph meldet: COMPLETE ━━━"
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
