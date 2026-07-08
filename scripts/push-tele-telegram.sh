#!/usr/bin/env bash
# Push new Vietnam / Cambodia telecom headlines → Telegram (via Hermes)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/data.json" ]; then
  ROOT="$SCRIPT_DIR"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
cd "$ROOT"

MSG="$(node "$SCRIPT_DIR/push-tele-telegram.mjs")"
if [ -z "$MSG" ]; then
  echo "[$(date -Iseconds)] tele-notify: nothing new"
  exit 0
fi

WORKSPACE="${LLM_WORKSPACE:-$HOME/llm-workspace}"
NOTIFY="$WORKSPACE/bin/notify.sh"
SUBJECT="${AIPULSE_NOTIFY_SUBJECT:-[AIPulse Telecom]}"

if [ -x "$NOTIFY" ]; then
  "$NOTIFY" done "$MSG" --subject "$SUBJECT"
else
  HCMD="${HERMES_BIN:-$HOME/.local/bin/hermes}"
  [ -x "$HCMD" ] || HCMD="$(command -v hermes 2>/dev/null || true)"
  if [ -z "$HCMD" ]; then
    echo "tele-notify: notify.sh and hermes unavailable" >&2
    exit 0
  fi
  "$HCMD" send --to "${AIPULSE_NOTIFY_TARGET:-telegram}" --subject "$SUBJECT" "$MSG" -q
  echo "tele-notify: sent via hermes"
fi
