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

