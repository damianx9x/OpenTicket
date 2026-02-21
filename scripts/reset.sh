#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
STATE_DIR="$RUNTIME_DIR/state"

APP_ENV="${APP_ENV:-}"
if [[ "$APP_ENV" != "DEV_LOCAL" ]]; then
  echo "[reset] blocked: set APP_ENV=DEV_LOCAL to allow destructive reset"
  exit 2
fi

echo "[reset] stopping services"
"$ROOT_DIR/scripts/stop.sh" --force

echo "[reset] removing local runtime state"
rm -rf "$STATE_DIR"
rm -rf "$RUNTIME_DIR/pids"
rm -f "$RUNTIME_DIR/env"
mkdir -p "$RUNTIME_DIR/state/config" "$RUNTIME_DIR/state/data" "$RUNTIME_DIR/pids" "$RUNTIME_DIR/logs" "$RUNTIME_DIR/reports"

echo "[reset] cleaning repo-local transient artifacts"
rm -f "$ROOT_DIR/backend/data/app.db" 2>/dev/null || true
rm -rf "$ROOT_DIR/backend/uploads" 2>/dev/null || true

echo "[reset] done"
