#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const playwrightEntry = path.join(rootDir, 'frontend', 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(playwrightEntry)) {
  console.error('[full-install-usage-smoke] Brak playwright w frontend/node_modules.');
  process.exit(2);
}
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3200';
const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.test';
const adminPassword = process.env.ADMIN_PASSWORD || 'DevLocal123!';
const companyName = process.env.COMPANY_NAME || 'OpenTicket Demo Lab';
const demoCount = Number(process.env.DEMO_COUNT || '200');
const screenshotVersion = process.env.SCREENSHOT_VERSION || 'v0.4';

const reportDir = path.join(rootDir, 'Moj', 'testy', 'runtime', 'reports');
const screenshotsDir = path.join(rootDir, 'docs', 'screenshots', screenshotVersion);
const assetsDir = path.join(rootDir, 'Moj', 'testy', 'runtime', 'assets');
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const customLogoPath = path.join(assetsDir, 'custom-logo-smoke.svg');
fs.writeFileSync(
  customLogoPath,
  `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="24" y1="16" x2="240" y2="248" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0A84FF"/>
      <stop offset="1" stop-color="#5E5CE6"/>
    </linearGradient>
  </defs>
  <rect x="16" y="16" width="224" height="224" rx="56" fill="#0F172A"/>
  <rect x="28" y="28" width="200" height="200" rx="48" fill="url(#g)"/>
  <path d="M82 88h92v24H82V88Zm0 56h92v24H82v-24Z" fill="#fff"/>
  <circle cx="70" cy="100" r="12" fill="#fff"/>
  <circle cx="186" cy="156" r="12" fill="#fff"/>
</svg>`,
  'utf-8',
);

const report = {
  name: 'full-install-usage-smoke',
  createdAt: new Date().toISOString(),
  status: 'PASS',
  checks: [],
  screenshots: [],
};

function addCheck(name, ok, detail = '') {
  report.checks.push({ name, ok, detail });
  if (!ok) {
    report.status = 'FAIL';
  }
}

async function safeShot(page, filename) {
  const out = path.join(screenshotsDir, filename);
  await page.screenshot({ path: out, fullPage: true });
  report.screenshots.push(out);
}

