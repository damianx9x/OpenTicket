#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const playwrightEntry = path.join(rootDir, 'frontend', 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(playwrightEntry)) {
  console.error('[screens] Brak playwright.');
  process.exit(2);
}
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3200';
const apiBase = `${baseUrl}/api/v1`;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.test';
const adminPassword = process.env.ADMIN_PASSWORD || 'DevLocal123!';
const outDir = path.join(rootDir, 'docs', 'screenshots', 'v0.3');
fs.mkdirSync(outDir, { recursive: true });

async function apiJson(pathname, init) {
  const response = await fetch(`${apiBase}${pathname}`, init);
  const raw = await response.text();
  let parsed = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }
  }
  if (!response.ok) {
    throw new Error(`API ${pathname} -> ${response.status} ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function ensureSetupAndDemo() {
  const statusEnvelope = await apiJson('/setup/status', { method: 'POST' });
  const status = statusEnvelope?.data || statusEnvelope || {};
  if (status.setupMode) {
    await apiJson('/setup/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataPath: path.join(rootDir, 'Moj', 'testy', 'runtime', 'state', 'data'),
        adminEmail,
        adminPassword,
        organizationName: 'MojTest Screens',
      }),
    });
  }

  const loginEnvelope = await apiJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const token = loginEnvelope?.data?.token || loginEnvelope?.token;
  if (!token) {
    throw new Error('Brak tokenu admina do wczytania demo.');
  }

  await apiJson('/demo/load', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ count: 200, reset: true }),
  });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(adminEmail);
  await page.getByPlaceholder('Hasło').fill(adminPassword);
  await page.getByRole('button', { name: /Zaloguj|Login/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  await page.waitForSelector('tbody tr', { timeout: 20000 });
}

async function main() {
  await ensureSetupAndDemo();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  try {
    await login(page);

    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, 'dashboard-chromium.png'), fullPage: true });

    await page.locator('tbody tr').first().click();
    await page.waitForSelector('text=Szczegóły zgłoszenia', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'ticket-modal-chromium.png'), fullPage: true });

    await page.getByRole('button', { name: /Zamknij|Close/i }).click();
    await page.waitForSelector('text=Szczegóły zgłoszenia', { state: 'hidden', timeout: 12000 });

    await page.getByRole('button', { name: 'Statystyki' }).click();
    await page.waitForSelector('text=Zaawansowane statystyki', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'statistics-chromium.png'), fullPage: true });

    await page.getByRole('button', { name: 'Użytkownicy' }).click();
    await page.waitForSelector('text=Użytkownicy (widok kontaktów)', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'users-chromium.png'), fullPage: true });

    await page.getByRole('button', { name: 'Konfiguracja' }).click();
    await page.waitForSelector('text=Konfiguracja firmy i integracji', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'settings-chromium.png'), fullPage: true });

    await page.getByRole('button', { name: 'Serwer' }).click();
    await page.waitForSelector('text=Baza danych:', { timeout: 12000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'server-chromium.png'), fullPage: true });

    console.log('[screens] Updated screenshots in docs/screenshots/v0.3');
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[screens] FAIL:', error?.stack || error);
  process.exit(1);
});
