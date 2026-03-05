import electron from "electron";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import * as os from "os";
import * as net from "net";
import * as fs from "fs";
import * as https from "https";
import { autoUpdater } from "electron-updater";

const { app, BrowserWindow, dialog, ipcMain, shell, systemPreferences } = electron;

let mainWindow: electron.BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let currentBackendPort = 3000;
let backendStarting = false;
let backendLastError: string | null = null;
let backendLastExitCode: number | null = null;
let backendLastExitSignal: NodeJS.Signals | null = null;
let backendLastExitAt: string | null = null;
let backendLastStartAt: string | null = null;
let backendRunnerLabel: string | null = null;
let backendLogFilePath: string | null = null;
let appQuitting = false;
let backendAutoRestartInFlight = false;
let backendCrashTimestamps: number[] = [];
let backendHealthMonitor: NodeJS.Timeout | null = null;
let backendProbeInFlight = false;
let backendConsecutiveProbeFailures = 0;
const BACKEND_CRASH_WINDOW_MS = 2 * 60 * 1000;
const BACKEND_MAX_AUTO_RESTARTS = 3;
const BACKEND_MONITOR_INTERVAL_MS = 15000;
const BACKEND_MONITOR_FAIL_THRESHOLD = 3;
const isPackaged = app.isPackaged;
const isUiDevMode = !isPackaged || process.argv.includes("--dev");
const forceSetupAssistant = process.argv.includes("--setup-assistant");
const forcePermissionsAssistant = process.argv.includes("--permissions-assistant");

type UpdateState =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

type DesktopUpdateStatus = {
  supported: boolean;
  state: UpdateState;
  appVersion: string;
  message: string;
  releaseName: string | null;
  releaseVersion: string | null;
  releaseDate: string | null;
  progressPercent: number | null;
  bytesPerSecond: number | null;
  downloadedFile: string | null;
  lastCheckedAt: string | null;
  lastBackupPath: string | null;
  manualMode: boolean;
  manualDownloadUrl: string | null;
  manualReleasePageUrl: string | null;
};

type DesktopRuntimePaths = {
  userDataPath: string;
  configDir: string;
  configFile: string;
  dataPath: string;
  dbFile: string;
  uploadsDir: string;
  backupsDir: string;
};

type UpdateStateFile = {
  version: string;
  updatedAt: string;
  lastBackupPath?: string;
};

const updateStatus: DesktopUpdateStatus = {
  supported: false,
  state: "disabled",
  appVersion: app.getVersion(),
  message: "Auto-update jest dostępny tylko w buildzie instalatora.",
  releaseName: null,
  releaseVersion: null,
  releaseDate: null,
  progressPercent: null,
  bytesPerSecond: null,
  downloadedFile: null,
  lastCheckedAt: null,
  lastBackupPath: null,
  manualMode: false,
  manualDownloadUrl: null,
  manualReleasePageUrl: null,
};

const UPDATE_REPO_OWNER = process.env.TICKET_SYSTEM_UPDATE_OWNER || "damianx9x";
const UPDATE_REPO_NAME = process.env.TICKET_SYSTEM_UPDATE_REPO || "OpenTicket";

type BackendRunnerCandidate = {
  command: string;
  envPatch?: Record<string, string>;
  label: string;
};

type SetupValidatePathPayload = {
  dataPath?: string;
  apiBaseUrl?: string;
  setupSessionToken?: string;
};

type SetupValidatePathResult = {
  ok: boolean;
  requestedPath: string;
  resolvedPath: string;
  createdDirectory: boolean;
  writable: boolean;
  warning?: string;
  error?: string;
};

function pickResponseMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const obj = payload as Record<string, unknown>;
  if (typeof obj.message === "string" && obj.message.trim().length > 0) {
    return obj.message;
  }
  if (typeof obj.error === "string" && obj.error.trim().length > 0) {
    return obj.error;
  }
  if (Array.isArray(obj.message) && obj.message.length > 0) {
    return obj.message.map((item) => String(item)).join(", ");
  }
  return fallback;
}

async function proxySetupValidatePath(payload?: SetupValidatePathPayload): Promise<SetupValidatePathResult> {
  const requestedPath = (payload?.dataPath || "").trim();
  if (!requestedPath) {
    throw new Error("Brak ścieżki do walidacji.");
  }

  let apiBaseUrl = `http://127.0.0.1:${currentBackendPort}`;
  if (payload?.apiBaseUrl && payload.apiBaseUrl.trim().length > 0) {
    try {
      const parsed = new URL(payload.apiBaseUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("API base must use http/https.");
      }
      parsed.pathname = "";
      parsed.search = "";
      parsed.hash = "";
      apiBaseUrl = parsed.toString().replace(/\/+$/, "");
    } catch {
      throw new Error("Niepoprawny adres API serwera.");
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (payload?.setupSessionToken && payload.setupSessionToken.trim().length > 0) {
    headers["x-setup-session-token"] = payload.setupSessionToken.trim();
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/setup/validate-path`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dataPath: requestedPath,
      setupSessionToken: payload?.setupSessionToken,
    }),
  });

  const rawText = await response.text();
  let responseJson: unknown = null;
  if (rawText) {
    try {
      responseJson = JSON.parse(rawText);
    } catch {
      responseJson = { message: rawText };
    }
  }

  if (!response.ok) {
    const fallback = `Walidacja ścieżki nie powiodła się (HTTP ${response.status}).`;
    throw new Error(pickResponseMessage(responseJson, fallback));
  }

  const envelopeData =
    responseJson && typeof responseJson === "object" && "data" in (responseJson as Record<string, unknown>)
      ? ((responseJson as Record<string, unknown>).data as unknown)
      : responseJson;

  if (!envelopeData || typeof envelopeData !== "object") {
    throw new Error("Silnik zwrócił niepoprawny wynik walidacji ścieżki.");
  }

  const result = envelopeData as SetupValidatePathResult;
  if (typeof result.ok !== "boolean" || typeof result.resolvedPath !== "string") {
    throw new Error("Silnik zwrócił niekompletne dane walidacji ścieżki.");
  }

  return result;
}

function toSqliteDatabaseUrl(dbPath: string): string {
  return `file:${encodeURI(path.resolve(dbPath))}`;
}

function resolveBackendEntry(): string {
  const devEntry = path.resolve(__dirname, "../../backend/dist/main.js");
  if (!isPackaged) {
    return devEntry;
  }

  const candidates = [
    path.join(process.resourcesPath, "backend", "dist", "main.js"),
    path.join(process.resourcesPath, "app.asar.unpacked", "backend", "dist", "main.js"),
    path.join(process.resourcesPath, "app.asar", "backend", "dist", "main.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Backend entry not found. Checked: ${candidates.join(", ")}`
  );
}

function isBackendProcessAlive(): boolean {
  return !!backendProcess && backendProcess.exitCode === null && !backendProcess.killed;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function runSshCommand(params: {
  host: string;
  user?: string;
  sshPort?: number;
  identityFile?: string;
  remoteCommand: string;
  timeoutMs?: number;
}): {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
} {
  const host = params.host.trim();
  if (!host) {
    return {
      ok: false,
      code: null,
      stdout: "",
      stderr: "",
      error: "Missing remote host.",
    };
  }

  const target = params.user?.trim() ? `${params.user.trim()}@${host}` : host;
  const args: string[] = [];
  if (params.sshPort && Number.isFinite(params.sshPort)) {
    args.push("-p", String(params.sshPort));
  }
  if (params.identityFile?.trim()) {
    args.push("-i", params.identityFile.trim());
  }
  args.push(target, params.remoteCommand);

  const result = spawnSync("ssh", args, {
    encoding: "utf-8",
    timeout: params.timeoutMs ?? 10 * 60 * 1000,
    maxBuffer: 1024 * 1024 * 16,
  });

  return {
    ok: result.status === 0,
    code: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error?.message,
  };
}

function resolveSqlitePath(databaseUrl?: string | null): string | null {
  if (!databaseUrl || typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    return null;
  }
  const rawPath = databaseUrl.slice(5);
  try {
    return path.resolve(decodeURI(rawPath));
  } catch {
    return path.resolve(rawPath);
  }
}

function recordBackendCrash(): { canRestart: boolean; crashCount: number } {
  const now = Date.now();
  backendCrashTimestamps = backendCrashTimestamps.filter(
    (timestamp) => now - timestamp <= BACKEND_CRASH_WINDOW_MS,
  );
  backendCrashTimestamps.push(now);
  return {
    canRestart: backendCrashTimestamps.length <= BACKEND_MAX_AUTO_RESTARTS,
    crashCount: backendCrashTimestamps.length,
  };
}

async function stopBackendProcess(forceAfterMs = 3000): Promise<void> {
  if (!backendProcess) {
    return;
  }

  const proc = backendProcess;
  if (proc.exitCode !== null || proc.killed) {
    if (backendProcess === proc) {
      backendProcess = null;
    }
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finalize = () => {
      if (settled) {
        return;
      }
      settled = true;
      proc.removeListener("exit", onExit);
      resolve();
    };
    const onExit = () => {
      finalize();
    };

    proc.once("exit", onExit);

    try {
      proc.kill("SIGTERM");
    } catch {
      finalize();
      return;
    }

    setTimeout(() => {
      if (proc.exitCode === null) {
        try {
          proc.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      setTimeout(() => finalize(), 500);
    }, forceAfterMs);
  });

  if (backendProcess === proc) {
    backendProcess = null;
  }
}

function resolveBackendRunners(): BackendRunnerCandidate[] {
  const candidates: BackendRunnerCandidate[] = [];
  const add = (candidate: BackendRunnerCandidate) => {
    if (!candidate.command) {
      return;
    }
    if (candidates.some((item) => item.command === candidate.command && item.label === candidate.label)) {
      return;
    }
    candidates.push(candidate);
  };

  if (process.env.TICKET_SYSTEM_NODE_BINARY) {
    add({
      command: process.env.TICKET_SYSTEM_NODE_BINARY,
      label: "custom-node",
    });
  }

  // Most reliable for packaged apps: use Electron binary in Node mode.
  add({
    command: process.execPath,
    envPatch: { ELECTRON_RUN_AS_NODE: "1" },
    label: "electron-as-node",
  });

  // Dev fallback for local workflow.
  if (!isPackaged) {
    add({
      command: "node",
      label: "system-node",
    });
  }

  return candidates;
}

function readTailLines(filePath: string, maxLines = 80): string[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

async function isPortFree(port: number): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve());
      });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a free port on localhost
 */
async function findFreePort(start = 3000, end = 3100): Promise<number> {
  for (let port = start; port <= end; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = net.createServer();
        server.listen(port, "127.0.0.1", () => {
          server.close();
          resolve();
        });
        server.on("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            reject(err);
          }
        });
      });
      return port;
    } catch (_) {
      // Port is in use, try next
    }
  }
  throw new Error("No free ports available");
}

