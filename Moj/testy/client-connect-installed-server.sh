#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/Moj/testy/runtime/client-connect"
SERVER_DIR="$RUNTIME_DIR/server"
CLIENT_DIR="$RUNTIME_DIR/client"
SERVER_PORT="${SERVER_PORT:-3210}"
CLIENT_PORT="${CLIENT_PORT:-3211}"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
CLIENT_URL="http://127.0.0.1:${CLIENT_PORT}"
API_SERVER="$SERVER_URL/api/v1"
API_CLIENT="$CLIENT_URL/api/v1"
ADMIN_EMAIL="admin@client-connect.test"
ADMIN_PASS="ClientConnect123!"

mkdir -p "$SERVER_DIR" "$CLIENT_DIR"

cleanup() {
  local pid
  for pid_file in "$SERVER_DIR/backend.pid" "$CLIENT_DIR/backend.pid"; do
    if [[ -f "$pid_file" ]]; then
      pid="$(cat "$pid_file" 2>/dev/null || true)"
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        sleep 1
        kill -9 "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
    fi
  done
}
trap cleanup EXIT

start_instance() {
  local name="$1"
  local port="$2"
  local cfg="$3"
  local data="$4"
  local log="$5"
  mkdir -p "$cfg" "$data" "$(dirname "$log")"

  nohup env \
    TICKET_SYSTEM_CONFIG_DIR="$cfg" \
    TICKET_SYSTEM_DATA_DIR="$data" \
    APP_ENV="DEV_LOCAL" \
    TICKET_SYSTEM_ALLOW_DEV_RESET="1" \
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK="1" \
    TICKET_SYSTEM_AUTO_MIGRATE="1" \
    PORT="$port" \
    BIND_HOST="127.0.0.1" \
    NODE_ENV="production" \
    node "$ROOT_DIR/backend/dist/main.js" >"$log" 2>&1 < /dev/null &

  local pid="$!"
  disown "$pid" 2>/dev/null || true
  echo "$pid"
}

wait_health() {
  local base="$1"
  for _ in $(seq 1 90); do
    if curl -fsS "$base/api/v1/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [[ ! -f "$ROOT_DIR/backend/dist/main.js" ]]; then
  npm --prefix "$ROOT_DIR/backend" run build
fi
if [[ ! -f "$ROOT_DIR/frontend/out/index.html" ]]; then
  npm --prefix "$ROOT_DIR/frontend" run build
fi

rm -rf "$RUNTIME_DIR"
mkdir -p "$SERVER_DIR" "$CLIENT_DIR"

echo "[client-connect] start server runtime"
SERVER_PID="$(start_instance "server" "$SERVER_PORT" "$SERVER_DIR/config" "$SERVER_DIR/data" "$SERVER_DIR/backend.log")"
echo "$SERVER_PID" > "$SERVER_DIR/backend.pid"
wait_health "$SERVER_URL"

echo "[client-connect] 1/5 server setup status"
STATUS_JSON="$(curl -fsS -X POST "$API_SERVER/setup/status")"
echo "$STATUS_JSON" | grep -q '"setupMode":true'

echo "[client-connect] 2/5 initialize server"
curl -fsS -X POST "$API_SERVER/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$SERVER_DIR/data\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASS\",\"organizationName\":\"Client Connect Test\",\"bootstrapMode\":\"fresh\",\"autoBackupEnabled\":true,\"autoBackupIntervalHours\":12,\"autoBackupPath\":\"$SERVER_DIR/data/backups/auto\"}" >/dev/null

echo "[client-connect] 3/5 create ticket on server"
LOGIN_JSON="$(curl -fsS -X POST "$API_SERVER/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.token)||x.token||"")' "$LOGIN_JSON")"
[[ -n "$TOKEN" ]]
TICKET_PAYLOAD='{"title":"Klient-serwer test","description":"Ticket utworzony na serwerze do testu klienta","priority":"NORMAL","customerName":"Test Klient"}'
CREATE_JSON="$(curl -fsS -X POST "$API_SERVER/tickets" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$TICKET_PAYLOAD")"
TICKET_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.id)||x.id||"")' "$CREATE_JSON")"
[[ -n "$TICKET_ID" ]]

echo "[client-connect] start client runtime"
CLIENT_PID="$(start_instance "client" "$CLIENT_PORT" "$CLIENT_DIR/config" "$CLIENT_DIR/data" "$CLIENT_DIR/backend.log")"
echo "$CLIENT_PID" > "$CLIENT_DIR/backend.pid"
wait_health "$CLIENT_URL"

echo "[client-connect] 4/5 initialize client-only profile"
curl -fsS -X POST "$API_CLIENT/setup/client-only" \
  -H 'Content-Type: application/json' \
  -d "{\"remoteApiBaseUrl\":\"$SERVER_URL\"}" >/dev/null

CLIENT_STATUS="$(curl -fsS -X POST "$API_CLIENT/setup/status")"
echo "$CLIENT_STATUS" | grep -q '"installationMode":"client_only"'

echo "[client-connect] 5/5 UI login through client and verify server tickets"
export ROOT_DIR CLIENT_URL ADMIN_EMAIL ADMIN_PASS
node - <<'NODE'
const path = require('path');
const ROOT = process.env.ROOT_DIR;
const CLIENT_URL = process.env.CLIENT_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASS;
const playwrightPath = path.resolve(ROOT, 'frontend/node_modules/playwright');
const { chromium } = require(playwrightPath);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${CLIENT_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Hasło').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /Zaloguj|Login/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  await page.waitForSelector('tbody tr', { timeout: 20000 });
  const body = await page.textContent('body');
  if (!body || !body.includes('Klient-serwer test')) {
    throw new Error('Client dashboard does not show server ticket data.');
  }
  await browser.close();
})();
NODE

echo "[client-connect] PASS"
