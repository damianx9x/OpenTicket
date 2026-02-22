#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/custom-path"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
mkdir -p "$RUNTIME_DIR" "$REPORT_DIR"

PORT="${PORT:-3212}"
CONFIG_DIR="$RUNTIME_DIR/config"
LOG_FILE="$RUNTIME_DIR/backend.log"
DATA_PATH="${DATA_PATH:-$HOME/Library/Application Support/openticket-desktop/data}"
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
mkdir -p "$CONFIG_DIR"
lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 || true

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]] || find "$ROOT_DIR/backend/src" -type f -newer "$ROOT_DIR/backend/dist/main.js" | head -n 1 | grep -q .; then
  npm --prefix "$ROOT_DIR/backend" run build >/dev/null
fi

nohup env \
  TICKET_SYSTEM_CONFIG_DIR="$CONFIG_DIR" \
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

SETUP_JSON="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"CustomPathSmoke\"}")"

TOKEN="$(printf '%s' "$SETUP_JSON" >/dev/null; curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.data.token)})")"

BACKUP_JSON="$(curl -fsS -X POST "http://127.0.0.1:${PORT}/api/v1/system/backup/export" \
  -H "Authorization: Bearer $TOKEN")"

ARCHIVE_PATH="$(printf '%s' "$BACKUP_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write((j.data.archivePath||j.data.path||''))})")"

if [[ -z "$ARCHIVE_PATH" || ! -f "$ARCHIVE_PATH" ]]; then
  echo "[Moj/testy][custom-path-backup-smoke] FAIL backup archive missing"
  echo "$BACKUP_JSON"
  tail -n 200 "$LOG_FILE" || true
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="$REPORT_DIR/custom-path-backup-smoke-$STAMP.json"
REPORT_PATH="$REPORT_PATH" \
REPORT_PORT="$PORT" \
REPORT_DATA_PATH="$DATA_PATH" \
REPORT_ARCHIVE_PATH="$ARCHIVE_PATH" \
REPORT_LOG_FILE="$LOG_FILE" \
node -e '
const fs = require("fs");
const payload = {
  name: "custom-path-backup-smoke",
  status: "PASS",
  createdAt: new Date().toISOString(),
  port: Number(process.env.REPORT_PORT || "0"),
  dataPath: process.env.REPORT_DATA_PATH || "",
  archivePath: process.env.REPORT_ARCHIVE_PATH || "",
  logFile: process.env.REPORT_LOG_FILE || "",
};
fs.writeFileSync(process.env.REPORT_PATH, JSON.stringify(payload, null, 2), "utf-8");
'

echo "[Moj/testy][custom-path-backup-smoke] PASS report=$REPORT_PATH"
