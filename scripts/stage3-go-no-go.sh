#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ENV="$ROOT_DIR/.runtime/env"

if [[ -f "$RUNTIME_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$RUNTIME_ENV"
fi

BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
BASE="http://127.0.0.1:${BACKEND_PORT}/api/v1"
FRONT="http://127.0.0.1:${FRONTEND_PORT}"

# Ensure setup completed for tests that need data writes
STATUS_JSON="$(curl -sS -X POST "$BASE/setup/status")"
if echo "$STATUS_JSON" | grep -q '"setupMode":true'; then
  curl -sS -X POST "$BASE/setup/init" \
    -H 'Content-Type: application/json' \
    -d "{\"dataPath\":\"$ROOT_DIR/.runtime/state/data\",\"adminEmail\":\"admin@local.test\",\"adminPassword\":\"DevLocal123!\",\"organizationName\":\"DEV\"}" >/dev/null
fi

LOGIN_JSON="$(curl -sS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","password":"DevLocal123!"}')"
AUTH_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write((x.data&&x.data.token)||x.token||"")' "$LOGIN_JSON")"
if [[ -z "$AUTH_TOKEN" ]]; then
  echo "auth_login=FAIL"
  exit 1
fi

T1='FAIL'; T2='FAIL'; T3='FAIL'; T4='FAIL'; T5='FAIL'

if [[ "$(curl -sS -o /tmp/stage3-front.html -w '%{http_code}' "$FRONT/dashboard")" == "200" ]]; then
  T1='PASS'
fi

CREATE_JSON="$(curl -sS -X POST "$BASE/tickets" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Stage3 go/no-go","description":"Ticket utworzony przez stage3 go/no-go script","priority":"HIGH","customerName":"Stage3 User","customerEmail":"stage3@example.com"}')"
TICKET_ID="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write((x.data&&x.data.id)||x.id||"")' "$CREATE_JSON")"
if [[ -n "$TICKET_ID" ]]; then
  T2='PASS'
fi

if [[ "$(curl -sS -o /tmp/stage3-comment.json -w '%{http_code}' -X POST "$BASE/tickets/$TICKET_ID/comments" -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' -d '{"body":"Komentarz z testu Stage3","isInternal":false,"author":"WebUI Agent"}')" == "201" ]]; then
  T3='PASS'
fi

if [[ "$(curl -sS -o /tmp/stage3-cost.json -w '%{http_code}' -X POST "$BASE/tickets/$TICKET_ID/cost-items" -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' -d '{"name":"Diagnoza","qty":1,"unitNet":100,"vatCode":"23"}')" == "201" ]]; then
  T4='PASS'
fi

LIST_JSON="$(curl -sS "$BASE/tickets" -H "Authorization: Bearer $AUTH_TOKEN")"
if echo "$LIST_JSON" | grep -q "$TICKET_ID" && echo "$LIST_JSON" | grep -q '"meta"'; then
  T5='PASS'
fi

echo "T1_front_dashboard=$T1"
echo "T2_create_ticket=$T2"
echo "T3_add_comment=$T3"
echo "T4_add_cost=$T4"
echo "T5_list_ticket_meta=$T5"

if [[ "$T1" != 'PASS' || "$T2" != 'PASS' || "$T3" != 'PASS' || "$T4" != 'PASS' || "$T5" != 'PASS' ]]; then
  exit 1
fi
