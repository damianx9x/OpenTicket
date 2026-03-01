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

const argPlatform = process.argv.find((arg) => arg.startsWith('--platform='))?.split('=')[1] || process.platform;
const platform = argPlatform === 'windows' ? 'win32' : argPlatform === 'macos' ? 'darwin' : argPlatform;

const stamp = `${Date.now()}`;
const sandboxRoot = path.join(os.tmpdir(), `openticket-clean-account-${stamp}`);
const homeDir = path.join(sandboxRoot, 'home');
const appDataDir = path.join(homeDir, 'AppData', 'Roaming');
const reportDir = path.join(rootDir, '.runtime', 'reports');
const reportPath = path.join(reportDir, `ci-clean-user-smoke-${platform}-${stamp}.json`);
const logPath = path.join(reportDir, `ci-clean-user-smoke-${platform}-${stamp}.backend.log`);

fs.mkdirSync(homeDir, { recursive: true });
fs.mkdirSync(appDataDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFreePort(start = 4300, end = 4700) {
  for (let port = start; port <= end; port += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (free) {
      return port;
    }
  }
  throw new Error(`No free TCP port in range ${start}-${end}`);
}

function unwrapEnvelope(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

async function requestJson(baseUrl, endpoint, options = {}) {
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: requestHeaders,
  });

  const text = await response.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from ${endpoint}: ${text.slice(0, 250)}`);
    }
  }

  if (!response.ok) {
    const message =
      (json && typeof json === 'object' && json.error && json.error.message) ||
      (json && typeof json === 'object' && json.message) ||
      response.statusText;
    throw new Error(`${endpoint} -> HTTP ${response.status}: ${message}`);
  }

  return json;
}

async function waitForHealth(baseUrl, timeoutMs = 90000) {
  const started = Date.now();
  let lastError = 'health check timeout';
  while (Date.now() - started < timeoutMs) {
    try {
      await requestJson(baseUrl, '/health');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(1000);
    }
  }
  throw new Error(`Backend health did not become ready in ${timeoutMs}ms: ${lastError}`);
}

function startBackend({ port, dataPath }) {
  const backendEntry = path.join(rootDir, 'backend', 'dist', 'main.js');
  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Missing backend entry: ${backendEntry}. Run backend build first.`);
  }

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    APPDATA: appDataDir,
    PORT: String(port),
    BIND_HOST: '127.0.0.1',
    NODE_ENV: 'production',
    APP_ENV: 'DEV_LOCAL',
    TICKET_SYSTEM_ALLOW_DEV_RESET: '1',
    TICKET_SYSTEM_AUTO_MIGRATE: '1',
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK: '1',
    TICKET_SYSTEM_SMOKE_DATA_PATH: dataPath,
  };

  const proc = spawn(process.execPath, [backendEntry], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (chunk) => logStream.write(chunk));
  proc.stderr?.on('data', (chunk) => logStream.write(chunk));
  proc.on('exit', (code, signal) => {
    logStream.write(`\n[exit] code=${code ?? 'null'} signal=${signal ?? 'null'}\n`);
  });

  return { proc, logStream };
}

async function stopBackend(proc, forceAfterMs = 4500) {
  if (!proc || proc.exitCode !== null || proc.killed) {
    return;
  }

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      proc.removeAllListeners('exit');
      resolve();
    };

    proc.once('exit', () => finish());

    try {
      proc.kill('SIGTERM');
    } catch {
      finish();
      return;
    }

    setTimeout(() => {
      if (proc.exitCode === null) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
      setTimeout(() => finish(), 300);
    }, forceAfterMs);
  });
}

function expectedConfigPath() {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'OpenTicket', 'config.json');
  }
  if (platform === 'win32') {
    return path.join(appDataDir, 'OpenTicket', 'config.json');
  }
  return path.join(homeDir, '.config', 'openticket', 'config.json');
}

function buildReport(payload) {
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf-8');
  return reportPath;
}