/**
 * Wait for backend to be ready.
 * Packaged apps (especially Windows first start) can need more time for setup/migrations.
 */
async function waitForBackend(
  port: number,
  timeoutMs = Number(
    process.env.TICKET_SYSTEM_BACKEND_START_TIMEOUT_MS ||
      (isPackaged ? "60000" : "15000"),
  ),
): Promise<void> {
  const startedAt = Date.now();
  const pollIntervalMs = 500;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/setup/status`, {
        method: "POST",
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        console.log(`✓ Backend ready on port ${port}`);
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const tail = backendLogFilePath ? readTailLines(backendLogFilePath, 25).join("\n") : "";
  if (tail) {
    throw new Error(`Backend did not start in time (${timeoutMs} ms). Last log lines:\n${tail}`);
  }
  throw new Error(`Backend did not start in time (${timeoutMs} ms).`);
}

async function probeBackendHealth(port: number): Promise<{
  healthy: boolean;
  setupReachable: boolean;
  error?: string;
}> {
  let healthy = false;
  let setupReachable = false;
  let errorMessage = "";

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    });
    healthy = response.ok;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  if (healthy) {
    setupReachable = true;
  } else {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/setup/status`, {
        method: "POST",
        signal: AbortSignal.timeout(2000),
      });
      setupReachable = response.ok;
    } catch (error) {
      if (!errorMessage) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return {
    healthy,
    setupReachable,
    error: errorMessage || undefined,
  };
}

async function getEngineStatus() {
  const probe = await probeBackendHealth(currentBackendPort);
  return {
    running: isBackendProcessAlive(),
    starting: backendStarting,
    port: currentBackendPort,
    pid: backendProcess?.pid ?? null,
    healthy: probe.healthy,
    setupReachable: probe.setupReachable,
    lastError: backendLastError,
    lastExitCode: backendLastExitCode,
    lastExitSignal: backendLastExitSignal,
    lastExitAt: backendLastExitAt,
    lastStartAt: backendLastStartAt,
    runner: backendRunnerLabel,
    logFile: backendLogFilePath,
    checkedAt: new Date().toISOString(),
    probeError: probe.error || null,
  };
}

/**
 * Get local IP address for QR code
 */
function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      // Skip IPv6 and internal addresses
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

function ensureCanonicalUserDataPath(): void {
  const appDataPath = app.getPath("appData");
  const canonicalPath = path.join(appDataPath, "OpenTicket");
  const currentUserDataPath = app.getPath("userData");
  const legacyCandidates = [
    path.join(appDataPath, "openticket-desktop"),
    path.join(appDataPath, "Ticket System"),
    path.join(appDataPath, "TicketSystem"),
  ].filter((candidate) => candidate !== canonicalPath);

  if (!fs.existsSync(canonicalPath)) {
    const legacySource = legacyCandidates.find((candidate) => {
      if (!fs.existsSync(candidate)) {
        return false;
      }
      const configPath = path.join(candidate, "config", "config.json");
      const dbPath = path.join(candidate, "data", "app.db");
      return fs.existsSync(configPath) || fs.existsSync(dbPath);
    });

    if (legacySource) {
      try {
        fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
        fs.cpSync(legacySource, canonicalPath, { recursive: true });
        console.log(`Migrated legacy userData from ${legacySource} to ${canonicalPath}`);
      } catch (error) {
        console.warn(`Failed to migrate legacy userData from ${legacySource}`, error);
      }
    }
  }

  if (currentUserDataPath !== canonicalPath) {
    app.setPath("userData", canonicalPath);
  }
}

function isAutoUpdateSupported(): boolean {
  return isPackaged && (process.platform === "darwin" || process.platform === "win32");
}

function emitUpdateStatus(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("update-status", { ...updateStatus });
}

function setUpdateStatus(patch: Partial<DesktopUpdateStatus>): void {
  Object.assign(updateStatus, patch);
  updateStatus.appVersion = app.getVersion();
  emitUpdateStatus();
}

