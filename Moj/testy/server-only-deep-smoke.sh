#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/server-only-deep"
PORT="${SERVER_ONLY_PORT:-3220}"
BASE_URL="http://127.0.0.1:${PORT}"
API="$BASE_URL/api/v1"
ADMIN_EMAIL="admin@server-only.test"
ADMIN_PASS="ServerOnly123!"

mkdir -p "$RUNTIME_DIR"

cleanup() {
  if [[ -f "$RUNTIME_DIR/backend.pid" ]]; then
    local pid
    pid="$(cat "$RUNTIME_DIR/backend.pid" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}
trap cleanup EXIT

json_get() {
  node -e 'const x=JSON.parse(process.argv[1]);const p=process.argv[2].split(".");let v=x;for(const k of p){if(v&&Object.prototype.hasOwnProperty.call(v,k)){v=v[k]}else{v=undefined;break}};if(v===undefined||v===null){process.exit(2)};process.stdout.write(String(v));' "$1" "$2"
}

wait_health() {
  for _ in $(seq 1 90); do
    if curl -fsS "$API/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]]; then
  npm --prefix "$ROOT_DIR/backend" run build >/dev/null
fi

rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR/config" "$RUNTIME_DIR/data"

nohup env \
  TICKET_SYSTEM_CONFIG_DIR="$RUNTIME_DIR/config" \
  TICKET_SYSTEM_DATA_DIR="$RUNTIME_DIR/data" \
  APP_ENV="DEV_LOCAL" \
  TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
  TICKET_SYSTEM_FORCE_SQLITE_FALLBACK="1" \
  TICKET_SYSTEM_AUTO_MIGRATE="1" \
  PORT="$PORT" \
  BIND_HOST="127.0.0.1" \
  NODE_ENV="production" \
  node "$ROOT_DIR/backend/dist/main.js" >"$RUNTIME_DIR/backend.log" 2>&1 < /dev/null &

echo "$!" > "$RUNTIME_DIR/backend.pid"
wait_health

echo "[server-only] 1/7 setup init"
curl -fsS -X POST "$API/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$RUNTIME_DIR/data\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASS\",\"organizationName\":\"Server Only Test\",\"bootstrapMode\":\"fresh\"}" >/dev/null

echo "[server-only] 2/7 login"
LOGIN_JSON="$(curl -fsS -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")"
TOKEN="$(json_get "$LOGIN_JSON" data.token || json_get "$LOGIN_JSON" token)"
ADMIN_ID="$(json_get "$LOGIN_JSON" data.user.id || true)"
[[ -n "$TOKEN" ]]

echo "[server-only] 3/7 create two tickets for one customer"
COMMON_CUSTOMER='{"customerName":"Alicja Kowalska","customerEmail":"alicja.kowalska@example.test","customerPhone":"+48123123123"}'
T1_PAYLOAD="{\"title\":\"Brak ładowania USB-C\",\"description\":\"Laptop nie ładuje przez USB-C, test scenariusza server-only\",\"priority\":\"HIGH\",\"channel\":\"DROP_OFF\",${COMMON_CUSTOMER:1}"
T2_PAYLOAD="{\"title\":\"Losowe restarty urządzenia\",\"description\":\"Urządzenie restartuje się pod obciążeniem, opis diagnostyczny\",\"priority\":\"NORMAL\",\"channel\":\"WEB_FORM\",${COMMON_CUSTOMER:1}"
T1="$(curl -fsS -X POST "$API/tickets" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$T1_PAYLOAD")"
T2="$(curl -fsS -X POST "$API/tickets" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$T2_PAYLOAD")"
T1_ID="$(json_get "$T1" data.id || json_get "$T1" id)"
T2_ID="$(json_get "$T2" data.id || json_get "$T2" id)"
T1_NO="$(json_get "$T1" data.number || json_get "$T1" number)"
T1_OWNER="$(json_get "$T1" data.owner.id || json_get "$T1" owner.id)"
T2_OWNER="$(json_get "$T2" data.owner.id || json_get "$T2" owner.id)"
T1_ASSIGNED="$(json_get "$T1" data.assignedAgent.id || json_get "$T1" assignedAgent.id || true)"
[[ -n "$T1_ID" && -n "$T2_ID" && -n "$T1_NO" ]]
[[ "$T1_OWNER" == "$T2_OWNER" ]]
if [[ -n "$ADMIN_ID" && -n "$T1_ASSIGNED" ]]; then
  [[ "$ADMIN_ID" == "$T1_ASSIGNED" ]]
