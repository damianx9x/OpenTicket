#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const stamp = `${Date.now()}`;
const sandboxRoot = path.join(os.tmpdir(), `openticket-ios-contract-${stamp}`);
const configDir = path.join(sandboxRoot, 'config');
const dataDir = path.join(sandboxRoot, 'data');
const reportDir = path.join(rootDir, '.runtime', 'reports');
const reportPath = path.join(reportDir, `ios-contract-smoke-${stamp}.json`);
const logPath = path.join(reportDir, `ios-contract-smoke-${stamp}.backend.log`);

fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFreePort(start = 4800, end = 5200) {
  for (let port = start; port <= end; port += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error(`No free TCP port in ${start}-${end}`);
}

function unwrapEnvelope(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

async function requestJson(baseUrl, endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let json = {};
  if (text) {
    json = JSON.parse(text);
  }
  if (!response.ok) {
    const msg = (json && json.message) || (json && json.error) || response.statusText;
    throw new Error(`${endpoint} -> HTTP ${response.status}: ${msg}`);
  }
  return json;
}

async function waitForHealth(baseUrl, timeoutMs = 90000) {
  const started = Date.now();
  let lastError = 'timeout';
  while (Date.now() - started < timeoutMs) {
    try {
      await requestJson(baseUrl, '/health');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(1000);
    }
  }
  throw new Error(`Health timeout: ${lastError}`);
}

function startBackend(port) {
  const backendEntry = path.join(rootDir, 'backend', 'dist', 'main.js');
  if (!fs.existsSync(backendEntry)) {
    throw new Error('Missing backend build: backend/dist/main.js');
  }

  const out = fs.createWriteStream(logPath, { flags: 'a' });
  const proc = spawn(process.execPath, [backendEntry], {
    cwd: rootDir,
    env: {
      ...process.env,
      TICKET_SYSTEM_CONFIG_DIR: configDir,
      TICKET_SYSTEM_DATA_DIR: dataDir,
      APP_ENV: 'DEV_LOCAL',
      TICKET_SYSTEM_ALLOW_DEV_RESET: '1',
      TICKET_SYSTEM_FORCE_SQLITE_FALLBACK: '1',
      TICKET_SYSTEM_AUTO_MIGRATE: '1',
      NODE_ENV: 'production',
      BIND_HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (chunk) => out.write(chunk));
  proc.stderr.on('data', (chunk) => out.write(chunk));
  return { proc, out };
}

async function stopBackend(proc, out) {
  if (proc && proc.exitCode === null) {
    proc.kill('SIGTERM');
    await sleep(500);
    if (proc.exitCode === null) {
      proc.kill('SIGKILL');
    }
  }
  try {
    out?.end();
  } catch {
    // ignore
  }
}

function requireFields(obj, fields, label) {
  for (const field of fields) {
    if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
      throw new Error(`${label} missing required field: ${field}`);
    }
  }
}

async function main() {
  const checks = [];
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const adminEmail = 'admin+ios-contract@openticket.local';
  const adminPassword = 'SmokePass123!';

  let backend;
  try {
    backend = startBackend(port);
    await waitForHealth(baseUrl);
    checks.push({ name: 'health', ok: true, details: baseUrl });

    await requestJson(baseUrl, '/setup/init', {
      method: 'POST',
      body: JSON.stringify({
        dataPath: dataDir,
        organizationName: 'OpenTicket iOS Contract Smoke',
        adminEmail,
        adminPassword,
      }),
    });
    checks.push({ name: 'setup-init', ok: true });

    const loginEnvelope = await requestJson(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const loginData = unwrapEnvelope(loginEnvelope);
    requireFields(loginData, ['token', 'expiresAt', 'user'], 'auth.login.data');
    requireFields(loginData.user, ['id', 'email', 'role'], 'auth.login.data.user');
    checks.push({ name: 'login-shape', ok: true });

    const token = loginData.token;

    const createdEnvelope = await requestJson(baseUrl, '/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'iOS contract smoke ticket',
        description: 'Validation for iOS DTO compatibility and required fields',
        priority: 'NORMAL',
        customerName: 'iOS Tester',
      }),
    });
    const createdTicket = unwrapEnvelope(createdEnvelope);
    requireFields(createdTicket, ['id', 'title', 'description', 'status', 'priority', 'createdAt', 'updatedAt'], 'tickets.create.data');
    checks.push({ name: 'ticket-create-shape', ok: true });

    await requestJson(baseUrl, `/tickets/${createdTicket.id}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ body: 'Komentarz smoke iOS', isInternal: false }),
    });

    await requestJson(baseUrl, `/tickets/${createdTicket.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'DIAGNOSIS' }),
    });

    const listEnvelope = await requestJson(baseUrl, '/tickets?limit=20&page=1&sort=createdAt_desc&onlyMine=true', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = unwrapEnvelope(listEnvelope);
    if (!Array.isArray(listData) || listData.length === 0) {
      throw new Error('tickets.list returned empty data array');
    }
    requireFields(listData[0], ['id', 'title', 'description', 'status', 'priority', 'createdAt', 'updatedAt'], 'tickets.list.data[0]');
    checks.push({ name: 'tickets-list-shape', ok: true, details: `count=${listData.length}` });

    const detailEnvelope = await requestJson(baseUrl, `/tickets/${createdTicket.id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const detail = unwrapEnvelope(detailEnvelope);
    requireFields(detail, ['id', 'title', 'description', 'status', 'priority', 'createdAt', 'updatedAt'], 'tickets.detail');
    if (!Array.isArray(detail.comments) || detail.comments.length === 0) {
      throw new Error('tickets.detail missing comments array after comment create');
    }
    checks.push({ name: 'ticket-detail-shape', ok: true, details: `comments=${detail.comments.length}` });

    const report = {
      name: 'ios-contract-smoke',
      status: 'PASS',
      baseUrl,
      checks,
      logPath,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[ios-contract-smoke] PASS report=${reportPath}`);
  } catch (error) {
    const report = {
      name: 'ios-contract-smoke',
      status: 'FAIL',
      baseUrl,
      checks,
      error: error instanceof Error ? error.message : String(error),
      logPath,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.error(`[ios-contract-smoke] FAIL report=${reportPath}`);
    try {
      const tail = fs.readFileSync(logPath, 'utf-8').split('\n').slice(-80).join('\n');
      console.error('--- backend log tail ---');
      console.error(tail);
      console.error('--- end backend log tail ---');
    } catch {
      // ignore
    }
    process.exitCode = 1;
  } finally {
    if (backend) {
      await stopBackend(backend.proc, backend.out);
    }
  }
}

await main();