function readJsonFile<T = any>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function resolveDesktopRuntimePaths(): DesktopRuntimePaths {
  const userDataPath = app.getPath("userData");
  const configDir = path.join(userDataPath, "config");
  const configFile = path.join(configDir, "config.json");
  const config = readJsonFile<{
    dataPath?: string;
    databaseUrl?: string;
    uploadsPath?: string;
  }>(configFile);

  const dataPath =
    config?.dataPath?.trim() ||
    process.env.TICKET_SYSTEM_DATA_DIR?.trim() ||
    path.join(userDataPath, "data");

  const dbFile =
    resolveSqlitePath(config?.databaseUrl) || path.join(path.resolve(dataPath), "app.db");
  const uploadsDir = config?.uploadsPath?.trim()
    ? path.resolve(config.uploadsPath)
    : path.join(path.dirname(dbFile), "uploads");

  return {
    userDataPath,
    configDir,
    configFile,
    dataPath: path.dirname(dbFile),
    dbFile,
    uploadsDir,
    backupsDir: path.join(path.dirname(dbFile), "backups", "updates"),
  };
}

function nowStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function sanitizeReason(reason: string): string {
  return reason.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type GithubReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  size?: number;
};

type GithubLatestRelease = {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  assets?: GithubReleaseAsset[];
};

function normalizeVersion(version: string): string {
  return version.replace(/^v/i, "").trim();
}

function compareSemverLoose(leftRaw: string, rightRaw: string): number {
  const left = normalizeVersion(leftRaw).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = normalizeVersion(rightRaw).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function isMissingUpdateMetadataError(message: string): boolean {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("latest-mac.yml") ||
    normalized.includes("latest.yml") ||
    normalized.includes("cannot find latest") ||
    normalized.includes("404") ||
    normalized.includes("release artifacts")
  );
}

function requestTextWithRedirects(url: string, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "OpenTicketDesktopUpdater",
          Accept: "application/vnd.github+json,application/json",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectCount > 5) {
            reject(new Error("Too many redirects while checking updates."));
            return;
          }
          const nextUrl = location.startsWith("http") ? location : new URL(location, url).toString();
          requestTextWithRedirects(nextUrl, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} while requesting ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("error", reject);
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      },
    );

    request.on("error", reject);
  });
}

function downloadFileWithRedirects(url: string, destinationPath: string, redirectCount = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "OpenTicketDesktopUpdater",
          Accept: "*/*",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectCount > 8) {
            reject(new Error("Too many redirects while downloading update package."));
            return;
          }
          const nextUrl = location.startsWith("http") ? location : new URL(location, url).toString();
          downloadFileWithRedirects(nextUrl, destinationPath, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Download failed with HTTP ${statusCode}`));
          return;
        }

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        const writer = fs.createWriteStream(destinationPath, { flags: "w", mode: 0o644 });
        response.pipe(writer);
        writer.on("finish", () => {
          writer.close();
          resolve();
        });
        writer.on("error", (error) => {
          writer.close();
          fs.rmSync(destinationPath, { force: true });
          reject(error);
        });
        response.on("error", (error) => {
          writer.close();
          fs.rmSync(destinationPath, { force: true });
          reject(error);
        });
      },
    );

    request.on("error", reject);
  });
}

function pickManualInstallerAsset(release: GithubLatestRelease): GithubReleaseAsset | null {
  const assets = release.assets || [];
  if (assets.length === 0) {
    return null;
  }

  const byName = (predicate: (name: string) => boolean) =>
    assets.find((asset) => predicate((asset.name || "").toLowerCase()));

  if (process.platform === "darwin") {
    return (
      byName((name) => name === "openticket-installer.pkg") ||
      byName((name) => name.endsWith(".pkg")) ||
      byName((name) => name.includes("openticket-") && name.endsWith(".zip")) ||
      null
    );
  }

  if (process.platform === "win32") {
    return (
      byName((name) => name === "openticket-installer.exe") ||
      byName((name) => name.includes("setup") && name.endsWith(".exe")) ||
      byName((name) => name.endsWith(".exe")) ||
      null
    );
  }

  return null;
}

async function checkForUpdatesViaGithubFallback(triggerReason?: string): Promise<{
  success: boolean;
  message: string;
  status: DesktopUpdateStatus;
}> {
  try {
    const apiUrl = `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`;
    const raw = await requestTextWithRedirects(apiUrl);
    const release = JSON.parse(raw) as GithubLatestRelease;
    const releaseVersion = normalizeVersion(release.tag_name || "");
    const currentVersion = normalizeVersion(app.getVersion());

    if (!releaseVersion || compareSemverLoose(releaseVersion, currentVersion) <= 0) {
      setUpdateStatus({
        state: "not-available",
        message: "Masz najnowszą wersję aplikacji (fallback GitHub).",
        releaseName: release.name || null,
        releaseVersion: releaseVersion || null,
        releaseDate: release.published_at || null,
        manualMode: false,
        manualDownloadUrl: null,
        manualReleasePageUrl: release.html_url || null,
      });
      return {
        success: true,
        message: "Aktualizacja nie jest wymagana.",
        status: { ...updateStatus },
      };
    }

    const installerAsset = pickManualInstallerAsset(release);
    const manualDownloadUrl = installerAsset?.browser_download_url || null;

    setUpdateStatus({
      state: "available",
      message: triggerReason
        ? `Automatyczne metadane update są niedostępne (${triggerReason}). Wykryto wersję ${releaseVersion} w GitHub Releases.`
        : `Wykryto aktualizację ${releaseVersion} (fallback GitHub Releases).`,
      releaseName: release.name || null,
      releaseVersion,
      releaseDate: release.published_at || null,
      manualMode: true,
      manualDownloadUrl,
      manualReleasePageUrl: release.html_url || null,
      progressPercent: null,
      bytesPerSecond: null,
      downloadedFile: null,
    });

    if (!manualDownloadUrl) {
      return {
        success: false,
        message: "W release nie znaleziono pliku instalatora (.pkg/.exe).",
        status: { ...updateStatus },
      };
    }

    return {
      success: true,
      message: `Znaleziono aktualizację ${releaseVersion}.`,
      status: { ...updateStatus },
    };
  } catch (error: any) {
    const reason = error?.message || String(error);
    setUpdateStatus({
      state: "error",
      message: `Nie udało się pobrać informacji o release z GitHub: ${reason}`,
      manualMode: false,
      manualDownloadUrl: null,
    });
    return {
      success: false,
      message: updateStatus.message,
      status: { ...updateStatus },
    };
  }
}

async function downloadManualUpdatePackage(downloadUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = new URL(downloadUrl);
    const fileNameFromUrl = path.basename(parsed.pathname) || `OpenTicket-update-${app.getVersion()}.pkg`;
    const safeFileName =
      fileNameFromUrl.endsWith(".pkg") || fileNameFromUrl.endsWith(".exe") || fileNameFromUrl.endsWith(".zip")
        ? fileNameFromUrl
        : `OpenTicket-update-${app.getVersion()}.pkg`;
    const targetDir = path.join(app.getPath("downloads"), "OpenTicket-updates");
    const targetPath = path.join(targetDir, safeFileName);

    await downloadFileWithRedirects(downloadUrl, targetPath);
    setUpdateStatus({
      state: "downloaded",
      message: `Pobrano instalator aktualizacji: ${targetPath}`,
      downloadedFile: targetPath,
      progressPercent: 100,
      manualMode: true,
      manualDownloadUrl: downloadUrl,
    });

    return {
      success: true,
      message: "Pobrano pakiet aktualizacji.",
    };
  } catch (error: any) {
    setUpdateStatus({
      state: "error",
      message: `Nie udało się pobrać aktualizacji (fallback): ${error?.message || String(error)}`,
    });
    return {
      success: false,
      message: updateStatus.message,
    };
  }
}

async function createPreUpdateBackup(reason = "manual-update"): Promise<{
  success: boolean;
  message: string;
  backupPath: string | null;
}> {
  const runtime = resolveDesktopRuntimePaths();
  fs.mkdirSync(runtime.backupsDir, { recursive: true });

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "openticket-update-backup-"));
  const safeReason = sanitizeReason(reason || "manual-update");
  const baseName = `openticket-backup-${safeReason}-${nowStamp()}`;
  const archivePath = path.join(runtime.backupsDir, `${baseName}.tar.gz`);
  const copied: string[] = [];

  try {
    const candidates = [
      runtime.dbFile,
      `${runtime.dbFile}-wal`,
      `${runtime.dbFile}-shm`,
      `${runtime.dbFile}-journal`,
    ];
    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) {
        continue;
      }
      const targetName = path.basename(filePath);
      fs.copyFileSync(filePath, path.join(stageDir, targetName));
      copied.push(targetName);
    }

    if (fs.existsSync(runtime.uploadsDir)) {
      fs.cpSync(runtime.uploadsDir, path.join(stageDir, "uploads"), { recursive: true });
      copied.push("uploads/");
    }

    if (fs.existsSync(runtime.configFile)) {
      fs.copyFileSync(runtime.configFile, path.join(stageDir, "config.json"));
      copied.push("config.json");
    }

    const manifest = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      reason: safeReason,
      appVersion: app.getVersion(),
      backendPort: currentBackendPort,
      runtime,
      includes: copied,
    };
    fs.writeFileSync(path.join(stageDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

    const tar = spawnSync("tar", ["-czf", archivePath, "-C", stageDir, "."], {
      encoding: "utf-8",
    });
    if (tar.status === 0) {
      setUpdateStatus({
        lastBackupPath: archivePath,
        message: `Utworzono backup przed aktualizacją: ${archivePath}`,
      });
      return {
        success: true,
        message: "Backup utworzony poprawnie.",
        backupPath: archivePath,
      };
    }

    const fallbackDir = path.join(runtime.backupsDir, `${baseName}-folder`);
    fs.cpSync(stageDir, fallbackDir, { recursive: true });
    setUpdateStatus({
      lastBackupPath: fallbackDir,
      message: `Backup zapisany jako folder (tar niedostępny): ${fallbackDir}`,
    });
    return {
      success: true,
      message: "Backup utworzony jako folder (brak narzędzia tar).",
      backupPath: fallbackDir,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Backup przed aktualizacją nie powiódł się: ${error?.message || String(error)}`,
      backupPath: null,
    };
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

