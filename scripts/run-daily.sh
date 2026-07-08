#!/usr/bin/env bash
# AIPulse daily — manual full run (fetch + GitHub + Telegram)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

./run-morning-820.sh
./run-morning-830.sh
