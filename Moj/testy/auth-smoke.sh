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
      echo "[Moj/testy] Użycie: ./Moj/testy/auth-smoke.sh [--no-fresh]"
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
ADMIN_EMAIL="admin@local.test"
ADMIN_PASSWORD="DevLocal123!"
TECH_PASSWORD="TechPass123!"
RUN_ID="$(date +%s)"
TECH_EMAIL="tech.${RUN_ID}@local.test"
TECH_NAME="Tech ${RUN_ID}"
SIGNUP_CODE="TECH-${RUN_ID}"

echo "[Moj/testy] 1/5 health"
curl -fsS "$BASE/health" >/dev/null

echo "[Moj/testy] 2/5 setup status/init"
STATUS_JSON="$(curl -fsS -X POST "$BASE/setup/status")"
if echo "$STATUS_JSON" | grep -q '"setupMode":true'; then
  curl -fsS -X POST "$BASE/setup/init" \
    -H 'Content-Type: application/json' \
    -d "{\"dataPath\":\"$ROOT_DIR/Moj/testy/runtime/state/data\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"MojTest\"}" >/dev/null
fi

echo "[Moj/testy] 3/5 login admin"
ADMIN_LOGIN_JSON="$(curl -fsS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
ADMIN_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.token)||x.token||"")' "$ADMIN_LOGIN_JSON")"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "[Moj/testy] Brak tokenu admina po login."
  exit 1
fi

echo "[Moj/testy] 4/5 configure signup code + register technician"
curl -fsS -X POST "$BASE/users/technician-signup-code" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$SIGNUP_CODE\",\"enabled\":true}" >/dev/null

REGISTER_JSON="$(curl -fsS -X POST "$BASE/users/register-technician" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"signupCode\":\"$SIGNUP_CODE\",\"name\":\"$TECH_NAME\",\"email\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASSWORD\"}")"
TECH_USER_ID="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.id)||x.id||"")' "$REGISTER_JSON")"
if [[ -z "$TECH_USER_ID" ]]; then
  echo "[Moj/testy] Rejestracja technika nie zwróciła ID."
  echo "$REGISTER_JSON"
  exit 1
fi

echo "[Moj/testy] 5/5 login technician + auth/me"
TECH_LOGIN_JSON="$(curl -fsS -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TECH_EMAIL\",\"password\":\"$TECH_PASSWORD\"}")"
TECH_TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.token)||x.token||"")' "$TECH_LOGIN_JSON")"
if [[ -z "$TECH_TOKEN" ]]; then
  echo "[Moj/testy] Brak tokenu technika po login."
  exit 1
fi

ME_JSON="$(curl -fsS "$BASE/auth/me" -H "Authorization: Bearer $TECH_TOKEN")"
TECH_ROLE="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write(x.role||x.data?.role||"")' "$ME_JSON")"
if [[ "$TECH_ROLE" != "AGENT" ]]; then
  echo "[Moj/testy] Oczekiwano roli AGENT, otrzymano: $TECH_ROLE"
  exit 1
fi

echo "[Moj/testy] PASS"
echo "[Moj/testy] tech.email=$TECH_EMAIL"
echo "[Moj/testy] tech.userId=$TECH_USER_ID"