function getUpdateStateFilePath(): string {
  return path.join(app.getPath("userData"), "config", "update-state.json");
}

function readUpdateStateFile(): UpdateStateFile | null {
  return readJsonFile<UpdateStateFile>(getUpdateStateFilePath());
}

function writeUpdateStateFile(payload: UpdateStateFile): void {
  const statePath = getUpdateStateFilePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2), "utf-8");
}

async function ensureUpgradeBackupOnVersionChange(): Promise<void> {
  try {
    const previous = readUpdateStateFile();
    const currentVersion = app.getVersion();

    if (previous?.version && previous.version !== currentVersion) {
      const backup = await createPreUpdateBackup(`pre-upgrade-${previous.version}-to-${currentVersion}`);
      if (backup.success) {
        setUpdateStatus({
          message: `Wykryto nową wersję ${currentVersion}. Utworzono backup: ${backup.backupPath || "-"}`,
        });
      } else {
        setUpdateStatus({
          state: "error",
          message: `Wykryto nową wersję ${currentVersion}, ale backup przed migracją nie powiódł się: ${backup.message}`,
        });
      }
      writeUpdateStateFile({
        version: currentVersion,
        updatedAt: new Date().toISOString(),
        lastBackupPath: backup.backupPath || undefined,
      });
      return;
    }

    writeUpdateStateFile({
      version: currentVersion,
      updatedAt: new Date().toISOString(),
      lastBackupPath: previous?.lastBackupPath,
    });
  } catch (error) {
    console.warn("Failed to write update-state.json", error);
  }
}

