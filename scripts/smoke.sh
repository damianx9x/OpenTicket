#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
STATE_DATA_DIR="$RUNTIME_DIR/state/data"
ENV_FILE="$RUNTIME_DIR/env"
mkdir -p "$STATE_DATA_DIR"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BACKEND_PORT="${BACKEND_PORT:-3000}"
BACKEND_HEALTH_HOST="${BACKEND_HEALTH_HOST:-127.0.0.1}"
BASE_URL="http://${BACKEND_HEALTH_HOST}:${BACKEND_PORT}/api/v1"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"
SMOKE_FORCE_FRESH="${SMOKE_FORCE_FRESH:-1}"
SMOKE_AUTO_UP="${SMOKE_AUTO_UP:-1}"

extract_token() {
  node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write((x.data&&x.data.token)||x.token||"")' "$1"
}

try_login() {
  curl -sS -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" || true
}

health_ok() {
  curl -fsS "$BASE_URL/health" >/dev/null 2>&1
}

echo "[smoke] 1/5 health"
if ! health_ok && [[ "$SMOKE_AUTO_UP" == "1" ]]; then
  echo "[smoke] backend down -> auto-start via scripts/up.sh"
  BACKEND_PORT="$BACKEND_PORT" BACKEND_HEALTH_HOST="$BACKEND_HEALTH_HOST" "$ROOT_DIR/scripts/up.sh" >/dev/null
fi

for _ in $(seq 1 30); do
  if health_ok; then
    break
  fi
  sleep 1
done
curl -fsS "$BASE_URL/health" >/dev/null

echo "[smoke] 2/5 setup status/init"
if [[ "$SMOKE_FORCE_FRESH" == "1" ]]; then
  echo "[smoke] force-fresh enabled -> setup/dev-reset"
  curl -sS -X POST "$BASE_URL/setup/dev-reset" >/dev/null || true
fi
STATUS_JSON="$(curl -fsS -X POST "$BASE_URL/setup/status")"
if echo "$STATUS_JSON" | grep -q '"setupMode":true'; then
  curl -fsS -X POST "$BASE_URL/setup/init" \
    -H 'Content-Type: application/json' \
    -d "{\"dataPath\":\"$STATE_DATA_DIR\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"DEV\"}" >/dev/null
fi

echo "[smoke] login admin"
LOGIN_JSON="$(try_login)"
AUTH_TOKEN="$(extract_token "$LOGIN_JSON" 2>/dev/null || true)"
if [[ -z "$AUTH_TOKEN" ]]; then
  echo "[smoke] login failed (missing token)"
  echo "[smoke] login response: $LOGIN_JSON"
  exit 1
fi

echo "[smoke] 3/5 create ticket"
CREATE_JSON="$(curl -fsS -X POST "$BASE_URL/tickets" -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' -d '{"title":"Smoke ticket","description":"Backend/frontend integration smoke test ticket","priority":"NORMAL","customerName":"Smoke Tester","customerEmail":"smoke@local.test"}')"
TICKET_ID="$(echo "$CREATE_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$TICKET_ID" ]]; then
  echo "[smoke] ticket create failed"
  exit 1
fi

echo "[smoke] 4/5 list tickets"
LIST_JSON="$(curl -fsS "$BASE_URL/tickets" -H "Authorization: Bearer $AUTH_TOKEN")"
echo "$LIST_JSON" | grep -q '"data"' || { echo "[smoke] list response missing data"; exit 1; }
echo "$LIST_JSON" | grep -q "$TICKET_ID" || { echo "[smoke] created ticket not found in list"; exit 1; }

echo "[smoke] 5/5 diagnostics"
DIAG_JSON="$(curl -fsS "$BASE_URL/diagnostics" -H "Authorization: Bearer $AUTH_TOKEN")"
echo "$DIAG_JSON" | grep -q '"database"' || { echo "[smoke] diagnostics missing database section"; exit 1; }

echo "[smoke] PASS"
