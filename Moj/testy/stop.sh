#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$ROOT_DIR/Moj/testy/runtime"
PID_FILE="$TEST_ROOT/pids/backend.pid"
ENV_FILE="$TEST_ROOT/env"

PORT="3200"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    echo "[Moj/testy] zatrzymuję backend pid=$PID"
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

PIDS_ON_PORT="$(lsof -ti tcp:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$PIDS_ON_PORT" ]]; then
  for P in $PIDS_ON_PORT; do
    CMD="$(ps -p "$P" -o command= 2>/dev/null || true)"
    if [[ "$CMD" == *"/backend/dist/main.js"* || "$CMD" == *"backend/dist/main.js"* || "$CMD" == *"ticket-system"* ]]; then
      kill "$P" 2>/dev/null || true
      sleep 1
      kill -9 "$P" 2>/dev/null || true
    fi
  done
fi

echo "[Moj/testy] stop done"
