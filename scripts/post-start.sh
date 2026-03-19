#!/usr/bin/env bash
# post-start.sh — runs once after the container starts to complete setup steps
# that require network access or authentication (e.g., installing gh extensions).
# Invoke manually: bash ~/.post-start.sh
# Or integrate into your agent startup sequence.

set -euo pipefail

# Install GitHub Copilot CLI extension if gh is authenticated and the
# extension is not yet installed.
if gh auth status &>/dev/null; then
  if ! gh extension list | grep -q "gh-copilot"; then
    echo "[post-start] Installing GitHub Copilot CLI extension..."
    gh extension install github/gh-copilot
    echo "[post-start] gh-copilot installed."
  else
    echo "[post-start] gh-copilot extension already installed."
  fi
else
  echo "[post-start] WARNING: gh is not authenticated."
  echo "  Run 'gh auth login' or set the GH_TOKEN environment variable."
fi
