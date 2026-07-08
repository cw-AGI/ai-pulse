#!/usr/bin/env bash
# AIPulse daily fetch — run once per day (cron / launchd)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: export DEEPL_AUTH_KEY=your-key  (recommended for vi/km → en)
# Optional: export AIPULSE_TRANSLATE_MAX=50

node scripts/fetch-data.mjs
echo "[$(date -Iseconds)] data.json updated at $ROOT/data.json"
