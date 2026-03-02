/// <reference types="electron" />

declare global {
  interface EngineStatus {
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
  }

  interface UpdateStatus {
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
  }

  interface ElectronBridge {
    selectFolder: () => Promise<string | null>;
    selectFile: (kind: 'database' | 'backup') => Promise<string | null>;
    setupValidatePath: (payload: {
      dataPath: string;
      apiBaseUrl?: string;
      setupSessionToken?: string;
    }) => Promise<{
      ok: boolean;
      requestedPath: string;
      resolvedPath: string;
      createdDirectory: boolean;
      writable: boolean;
      warning?: string;
      error?: string;
    }>;
    getLocalIp: () => Promise<string>;
    getAppPath: () => Promise<string>;
    resetSetup: () => Promise<{ success: boolean; message: string }>;
    factoryReset: () => Promise<{ success: boolean; message: string; status: EngineStatus }>;
    getEngineStatus: () => Promise<EngineStatus>;
    restartEngine: () => Promise<{ success: boolean; message: string; status: EngineStatus }>;
    quickRepairEngine: () => Promise<{ success: boolean; message: string; status: EngineStatus }>;
    openLogsFolder: () => Promise<{ success: boolean; message: string; path: string }>;
    createEngineDiagnostics: () => Promise<{
      success: boolean;
      message: string;
      reportPath: string;
    }>;
    requestDesktopPermissions: () => Promise<{
      success: boolean;
      message: string;
      details: Record<string, string>;
    }>;
    getUpdateStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<{ success: boolean; message: string; status: UpdateStatus }>;
    downloadUpdate: () => Promise<{ success: boolean; message: string; status: UpdateStatus }>;
    installUpdate: () => Promise<{ success: boolean; message: string; status: UpdateStatus }>;
    createUpdateBackup: (reason?: string) => Promise<{
      success: boolean;
      message: string;
      backupPath: string | null;
    }>;
    openBackupsFolder: () => Promise<{ success: boolean; message: string; path: string }>;
    openExternalUrl: (url: string) => Promise<{ success: boolean; message: string }>;
    remoteDeploySsh: (payload: {
      host: string;
      user?: string;
      sshPort?: number;
      identityFile?: string;
      profile?: 'linux_docker' | 'linux_native' | 'synology_docker';
      remoteRepoPath?: string;
      apiPort?: number;
      withTls?: boolean;
      domain?: string;
    }) => Promise<{
      success: boolean;
      message: string;
      code?: number | null;
      stdout?: string;
      stderr?: string;
      error?: string | null;
    }>;
    remoteCreateSetupTokenSsh: (payload: {
      host: string;
      user?: string;
      sshPort?: number;
      identityFile?: string;
      apiPort?: number;
      ttlMinutes?: number;
      maxAttempts?: number;
    }) => Promise<{
      success: boolean;
      message: string;
      token?: string | null;
      expiresAt?: string | null;
      raw?: string;
    }>;
    onBackendCrashed: (callback: () => void) => () => void;
    onBackendWatchdog: (
      callback: (payload: { success: boolean; message: string; status?: EngineStatus }) => void,
    ) => () => void;
    onUpdateStatus: (
      callback: (payload: UpdateStatus) => void,
    ) => () => void;
  }

  interface Window {
    electron: ElectronBridge;
    electronAPI: ElectronBridge;
  }
}

export {};
