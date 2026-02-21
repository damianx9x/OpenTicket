#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$ROOT_DIR/Moj/testy/runtime"
PID_DIR="$TEST_ROOT/pids"
LOG_DIR="$TEST_ROOT/logs"
STATE_DIR="$TEST_ROOT/state"
CONFIG_DIR="$STATE_DIR/config"
DATA_DIR="$STATE_DIR/data"
ENV_FILE="$TEST_ROOT/env"
LOCK_DIR="$TEST_ROOT/.runtime.lock"
LOCK_OWNER_FILE="$LOCK_DIR/owner.pid"
LOCK_ACQUIRED=0

PORT="${PORT:-3200}"
FRESH_START=0
AUTO_OPEN=1

acquire_runtime_lock() {
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

is_backend_process() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"

  # Accept both absolute and relative invocation forms:
  # - /.../backend/dist/main.js
  # - backend/dist/main.js
  # This keeps stop/start deterministic even when cwd differs.
  [[ "$cmd" == *"/backend/dist/main.js"* || "$cmd" == *"backend/dist/main.js"* ]]
}

port_listeners() {
  lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

for arg in "$@"; do
  case "$arg" in
    --fresh)
      FRESH_START=1
      ;;
    --no-open)
      AUTO_OPEN=0
      ;;
    *)
      echo "[Moj/testy] Nieznany argument: $arg"
      echo "[Moj/testy] Użycie: ./Moj/testy/start.sh [--fresh] [--no-open]"
      exit 2
      ;;
  esac
done

mkdir -p "$PID_DIR" "$LOG_DIR" "$CONFIG_DIR" "$DATA_DIR"

needs_backend_build=false
needs_frontend_build=false

if [[ -f "$PID_DIR/backend.pid" ]]; then
  PID="$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null && is_backend_process "$PID"; then
    if [[ "$FRESH_START" == "1" ]]; then
      echo "[Moj/testy] wykryto działający backend (pid $PID), ale żądano --fresh -> reset"
    else
      echo "[Moj/testy] backend już działa (pid $PID)"
      echo "[Moj/testy] URL: http://127.0.0.1:${PORT}"
      exit 0
    fi
  fi
  rm -f "$PID_DIR/backend.pid"
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[Moj/testy] Brak node w systemie. Ten tryb testowy wymaga node (bez instalacji app)."
  exit 1
fi

if [[ "$FRESH_START" == "1" ]]; then
  echo "[Moj/testy] Fresh start requested -> reset środowiska testowego"
  MOJ_TESTY_LOCK_HELD=1 APP_ENV=DEV_LOCAL "$ROOT_DIR/Moj/testy/reset.sh"
fi

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]]; then
  needs_backend_build=true
elif find "$ROOT_DIR/backend/src" -type f -newer "$ROOT_DIR/backend/dist/main.js" | head -n 1 | grep -q .; then
  needs_backend_build=true
elif [[ -f "$ROOT_DIR/backend/tsconfig.json" && "$ROOT_DIR/backend/tsconfig.json" -nt "$ROOT_DIR/backend/dist/main.js" ]]; then
  needs_backend_build=true
fi

if [[ "$needs_backend_build" == "true" ]]; then
  echo "[Moj/testy] Buduję backend..."
  if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]]; then
    rm -f "$ROOT_DIR/backend/tsconfig.tsbuildinfo"
  fi
  npm --prefix "$ROOT_DIR/backend" run build
fi

if [[ ! -f "$ROOT_DIR/frontend/out/index.html" ]]; then
  needs_frontend_build=true
elif find "$ROOT_DIR/frontend/app" -type f -newer "$ROOT_DIR/frontend/out/index.html" | head -n 1 | grep -q .; then
  needs_frontend_build=true
elif [[ -f "$ROOT_DIR/frontend/next.config.js" && "$ROOT_DIR/frontend/next.config.js" -nt "$ROOT_DIR/frontend/out/index.html" ]]; then
  needs_frontend_build=true
elif [[ -f "$ROOT_DIR/frontend/tailwind.config.js" && "$ROOT_DIR/frontend/tailwind.config.js" -nt "$ROOT_DIR/frontend/out/index.html" ]]; then
  needs_frontend_build=true
elif [[ -f "$ROOT_DIR/frontend/tailwind.config.ts" && "$ROOT_DIR/frontend/tailwind.config.ts" -nt "$ROOT_DIR/frontend/out/index.html" ]]; then
  needs_frontend_build=true
elif [[ -f "$ROOT_DIR/frontend/postcss.config.js" && "$ROOT_DIR/frontend/postcss.config.js" -nt "$ROOT_DIR/frontend/out/index.html" ]]; then
  needs_frontend_build=true
