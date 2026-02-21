#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
ENV_FILE="$RUNTIME_DIR/env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

stop_by_pid_file() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "[stop] $name pid file not found"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    return
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "[stop] stopping $name (pid $pid)"
    kill "$pid" 2>/dev/null || true

    for _ in $(seq 1 10); do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      sleep 1
    done

    if kill -0 "$pid" 2>/dev/null; then
      echo "[stop] forcing $name (pid $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  else
    echo "[stop] stale $name pid file detected ($pid)"
  fi

  rm -f "$pid_file"
}

kill_by_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    local pid
    for pid in $pids; do
      local cmd
      cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
      if [[ "$cmd" == *"$ROOT_DIR"* || "$cmd" == *"ticket-system"* || "$cmd" == *"openticket"* || "$cmd" == *"ts-node-dev"* || "$cmd" == *"next dev"* ]]; then
        echo "[stop] killing managed process on :$port -> pid $pid"
        kill "$pid" 2>/dev/null || true
        sleep 1
        kill -9 "$pid" 2>/dev/null || true
      else
        echo "[stop] skipping non-managed process on :$port -> pid $pid"
      fi
    done
  fi
}

mkdir -p "$PID_DIR" "$LOG_DIR"

stop_by_pid_file "frontend"
stop_by_pid_file "backend"

if [[ "$FORCE" -eq 1 ]]; then
  kill_by_port "${BACKEND_PORT:-3000}"
  kill_by_port "${FRONTEND_PORT:-3001}"
fi

rm -f "$RUNTIME_DIR"/*.lock
echo "[stop] done"
