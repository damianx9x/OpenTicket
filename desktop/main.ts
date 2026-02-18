import electron from "electron";
import path from "path";
import isDev from "electron-is-dev";
import { spawn } from "child_process";
import * as os from "os";
import * as net from "net";

const { app, BrowserWindow, dialog, ipcMain } = electron;

let mainWindow: electron.BrowserWindow | null = null;
let backendProcess: any = null;

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
      const response = await fetch(`http://localhost:${port}/api/v1/setup/status`, {
        method: "POST",
        timeout: 1000,
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

/**
 * Ensure fresh installation - remove old config if database is empty
 * This allows users to re-run setup if needed
 */
function cleanOldConfig(): void {
  const platform = process.platform;
  const homeDir = os.homedir();
  let configPath = "";
  let dataPath = "";

  if (platform === "darwin") {
    configPath = path.join(homeDir, "Library", "Application Support", "TicketSystem", "config.json");
    dataPath = path.join(homeDir, "Library", "Application Support", "TicketSystem", "data");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    configPath = path.join(appData, "TicketSystem", "config.json");
    dataPath = path.join(appData, "TicketSystem", "data");
  } else {
    configPath = path.join(homeDir, ".config", "ticket-system", "config.json");
    dataPath = path.join(homeDir, ".local", "share", "ticket-system", "data");
  }

  // Check if database file exists - if not, clear config to force setup
  const dbPath = require("path").join(dataPath, "app.db");
  const fs = require("fs");

  if (!fs.existsSync(dbPath)) {
    // No database found - this is a fresh install
    // Remove config to force setup wizard
    if (fs.existsSync(configPath)) {
      try {
        fs.unlinkSync(configPath);
        console.log(`Removed stale config for fresh install: ${configPath}`);
      } catch (err) {
        console.error(`Failed to remove stale config: ${err}`);
      }
    }
  }
}

/**
 * Spawn backend NestJS process
 */
async function spawnBackend(port: number): Promise<void> {
  // Always use compiled dist/ path (both dev and prod)
  const backendPath = path.join(__dirname, "../backend/dist/main.js");

  const env = {
    ...process.env,
    DATABASE_URL: `file:${path.join(app.getPath("userData"), "data", "app.db")}`,
    PORT: port.toString(),
    NODE_ENV: isDev ? "development" : "production",
  };

  console.log(`Spawning backend at ${backendPath} on port ${port}...`);

  backendProcess = spawn("node", [backendPath], {
    env,
    stdio: isDev ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  backendProcess.on("error", (err: Error) => {
    console.error("Backend process error:", err);
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend: ${err.message}`
    );
  });

  backendProcess.on("exit", (code: number) => {
    console.log(`Backend process exited with code ${code}`);
    if (mainWindow) {
      mainWindow.webContents.send("backend-crashed");
    }
  });

  // Wait for backend to be ready
  await waitForBackend(port);
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
      enableRemoteModule: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `http://localhost:${port}`;

  console.log(`Loading ${startUrl}`);
  mainWindow.loadURL(startUrl);

  if (isDev) {
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
    // Clean old configuration to ensure setup wizard on first run
    cleanOldConfig();

    // Find free port and start backend
    const port = await findFreePort();
    await spawnBackend(port);

    // Create window
    await createWindow(port);

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
      // Allow user to reset setup by clearing config
      const platform = process.platform;
      const homeDir = os.homedir();
      let configPath = "";

      if (platform === "darwin") {
        configPath = path.join(homeDir, "Library", "Application Support", "TicketSystem", "config.json");
      } else if (platform === "win32") {
        const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
        configPath = path.join(appData, "TicketSystem", "config.json");
      } else {
        configPath = path.join(homeDir, ".config", "ticket-system", "config.json");
      }

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
    // Kill backend process on Windows/Linux
    if (backendProcess) {
      backendProcess.kill();
    }
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow(3000); // Fallback port
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  if (mainWindow) {
    dialog.showErrorBox("Error", error.message);
  }
});
