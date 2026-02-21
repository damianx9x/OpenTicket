import { Injectable, Logger } from '@nestjs/common';
import { AppConfig, DatabaseMode, StorageMode } from './config.types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

@Injectable()
export class ConfigLoaderService {
  private readonly logger = new Logger(ConfigLoaderService.name);
  private static cachedConfig: AppConfig | null = null;

  /**
   * Initialize configuration
   * 1. Check for config.json in OS user data folder
   * 2. If found, load it
   * 3. If not found, return setup mode configuration
   */
  async loadConfig(): Promise<AppConfig> {
    if (ConfigLoaderService.cachedConfig) {
      this.applyProcessEnv(ConfigLoaderService.cachedConfig);
      return ConfigLoaderService.cachedConfig;
    }

    const configPath = this.getConfigPath();
    const configFile = path.join(configPath, 'config.json');

    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        const parsed = JSON.parse(raw) as AppConfig;
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.installationMode = parsed.installationMode || 'server_client';
        parsed.port = this.resolvePort(parsed.port);

        if (parsed.databaseMode === 'sqlite' && !parsed.setupMode && parsed.installationMode !== 'client_only') {
          const sqlitePath = this.resolveSqliteDatabasePath(parsed.databaseUrl);
          if (!sqlitePath || !fs.existsSync(sqlitePath)) {
            this.logger.warn(
              `Configured SQLite database is missing or invalid (${parsed.databaseUrl}). Switching to setup mode.`,
            );
            return this.getSetupModeConfig(parsed.dataPath);
          }
          if (!this.ensureDirectoryWritable(path.dirname(sqlitePath))) {
            this.logger.warn(
              `Configured SQLite directory is not writable (${path.dirname(sqlitePath)}). Switching to setup mode.`,
            );
            return this.getSetupModeConfig(parsed.dataPath);
          }
        }

        ConfigLoaderService.cachedConfig = parsed;
        this.applyProcessEnv(parsed);
        this.logger.log(`Configuration loaded from ${configFile}`);
        return ConfigLoaderService.cachedConfig;
      } catch (error) {
        this.logger.error(`Failed to load config from ${configFile}: ${error}`);
        return this.getSetupModeConfig();
      }
    }

    this.logger.log('No configuration found, entering SETUP_MODE');
    return this.getSetupModeConfig();
  }

  /**
   * Return configuration for setup mode
   * Uses in-memory SQLite and local storage
   */
  private getSetupModeConfig(preferredDataPath?: string): AppConfig {
    const setupKey = crypto.randomBytes(16).toString('hex');
    const dataPath = preferredDataPath ? path.resolve(preferredDataPath) : this.getDefaultDataPath();
    const dbPath = path.join(dataPath, 'app.db');
    
    ConfigLoaderService.cachedConfig = {
      databaseMode: 'sqlite',
      databaseUrl: this.toSqliteDatabaseUrl(dbPath),
      storageMode: 'local',
      dataPath,
      uploadsPath: path.join(dataPath, 'uploads'),
      port: this.resolvePort(3000),
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      setupMode: true,
      setupModeKey: setupKey,
      installationMode: 'server_client',
      createdAt: new Date(),
    };
    this.applyProcessEnv(ConfigLoaderService.cachedConfig);

    return ConfigLoaderService.cachedConfig;
  }

  /**
   * Save configuration to file after setup
   */
  async saveConfig(config: AppConfig): Promise<void> {
    const configPath = this.getConfigPath();
    const configFile = path.join(configPath, 'config.json');

    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
      this.logger.log(`Created config directory: ${configPath}`);
    }

    const toSave = { ...config };
    toSave.port = this.resolvePort(toSave.port);
    toSave.createdAt = toSave.createdAt.toISOString() as any;

    fs.writeFileSync(configFile, JSON.stringify(toSave, null, 2));
    this.logger.log(`Configuration saved to ${configFile}`);

    ConfigLoaderService.cachedConfig = toSave as AppConfig;
    ConfigLoaderService.cachedConfig.createdAt = config.createdAt;
    this.applyProcessEnv(ConfigLoaderService.cachedConfig);
  }

  /**
   * Get the OS-specific user data directory
   */
  private getConfigPath(): string {
    const customConfigDir = process.env.TICKET_SYSTEM_CONFIG_DIR;
    if (customConfigDir) {
      return path.resolve(customConfigDir);
    }

    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/OpenTicket
      return path.join(homeDir, 'Library', 'Application Support', 'OpenTicket');
    } else if (platform === 'win32') {
      // Windows: %APPDATA%\OpenTicket
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appData, 'OpenTicket');
    } else {
      // Linux: ~/.config/openticket
      return path.join(homeDir, '.config', 'openticket');
    }
  }

  /**
   * Get default data path for local storage
   */
  private getDefaultDataPath(): string {
    const customDataDir = process.env.TICKET_SYSTEM_DATA_DIR;
    if (customDataDir) {
      return path.resolve(customDataDir);
    }

    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      return path.join(homeDir, 'Library', 'Application Support', 'OpenTicket', 'data');
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appData, 'OpenTicket', 'data');
    } else {
      return path.join(homeDir, '.local', 'share', 'openticket', 'data');
    }
  }

  /**
   * Get current configuration
   */
  getConfigSync(): AppConfig | null {
    return ConfigLoaderService.cachedConfig;
  }

  /**
   * Clear cached configuration (used by DEV reset flows)
   */
  clearCache(): void {
    ConfigLoaderService.cachedConfig = null;
  }

  /**
   * Resolved directory where config.json is stored
   */
  getConfigDirectoryPath(): string {
    return this.getConfigPath();
  }

  /**
   * Resolved default data directory for current runtime
   */
  getDefaultDataDirectoryPath(): string {
    return this.getDefaultDataPath();
  }

  /**
   * Check if system is in setup mode
   */
  isSetupMode(): boolean {
    return ConfigLoaderService.cachedConfig?.setupMode ?? true;
  }

  /**
   * Check if setup mode key is valid
   */
  validateSetupKey(key: string): boolean {
    if (!ConfigLoaderService.cachedConfig || !ConfigLoaderService.cachedConfig.setupModeKey) {
      return false;
    }
    return key === ConfigLoaderService.cachedConfig.setupModeKey;
  }

  /**
   * Get database URL
   */
  getDatabaseUrl(): string {
    if (!ConfigLoaderService.cachedConfig) {
      return this.toSqliteDatabaseUrl(path.join(this.getDefaultDataPath(), 'app.db'));
    }
    return ConfigLoaderService.cachedConfig.databaseUrl;
  }

  private resolvePort(fallback: number): number {
    const envPort = Number(process.env.PORT);
    if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) {
      return envPort;
    }
    return fallback;
  }

  private applyProcessEnv(config: AppConfig): void {
    process.env.DATABASE_URL = this.resolveRuntimeDatabaseUrl(config);
    process.env.JWT_SECRET = config.jwtSecret;
    process.env.PORT = String(config.port);
    process.env.TICKET_SYSTEM_SETUP_MODE = config.setupMode ? '1' : '0';
  }

  private toSqliteDatabaseUrl(dbPath: string): string {
    return `file:${encodeURI(path.resolve(dbPath))}`;
  }

  private resolveRuntimeDatabaseUrl(config: AppConfig): string {
    if (config.databaseMode !== 'sqlite') {
      return config.databaseUrl;
    }

    const configuredDbPath =
      this.resolveSqliteDatabasePath(config.databaseUrl) ||
      path.join(path.resolve(config.dataPath || this.getDefaultDataPath()), 'app.db');

    if (this.ensureDirectoryWritable(path.dirname(configuredDbPath))) {
      return this.toSqliteDatabaseUrl(configuredDbPath);
    }

    const fallbackDbPath = path.join(this.getDefaultDataPath(), 'app.db');
    if (this.ensureDirectoryWritable(path.dirname(fallbackDbPath))) {
      this.logger.error(
        `Configured SQLite path is not writable (${configuredDbPath}). Falling back to ${fallbackDbPath}.`,
      );
      return this.toSqliteDatabaseUrl(fallbackDbPath);
    }

    throw new Error(
      `No writable SQLite directory available. Checked: ${path.dirname(configuredDbPath)} and ${path.dirname(fallbackDbPath)}`,
    );
  }

  private resolveSqliteDatabasePath(databaseUrl: string): string | null {
    if (!databaseUrl || !databaseUrl.startsWith('file:')) {
      return null;
    }

    const rawPath = databaseUrl.slice(5);
    try {
      return path.resolve(decodeURI(rawPath));
    } catch {
      return path.resolve(rawPath);
    }
  }

  private ensureDirectoryWritable(dirPath: string): boolean {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
}