async function clickFirst(page, names) {
  for (const name of names) {
    const btn = page.getByRole('button', { name });
    if ((await btn.count()) > 0) {
      await btn.first().click();
      return true;
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/setup`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Choose Storage Location', { timeout: 20000 });
    addCheck('setup-opened', true, '/setup ready');

    const demoRadio = page
      .locator('label:has-text("Wczytaj bazę demo"), label:has-text("Load demo dataset")')
      .locator('input[type="radio"]')
      .first();
    if ((await demoRadio.count()) > 0) {
      await demoRadio.check();
      addCheck('setup-demo-mode-select', true);
    } else {
      addCheck('setup-demo-mode-select', false, 'demo mode radio not found');
    }

    const demoCountInput = page.locator('label:has-text("Liczba zgłoszeń demo") input[type="number"]').first();
    if ((await demoCountInput.count()) > 0) {
      await demoCountInput.fill(String(demoCount));
      addCheck('setup-demo-count', true, String(demoCount));
    } else {
      addCheck('setup-demo-count', false, 'demo count input not found');
    }
    await safeShot(page, 'setup-step1-demo.png');

    const contStep1 = await clickFirst(page, [
      /Continue to Admin Setup/i,
      /Dalej do konfiguracji admina/i,
      /Continue/i,
    ]);
    addCheck('setup-step1-continue', contStep1);

    await page.waitForSelector('text=Create Admin Account', { timeout: 20000 });
    await page.getByPlaceholder('admin@company.com').fill(adminEmail);
    await page.getByPlaceholder('Enter a strong password').fill(adminPassword);
    await page.getByPlaceholder('Re-enter password').fill(adminPassword);
    await page.getByPlaceholder("e.g., John's Services").fill(companyName);
    addCheck('setup-step2-form', true, adminEmail);
    await safeShot(page, 'setup-step2-admin.png');

    const contStep2 = await clickFirst(page, [/Continue to Review/i, /Continue/i]);
    addCheck('setup-step2-continue', contStep2);

    await page.waitForSelector('text=Review & Initialize', { timeout: 20000 });
    await safeShot(page, 'setup-step3-review.png');

    const initClicked = await clickFirst(page, [/Initialize System/i, /Initializing/i]);
    addCheck('setup-initialize-click', initClicked);

    await page.waitForSelector('text=Setup Complete', { timeout: 50000 });
    await safeShot(page, 'setup-step4-complete.png');
    addCheck('setup-completed', true);

    const toDashboard = await clickFirst(page, [/Przejdź do dashboardu/i, /Go to dashboard/i]);
    addCheck('step4-go-dashboard', toDashboard);

    await page.waitForURL(/\/dashboard$/, { timeout: 25000 });
    await page.waitForSelector('tbody tr', { timeout: 20000 });
    await safeShot(page, 'dashboard-demo-helpdesk.png');
    addCheck('dashboard-opened', true);

    // Filter preset save + apply (user critical flow).
    const searchInput = page.getByPlaceholder(/Szukaj po temacie|Search by title/i).first();
    await searchInput.fill('iPhone');
    const presetInput = page.getByPlaceholder(/Nazwa nowego filtra|New filter name/i).first();
    const presetName = `iphone-smoke-${Date.now().toString().slice(-5)}`;
    await presetInput.fill(presetName);
    await page.getByRole('button', { name: /Zapisz filtr|Save filter/i }).first().click();
    await page.waitForTimeout(400);
    const presetSelect = page.locator('select[title*="filtra"], select[title*="filter"]').first();
    await presetSelect.selectOption({ label: presetName }).catch(async () => {
      await presetSelect.selectOption({ value: presetName });
    });
    await safeShot(page, 'dashboard-filters-preset.png');
    addCheck('filter-preset-save-apply', true, presetName);

    // Theme customization.
    await page.getByRole('button', { name: /Mój interfejs|My UI/i }).click();
    await Promise.race([
      page.waitForSelector('text=Mój profil interfejsu', { timeout: 12000 }),
      page.waitForSelector('text=My interface profile', { timeout: 12000 }),
    ]);

    const themeSelect = page
      .locator('label:has-text("Motyw kolorystyczny") select, label:has-text("Color theme") select')
      .first();
    for (const [theme, shot] of [
      ['graphite-noir', 'dashboard-theme-graphite.png'],
      ['emerald-flow', 'dashboard-theme-emerald.png'],
      ['cupertino-glass', 'dashboard-theme-cupertino.png'],
    ]) {
      await themeSelect.selectOption(theme);
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: /Zgłoszenia|Tickets/i }).click();
      await page.waitForSelector('tbody tr', { timeout: 12000 });
      await safeShot(page, shot);
      addCheck(`theme-${theme}`, true);
      await page.getByRole('button', { name: /Mój interfejs|My UI/i }).click();
      await Promise.race([
        page.waitForSelector('text=Mój profil interfejsu', { timeout: 12000 }),
        page.waitForSelector('text=My interface profile', { timeout: 12000 }),
      ]);
    }

    // Branding/logo from settings.
    await page.getByRole('button', { name: /Konfiguracja|Configuration/i }).click();
    await page.waitForSelector('text=Konfiguracja firmy i integracji', { timeout: 12000 });

    const companyInput = page.getByPlaceholder('Nazwa firmy').first();
    await companyInput.fill(companyName);
    const fileInput = page
      .locator('div:has-text("Branding / personalizacja") input[type="file"]')
      .first();
    await fileInput.setInputFiles(customLogoPath);
    await page.getByRole('button', { name: /Zapisz konfigurację|Save configuration/i }).first().click();
    await page.waitForTimeout(1000);
    await safeShot(page, 'settings-logo-custom.png');
    addCheck('logo-upload-save', true, customLogoPath);

    // Verify sidebar logo is visible with updated company name.
    const topLogo = page.locator(`img[alt="${companyName}"]`).first();
    addCheck('sidebar-logo-visible', (await topLogo.count()) > 0);

    await page.getByRole('button', { name: /Serwer|Server/i }).click();
    await page.waitForSelector('text=Baza danych:', { timeout: 12000 });
    await safeShot(page, 'server-status-after-install.png');
    addCheck('server-tab-open', true);
  } catch (error) {
    addCheck('unexpected-error', false, error instanceof Error ? error.message : String(error));
  } finally {
    await context.close();
    await browser.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `full-install-usage-smoke-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  if (report.status === 'PASS') {
    console.log(`[Moj/testy][full-install-usage-smoke] PASS report=${reportPath}`);
    process.exit(0);
  }

  console.error(`[Moj/testy][full-install-usage-smoke] FAIL report=${reportPath}`);
  process.exit(1);
}

main();
