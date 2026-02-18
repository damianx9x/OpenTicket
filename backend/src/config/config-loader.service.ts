import { Injectable, Logger } from '@nestjs/common';
import { AppConfig, DatabaseMode, StorageMode } from './config.types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

@Injectable()
export class ConfigLoaderService {
  private readonly logger = new Logger(ConfigLoaderService.name);
  private config: AppConfig | null = null;

  /**
   * Initialize configuration
   * 1. Check for config.json in OS user data folder
   * 2. If found, load it
   * 3. If not found, return setup mode configuration
   */
  async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    const configPath = this.getConfigPath();
    const configFile = path.join(configPath, 'config.json');

    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        this.config = JSON.parse(raw);
        this.config.createdAt = new Date(this.config.createdAt);
        this.logger.log(`Configuration loaded from ${configFile}`);
        return this.config;
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
  private getSetupModeConfig(): AppConfig {
    const setupKey = crypto.randomBytes(16).toString('hex');
    
    this.config = {
      databaseMode: 'sqlite',
      databaseUrl: 'file:./data/app.db',
      storageMode: 'local',
      dataPath: this.getDefaultDataPath(),
      uploadsPath: path.join(this.getDefaultDataPath(), 'uploads'),
      port: 3000,
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      setupMode: true,
      setupModeKey: setupKey,
      createdAt: new Date(),
    };

    return this.config;
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
    toSave.createdAt = toSave.createdAt.toISOString() as any;

    fs.writeFileSync(configFile, JSON.stringify(toSave, null, 2));
    this.logger.log(`Configuration saved to ${configFile}`);

    this.config = config;
  }

  /**
   * Get the OS-specific user data directory
   */
  private getConfigPath(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/TicketSystem
      return path.join(homeDir, 'Library', 'Application Support', 'TicketSystem');
    } else if (platform === 'win32') {
      // Windows: %APPDATA%\TicketSystem
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appData, 'TicketSystem');
    } else {
      // Linux: ~/.config/ticket-system
      return path.join(homeDir, '.config', 'ticket-system');
    }
  }

  /**
   * Get default data path for local storage
   */
  private getDefaultDataPath(): string {
    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'darwin') {
      return path.join(homeDir, 'Library', 'Application Support', 'TicketSystem', 'data');
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return path.join(appData, 'TicketSystem', 'data');
    } else {
      return path.join(homeDir, '.local', 'share', 'ticket-system', 'data');
    }
  }

  /**
   * Get current configuration
   */
  getConfigSync(): AppConfig | null {
    return this.config;
  }

  /**
   * Check if system is in setup mode
   */
  isSetupMode(): boolean {
    return this.config?.setupMode ?? true;
  }

  /**
   * Check if setup mode key is valid
   */
  validateSetupKey(key: string): boolean {
    if (!this.config || !this.config.setupModeKey) {
      return false;
    }
    return key === this.config.setupModeKey;
  }

  /**
   * Get database URL
   */
  getDatabaseUrl(): string {
    if (!this.config) {
      return 'file:./data/app.db';
    }
    return this.config.databaseUrl;
  }
}
