#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"
REPORT_DIR="$RUNTIME_DIR/reports"
STATE_DIR="$RUNTIME_DIR/state"
CONFIG_DIR="$STATE_DIR/config"
DATA_DIR="$STATE_DIR/data"

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
BIND_HOST="${BIND_HOST:-127.0.0.1}"
BACKEND_HEALTH_HOST="${BACKEND_HEALTH_HOST:-127.0.0.1}"

mkdir -p "$PID_DIR" "$LOG_DIR" "$REPORT_DIR" "$CONFIG_DIR" "$DATA_DIR"

is_running() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

cleanup_stale_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]] && ! is_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

is_port_free() {
  local port="$1"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

find_free_port() {
  local start="$1"
  local end="$2"
  local port
  for port in $(seq "$start" "$end"); do
    if is_port_free "$port"; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

wait_for_backend_health() {
  local port="$1"
  local url_v4="http://${BACKEND_HEALTH_HOST}:${port}/api/v1/health"
  local url_v6="http://[::1]:${port}/api/v1/health"
  for _ in $(seq 1 60); do
    if curl -fsS "$url_v4" >/dev/null 2>&1 || curl -g -fsS "$url_v6" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_backend_build() {
  local backend_dist="$ROOT_DIR/backend/dist/main.js"
  local needs_backend_build=0

  if [[ ! -f "$backend_dist" ]]; then
    needs_backend_build=1
  elif find "$ROOT_DIR/backend/src" -type f -newer "$backend_dist" | head -n 1 | grep -q .; then
    needs_backend_build=1
  elif [[ -f "$ROOT_DIR/backend/tsconfig.json" && "$ROOT_DIR/backend/tsconfig.json" -nt "$backend_dist" ]]; then
    needs_backend_build=1
  fi

  if [[ "$needs_backend_build" -eq 1 ]]; then
    echo "[up] backend build required -> npm --prefix backend run build"
    npm --prefix "$ROOT_DIR/backend" run build >/dev/null
  fi
}

start_backend() {
  local pid_file="$PID_DIR/backend.pid"
  cleanup_stale_pid_file "$pid_file"
  if is_running "$pid_file"; then
    echo "[up] backend already running (pid $(cat "$pid_file"))"
    return
  fi

  if ! is_port_free "$BACKEND_PORT"; then
    local next_port
    next_port="$(find_free_port "$((BACKEND_PORT + 1))" "$((BACKEND_PORT + 100))" || true)"
    if [[ -z "$next_port" ]]; then
      echo "[up] no free backend port in range ${BACKEND_PORT}-${BACKEND_PORT}+100"
      exit 1
    fi
    echo "[up] backend port :$BACKEND_PORT busy, switching to :$next_port"
    BACKEND_PORT="$next_port"
  fi

  echo "[up] starting backend on :$BACKEND_PORT"
  ensure_backend_build
  (
    cd "$ROOT_DIR"
    TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
    TICKET_SYSTEM_DATA_DIR="$DATA_DIR" \
    TICKET_SYSTEM_AUTO_MIGRATE="${TICKET_SYSTEM_AUTO_MIGRATE:-1}" \
    APP_ENV="DEV_LOCAL" \
    TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
    PORT="$BACKEND_PORT" \
    BIND_HOST="$BIND_HOST" \
    NODE_ENV=production \
    nohup node backend/dist/main.js >"$LOG_DIR/backend.log" 2>&1 < /dev/null &
    echo $! > "$pid_file"
  )

  if wait_for_backend_health "$BACKEND_PORT"; then
    echo "[up] backend healthy"
    return
  fi

  echo "[up] backend failed to start, check $LOG_DIR/backend.log"
  exit 1
}

start_frontend() {
  local pid_file="$PID_DIR/frontend.pid"
  cleanup_stale_pid_file "$pid_file"
  if is_running "$pid_file"; then
    echo "[up] frontend already running (pid $(cat "$pid_file"))"
    return
  fi

  if ! is_port_free "$FRONTEND_PORT"; then
    local next_port
    next_port="$(find_free_port "$((FRONTEND_PORT + 1))" "$((FRONTEND_PORT + 100))" || true)"
    if [[ -z "$next_port" ]]; then
      echo "[up] no free frontend port in range ${FRONTEND_PORT}-${FRONTEND_PORT}+100"
      exit 1
    fi
    echo "[up] frontend port :$FRONTEND_PORT busy, switching to :$next_port"
    FRONTEND_PORT="$next_port"
  fi

  echo "[up] starting frontend on :$FRONTEND_PORT"
  (
    cd "$ROOT_DIR"
    NEXT_PUBLIC_API_URL="http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}" \
    PORT="$FRONTEND_PORT" \
    NODE_ENV=development \
    nohup npm --prefix frontend run dev -- --port "$FRONTEND_PORT" >"$LOG_DIR/frontend.log" 2>&1 < /dev/null &
    echo $! > "$pid_file"
  )

  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1; then
      echo "[up] frontend healthy"
      return
    fi
    sleep 1
  done

  echo "[up] frontend failed to start, check $LOG_DIR/frontend.log"
  exit 1
}

start_backend
start_frontend

cat > "$RUNTIME_DIR/env" <<EOF
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT
BIND_HOST=$BIND_HOST
BACKEND_HEALTH_HOST=$BACKEND_HEALTH_HOST
TICKET_SYSTEM_CONFIG_DIR=$CONFIG_DIR
TICKET_SYSTEM_DATA_DIR=$DATA_DIR
EOF

echo "[up] done"
echo "[up] backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "[up] frontend: http://127.0.0.1:${FRONTEND_PORT}"
