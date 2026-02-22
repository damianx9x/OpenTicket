#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/setup-state-regression"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
mkdir -p "$RUNTIME_DIR" "$REPORT_DIR"

PORT="${PORT:-3213}"
CONFIG_DIR="$RUNTIME_DIR/config"
DATA_PATH="$RUNTIME_DIR/data"
LOG_FILE="$RUNTIME_DIR/backend.log"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

rm -rf "$RUNTIME_DIR"
mkdir -p "$CONFIG_DIR" "$DATA_PATH"
lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 || true

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]] || find "$ROOT_DIR/backend/src" -type f -newer "$ROOT_DIR/backend/dist/main.js" | head -n 1 | grep -q .; then
  npm --prefix "$ROOT_DIR/backend" run build >/dev/null
fi

nohup env \
  TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
  TICKET_SYSTEM_DATA_DIR="$DATA_PATH" \
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
    break
  fi
  sleep 1
done

BASE_URL="http://127.0.0.1:${PORT}/api/v1"

STATUS_BEFORE="$(curl -fsS -X POST "$BASE_URL/setup/status")"
echo "$STATUS_BEFORE" | grep -q '"setupMode":true'

SETUP_JSON="$(curl -fsS -X POST "$BASE_URL/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"RegressionOrg\"}")"
echo "$SETUP_JSON" | grep -q '"success":true'

LOGIN_JSON="$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
TOKEN="$(printf '%s' "$LOGIN_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write((j.data&&j.data.token)||'')})")"
if [[ -z "$TOKEN" ]]; then
  echo "[Moj/testy][setup-state-regression] FAIL: login token missing"
  tail -n 200 "$LOG_FILE" || true
  exit 1
fi

BACKUP_JSON="$(curl -fsS -X POST "$BASE_URL/system/backup/export" -H "Authorization: Bearer $TOKEN")"
ARCHIVE_PATH="$(printf '%s' "$BACKUP_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write((j.data&&j.data.archivePath)||'')})")"
if [[ -z "$ARCHIVE_PATH" || ! -f "$ARCHIVE_PATH" ]]; then
  echo "[Moj/testy][setup-state-regression] FAIL: backup archive missing"
  echo "$BACKUP_JSON"
  tail -n 200 "$LOG_FILE" || true
  exit 1
fi

curl -fsS -X POST "$BASE_URL/system/backup/import-path" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"archivePath\":\"$ARCHIVE_PATH\"}" >/dev/null

CLIENT_ONLY_JSON="$(curl -fsS -X POST "$BASE_URL/setup/client-only" \
  -H 'Content-Type: application/json' \
  -d '{"remoteApiBaseUrl":"http://127.0.0.1:3000"}')"
echo "$CLIENT_ONLY_JSON" | grep -q '"success":false'

STATUS_AFTER_IMPORT="$(curl -fsS -X POST "$BASE_URL/setup/status")"
echo "$STATUS_AFTER_IMPORT" | grep -q '"setupMode":false'

rm -f "$DATA_PATH/app.db" "$DATA_PATH/app.db-wal" "$DATA_PATH/app.db-shm" "$DATA_PATH/app.db-journal"
STATUS_AFTER_DB_DELETE="$(curl -fsS -X POST "$BASE_URL/setup/status")"
echo "$STATUS_AFTER_DB_DELETE" | grep -q '"setupMode":true'

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/setup-state-regression-smoke-$STAMP.json"
REPORT_PATH="$REPORT_PATH" \
REPORT_PORT="$PORT" \
REPORT_DATA_PATH="$DATA_PATH" \
REPORT_LOG_FILE="$LOG_FILE" \
REPORT_STATUS_BEFORE="$STATUS_BEFORE" \
REPORT_STATUS_AFTER_IMPORT="$STATUS_AFTER_IMPORT" \
REPORT_STATUS_AFTER_DB_DELETE="$STATUS_AFTER_DB_DELETE" \
REPORT_CLIENT_ONLY_JSON="$CLIENT_ONLY_JSON" \
node -e '
const fs = require("fs");
const payload = {
  name: "setup-state-regression-smoke",
  status: "PASS",
  createdAt: new Date().toISOString(),
  port: Number(process.env.REPORT_PORT || "0"),
  dataPath: process.env.REPORT_DATA_PATH || "",
  logFile: process.env.REPORT_LOG_FILE || "",
  checks: {
    statusBefore: process.env.REPORT_STATUS_BEFORE || "",
    statusAfterImport: process.env.REPORT_STATUS_AFTER_IMPORT || "",
    statusAfterDbDelete: process.env.REPORT_STATUS_AFTER_DB_DELETE || "",
    clientOnlyAttempt: process.env.REPORT_CLIENT_ONLY_JSON || "",
  },
};
fs.writeFileSync(process.env.REPORT_PATH, JSON.stringify(payload, null, 2), "utf-8");
'

echo "[Moj/testy][setup-state-regression] PASS report=$REPORT_PATH"