fi

echo "[server-only] 4/7 comments + attachment + reminder"
COMMENT_TEXT="Diagnoza server-only deep smoke"
curl -fsS -X POST "$API/tickets/$T1_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"body\":\"$COMMENT_TEXT\",\"isInternal\":false}" >/dev/null

ATTACH_FILE="$RUNTIME_DIR/sample-image.png"
base64 -d > "$ATTACH_FILE" <<'B64'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5l9pEAAAAASUVORK5CYII=
B64
curl -fsS -X POST "$API/tickets/$T1_ID/attachments/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$ATTACH_FILE;type=image/png" >/dev/null

DUE_AT="$(date -u -v+2H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || python3 - <<'PY'
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc)+timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%SZ'))
PY
)"
curl -fsS -X POST "$API/reminders" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"ticketId\":\"$T1_ID\",\"title\":\"Oddzwonić do klienta\",\"note\":\"Potwierdzić kosztorys\",\"dueAt\":\"$DUE_AT\"}" >/dev/null

echo "[server-only] 5/7 search and filters coverage"
SEARCH_OWNER="$(curl -fsS "$API/tickets?search=Alicja" -H "Authorization: Bearer $TOKEN")"
SEARCH_NO="$(curl -fsS "$API/tickets?search=$T1_NO" -H "Authorization: Bearer $TOKEN")"
SEARCH_COMMENT="$(curl -fsS "$API/tickets?search=server-only%20deep%20smoke" -H "Authorization: Bearer $TOKEN")"
HAS_ATTACH="$(curl -fsS "$API/tickets?hasAttachments=true" -H "Authorization: Bearer $TOKEN")"
HAS_COMMENTS="$(curl -fsS "$API/tickets?hasComments=true" -H "Authorization: Bearer $TOKEN")"

echo "$SEARCH_OWNER" | grep -q "$T1_ID"
echo "$SEARCH_NO" | grep -q "$T1_ID"
echo "$SEARCH_COMMENT" | grep -q "$T1_ID"
echo "$HAS_ATTACH" | grep -q "$T1_ID"
echo "$HAS_COMMENTS" | grep -q "$T1_ID"

echo "[server-only] 6/7 workflow + reopen"
curl -fsS -X PATCH "$API/tickets/$T1_ID" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"DIAGNOSIS"}' >/dev/null
curl -fsS -X PATCH "$API/tickets/$T1_ID" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"CLOSED"}' >/dev/null
curl -fsS -X PATCH "$API/tickets/$T1_ID" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"DIAGNOSIS"}' >/dev/null
HISTORY="$(curl -fsS "$API/tickets/$T1_ID" -H "Authorization: Bearer $TOKEN")"
echo "$HISTORY" | grep -q 'DIAGNOSIS'

echo "[server-only] 7/7 backup export"
BACKUP_OUT="$RUNTIME_DIR/exports"
mkdir -p "$BACKUP_OUT"
EXPORT_JSON="$(curl -fsS -X POST "$API/system/backup/export" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"outputDir\":\"$BACKUP_OUT\",\"encryptionKey\":\"ServerOnlyBackupKey_1234567890\"}")"
BACKUP_PATH="$(json_get "$EXPORT_JSON" data.archivePath || json_get "$EXPORT_JSON" data.backupPath || json_get "$EXPORT_JSON" backupPath)"
[[ -n "$BACKUP_PATH" && -f "$BACKUP_PATH" ]]

echo "[server-only] PASS"
