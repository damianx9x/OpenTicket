#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$ROOT_DIR/Moj/testy/runtime"
STATE_DIR="$TEST_ROOT/state"
LOGS_DIR="$TEST_ROOT/logs"
PIDS_DIR="$TEST_ROOT/pids"
REPORTS_DIR="$TEST_ROOT/reports"
ENV_FILE="$TEST_ROOT/env"
LOCK_DIR="$TEST_ROOT/.runtime.lock"
LOCK_OWNER_FILE="$LOCK_DIR/owner.pid"
LOCK_ACQUIRED=0

acquire_runtime_lock() {
  if [[ "${MOJ_TESTY_LOCK_HELD:-0}" == "1" ]]; then
    return
  fi

  local max_wait=180
  local waited=0

  while true; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      echo "$$" > "$LOCK_OWNER_FILE"
      LOCK_ACQUIRED=1
      return
    fi

    local owner_pid=""
    if [[ -f "$LOCK_OWNER_FILE" ]]; then
      owner_pid="$(cat "$LOCK_OWNER_FILE" 2>/dev/null || true)"
    fi

    if [[ -z "$owner_pid" ]] || ! kill -0 "$owner_pid" 2>/dev/null; then
      rm -rf "$LOCK_DIR" 2>/dev/null || true
      continue
    fi

    if (( waited >= max_wait )); then
      echo "[Moj/testy] timeout locka runtime (${max_wait}s)."
      echo "[Moj/testy] Jeśli żaden test nie działa, usuń: $LOCK_DIR"
      exit 1
    fi

    sleep 1
    waited=$((waited + 1))
  done
}

release_runtime_lock() {
  if [[ "$LOCK_ACQUIRED" == "1" ]]; then
    rm -rf "$LOCK_DIR" 2>/dev/null || true
  fi
}

acquire_runtime_lock
trap release_runtime_lock EXIT

APP_ENV="${APP_ENV:-}"
if [[ "$APP_ENV" != "DEV_LOCAL" ]]; then
  echo "[Moj/testy] reset zablokowany. Użyj APP_ENV=DEV_LOCAL"
  exit 2
fi

MOJ_TESTY_LOCK_HELD=1 "$ROOT_DIR/Moj/testy/stop.sh"
rm -rf "$STATE_DIR" "$LOGS_DIR" "$PIDS_DIR" "$REPORTS_DIR"
rm -f "$ENV_FILE"
rm -rf "$TEST_ROOT/browser-profile"
rm -rf "$ROOT_DIR/.playwright-cli"

# Full cache cleanup for "first customer run" simulation.
rm -rf "$ROOT_DIR/frontend/.next" "$ROOT_DIR/frontend/out"
rm -rf "$ROOT_DIR/backend/dist"
rm -f "$ROOT_DIR/backend/tsconfig.tsbuildinfo"

mkdir -p "$TEST_ROOT/state/config" "$TEST_ROOT/state/data" "$LOGS_DIR" "$PIDS_DIR" "$REPORTS_DIR"
echo "[Moj/testy] reset done"
