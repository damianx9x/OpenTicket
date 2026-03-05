#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/role-guard"
PORT="${ROLE_GUARD_PORT:-3221}"
BASE_URL="http://127.0.0.1:${PORT}"
API="$BASE_URL/api/v1"
ADMIN_EMAIL="admin@roles.test"
ADMIN_PASS="RolesAdmin123!"
AGENT_EMAIL="agent@roles.test"
AGENT_PASS="RolesAgent123!"

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

echo "[role-guard] 1/5 setup and admin login"
curl -fsS -X POST "$API/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$RUNTIME_DIR/data\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASS\",\"organizationName\":\"Role Guard Test\",\"bootstrapMode\":\"fresh\"}" >/dev/null
ADMIN_LOGIN="$(curl -fsS -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")"
ADMIN_TOKEN="$(json_get "$ADMIN_LOGIN" data.token || json_get "$ADMIN_LOGIN" token)"
[[ -n "$ADMIN_TOKEN" ]]

echo "[role-guard] 2/5 create AGENT by admin"
AGENT_CREATE="$(curl -fsS -X POST "$API/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "{\"email\":\"$AGENT_EMAIL\",\"name\":\"Role Guard Agent\",\"role\":\"AGENT\",\"password\":\"$AGENT_PASS\"}")"
AGENT_ID="$(json_get "$AGENT_CREATE" data.id || json_get "$AGENT_CREATE" id)"
[[ -n "$AGENT_ID" ]]

echo "[role-guard] 3/5 agent login"
AGENT_LOGIN="$(curl -fsS -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$AGENT_EMAIL\",\"password\":\"$AGENT_PASS\"}")"
AGENT_TOKEN="$(json_get "$AGENT_LOGIN" data.token || json_get "$AGENT_LOGIN" token)"
[[ -n "$AGENT_TOKEN" ]]

echo "[role-guard] 4/5 verify admin-only endpoints denied for agent"
set +e
HTTP_CODE_USERS_PATCH="$(curl -s -o /tmp/role-guard-users.patch.out -w "%{http_code}" -X PATCH "$API/users/$AGENT_ID" -H "Authorization: Bearer $AGENT_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Should Fail"}')"
HTTP_CODE_SETTINGS_ADMIN="$(curl -s -o /tmp/role-guard-settings.admin.out -w "%{http_code}" "$API/settings/admin" -H "Authorization: Bearer $AGENT_TOKEN")"
set -e

if [[ "$HTTP_CODE_USERS_PATCH" != "403" ]]; then
  echo "Expected 403 for AGENT PATCH /users/:id, got $HTTP_CODE_USERS_PATCH"
  cat /tmp/role-guard-users.patch.out
  exit 1
fi

if [[ "$HTTP_CODE_SETTINGS_ADMIN" != "403" ]]; then
  echo "Expected 403 for AGENT GET /settings/admin, got $HTTP_CODE_SETTINGS_ADMIN"
  cat /tmp/role-guard-settings.admin.out
  exit 1
fi

echo "[role-guard] 5/5 verify allowed endpoint for agent"
AGENT_USERS="$(curl -fsS "$API/users" -H "Authorization: Bearer $AGENT_TOKEN")"
echo "$AGENT_USERS" | grep -q "$AGENT_EMAIL"

echo "[role-guard] PASS"
