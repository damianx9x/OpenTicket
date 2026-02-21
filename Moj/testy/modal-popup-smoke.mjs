#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const playwrightEntry = path.join(rootDir, 'frontend', 'node_modules', 'playwright', 'index.mjs');
if (!fs.existsSync(playwrightEntry)) {
  console.error('[Moj/testy] Brak lokalnego pakietu playwright.');
  console.error('Uruchom: npm --prefix frontend install --save-dev playwright');
  process.exit(2);
}

const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3200';
const apiBase = `${baseUrl}/api/v1`;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@local.test';
const adminPassword = process.env.ADMIN_PASSWORD || 'DevLocal123!';

const modes = ['save', 'discard', 'cancel'];

async function apiJson(pathname, init) {
  const res = await fetch(`${apiBase}${pathname}`, init);
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  if (!res.ok) {
    throw new Error(`API ${pathname} -> HTTP ${res.status} ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function ensureSetupAndDemo() {
  const statusEnvelope = await apiJson('/setup/status', { method: 'POST' });
  const status = statusEnvelope?.data || statusEnvelope || {};
  if (status.setupMode) {
    const dataPath = path.join(rootDir, 'Moj', 'testy', 'runtime', 'state', 'data');
    await apiJson('/setup/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataPath,
        adminEmail,
        adminPassword,
        organizationName: 'MojTest Modal',
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
    throw new Error('Brak tokenu admina po login API.');
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

async function loginToDashboard(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('E-mail').fill(adminEmail);
  await page.getByPlaceholder('Hasło').fill(adminPassword);
  await page.getByRole('button', { name: /Zaloguj|Login/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20000 });
  await page.waitForSelector('tbody tr', { timeout: 20000 });
}

async function openFirstTicket(page) {
  await page.waitForSelector('tbody tr', { timeout: 20000 });
  await page.locator('tbody tr').first().click();
  await page.waitForSelector('text=Szczegóły zgłoszenia', { timeout: 10000 });
}

async function closeByBackdropWithDialogs(page, mode) {
  const dialogs = [];
  const handler = async (dialog) => {
    dialogs.push(dialog.message());
    if (mode === 'save') {
      await dialog.accept();
      return;
    }
    if (mode === 'discard') {
      if (dialogs.length === 1) {
        await dialog.dismiss();
      } else {
        await dialog.accept();
      }
      return;
    }
    if (dialogs.length === 1) {
      await dialog.dismiss();
    } else {
      await dialog.dismiss();
    }
  };

  page.on('dialog', handler);
  await page.locator('.modal-overlay').click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(450);
  page.off('dialog', handler);
  return dialogs;
}

async function runOne(mode, index) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  try {
    await loginToDashboard(page);
    await openFirstTicket(page);

    const comment = `Modal test ${mode} #${index} @ ${new Date().toISOString()}`;
    const textarea = page.getByPlaceholder('Dodaj komentarz');
    await textarea.fill(comment);

    const dialogs = await closeByBackdropWithDialogs(page, mode);

    if (mode === 'save') {
      await page.waitForSelector('text=Szczegóły zgłoszenia', { state: 'hidden', timeout: 12000 });
      await openFirstTicket(page);
      await page.waitForSelector(`text=${comment}`, { timeout: 12000 });
      await page.locator('.modal-overlay').click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(200);
      return { ok: true, mode, dialogs, check: 'saved_comment_visible' };
    }

    if (mode === 'discard') {
      await page.waitForSelector('text=Szczegóły zgłoszenia', { state: 'hidden', timeout: 12000 });
      await openFirstTicket(page);
      const occurrences = await page.locator(`text=${comment}`).count();
      if (occurrences > 0) {
        throw new Error('Komentarz po discard nadal widoczny.');
      }
      await page.locator('.modal-overlay').click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(200);
      return { ok: true, mode, dialogs, check: 'discard_comment_hidden' };
    }

    await page.waitForSelector('text=Szczegóły zgłoszenia', { state: 'visible', timeout: 12000 });
    await textarea.fill('');
    await page.getByRole('button', { name: /Zamknij|Close/i }).click();
    await page.waitForSelector('text=Szczegóły zgłoszenia', { state: 'hidden', timeout: 12000 });
    return { ok: true, mode, dialogs, check: 'cancel_kept_modal_open_then_closed' };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  await ensureSetupAndDemo();

  const results = [];
  for (let i = 0; i < modes.length; i += 1) {
    const mode = modes[i];
    const result = await runOne(mode, i + 1);
    results.push(result);
    console.log(`[Moj/testy][modal] PASS mode=${mode} check=${result.check}`);
  }

  const reportDir = path.join(rootDir, 'Moj', 'testy', 'runtime', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const reportPath = path.join(reportDir, `modal-popup-smoke-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ baseUrl, results }, null, 2));
  console.log(`[Moj/testy][modal] report: ${reportPath}`);
}

main().catch((error) => {
  console.error('[Moj/testy][modal] FAIL:', error?.stack || error);
  process.exit(1);
});