function configureAutoUpdater(): void {
  if (!isAutoUpdateSupported()) {
    setUpdateStatus({
      supported: false,
      state: "disabled",
      message: "Auto-update działa tylko w instalatorze macOS/Windows.",
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
    return;
  }

  setUpdateStatus({
    supported: true,
    state: "idle",
    message: "Aktualizacje gotowe. Kliknij „Sprawdź aktualizacje”.",
    manualMode: false,
    manualDownloadUrl: null,
    manualReleasePageUrl: null,
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setUpdateStatus({
      state: "checking",
      message: "Sprawdzanie aktualizacji...",
      lastCheckedAt: new Date().toISOString(),
      progressPercent: null,
      bytesPerSecond: null,
      downloadedFile: null,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
  });

  autoUpdater.on("update-available", (info: any) => {
    setUpdateStatus({
      state: "available",
      message: `Dostępna aktualizacja: ${info?.version || "nowsza wersja"}.`,
      releaseName: info?.releaseName || null,
      releaseVersion: info?.version || null,
      releaseDate: info?.releaseDate || null,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateStatus({
      state: "not-available",
      message: "Masz najnowszą wersję aplikacji.",
      releaseName: null,
      releaseVersion: null,
      releaseDate: null,
      progressPercent: null,
      bytesPerSecond: null,
      downloadedFile: null,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
  });

  autoUpdater.on("download-progress", (progress: any) => {
    setUpdateStatus({
      state: "downloading",
      message: `Pobieranie aktualizacji: ${Math.round(progress?.percent || 0)}%`,
      progressPercent: progress?.percent ?? null,
      bytesPerSecond: progress?.bytesPerSecond ?? null,
    });
  });

  autoUpdater.on("update-downloaded", (info: any) => {
    setUpdateStatus({
      state: "downloaded",
      message: "Aktualizacja pobrana. Możesz ją zainstalować.",
      releaseName: info?.releaseName || updateStatus.releaseName,
      releaseVersion: info?.version || updateStatus.releaseVersion,
      releaseDate: info?.releaseDate || updateStatus.releaseDate,
      downloadedFile: info?.downloadedFile || null,
      progressPercent: 100,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
  });

  autoUpdater.on("error", (error: Error) => {
    const reason = error?.message || "unknown";
    if (isMissingUpdateMetadataError(reason)) {
      void checkForUpdatesViaGithubFallback(reason);
      return;
    }
    setUpdateStatus({
      state: "error",
      message: `Błąd auto-update: ${reason}`,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
  });
}

async function checkForUpdates(): Promise<{ success: boolean; message: string; status: DesktopUpdateStatus }> {
  if (!isAutoUpdateSupported()) {
    return {
      success: false,
      message: "Auto-update działa tylko w buildzie instalatora.",
      status: { ...updateStatus },
    };
  }

  try {
    await autoUpdater.checkForUpdates();
    return {
      success: true,
      message: "Sprawdzenie aktualizacji uruchomione.",
      status: { ...updateStatus },
    };
  } catch (error: any) {
    const reason = error?.message || String(error);
    if (isMissingUpdateMetadataError(reason)) {
      return checkForUpdatesViaGithubFallback(reason);
    }
    setUpdateStatus({
      state: "error",
      message: `Nie udało się sprawdzić aktualizacji: ${reason}`,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
    return {
      success: false,
      message: updateStatus.message,
      status: { ...updateStatus },
    };
  }
}

async function downloadUpdatePackage(): Promise<{
  success: boolean;
  message: string;
  status: DesktopUpdateStatus;
}> {
  if (!isAutoUpdateSupported()) {
    return {
      success: false,
      message: "Auto-update działa tylko w buildzie instalatora.",
      status: { ...updateStatus },
    };
  }

  if (updateStatus.manualMode && updateStatus.manualDownloadUrl) {
    const manual = await downloadManualUpdatePackage(updateStatus.manualDownloadUrl);
    return {
      success: manual.success,
      message: manual.message,
      status: { ...updateStatus },
    };
  }

  if (updateStatus.manualMode && !updateStatus.manualDownloadUrl) {
    return {
      success: false,
      message:
        updateStatus.manualReleasePageUrl
          ? `W release nie ma bezpośredniego assetu instalatora. Otwórz release: ${updateStatus.manualReleasePageUrl}`
          : "W release nie znaleziono pliku instalatora.",
      status: { ...updateStatus },
    };
  }

  try {
    await autoUpdater.downloadUpdate();
    return {
      success: true,
      message: "Pobieranie aktualizacji uruchomione.",
      status: { ...updateStatus },
    };
  } catch (error: any) {
    setUpdateStatus({
      state: "error",
      message: `Nie udało się pobrać aktualizacji: ${error?.message || String(error)}`,
      manualMode: false,
      manualDownloadUrl: null,
      manualReleasePageUrl: null,
    });
    return {
      success: false,
      message: updateStatus.message,
      status: { ...updateStatus },
    };
  }
}

async function installDownloadedUpdate(): Promise<{
  success: boolean;
  message: string;
  status: DesktopUpdateStatus;
}> {
  if (!isAutoUpdateSupported()) {
    return {
      success: false,
      message: "Auto-update działa tylko w buildzie instalatora.",
      status: { ...updateStatus },
    };
  }

  if (updateStatus.manualMode) {
    if (updateStatus.downloadedFile && fs.existsSync(updateStatus.downloadedFile)) {
      const openResult = await shell.openPath(updateStatus.downloadedFile);
      if (openResult !== "") {
        return {
          success: false,
          message: `Nie udało się uruchomić instalatora aktualizacji: ${openResult}`,
          status: { ...updateStatus },
        };
      }
      return {
        success: true,
        message: "Uruchomiono instalator aktualizacji. Po instalacji uruchom ponownie OpenTicket.",
        status: { ...updateStatus },
      };
    }

    if (updateStatus.manualDownloadUrl) {
      const openResult = await shell.openExternal(updateStatus.manualDownloadUrl).then(
        () => "",
        (error: any) => error?.message || String(error),
      );
      if (openResult !== "") {
        return {
          success: false,
          message: `Nie udało się otworzyć linku do aktualizacji: ${openResult}`,
          status: { ...updateStatus },
        };
      }
      return {
        success: true,
        message: "Otwarto link do ręcznej aktualizacji.",
        status: { ...updateStatus },
      };
    }
  }

  if (updateStatus.state !== "downloaded") {
    return {
      success: false,
      message: "Najpierw pobierz aktualizację.",
      status: { ...updateStatus },
    };
  }

  setUpdateStatus({
    state: "idle",
    message: "Instalowanie aktualizacji i restart aplikacji...",
  });
  stopBackendHealthMonitor();
  await stopBackendProcess();

  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 250);

  return {
    success: true,
    message: "Instalacja aktualizacji uruchomiona.",
    status: { ...updateStatus },
  };
}

/**
 * Remove stale config only when configured sqlite database is truly unavailable.
 * Works with default and custom data locations.
 */
function cleanOldConfig(configPath: string): void {
  if (!fs.existsSync(configPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(raw) as {
      setupMode?: boolean;
      installationMode?: "server_client" | "client_only";
      dataPath?: string;
      databaseUrl?: string;
    };

    if (cfg.setupMode || cfg.installationMode === "client_only") {
      return;
    }

    const sqlitePathFromUrl = resolveSqlitePath(cfg.databaseUrl);
    const fallbackDbPath = path.join(path.resolve(cfg.dataPath || app.getPath("userData")), "app.db");
    const dbPath = sqlitePathFromUrl || fallbackDbPath;

    if (fs.existsSync(dbPath)) {
      return;
    }

    fs.rmSync(configPath, { force: true });
    console.log(`Removed stale config. Missing configured database: ${dbPath}`);
  } catch (err) {
    console.error(`Failed to validate stale config ${configPath}:`, err);
  }
}

/**
 * Spawn backend NestJS process
 */
async function spawnBackend(port: number): Promise<void> {
  backendStarting = true;
  backendLastError = null;
  const backendPath = resolveBackendEntry();
  const runtimePaths = resolveDesktopRuntimePaths();
  const userDataPath = runtimePaths.userDataPath;
  const dataPath = runtimePaths.dataPath;
  const configPath = runtimePaths.configDir;
  const logsPath = path.join(userDataPath, "logs");

  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  const env: Record<string, string> = {
    ...process.env,
    DATABASE_URL: toSqliteDatabaseUrl(runtimePaths.dbFile),
    TICKET_SYSTEM_CONFIG_DIR: configPath,
    TICKET_SYSTEM_DATA_DIR: dataPath,
    TICKET_SYSTEM_FORCE_SQLITE_FALLBACK:
      process.env.TICKET_SYSTEM_FORCE_SQLITE_FALLBACK || (isPackaged ? "1" : "0"),
    TICKET_SYSTEM_AUTO_MIGRATE:
      process.env.TICKET_SYSTEM_AUTO_MIGRATE || (isPackaged ? "1" : "0"),
    PORT: port.toString(),
    BIND_HOST: "127.0.0.1",
    NODE_ENV: isPackaged ? "production" : "development",
  };

  const backendLogFile = path.join(logsPath, "backend-child.log");
  backendLogFilePath = backendLogFile;
  const stream = fs.createWriteStream(backendLogFile, { flags: "a" });
  const candidates = resolveBackendRunners();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    const envForCandidate = {
      ...env,
      ...(candidate.envPatch || {}),
    };

    console.log(
      `Spawning backend via ${candidate.label} (${candidate.command}) at ${backendPath} on port ${port}...`,
    );

    const child = spawn(candidate.command, [backendPath], {
      env: envForCandidate,
      cwd: path.dirname(backendPath),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    child.stdout?.pipe(stream, { end: false });
    child.stderr?.pipe(stream, { end: false });

    if (!isPackaged) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const onSpawn = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        const onError = (error: Error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        };

        child.once("spawn", onSpawn);
        child.once("error", onError);

        setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, 250);
      });
    } catch (error) {
      lastError = error as Error;
      console.error(`Backend spawn failed via ${candidate.label}:`, lastError.message);
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      continue;
    }

    backendProcess = child;
    backendRunnerLabel = candidate.label;
    currentBackendPort = port;

    backendProcess.on("error", (err: Error) => {
      console.error("Backend process error:", err);
      backendLastError = err.message;
      dialog.showErrorBox(
        "Backend Error",
        `Failed to start backend: ${err.message}`,
      );
    });

    backendProcess.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      backendLastExitCode = code ?? null;
      backendLastExitSignal = signal ?? null;
      backendLastExitAt = new Date().toISOString();
      const shouldRecover = !appQuitting && !backendStarting;
      if (backendProcess === child) {
        backendProcess = null;
      }
      console.log(`Backend process exited with code=${code ?? "null"} signal=${signal ?? "null"}`);
      if (mainWindow) {
        mainWindow.webContents.send("backend-crashed");
      }
      if (shouldRecover) {
        void autoRecoverBackend("watchdog-exit");
      }
    });

    try {
      await waitForBackend(port);
      backendLastStartAt = new Date().toISOString();
      backendCrashTimestamps = [];
      backendStarting = false;
      return;
    } catch (error) {
      lastError = error as Error;
      backendLastError = lastError.message;
      console.error(`Backend health check failed via ${candidate.label}:`, lastError.message);
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      backendProcess = null;
    }
  }

  backendStarting = false;
  backendLastError = lastError?.message || "unknown error";
  throw new Error(
    `Failed to start backend with available runners: ${
      lastError?.message || "unknown error"
    }`,
  );
}

async function reloadWindowForPortIfNeeded(port: number): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const expectedPrefix = `http://127.0.0.1:${port}`;
  const currentUrl = mainWindow.webContents.getURL();
  if (!currentUrl.startsWith(expectedPrefix)) {
    await mainWindow.loadURL(expectedPrefix);
  } else {
    mainWindow.webContents.reloadIgnoringCache();
  }
}

async function restartBackendFromDesktop(reason = "manual-restart"): Promise<{
  success: boolean;
  message: string;
  status: Awaited<ReturnType<typeof getEngineStatus>>;
}> {
  backendLastError = null;
  await stopBackendProcess();

  let targetPort = currentBackendPort;
  if (!(await isPortFree(targetPort))) {
    targetPort = await findFreePort();
  }

  try {
    await spawnBackend(targetPort);
    currentBackendPort = targetPort;
    await reloadWindowForPortIfNeeded(targetPort);
    const status = await getEngineStatus();
    return {
      success: true,
      message: `Silnik uruchomiony ponownie (${reason}).`,
      status,
    };
  } catch (error) {
    backendLastError = error instanceof Error ? error.message : String(error);
    const status = await getEngineStatus();
    return {
      success: false,
      message: `Restart silnika nie powiódł się: ${backendLastError}`,
      status,
    };
  }
}

async function autoRecoverBackend(reason = "watchdog"): Promise<void> {
  if (appQuitting || backendAutoRestartInFlight) {
    return;
  }

  const crash = recordBackendCrash();
  if (!crash.canRestart) {
    backendLastError = `Silnik zatrzymał się ${crash.crashCount} razy w krótkim czasie. Wykonaj reset systemu z ekranu logowania.`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-watchdog", {
        success: false,
        message: backendLastError,
      });
    }
    return;
  }

  backendAutoRestartInFlight = true;
  try {
    await wait(1200);
    const result = await restartBackendFromDesktop(reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-watchdog", result);
    }
  } catch (error) {
    backendLastError = error instanceof Error ? error.message : String(error);
  } finally {
    backendAutoRestartInFlight = false;
  }
}

function stopBackendHealthMonitor(): void {
  if (backendHealthMonitor) {
    clearInterval(backendHealthMonitor);
    backendHealthMonitor = null;
  }
  backendProbeInFlight = false;
  backendConsecutiveProbeFailures = 0;
}

function startBackendHealthMonitor(): void {
  stopBackendHealthMonitor();

  backendHealthMonitor = setInterval(() => {
    void (async () => {
      if (
        appQuitting ||
        backendStarting ||
        backendAutoRestartInFlight ||
        backendProbeInFlight ||
        !isBackendProcessAlive()
      ) {
        return;
      }

      backendProbeInFlight = true;
      try {
        const probe = await probeBackendHealth(currentBackendPort);
        if (probe.healthy && probe.setupReachable) {
          backendConsecutiveProbeFailures = 0;
          return;
        }

        backendConsecutiveProbeFailures += 1;
        backendLastError = probe.error || "Healthcheck failed";

        if (backendConsecutiveProbeFailures >= BACKEND_MONITOR_FAIL_THRESHOLD) {
          backendConsecutiveProbeFailures = 0;
          await autoRecoverBackend("watchdog-health");
        }
      } catch (error) {
        backendConsecutiveProbeFailures += 1;
        backendLastError = error instanceof Error ? error.message : String(error);
        if (backendConsecutiveProbeFailures >= BACKEND_MONITOR_FAIL_THRESHOLD) {
          backendConsecutiveProbeFailures = 0;
          await autoRecoverBackend("watchdog-health");
        }
      } finally {
        backendProbeInFlight = false;
      }
    })();
  }, BACKEND_MONITOR_INTERVAL_MS);
}

async function performFactoryReset(): Promise<{
  success: boolean;
  message: string;
  status: Awaited<ReturnType<typeof getEngineStatus>>;
}> {
  await stopBackendProcess();

  const userDataPath = app.getPath("userData");
  const configDir = path.join(userDataPath, "config");
  const configFile = path.join(configDir, "config.json");
  const dataCandidates = new Set<string>([path.join(userDataPath, "data")]);

  try {
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, "utf-8");
      const parsed = JSON.parse(raw) as { dataPath?: string; databaseUrl?: string };
      if (parsed.dataPath && parsed.dataPath.trim().length > 0) {
        dataCandidates.add(path.resolve(parsed.dataPath));
      }
      const sqlitePath = resolveSqlitePath(parsed.databaseUrl);
      if (sqlitePath) {
        dataCandidates.add(path.dirname(sqlitePath));
      }
    }
  } catch (error) {
    console.warn("Factory reset: failed to parse config.json", error);
  }

  const deleteTargets: string[] = [];
  for (const dataDir of dataCandidates) {
    const normalized = path.resolve(dataDir);
    deleteTargets.push(
      path.join(normalized, "app.db"),
      path.join(normalized, "app.db-wal"),
      path.join(normalized, "app.db-shm"),
      path.join(normalized, "app.db-journal"),
      path.join(normalized, "uploads"),
      path.join(normalized, "backups"),
      path.join(normalized, "backup"),
      path.join(normalized, "cache"),
    );
  }
  deleteTargets.push(configFile);

  for (const target of deleteTargets) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Factory reset: failed to remove ${target}`, error);
    }
  }

  backendCrashTimestamps = [];

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      await mainWindow.webContents.executeJavaScript(
        "try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}",
      );
    } catch {
      // ignore
    }
  }

  let targetPort = currentBackendPort;
  if (!(await isPortFree(targetPort))) {
    targetPort = await findFreePort();
  }

  try {
    await spawnBackend(targetPort);
    currentBackendPort = targetPort;
    await reloadWindowForPortIfNeeded(targetPort);
    const status = await getEngineStatus();
    return {
      success: true,
      message: "Reset zakończony. Konfiguracja i baza zostały wyczyszczone, uruchom setup od nowa.",
      status,
    };
  } catch (error) {
    backendLastError = error instanceof Error ? error.message : String(error);
    const status = await getEngineStatus();
    return {
      success: false,
      message: `Reset wykonano częściowo, ale restart silnika nie powiódł się: ${backendLastError}`,
      status,
    };
  }
}

async function writeEngineDiagnosisReport(): Promise<{
  success: boolean;
  message: string;
  reportPath: string;
}> {
  const logsPath = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logsPath, { recursive: true });

  const reportPath = path.join(
    logsPath,
    `diagnose-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );

  const status = await getEngineStatus();
  const backendLogTail = backendLogFilePath ? readTailLines(backendLogFilePath, 140) : [];

  const payload = {
    generatedAt: new Date().toISOString(),
    status,
    backendLogFilePath,
    backendLogTail,
    userDataPath: app.getPath("userData"),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    appVersion: app.getVersion(),
  };

  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), "utf-8");

  return {
    success: true,
    message: "Raport diagnostyczny zapisany.",
    reportPath,
  };
}

