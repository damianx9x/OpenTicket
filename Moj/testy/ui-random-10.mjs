#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const reportsDir = path.join(rootDir, 'Moj', 'testy', 'runtime', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

const playwrightEntry = path.join(rootDir, 'frontend', 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(playwrightEntry)) {
  console.error('[Moj/testy] Brak lokalnego pakietu playwright.');
  console.error('[Moj/testy] Uruchom najpierw:');
  console.error('  npm --prefix frontend install --save-dev playwright');
  console.error('  npx --prefix frontend playwright install chromium webkit');
  process.exit(2);
}

const playwright = await import(pathToFileURL(playwrightEntry).href);
const { chromium, webkit } = playwright;

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const key = args[i];
  if (!key.startsWith('--')) continue;
  const next = args[i + 1];
  if (next && !next.startsWith('--')) {
    argMap.set(key, next);
    i += 1;
  } else {
    argMap.set(key, '1');
  }
}

const baseUrl = argMap.get('--base-url') || 'http://127.0.0.1:3200';
const browserName = argMap.get('--browser') || 'chromium';
const email = argMap.get('--email') || 'admin@local.test';
const password = argMap.get('--password') || 'DevLocal123!';
const iterations = Number(argMap.get('--iterations') || '10');

function nowStamp() {
  const date = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function ensureSetupAndLogin(page) {
  const clickButtonByName = async (patterns, timeout = 30000) => {
    const list = Array.isArray(patterns) ? patterns : [patterns];
    for (const pattern of list) {
      const button = page.getByRole('button', { name: pattern });
      const visible = await button.first().isVisible().catch(() => false);
      if (!visible) continue;
      await button.first().click({ timeout });
      return true;
    }
    return false;
  };

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.pathname !== '/', undefined, {
    timeout: 12000,
  }).catch(() => undefined);

  const currentPath = new URL(page.url()).pathname;

  if (currentPath.startsWith('/setup')) {
    const movedToAdminSetup = await clickButtonByName(
      [/Continue to Admin Setup/i, /Dalej.*konfiguracji admina/i, /^Dalej/i],
      35000,
    );
    if (!movedToAdminSetup) {
      throw new Error('Setup step 1 button not found');
    }

    await page.getByPlaceholder('admin@company.com').fill(email);
    await page.getByPlaceholder('Enter a strong password').fill(password);
    await page.getByPlaceholder('Re-enter password').fill(password);
    await page.getByPlaceholder("e.g., John's Services").fill('Moj Serwis');

    const movedToReview = await clickButtonByName(
      [/Continue to Review/i, /Dalej.*podsumowania/i, /^Continue/i],
      35000,
    );
    if (!movedToReview) {
      throw new Error('Setup step 2 button not found');
    }

    const initialized = await clickButtonByName(
      [/Initialize System/i, /Inicjalizuj system/i, /Uruchom system/i],
      35000,
    );
    if (!initialized) {
      throw new Error('Setup step 3 initialize button not found');
    }

    await page
      .waitForFunction(() => {
        const path = window.location.pathname || '';
        if (path.startsWith('/dashboard') || path.startsWith('/login')) {
          return true;
        }
        const body = document.body?.innerText || '';
        return /Zaczynamy|Przejdź do dashboardu|Go to Dashboard/i.test(body);
      }, undefined, { timeout: 120000 })
      .catch(() => undefined);

    const afterInitPath = new URL(page.url()).pathname;
    if (afterInitPath.startsWith('/setup')) {
      const openedDashboard = await clickButtonByName(
        [/Zaczynamy/i, /Przejdź do dashboardu/i, /Go to Dashboard/i],
        35000,
      );
      if (!openedDashboard) {
        throw new Error('Setup completion button not found');
      }
    }
  }

  if (new URL(page.url()).pathname.startsWith('/login')) {
    const response = await page.request.post(`${baseUrl}/api/v1/auth/login`, {
      data: { email, password },
    });
    if (!response.ok()) {
      throw new Error(`API login failed with status ${response.status()}`);
    }

    const payload = await response.json();
    const token = payload?.data?.token || payload?.token;
    const user = payload?.data?.user || payload?.user || null;
    if (!token) {
      throw new Error('API login returned no token');
    }

    await page.evaluate(
      ({ authToken, authUser }) => {
        localStorage.setItem('ts_auth_token', authToken);
        localStorage.setItem('ts_auth_user', JSON.stringify(authUser || null));
      },
      { authToken: token, authUser: user },
    );

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForSelector('button:has-text("Zgłoszenia")', { timeout: 15000 });
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

async function runRandomActions(page) {
  const menuButton = (name) =>
    page.locator('aside').first().getByRole('button', { name, exact: true });

  const actions = [
    async () => {
      await menuButton('Statystyki').click();
      await page.waitForSelector('text=Zaawansowane statystyki');
      return 'open_statistics';
    },
    async () => {
      await menuButton('Użytkownicy').click();
      await page.waitForSelector('text=Użytkownicy (widok kontaktów)');
      return 'open_users';
    },
    async () => {
      await menuButton('Konfiguracja').click();
      await page.waitForSelector('text=Konfiguracja firmy i integracji');
      return 'open_config';
    },
    async () => {
      await menuButton('Zgłoszenia').click();
      await page.waitForSelector('text=Informacje');
      return 'open_tickets';
    },
    async () => {
      await menuButton('Zgłoszenia').click();
      await page.waitForSelector('text=Informacje');
      const createButton = page.getByRole('button', { name: 'Nowe Zgłoszenie' });
      await createButton.waitFor({ timeout: 10000 });
      await createButton.click();
      await page.waitForSelector('text=Nowe zgłoszenie');
      await page.getByRole('button', { name: 'Zamknij' }).click();
      return 'open_close_new_ticket_modal';
    },
    async () => {
      await menuButton('Zgłoszenia').click();
      await page.locator('input[placeholder*=\"Szukaj po\"]').first().fill('test');
      return 'search_tickets';
    },
    async () => {
      await menuButton('Zgłoszenia').click();
      const selects = page.locator('section').locator('select');
      const count = await selects.count();
      let changed = false;
      for (let idx = 0; idx < count; idx += 1) {
        const optionCount = await selects.nth(idx).locator('option').count();
        if (optionCount > 1) {
          await selects.nth(idx).selectOption({ index: 1 });
          changed = true;
          break;
        }
      }
      return changed ? 'change_filter' : 'change_filter_skipped';
    },
    async () => {
      await menuButton('Zgłoszenia').click();
      await page.getByRole('button', { name: /Odśwież/i }).click();
      return 'refresh_tickets';
    },
    async () => {
      await menuButton('Konfiguracja').click();
      await page.waitForSelector('text=Personalizacja technika (profil UI)');
      return 'open_ui_personalization';
    },
    async () => {
      await page.getByRole('button', { name: 'Powiadomienia' }).click();
      return 'click_notifications';
    },
  ];

  const history = [];
  for (let i = 0; i < iterations; i += 1) {
    const idx = randomInt(actions.length);
    const name = await actions[idx]();
    await page.waitForTimeout(250);

    const stuckLoading = await page.getByText('Ładowanie dashboardu...').isVisible().catch(() => false);
    if (stuckLoading) {
      throw new Error(`UI stuck on loading after action: ${name}`);
    }

    const hasSidebar = await page.locator('aside').first().isVisible().catch(() => false);
    if (!hasSidebar && !page.url().includes('/login')) {
      throw new Error(`Sidebar disappeared after action: ${name}`);
    }

    history.push({ step: i + 1, action: name, url: page.url() });
  }

  return history;
}

async function main() {
  const type = browserName === 'webkit' ? webkit : chromium;
  const browser = await type.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const result = {
    browser: browserName,
    baseUrl,
    iterations,
    startedAt: new Date().toISOString(),
    success: false,
    actions: [],
    error: null,
  };

  try {
    await ensureSetupAndLogin(page);
    result.actions = await runRandomActions(page);
    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    const screenshotPath = path.join(reportsDir, `ui-random-10-${browserName}-FAIL-${nowStamp()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;
  } finally {
    await context.close();
    await browser.close();
  }

  const reportPath = path.join(reportsDir, `ui-random-10-${browserName}-${result.success ? 'PASS' : 'FAIL'}-${nowStamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`[Moj/testy] report: ${reportPath}`);

  if (!result.success) {
    console.error(`[Moj/testy] FAIL: ${result.error}`);
    process.exit(1);
  }

  console.log('[Moj/testy] PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
