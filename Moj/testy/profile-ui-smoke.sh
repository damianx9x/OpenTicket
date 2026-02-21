#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${BASE_URL:-http://127.0.0.1:3200}"
API_BASE="${BASE_URL}/api/v1"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@local.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-DevLocal123!}"
DATA_PATH="${DATA_PATH:-$ROOT_DIR/Moj/testy/runtime/state/data}"

"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open

STATUS_JSON="$(curl -fsS -X POST "$API_BASE/setup/status")"
if echo "$STATUS_JSON" | grep -q '"setupMode":true'; then
  curl -fsS -X POST "$API_BASE/setup/init" \
    -H 'Content-Type: application/json' \
    -d "{\"dataPath\":\"$DATA_PATH\",\"adminEmail\":\"$ADMIN_EMAIL\",\"adminPassword\":\"$ADMIN_PASSWORD\",\"organizationName\":\"MojTest\"}" >/dev/null
fi

node <<'NODE'
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

(async () => {
  const root = process.cwd();
  const { chromium } = await import(pathToFileURL(path.join(root, 'frontend/node_modules/playwright/index.mjs')).href);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 920 } });
  const page = await context.newPage();
  const reportDir = path.join(root, 'Moj', 'testy', 'runtime', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    name: 'profile-ui-smoke',
    createdAt: new Date().toISOString(),
    status: 'PASS',
    checks: [],
  };

  const add = (name, ok, detail = '') => {
    report.checks.push({ name, ok, detail });
    if (!ok) report.status = 'FAIL';
  };

  try {
    const base = process.env.BASE_URL || 'http://127.0.0.1:3200';
    const email = process.env.ADMIN_EMAIL || 'admin@local.test';
    const password = process.env.ADMIN_PASSWORD || 'DevLocal123!';

    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Hasło').fill(password);
    await page.getByRole('button', { name: /Zaloguj|Login/i }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    add('login', true, 'dashboard opened');

    await page.getByRole('button', { name: /Mój interfejs|My UI/i }).click();
    await page.waitForSelector('text=Mój profil interfejsu', { timeout: 12000 });
    add('open-profile-tab', true);

    const themeSelect = page.locator('label:has-text("Motyw kolorystyczny") select').first();
    await themeSelect.selectOption('graphite-noir');
    add('set-theme', true, 'graphite-noir');

    const compactCheckbox = page.locator('label:has-text("Tryb kompaktowy") input[type="checkbox"]').first();
    if (!(await compactCheckbox.isChecked())) {
      await compactCheckbox.check();
    }
    add('enable-compact-mode', true);

    await page.waitForTimeout(450);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
    await page.getByRole('button', { name: /Mój interfejs|My UI/i }).click();
    await page.waitForSelector('text=Mój profil interfejsu', { timeout: 12000 });

    const persistedTheme = await page.locator('label:has-text("Motyw kolorystyczny") select').first().inputValue();
    add('theme-persisted', persistedTheme === 'graphite-noir', `value=${persistedTheme}`);

    const persistedCompact = await page.locator('label:has-text("Tryb kompaktowy") input[type="checkbox"]').first().isChecked();
    add('compact-persisted', persistedCompact, `checked=${persistedCompact}`);

    await page.screenshot({ path: path.join(root, 'docs/screenshots/v0.3/profile-ui-chromium.png'), fullPage: true });
  } catch (error) {
    add('unexpected-error', false, error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `profile-ui-smoke-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  if (report.status === 'PASS') {
    console.log(`[Moj/testy][profile-ui-smoke] PASS report=${reportPath}`);
    process.exit(0);
  }

  console.error(`[Moj/testy][profile-ui-smoke] FAIL report=${reportPath}`);
  process.exit(1);
})();
NODE
