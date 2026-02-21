#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/Moj/testy/runtime/env"
PORT="3200"
FRESH=1

for arg in "$@"; do
  case "$arg" in
    --no-fresh)
      FRESH=0
      ;;
    *)
      echo "[Moj/testy] Nieznany argument: $arg"
      echo "[Moj/testy] Użycie: ./Moj/testy/smoke.sh [--no-fresh]"
      exit 2
      ;;
  esac
done

if [[ "$FRESH" == "1" ]]; then
  echo "[Moj/testy] Fresh mode: reset + start (--fresh)"
  APP_ENV=DEV_LOCAL "$ROOT_DIR/Moj/testy/reset.sh"
  "$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BASE="http://127.0.0.1:${PORT}/api/v1"

echo "[Moj/testy] 1/5 health"
curl -fsS "$BASE/health" >/dev/null

echo "[Moj/testy] 2/5 setup status/init"
STATUS_JSON="$(curl -fsS -X POST "$BASE/setup/status")"
if echo "$STATUS_JSON" | grep -q '"setupMode":true'; then
  curl -fsS -X POST "$BASE/setup/init" \
    -H 'Content-Type: application/json' \
    -d "{\"dataPath\":\"$ROOT_DIR/Moj/testy/runtime/state/data\",\"adminEmail\":\"admin@local.test\",\"adminPassword\":\"DevLocal123!\",\"organizationName\":\"MojTest\"}" >/dev/null
fi

echo "[Moj/testy] login admin"
LOGIN_JSON="$(curl -fsS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","password":"DevLocal123!"}')"
AUTH_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write((x.data&&x.data.token)||x.token||"")' "$LOGIN_JSON")"
if [[ -z "$AUTH_TOKEN" ]]; then
  echo "[Moj/testy] login failed - missing token"
  exit 1
fi

echo "[Moj/testy] 3/5 create ticket"
CREATE_JSON="$(curl -fsS -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Moj test ticket","description":"Ticket utworzony przez testy Moj","priority":"NORMAL","customerName":"Moj Tester","customerEmail":"moj@example.com"}')"
TICKET_ID="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write((x.data&&x.data.id)||x.id||"")' "$CREATE_JSON")"
[[ -n "$TICKET_ID" ]]

echo "[Moj/testy] 4/5 comment + cost"
curl -fsS -X POST "$BASE/tickets/$TICKET_ID/comments" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Komentarz z Moj/testy","isInternal":false,"author":"MojTest"}' >/dev/null
curl -fsS -X POST "$BASE/tickets/$TICKET_ID/cost-items" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Diagnoza","qty":1,"unitNet":50,"vatCode":"23"}' >/dev/null

echo "[Moj/testy] 5/5 list"
LIST_JSON="$(curl -fsS "$BASE/tickets" -H "Authorization: Bearer $AUTH_TOKEN")"
echo "$LIST_JSON" | grep -q "$TICKET_ID"

echo "[Moj/testy] PASS"
