import { contextBridge, ipcRenderer } from "electron";

// Expose safe IPC methods to renderer process
const api = {
  // File system methods
  selectFolder: async (): Promise<string | null> => {
    return ipcRenderer.invoke("select-folder");
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

  openExternalUrl: async (url: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke("open-external-url", { url });
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
};

// Keep both names for backward compatibility during migration.
contextBridge.exposeInMainWorld("electronAPI", api);
contextBridge.exposeInMainWorld("electron", api);
