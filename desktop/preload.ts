import { contextBridge, ipcRenderer } from "electron";

// Expose safe IPC methods to renderer process
const api = {
  // File system methods
  selectFolder: async (): Promise<string | null> => {
    return ipcRenderer.invoke("select-folder");
  },

  selectFile: async (kind: "database" | "backup"): Promise<string | null> => {
    return ipcRenderer.invoke("select-file", { kind });
  },

  setupValidatePath: async (payload: {
    dataPath: string;
    apiBaseUrl?: string;
    setupSessionToken?: string;
  }): Promise<{
    ok: boolean;
    requestedPath: string;
    resolvedPath: string;
    createdDirectory: boolean;
    writable: boolean;
    warning?: string;
    error?: string;
  }> => {
    return ipcRenderer.invoke("setup-validate-path", payload);
  },

  // Network methods
  getLocalIp: async (): Promise<string> => {
    return ipcRenderer.invoke("get-local-ip");
  },

  // App methods
  getAppPath: async (): Promise<string> => {
    return ipcRenderer.invoke("get-app-path");
  },

  // Reset setup
  resetSetup: async (): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("reset-setup");
  },

  factoryReset: async (): Promise<{
    success: boolean;
    message: string;
    status: any;
  }> => {
    return ipcRenderer.invoke("factory-reset");
  },

  getEngineStatus: async (): Promise<{
    running: boolean;
    starting: boolean;
    port: number;
    pid: number | null;
    healthy: boolean;
    setupReachable: boolean;
    lastError: string | null;
    lastExitCode: number | null;
    lastExitSignal: string | null;
    lastExitAt: string | null;
    lastStartAt: string | null;
    runner: string | null;
    logFile: string | null;
    checkedAt: string;
    probeError: string | null;
  }> => {
    return ipcRenderer.invoke("engine-status");
  },

  restartEngine: async (): Promise<{
    success: boolean;
    message: string;
    status: any;
  }> => {
    return ipcRenderer.invoke("engine-restart");
  },

  quickRepairEngine: async (): Promise<{
    success: boolean;
    message: string;
    status: any;
  }> => {
    return ipcRenderer.invoke("engine-quick-repair");
  },

  openLogsFolder: async (): Promise<{ success: boolean; message: string; path: string }> => {
    return ipcRenderer.invoke("open-logs-folder");
  },

  createEngineDiagnostics: async (): Promise<{
    success: boolean;
    message: string;
    reportPath: string;
  }> => {
    return ipcRenderer.invoke("engine-diagnose");
  },

  requestDesktopPermissions: async (): Promise<{
    success: boolean;
    message: string;
    details: Record<string, string>;
  }> => {
    return ipcRenderer.invoke("request-desktop-permissions");
  },

  openSystemSettings: async (
    section?: "privacy" | "notifications" | "camera" | "microphone",
  ): Promise<{ success: boolean; message: string; target?: string }> => {
    return ipcRenderer.invoke("open-system-settings", { section });
  },

  getUpdateStatus: async (): Promise<{
    supported: boolean;
    state: string;
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
  }> => {
    return ipcRenderer.invoke("update-get-status");
  },

  checkForUpdates: async (): Promise<{ success: boolean; message: string; status: any }> => {
    return ipcRenderer.invoke("update-check");
  },

  downloadUpdate: async (): Promise<{ success: boolean; message: string; status: any }> => {
    return ipcRenderer.invoke("update-download");
  },

  installUpdate: async (): Promise<{ success: boolean; message: string; status: any }> => {
    return ipcRenderer.invoke("update-install");
  },

  createUpdateBackup: async (reason?: string): Promise<{
    success: boolean;
    message: string;
    backupPath: string | null;
  }> => {
    return ipcRenderer.invoke("update-create-backup", { reason });
  },

  openBackupsFolder: async (): Promise<{ success: boolean; message: string; path: string }> => {
    return ipcRenderer.invoke("open-backups-folder");
  },

  openExternalUrl: async (url: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("open-external-url", { url });
  },

  remoteDeploySsh: async (payload: {
    host: string;
    user?: string;
    sshPort?: number;
    identityFile?: string;
    profile?: "linux_docker" | "linux_native" | "synology_docker";
    remoteRepoPath?: string;
    apiPort?: number;
    withTls?: boolean;
    domain?: string;
  }): Promise<{
    success: boolean;
    message: string;
    code?: number | null;
    stdout?: string;
    stderr?: string;
    error?: string | null;
  }> => {
    return ipcRenderer.invoke("remote-deploy-ssh", payload);
  },

  remoteCreateSetupTokenSsh: async (payload: {
    host: string;
    user?: string;
    sshPort?: number;
    identityFile?: string;
    apiPort?: number;
    ttlMinutes?: number;
    maxAttempts?: number;
  }): Promise<{
    success: boolean;
    message: string;
    token?: string | null;
    expiresAt?: string | null;
    raw?: string;
  }> => {
    return ipcRenderer.invoke("remote-create-setup-token-ssh", payload);
  },

  // Renderer notifications
  onBackendCrashed: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("backend-crashed", listener);
    return () => ipcRenderer.removeListener("backend-crashed", listener);
  },

  onBackendWatchdog: (callback: (payload: any) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on("backend-watchdog", listener);
    return () => ipcRenderer.removeListener("backend-watchdog", listener);
  },

  onUpdateStatus: (callback: (payload: any) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on("update-status", listener);
    return () => ipcRenderer.removeListener("update-status", listener);
  },

  onPermissionsAssistantResult: (
    callback: (payload: { success: boolean; message: string; details: Record<string, string> }) => void,
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on("permissions-assistant-result", listener);
    return () => ipcRenderer.removeListener("permissions-assistant-result", listener);
  },
};

// Keep both names for backward compatibility during migration.
contextBridge.exposeInMainWorld("electronAPI", api);
contextBridge.exposeInMainWorld("electron", api);