fi

if [[ "$needs_frontend_build" == "true" ]]; then
  echo "[Moj/testy] Buduję frontend..."
  npm --prefix "$ROOT_DIR/frontend" run build
fi

LISTENERS="$(port_listeners)"
if [[ -n "$LISTENERS" ]]; then
  for P in $LISTENERS; do
    if is_backend_process "$P"; then
      echo "[Moj/testy] Port ${PORT} zajęty przez poprzedni backend (pid $P), zatrzymuję..."
      kill "$P" 2>/dev/null || true
      sleep 1
      kill -9 "$P" 2>/dev/null || true
    fi
  done
fi

LISTENERS="$(port_listeners)"
if [[ -n "$LISTENERS" ]]; then
  echo "[Moj/testy] Port ${PORT} jest zajęty przez inny proces."
  for P in $LISTENERS; do
    echo "[Moj/testy] pid=$P cmd=$(ps -p "$P" -o command= 2>/dev/null || true)"
  done
  echo "[Moj/testy] Użyj innego portu: PORT=3201 ./Moj/testy/start.sh"
  exit 1
fi

if [[ -f "$CONFIG_DIR/config.json" && "$FRESH_START" != "1" ]]; then
  echo "[Moj/testy] Wykryto istniejącą konfigurację (setup już był wykonywany)."
  echo "[Moj/testy] Jeśli chcesz uruchomić setup od początku: ./Moj/testy/start.sh --fresh"
fi

echo "[Moj/testy] Start backend (tryb jak po instalacji, single-port)"
cd "$ROOT_DIR"
if command -v setsid >/dev/null 2>&1; then
  nohup setsid env \
    TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
    TICKET_SYSTEM_DATA_DIR="$DATA_DIR" \
    APP_ENV="DEV_LOCAL" \
    TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK="${TICKET_SYSTEM_FORCE_SQLITE_FALLBACK:-1}" \
    TICKET_SYSTEM_AUTO_MIGRATE="${TICKET_SYSTEM_AUTO_MIGRATE:-1}" \
    PORT="$PORT" \
    BIND_HOST="127.0.0.1" \
    NODE_ENV="production" \
    node backend/dist/main.js >"$LOG_DIR/backend.log" 2>&1 < /dev/null &
else
  nohup env \
    TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
    TICKET_SYSTEM_DATA_DIR="$DATA_DIR" \
    APP_ENV="DEV_LOCAL" \
    TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK="${TICKET_SYSTEM_FORCE_SQLITE_FALLBACK:-1}" \
    TICKET_SYSTEM_AUTO_MIGRATE="${TICKET_SYSTEM_AUTO_MIGRATE:-1}" \
    PORT="$PORT" \
    BIND_HOST="127.0.0.1" \
    NODE_ENV="production" \
    node backend/dist/main.js >"$LOG_DIR/backend.log" 2>&1 < /dev/null &
fi

BACKEND_PID="$!"
disown "$BACKEND_PID" 2>/dev/null || true
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then
  echo "[Moj/testy] backend nie wystartował. Log: $LOG_DIR/backend.log"
  exit 1
fi

sleep 1
if ! kill -0 "$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)" 2>/dev/null; then
  echo "[Moj/testy] backend uruchomił się i natychmiast zakończył."
  echo "[Moj/testy] Sprawdź log: $LOG_DIR/backend.log"
  exit 1
fi

if ! is_backend_process "$(cat "$PID_DIR/backend.pid" 2>/dev/null || true)"; then
  echo "[Moj/testy] Ostrzeżenie: PID backendu nie wskazuje na oczekiwany proces."
fi

cat > "$ENV_FILE" <<EOT
PORT=${PORT}
PID_DIR=${PID_DIR}
LOG_DIR=${LOG_DIR}
CONFIG_DIR=${CONFIG_DIR}
DATA_DIR=${DATA_DIR}
TICKET_SYSTEM_FORCE_SQLITE_FALLBACK=${TICKET_SYSTEM_FORCE_SQLITE_FALLBACK:-1}
TICKET_SYSTEM_AUTO_MIGRATE=${TICKET_SYSTEM_AUTO_MIGRATE:-1}
EOT

echo "[Moj/testy] OK"
echo "[Moj/testy] URL: http://127.0.0.1:${PORT}"
echo "[Moj/testy] Setup: http://127.0.0.1:${PORT}/setup"

if [[ "$AUTO_OPEN" == "1" ]] && command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${PORT}" >/dev/null 2>&1 || true
fi