async function requestDesktopPermissions(): Promise<{
  success: boolean;
  message: string;
  details: Record<string, string>;
}> {
  if (process.platform !== "darwin") {
    return {
      success: true,
      message: "Asystent uprawnień działa tylko na macOS.",
      details: { platform: process.platform },
    };
  }

  const details: Record<string, string> = {};
  details.filesAndFolders = "manual-check-required";
  try {
    const cameraStatusBefore = systemPreferences.getMediaAccessStatus("camera");
    const camera = cameraStatusBefore === "granted" ? true : await systemPreferences.askForMediaAccess("camera");
    details.camera = camera ? "granted" : `denied (${cameraStatusBefore})`;
  } catch (error: any) {
    details.camera = `error:${error?.message || "unknown"}`;
  }

  try {
    const micStatusBefore = systemPreferences.getMediaAccessStatus("microphone");
    const microphone = micStatusBefore === "granted" ? true : await systemPreferences.askForMediaAccess("microphone");
    details.microphone = microphone ? "granted" : `denied (${micStatusBefore})`;
  } catch (error: any) {
    details.microphone = `error:${error?.message || "unknown"}`;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      const notificationPermission = await mainWindow.webContents.executeJavaScript(
        "typeof Notification !== 'undefined' && Notification.requestPermission ? Notification.requestPermission() : 'unsupported'",
      );
      details.notifications = String(notificationPermission || "unknown");
    } catch (error: any) {
      details.notifications = `error:${error?.message || "unknown"}`;
    }
  } else {
    details.notifications = "window-unavailable";
  }

  const denied = Object.entries(details)
    .filter(([key, status]) => (key === "filesAndFolders" ? false : /denied|error/.test(status)))
    .map(([key]) => key);

  return {
    success: denied.length === 0,
    message:
      denied.length === 0
        ? "Zgody macOS są poprawne. Dla folderów spoza katalogu użytkownika może być wymagana ręczna zgoda w Ustawieniach systemowych."
        : `Wymagana ręczna akceptacja zgód: ${denied.join(", ")}. Otwórz Ustawienia systemowe -> Prywatność i bezpieczeństwo.`,
    details,
  };
}

