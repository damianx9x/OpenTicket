#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="$ROOT_DIR/Moj/testy/runtime/reports"
mkdir -p "$REPORT_DIR"

"$ROOT_DIR/Moj/testy/start.sh" --fresh --no-open >/dev/null
trap '"$ROOT_DIR/Moj/testy/stop.sh" >/dev/null 2>&1 || true' EXIT

node <<'NODE'
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${txt}`);
  return json;
}

(async () => {
  const root = '/Users/icex/Projekty/git_repos/OpenTicket-clean';
  const playwrightEntry = path.join(root, 'frontend/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwrightEntry).href);

  const base = 'http://127.0.0.1:3200';
  const api = `${base}/api/v1`;

  const setupStatus = await postJson(`${api}/setup/status`, {});
  if (setupStatus?.data?.setupMode) {
    await postJson(`${api}/setup/init`, {
      dataPath: path.join(root, 'Moj/testy/runtime/state/data'),
      adminEmail: 'admin@local.test',
      adminPassword: 'DevLocal123!',
      organizationName: 'MojTest Print Smoke',
    });
  }

  const loginResponse = await postJson(`${api}/auth/login`, {
    email: 'admin@local.test',
    password: 'DevLocal123!',
  });
  const token = loginResponse?.data?.token || loginResponse?.token;
  await postJson(`${api}/demo/load`, { count: 24, reset: true }, token);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  const result = {
    ok: false,
    checkedAt: new Date().toISOString(),
    popupErrorFound: false,
  };

  try {
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('E-mail').fill('admin@local.test');
    await page.getByPlaceholder('Hasło').fill('DevLocal123!');
    await page.getByRole('button', { name: /Zaloguj|Login/i }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 20000 });

    await page.getByRole('button', { name: 'Statystyki' }).click();
    await page.waitForSelector('text=Zaawansowane statystyki', { timeout: 15000 });
    await page.getByRole('button', { name: /Raport PDF/i }).click();
    await page.waitForTimeout(1400);

    const popupErrorCount = await page.getByText('Przeglądarka zablokowała okno eksportu PDF.').count();
    result.popupErrorFound = popupErrorCount > 0;
    result.ok = !result.popupErrorFound;

    if (!result.ok) {
      throw new Error('Popup blocker error still visible after clicking Raport PDF.');
    }

    console.log('[Moj/testy][print-report-smoke] PASS');
  } finally {
    const reportPath = path.join(root, 'Moj/testy/runtime/reports', `print-report-smoke-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`[Moj/testy][print-report-smoke] report=${reportPath}`);
    await browser.close();
  }
})();
NODE