async function main() {
  const checks = [];
  const dataPath = path.join(homeDir, 'OpenTicketData');
  const dbFile = path.join(dataPath, 'app.db');
  const configPath = expectedConfigPath();
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  let backend = null;

  const record = (name, ok, details = '') => {
    checks.push({ name, ok, details });
    if (!ok) {
      throw new Error(`${name} failed${details ? `: ${details}` : ''}`);
    }
  };

  try {
    backend = startBackend({ port, dataPath });
    await waitForHealth(baseUrl);
    record('health-initial', true, baseUrl);

    const statusBeforeEnvelope = await requestJson(baseUrl, '/setup/status', { method: 'POST', body: '{}' });
    const statusBefore = unwrapEnvelope(statusBeforeEnvelope);
    record('setup-mode-before-init', Boolean(statusBefore?.setupMode), JSON.stringify(statusBefore));

    await requestJson(baseUrl, '/setup/init', {
      method: 'POST',
      body: JSON.stringify({
        dataPath,
        organizationName: 'OpenTicket CI Smoke',
        adminEmail: 'admin+ci@openticket.local',
        adminPassword: 'SmokePass123!'
      }),
    });
    record('setup-init', true, dataPath);

    const loginEnvelope = await requestJson(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin+ci@openticket.local', password: 'SmokePass123!' }),
    });
    const login = unwrapEnvelope(loginEnvelope);
    const token = login?.token || '';
    record('login-after-setup', Boolean(token), token ? 'token issued' : 'missing token');

    await requestJson(baseUrl, '/tickets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: 'CI clean account ticket',
        description: 'Ticket created in clean account smoke test',
        customerName: 'CI User',
        priority: 'NORMAL',
      }),
    });
    record('ticket-create', true);

    await stopBackend(backend.proc);
    backend.logStream.end();
    backend = startBackend({ port, dataPath });
    await waitForHealth(baseUrl);
    record('health-after-restart', true);

    const statusAfterEnvelope = await requestJson(baseUrl, '/setup/status', { method: 'POST', body: '{}' });
    const statusAfter = unwrapEnvelope(statusAfterEnvelope);
    record('setup-mode-after-restart', statusAfter?.setupMode === false, JSON.stringify(statusAfter));

    const loginAfterRestartEnvelope = await requestJson(baseUrl, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin+ci@openticket.local', password: 'SmokePass123!' }),
    });
    const loginAfterRestart = unwrapEnvelope(loginAfterRestartEnvelope);
    record('login-after-restart', Boolean(loginAfterRestart?.token), loginAfterRestart?.token ? 'token issued' : 'missing token');

    record('config-file-created', fs.existsSync(configPath), configPath);
    record('db-file-created', fs.existsSync(dbFile), dbFile);

    const report = {
      name: 'ci-clean-user-account-smoke',
      platform,
      baseUrl,
      homeDir,
      appDataDir,
      dataPath,
      configPath,
      dbFile,
      logPath,
      checks,
      result: 'PASS',
      generatedAt: new Date().toISOString(),
    };
    const saved = buildReport(report);
    console.log(`[ci-clean-user-smoke] PASS report=${saved}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = {
      name: 'ci-clean-user-account-smoke',
      platform,
      baseUrl,
      homeDir,
      appDataDir,
      dataPath,
      configPath,
      dbFile,
      logPath,
      checks,
      result: 'FAIL',
      error: message,
      generatedAt: new Date().toISOString(),
    };
    const saved = buildReport(report);
    let tail = '';
    try {
      const log = fs.readFileSync(logPath, 'utf-8');
      tail = log.split('\n').slice(-80).join('\n');
    } catch {
      // ignore
    }
    console.error(`[ci-clean-user-smoke] FAIL report=${saved}`);
    if (tail) {
      console.error('--- backend log tail ---');
      console.error(tail);
      console.error('--- end log tail ---');
    }
    process.exitCode = 1;
  } finally {
    if (backend?.proc) {
      await stopBackend(backend.proc);
    }
    try {
      backend?.logStream?.end();
    } catch {
      // ignore
    }
  }
}

await main();
