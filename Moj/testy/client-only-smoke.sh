#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="$ROOT_DIR/Moj/testy"
BASE_URL="http://127.0.0.1:3200"
API_URL="$BASE_URL/api/v1"
REMOTE_API_BASE="${REMOTE_API_BASE:-http://192.168.1.50:3200}"

echo "[Moj/testy] client-only smoke: fresh start"
APP_ENV=DEV_LOCAL "$TEST_DIR/reset.sh"
"$TEST_DIR/start.sh" --no-open

echo "[Moj/testy] 1/5 setup status pre-check"
PRE_STATUS="$(curl -fsS -X POST "$API_URL/setup/status")"
echo "$PRE_STATUS" | grep -q '"setupMode":true'

echo "[Moj/testy] 2/5 initialize client-only mode"
INIT="$(curl -fsS -X POST "$API_URL/setup/client-only" \
  -H 'Content-Type: application/json' \
  -d "{\"remoteApiBaseUrl\":\"$REMOTE_API_BASE\"}")"
echo "$INIT" | grep -q '"success":true'
echo "$INIT" | grep -q '"installationMode":"client_only"'

echo "[Moj/testy] 3/5 setup status post-check"
POST_STATUS="$(curl -fsS -X POST "$API_URL/setup/status")"
echo "$POST_STATUS" | grep -q '"setupMode":false'
echo "$POST_STATUS" | grep -q '"installationMode":"client_only"'

echo "[Moj/testy] 4/5 system info check"
SYS_INFO="$(curl -fsS "$API_URL/system/info")"
echo "$SYS_INFO" | grep -q '"installationMode":"client_only"'

echo "[Moj/testy] 5/5 UI redirect + API base override"
node - <<'NODE'
const path = require('path');
const { chromium } = require(path.resolve(process.cwd(), 'frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3200/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/login', { timeout: 15000 });
  const apiBase = await page.evaluate(() => window.localStorage.getItem('ts_api_base_url'));
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    throw new Error(`API base override missing or invalid: ${apiBase}`);
  }
  console.log(`[Moj/testy] playwright ok: ${page.url()} api_base=${apiBase}`);
  await browser.close();
})();
NODE

echo "[Moj/testy] PASS client-only smoke"
