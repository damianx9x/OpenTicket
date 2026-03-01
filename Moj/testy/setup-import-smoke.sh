#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3200/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"
DATA_PATH="${DATA_PATH:-$ROOT_DIR/Moj/testy/runtime/state/data}"
SEED_DB="${SEED_DB:-/tmp/openticket-seed-setup.db}"
SEED_ARCHIVE="${SEED_ARCHIVE:-/tmp/openticket-seed-setup.otbackup}"

json_get() {
  local expr="$1"
  node -e "const x=JSON.parse(require('fs').readFileSync(0,'utf8'));const data=(x&&x.data!==undefined)?x.data:x;const out=(function(){${expr}})();process.stdout.write(out==null?'':String(out));"
}

login_token() {
  curl -fsS -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    | json_get "return data.token || '';"
}

setup_init() {
  local payload="$1"
  curl -fsS -X POST "$BASE_URL/setup/init" \
    -H 'Content-Type: application/json' \
    -d "$payload"
}

count_seed_tickets() {
  local token="$1"
  curl -fsS "$BASE_URL/tickets?search=Import%20seed%20ticket" \
    -H "Authorization: Bearer $token" \
    | json_get "const arr=Array.isArray(data.data)?data.data:Array.isArray(data)?data:[];return arr.length;"
}

echo "[setup-import-smoke] Seed baseline"
"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/tmp/openticket-setup-import-seed.log 2>&1
SEED_SETUP_JSON="$(setup_init "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"SeedOrg\"}")"
BACKUP_KEY="$(printf '%s' "$SEED_SETUP_JSON" | json_get "return data.backupEncryptionKeyGenerated || '';")"
if [[ -z "$BACKUP_KEY" ]]; then
  echo "[setup-import-smoke] FAIL: brak wygenerowanego klucza backupu po setupie seed"
  exit 1
fi

TOKEN="$(login_token)"
if [[ -z "$TOKEN" ]]; then
  echo "[setup-import-smoke] FAIL: brak tokenu po logowaniu seed admina"
  exit 1
fi

curl -fsS -X POST "$BASE_URL/tickets" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Import seed ticket","description":"ticket for setup import tests","priority":"NORMAL","customerName":"Jan Import","customerEmail":"jan.import@example.com"}' >/dev/null

EXPORT_JSON="$(curl -fsS -X POST "$BASE_URL/system/backup/export" -H "Authorization: Bearer $TOKEN")"
ARCHIVE_PATH="$(printf '%s' "$EXPORT_JSON" | json_get "return data.archivePath || '';")"
cp "$DATA_PATH/app.db" "$SEED_DB"
cp "$ARCHIVE_PATH" "$SEED_ARCHIVE"

echo "[setup-import-smoke] Test import existing_db"
"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/tmp/openticket-setup-import-existing.log 2>&1
setup_init "{\"dataPath\":\"$DATA_PATH\",\"bootstrapMode\":\"existing_db\",\"existingDatabasePath\":\"$SEED_DB\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"SeedOrg\"}" >/dev/null
TOKEN_EXISTING="$(login_token)"
COUNT_EXISTING="$(count_seed_tickets "$TOKEN_EXISTING")"

echo "[setup-import-smoke] Test import encrypted_backup"
"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/tmp/openticket-setup-import-archive.log 2>&1
setup_init "{\"dataPath\":\"$DATA_PATH\",\"bootstrapMode\":\"encrypted_backup\",\"existingBackupArchivePath\":\"$SEED_ARCHIVE\",\"backupEncryptionKey\":\"$BACKUP_KEY\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"SeedOrg\"}" >/dev/null
TOKEN_ARCHIVE="$(login_token)"
COUNT_ARCHIVE="$(count_seed_tickets "$TOKEN_ARCHIVE")"

if [[ "$COUNT_EXISTING" -lt 1 ]]; then
  echo "[setup-import-smoke] FAIL: import existing_db nie odtworzył danych"
  exit 1
fi

if [[ "$COUNT_ARCHIVE" -lt 1 ]]; then
  echo "[setup-import-smoke] FAIL: import encrypted_backup nie odtworzył danych"
  exit 1
fi

echo "[setup-import-smoke] PASS existing_db=$COUNT_EXISTING encrypted_backup=$COUNT_ARCHIVE"
