import electron from "electron";
import path from "path";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import * as os from "os";
import * as net from "net";
import * as fs from "fs";
import { autoUpdater } from "electron-updater";

const { app, BrowserWindow, dialog, ipcMain, shell } = electron;

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
};

type BackendRunnerCandidate = {
  command: string;
  envPatch?: Record<string, string>;
  label: string;
};

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
 * Wait for backend to be ready
 */
async function waitForBackend(port: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/setup/status`, {
        method: "POST",
      });
      if (response.ok) {
        console.log(`✓ Backend ready on port ${port}`);
        return;
      }
    } catch (_) {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Backend did not start in time");
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
    process.env.TICKET_SYSTEM_DATA_DIR?.trim() ||
    config?.dataPath?.trim() ||
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
    });
    return;
  }

  setUpdateStatus({
    supported: true,
    state: "idle",
    message: "Aktualizacje gotowe. Kliknij „Sprawdź aktualizacje”.",
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
    });
  });

  autoUpdater.on("update-available", (info: any) => {
    setUpdateStatus({
      state: "available",
      message: `Dostępna aktualizacja: ${info?.version || "nowsza wersja"}.`,
      releaseName: info?.releaseName || null,
      releaseVersion: info?.version || null,
      releaseDate: info?.releaseDate || null,
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
    });
  });

  autoUpdater.on("error", (error: Error) => {
    setUpdateStatus({
      state: "error",
      message: `Błąd auto-update: ${error.message}`,
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
    setUpdateStatus({
      state: "error",
      message: `Nie udało się sprawdzić aktualizacji: ${error?.message || String(error)}`,
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
  const userDataPath = app.getPath("userData");
  const dataPath = path.join(userDataPath, "data");
  const configPath = path.join(userDataPath, "config");
  const logsPath = path.join(userDataPath, "logs");

  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }

  const env: Record<string, string> = {
    ...process.env,
    DATABASE_URL: toSqliteDatabaseUrl(path.join(dataPath, "app.db")),
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

/**
 * Create or show main window
 */
async function createWindow(port: number): Promise<void> {
  const preloadPath = path.join(__dirname, "preload.js");

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

  const startUrl = `http://127.0.0.1:${port}`;

  console.log(`Loading ${startUrl}`);
  mainWindow.loadURL(startUrl);

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
    configureAutoUpdater();
    const userDataPath = app.getPath("userData");
    const configFilePath = path.join(userDataPath, "config", "config.json");

    // Clean old configuration to ensure setup wizard on first run
    cleanOldConfig(configFilePath);
    await ensureUpgradeBackupOnVersionChange();

    // Find free port and start backend
    const port = await findFreePort();
    currentBackendPort = port;
    await spawnBackend(port);
    startBackendHealthMonitor();

    // Create window
    await createWindow(port);
    emitUpdateStatus();

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

    ipcMain.handle("engine-diagnose", async () => {
      return writeEngineDiagnosisReport();
    });

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