async function openSystemSettings(
  section?: "privacy" | "notifications" | "camera" | "microphone",
): Promise<{ success: boolean; message: string; target?: string }> {
  if (process.platform !== "darwin") {
    return {
      success: false,
      message: "Ta akcja działa tylko na macOS.",
    };
  }

  const targetMap: Record<string, string> = {
    privacy: "x-apple.systempreferences:com.apple.preference.security",
    notifications: "x-apple.systempreferences:com.apple.preference.notifications",
    camera: "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera",
    microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  };

  const target = targetMap[section || "privacy"] || targetMap.privacy;
  try {
    await shell.openExternal(target);
    return {
      success: true,
      message: "Otwarto Ustawienia systemowe.",
      target,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Nie udało się otworzyć Ustawień systemowych.",
      target,
    };
  }
}

/**
 * Create or show main window
 */
async function createWindow(port: number): Promise<void> {
  const preloadPath = path.join(__dirname, "preload.js");
  const localOrigin = `http://127.0.0.1:${port}`;
  const isAllowedAppUrl = (rawUrl: string): boolean => {
    return rawUrl.startsWith(localOrigin);
  };

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const startPath = forceSetupAssistant ? "/setup?source=installer" : "/";
  const startUrl = `http://127.0.0.1:${port}${startPath}`;

  console.log(`Loading ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // Electron security hardening: block unexpected navigation/popups.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      return { action: "allow" };
    }
    void shell.openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url).catch(() => undefined);
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestOrigin = (() => {
      try {
        return new URL(details.requestingUrl).origin;
      } catch {
        return "";
      }
    })();
    const fromAppOrigin = requestOrigin === localOrigin;
    if (!fromAppOrigin) {
      callback(false);
      return;
    }
    const allowed = permission === "notifications";
    callback(allowed);
  });

  if (isUiDevMode) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * App event handlers
 */
app.on("ready", async () => {
  try {
    ensureCanonicalUserDataPath();
    configureAutoUpdater();
    const userDataPath = app.getPath("userData");
    const configFilePath = path.join(userDataPath, "config", "config.json");
    const allowStaleConfigCleanup = process.env.TICKET_SYSTEM_ENABLE_STALE_CONFIG_CLEANUP === "1";
    if (allowStaleConfigCleanup) {
      cleanOldConfig(configFilePath);
    } else {
      console.log("Stale config auto-cleanup disabled (safe mode).");
    }
    await ensureUpgradeBackupOnVersionChange();

    // Find free port and start backend
    const port = await findFreePort();
    currentBackendPort = port;
    await spawnBackend(port);
    startBackendHealthMonitor();

    // Create window
    await createWindow(port);
    emitUpdateStatus();
    const permissionsMarkerPath = path.join(userDataPath, "config", "permissions-assistant-v1.json");
    const shouldRunPermissionsAssistant = forcePermissionsAssistant || !fs.existsSync(permissionsMarkerPath);
    if (shouldRunPermissionsAssistant) {
      setTimeout(() => {
        void requestDesktopPermissions().then((result) => {
          try {
            fs.mkdirSync(path.dirname(permissionsMarkerPath), { recursive: true });
            fs.writeFileSync(
              permissionsMarkerPath,
              JSON.stringify(
                {
                  executedAt: new Date().toISOString(),
                  forced: forcePermissionsAssistant,
                  success: result.success,
                  details: result.details,
                },
                null,
                2,
              ),
              "utf-8",
            );
          } catch {
            // ignore marker write failures
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("permissions-assistant-result", result);
          }
        });
      }, 1200);
    }

    // IPC handlers
    ipcMain.handle("select-folder", async () => {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openDirectory", "createDirectory"],
        title: "Select Data Storage Location",
        buttonLabel: "Select",
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    });

    ipcMain.handle("select-file", async (_event, payload?: { kind?: "database" | "backup" }) => {
      const kind = payload?.kind === "backup" ? "backup" : "database";
      const filters =
        kind === "backup"
          ? [{ name: "Backup archives", extensions: ["otbackup", "tar", "tgz", "gz"] }]
          : [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }];

      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        title: kind === "backup" ? "Select Backup Archive" : "Select Existing Database",
        buttonLabel: "Select",
        filters,
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    });

    ipcMain.handle("setup-validate-path", async (_event, payload?: SetupValidatePathPayload) => {
      return proxySetupValidatePath(payload);
    });

    ipcMain.handle("get-local-ip", () => {
      return getLocalIp();
    });

    ipcMain.handle("get-app-path", () => {
      return app.getPath("userData");
    });

    ipcMain.handle("reset-setup", async () => {
      const configPath = path.join(app.getPath("userData"), "config", "config.json");

      const fs = require("fs");
      if (fs.existsSync(configPath)) {
        try {
          fs.unlinkSync(configPath);
          console.log(`Setup reset - config deleted: ${configPath}`);
          return { success: true, message: "Setup reset. Please restart the application." };
        } catch (err: any) {
          return { success: false, message: `Failed to reset: ${err.message}` };
        }
      }
      return { success: true, message: "Setup already reset." };
    });

    ipcMain.handle("factory-reset", async () => {
      return performFactoryReset();
    });

    ipcMain.handle("engine-status", async () => {
      return getEngineStatus();
    });

    ipcMain.handle("engine-restart", async () => {
      return restartBackendFromDesktop("manual");
    });

    ipcMain.handle("engine-quick-repair", async () => {
      const restarted = await restartBackendFromDesktop("quick-repair");
      if (!restarted.success) {
        return restarted;
      }

      await wait(500);
      const status = await getEngineStatus();
      if (status.healthy && status.setupReachable) {
        return {
          success: true,
          message: "Szybka naprawa zakończona powodzeniem.",
          status,
        };
      }

      return {
        success: false,
        message:
          "Silnik został zrestartowany, ale healthcheck nadal zgłasza problem. Otwórz logi i wyślij raport diagnostyczny.",
        status,
      };
    });

    ipcMain.handle("open-logs-folder", async () => {
      const logsPath = path.join(app.getPath("userData"), "logs");
      fs.mkdirSync(logsPath, { recursive: true });
      const result = await shell.openPath(logsPath);
      return {
        success: result === "",
        message: result === "" ? "Otwarto folder logów." : result,
        path: logsPath,
      };
    });

    ipcMain.handle("open-external-url", async (_event, payload: { url?: string }) => {
      const raw = (payload?.url || "").trim();
      if (!raw) {
        return { success: false, message: "Brak adresu URL." };
      }

      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return { success: false, message: "Niepoprawny adres URL." };
      }

      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { success: false, message: "Dozwolone są tylko adresy http/https." };
      }

      try {
        await shell.openExternal(parsed.toString());
      } catch (error: any) {
        return {
          success: false,
          message: error?.message || "Nie udało się otworzyć adresu.",
        };
      }
      return { success: true, message: `Otwarto: ${parsed.toString()}` };
    });

    ipcMain.handle(
      "remote-deploy-ssh",
      async (
        _event,
        payload: {
          host?: string;
          user?: string;
          sshPort?: number;
          identityFile?: string;
          profile?: "linux_docker" | "linux_native" | "synology_docker";
          remoteRepoPath?: string;
          apiPort?: number;
          withTls?: boolean;
          domain?: string;
        },
      ) => {
        const host = (payload?.host || "").trim();
        if (!host) {
          return { success: false, message: "Podaj host SSH." };
        }

        const profile = payload?.profile || "linux_docker";
        const remoteRepoPath = (payload?.remoteRepoPath || "~/OpenTicket-clean").trim();
        const apiPort = Number(payload?.apiPort || 3200);
        const withTls = Boolean(payload?.withTls);
        const domain = (payload?.domain || "").trim();

        let remoteCommand = "";
        if (profile === "linux_native") {
          remoteCommand = `cd ${shellEscape(remoteRepoPath)} && sudo ./deploy/native/install.sh --port ${apiPort}`;
        } else {
          const tlsFlags = withTls && domain ? ` --with-tls --domain ${shellEscape(domain)}` : "";
          remoteCommand = `cd ${shellEscape(remoteRepoPath)} && ./deploy/docker/install.sh --port ${apiPort}${tlsFlags}`;
        }

        const execution = runSshCommand({
          host,
          user: payload?.user,
          sshPort: payload?.sshPort,
          identityFile: payload?.identityFile,
          remoteCommand: remoteCommand,
          timeoutMs: 30 * 60 * 1000,
        });

        return {
          success: execution.ok,
          message: execution.ok ? "Wdrożenie zdalne zakończone." : "Wdrożenie zdalne nie powiodło się.",
          code: execution.code,
          stdout: execution.stdout,
          stderr: execution.stderr,
          error: execution.error || null,
        };
      },
    );

    ipcMain.handle(
      "remote-create-setup-token-ssh",
      async (
        _event,
        payload: {
          host?: string;
          user?: string;
          sshPort?: number;
          identityFile?: string;
          apiPort?: number;
          ttlMinutes?: number;
          maxAttempts?: number;
        },
      ) => {
        const host = (payload?.host || "").trim();
        if (!host) {
          return { success: false, message: "Podaj host SSH." };
        }
        const apiPort = Number(payload?.apiPort || 3200);
        const ttlMinutes = Number(payload?.ttlMinutes || 15);
        const maxAttempts = Number(payload?.maxAttempts || 5);
        const body = JSON.stringify({
          ttlMinutes: Math.max(5, Math.min(120, Math.floor(ttlMinutes))),
          maxAttempts: Math.max(1, Math.min(20, Math.floor(maxAttempts))),
        });
        const remoteCommand = `curl -fsS -X POST http://127.0.0.1:${apiPort}/api/v1/setup/token/create -H 'content-type: application/json' -d ${shellEscape(
          body,
        )}`;

        const execution = runSshCommand({
          host,
          user: payload?.user,
          sshPort: payload?.sshPort,
          identityFile: payload?.identityFile,
          remoteCommand,
        });

        if (!execution.ok) {
          return {
            success: false,
            message: "Nie udało się wygenerować tokenu setup przez SSH.",
            code: execution.code,
            stdout: execution.stdout,
            stderr: execution.stderr,
            error: execution.error || null,
          };
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(execution.stdout);
        } catch {
          parsed = null;
        }

        const data = parsed?.data || parsed || {};
        return {
          success: Boolean(data?.success ?? true),
          message: data?.message || "Token setup wygenerowany.",
          token: data?.token || null,
          expiresAt: data?.expiresAt || null,
          raw: execution.stdout,
        };
      },
    );

    ipcMain.handle("engine-diagnose", async () => {
      return writeEngineDiagnosisReport();
    });

    ipcMain.handle("request-desktop-permissions", async () => {
      return requestDesktopPermissions();
    });

    ipcMain.handle(
      "open-system-settings",
      async (_event, payload?: { section?: "privacy" | "notifications" | "camera" | "microphone" }) => {
        return openSystemSettings(payload?.section);
      },
    );

    ipcMain.handle("update-get-status", async () => {
      return { ...updateStatus };
    });

    ipcMain.handle("update-check", async () => {
      return checkForUpdates();
    });

    ipcMain.handle("update-download", async () => {
      return downloadUpdatePackage();
    });

    ipcMain.handle("update-install", async () => {
      return installDownloadedUpdate();
    });

    ipcMain.handle("update-create-backup", async (_event, payload: { reason?: string }) => {
      return createPreUpdateBackup(payload?.reason || "manual-before-update");
    });

    ipcMain.handle("open-backups-folder", async () => {
      const runtime = resolveDesktopRuntimePaths();
      fs.mkdirSync(runtime.backupsDir, { recursive: true });
      const result = await shell.openPath(runtime.backupsDir);
      return {
        success: result === "",
        message: result === "" ? "Otwarto folder backupów." : result,
        path: runtime.backupsDir,
      };
    });
  } catch (error) {
    console.error("Failed to initialize app:", error);
    dialog.showErrorBox(
      "Startup Error",
      `Failed to start application: ${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    appQuitting = true;
    stopBackendHealthMonitor();
    // Kill backend process on Windows/Linux
    void stopBackendProcess();
    app.quit();
  }
});

app.on("before-quit", () => {
  appQuitting = true;
  stopBackendHealthMonitor();
  void stopBackendProcess();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow(currentBackendPort);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  if (mainWindow) {
    dialog.showErrorBox("Error", error.message);
  }
});
