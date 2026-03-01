#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="$ROOT_DIR/Moj/testy"
API_URL="http://127.0.0.1:3200/api/v1"
DATA_PATH="$ROOT_DIR/Moj/testy/runtime/state/data"
AUTO_PATH="$DATA_PATH/backups/auto-smoke"
ADMIN_EMAIL="admin@autobackup.test"
ADMIN_PASS="AutoBackup123!"

APP_ENV=DEV_LOCAL "$TEST_DIR/reset.sh"
"$TEST_DIR/start.sh" --fresh --no-open

echo "[auto-backup-smoke] 1/5 setup with auto backup"
curl -fsS -X POST "$API_URL/setup/init" \
  -H 'Content-Type: application/json' \
  -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASS\",\"organizationName\":\"Auto Backup Test\",\"bootstrapMode\":\"fresh\",\"autoBackupEnabled\":true,\"autoBackupIntervalHours\":1,\"autoBackupPath\":\"$AUTO_PATH\"}" >/dev/null

echo "[auto-backup-smoke] 2/5 login"
LOGIN_JSON="$(curl -fsS -X POST "$API_URL/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")"
TOKEN="$(node -e 'const x=JSON.parse(process.argv[1]);process.stdout.write((x.data&&x.data.token)||x.token||"")' "$LOGIN_JSON")"
[[ -n "$TOKEN" ]]

echo "[auto-backup-smoke] 3/5 auto status"
STATUS_JSON="$(curl -fsS "$API_URL/system/backup/auto-status" -H "Authorization: Bearer $TOKEN")"
echo "$STATUS_JSON" | grep -q '"enabled":true'
echo "$STATUS_JSON" | grep -q '"intervalHours":1'

echo "[auto-backup-smoke] 4/5 first auto run"
curl -fsS -X POST "$API_URL/system/backup/auto-run" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' >/dev/null
[[ -f "$AUTO_PATH/openticket-auto-backup.current.tar.gz" ]]

echo "[auto-backup-smoke] 5/5 second auto run with previous rotation"
sleep 1
curl -fsS -X POST "$API_URL/system/backup/auto-run" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' >/dev/null
[[ -f "$AUTO_PATH/openticket-auto-backup.current.tar.gz" ]]
[[ -f "$AUTO_PATH/openticket-auto-backup.previous.tar.gz" ]]

echo "[auto-backup-smoke] PASS"
