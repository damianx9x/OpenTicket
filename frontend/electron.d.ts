/// <reference types="electron" />

declare global {
  interface Window {
    electron: {
      selectFolder: () => Promise<string | null>;
      getLocalIp: () => Promise<string>;
      getAppPath: () => Promise<string>;
      resetSetup: () => Promise<{ success: boolean; message: string }>;
      onBackendCrashed: (callback: () => void) => () => void;
    };
  }
}

export {};
