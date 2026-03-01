#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3200/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"
DATA_PATH="${DATA_PATH:-$ROOT_DIR/Moj/testy/runtime/state/data}"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
REPORT_PATH="$REPORT_DIR/backup-verify-smoke-$STAMP.json"

mkdir -p "$REPORT_DIR"

json_get() {
  local expr="$1"
  node -e "const x=JSON.parse(require('fs').readFileSync(0,'utf8'));const data=(x&&x.data!==undefined)?x.data:x;const out=(function(){${expr}})();process.stdout.write(out==null?'':String(out));"
}

echo "[backup-verify-smoke] 1/6 fresh setup"
"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/tmp/openticket-backup-verify.log 2>&1
SETUP_JSON="$(curl -fsS -X POST "$BASE_URL/setup/init" -H 'Content-Type: application/json' -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"Backup Verify Test\"}")"
BACKUP_KEY="$(printf '%s' "$SETUP_JSON" | json_get "return data.backupEncryptionKeyGenerated || '';")"
if [[ -z "$BACKUP_KEY" ]]; then
  echo "[backup-verify-smoke] FAIL: brak wygenerowanego klucza backupu"
  exit 1
fi

echo "[backup-verify-smoke] 2/6 login"
TOKEN="$(curl -fsS -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | json_get "return data.token || '';")"
if [[ -z "$TOKEN" ]]; then
  echo "[backup-verify-smoke] FAIL: brak tokenu auth"
  exit 1
fi

echo "[backup-verify-smoke] 3/6 export backup"
EXPORT_JSON="$(curl -fsS -X POST "$BASE_URL/system/backup/export" -H "Authorization: Bearer $TOKEN")"
ARCHIVE_PATH="$(printf '%s' "$EXPORT_JSON" | json_get "return data.archivePath || '';")"
if [[ -z "$ARCHIVE_PATH" || ! -f "$ARCHIVE_PATH" ]]; then
  echo "[backup-verify-smoke] FAIL: brak pliku backupu po eksporcie"
  exit 1
fi

echo "[backup-verify-smoke] 4/6 verify with valid key"
VERIFY_OK_JSON="$(curl -fsS -X POST "$BASE_URL/system/backup/verify-path" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"archivePath\":\"$ARCHIVE_PATH\",\"encryptionKey\":\"$BACKUP_KEY\"}")"

VERIFY_OK_SUCCESS="$(printf '%s' "$VERIFY_OK_JSON" | json_get "return data.success ? '1' : '0';")"
VERIFY_OK_DB="$(printf '%s' "$VERIFY_OK_JSON" | json_get "return data.contains && data.contains.database ? '1' : '0';")"
if [[ "$VERIFY_OK_SUCCESS" != "1" || "$VERIFY_OK_DB" != "1" ]]; then
  echo "[backup-verify-smoke] FAIL: verify-path z poprawnym kluczem nie przeszedł"
  exit 1
fi

echo "[backup-verify-smoke] 5/6 verify with wrong key (must fail)"
VERIFY_BAD_BODY_FILE="$(mktemp "${TMPDIR:-/tmp}/ot-verify-bad-body.XXXXXX")"
VERIFY_BAD_CODE="$(
  curl -sS -o "$VERIFY_BAD_BODY_FILE" -w '%{http_code}' -X POST "$BASE_URL/system/backup/verify-path" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"archivePath\":\"$ARCHIVE_PATH\",\"encryptionKey\":\"wrong-wrong-wrong-key\"}"
)"
VERIFY_BAD_OUTPUT="$(cat "$VERIFY_BAD_BODY_FILE")"
rm -f "$VERIFY_BAD_BODY_FILE"

if [[ "$VERIFY_BAD_CODE" -lt 400 ]]; then
  echo "[backup-verify-smoke] FAIL: verify-path z błędnym kluczem powinien zwrócić błąd"
  echo "$VERIFY_BAD_OUTPUT"
  exit 1
fi

echo "[backup-verify-smoke] 6/6 report"
node -e '
const fs = require("fs");
const reportPath = process.argv[1];
const archivePath = process.argv[2];
const verifyOkJson = JSON.parse(process.argv[3]);
const verifyBadOutput = process.argv[4];
const report = {
  name: "backup-verify-smoke",
  createdAt: new Date().toISOString(),
  status: "PASS",
  checks: [
    { name: "setup-fresh", ok: true },
    { name: "export-created-file", ok: true, detail: archivePath },
    { name: "verify-path-valid-key", ok: true },
    { name: "verify-path-wrong-key", ok: true },
  ],
  verification: verifyOkJson.data || verifyOkJson,
  wrongKeyError: verifyBadOutput,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
' "$REPORT_PATH" "$ARCHIVE_PATH" "$VERIFY_OK_JSON" "$VERIFY_BAD_OUTPUT"

echo "[backup-verify-smoke] PASS report=$REPORT_PATH"
