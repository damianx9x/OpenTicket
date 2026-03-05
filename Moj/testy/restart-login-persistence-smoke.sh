#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/restart-login-persistence"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
mkdir -p "$RUNTIME_DIR" "$REPORT_DIR"

PORT="${PORT:-3214}"
CONFIG_DIR="$RUNTIME_DIR/config"
DATA_PATH="$RUNTIME_DIR/data-custom"
LOG_FILE="$RUNTIME_DIR/backend.log"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"

BACKEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

start_backend() {
  local forced_data_dir="$1"
  nohup env \
    TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
    TICKET_SYSTEM_DATA_DIR="$forced_data_dir" \
    APP_ENV="DEV_LOCAL" \
    TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK="1" \
    TICKET_SYSTEM_AUTO_MIGRATE="1" \
    PORT="$PORT" \
    BIND_HOST="127.0.0.1" \
    NODE_ENV="production" \
    node "$ROOT_DIR/backend/dist/main.js" >"$LOG_FILE" 2>&1 < /dev/null &
  BACKEND_PID=$!
  disown "$BACKEND_PID" 2>/dev/null || true

  for _ in $(seq 1 60); do
    if curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "[restart-login-persistence] backend start timeout"
  tail -n 200 "$LOG_FILE" || true
  exit 1
}

stop_backend() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$BACKEND_PID" 2>/dev/null || true
  fi
  BACKEND_PID=""
}

rm -rf "$RUNTIME_DIR"
mkdir -p "$CONFIG_DIR" "$DATA_PATH"
lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 || true

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]] || find "$ROOT_DIR/backend/src" -type f -newer "$ROOT_DIR/backend/dist/main.js" | head -n 1 | grep -q .; then
  npm --prefix "$ROOT_DIR/backend" run build >/dev/null
fi

echo "[restart-login-persistence] 1/5 start #1 + setup"
start_backend "$RUNTIME_DIR/WRONG_DATA_DIR_FIRST_RUN"
BASE_URL="http://127.0.0.1:${PORT}/api/v1"

STATUS_BEFORE="$(curl -fsS -X POST "$BASE_URL/setup/status")"
echo "$STATUS_BEFORE" | grep -q '"setupMode":true'

SETUP_JSON="$(curl -fsS -X POST "$BASE_URL/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"Restart Persistence\"}")"
echo "$SETUP_JSON" | grep -q '"success":true'

LOGIN_1="$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
echo "$LOGIN_1" | grep -q '"token"'

echo "[restart-login-persistence] 2/5 restart backend (symulacja restartu aplikacji)"
stop_backend
start_backend "$RUNTIME_DIR/WRONG_DATA_DIR_SECOND_RUN"

echo "[restart-login-persistence] 3/5 setup status po restarcie"
STATUS_AFTER_RESTART="$(curl -fsS -X POST "$BASE_URL/setup/status")"
echo "$STATUS_AFTER_RESTART" | grep -q '"setupMode":false'

echo "[restart-login-persistence] 4/5 login po restarcie tym samym adminem"
LOGIN_2="$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
echo "$LOGIN_2" | grep -q '"token"'

echo "[restart-login-persistence] 5/5 sanity check DB exists"
test -f "$DATA_PATH/app.db"

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/restart-login-persistence-smoke-$STAMP.json"
REPORT_PATH="$REPORT_PATH" \
REPORT_PORT="$PORT" \
REPORT_CONFIG_DIR="$CONFIG_DIR" \
REPORT_DATA_PATH="$DATA_PATH" \
REPORT_LOG_FILE="$LOG_FILE" \
REPORT_STATUS_BEFORE="$STATUS_BEFORE" \
REPORT_STATUS_AFTER="$STATUS_AFTER_RESTART" \
node -e '
const fs = require("fs");
const payload = {
  name: "restart-login-persistence-smoke",
  status: "PASS",
  createdAt: new Date().toISOString(),
  port: Number(process.env.REPORT_PORT || "0"),
  configDir: process.env.REPORT_CONFIG_DIR || "",
  dataPath: process.env.REPORT_DATA_PATH || "",
  logFile: process.env.REPORT_LOG_FILE || "",
  checks: {
    statusBefore: process.env.REPORT_STATUS_BEFORE || "",
    statusAfterRestart: process.env.REPORT_STATUS_AFTER || "",
  },
};
fs.writeFileSync(process.env.REPORT_PATH, JSON.stringify(payload, null, 2), "utf-8");
'

echo "[restart-login-persistence] PASS report=$REPORT_PATH"
