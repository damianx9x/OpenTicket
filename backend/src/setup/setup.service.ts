import { Injectable, Logger } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import {
  AppConfig,
  ClientOnlySetupRequest,
  DiscoverLocalDataResponse,
  DiscoverServersRequest,
  DiscoverServersResponse,
  DiscoveredServerInfo,
  SetupRequest,
  SetupResponse,
  ValidateRemoteServerResponse,
} from '../config/config.types';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { hashPassword } from '../common/security/password';
import { PrismaService } from '../prisma/prisma.service';

export interface DataPathValidationResult {
  ok: boolean;
  requestedPath: string;
  resolvedPath: string;
  createdDirectory: boolean;
  writable: boolean;
  warning?: string;
  error?: string;
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Initialize the system with user-provided configuration
   */
  async initializeSystem(request: SetupRequest): Promise<SetupResponse> {
    try {
      if (!this.configLoader.isSetupMode()) {
        return {
          success: false,
          message: 'System is already configured. Cannot re-initialize.',
        };
      }

      this.logger.log('Starting system initialization...');

      const pathValidation = this.validateDataPath(request.dataPath);
      if (!pathValidation.ok) {
        throw new Error(pathValidation.error || 'Wybrana lokalizacja danych jest nieprawidłowa.');
      }

      const dataPath = pathValidation.resolvedPath;
      const uploadsPath = path.join(dataPath, 'uploads');
      const dbPath = path.join(dataPath, 'app.db');
      const dbUrl = this.toSqliteDatabaseUrl(dbPath);
      const bootstrapMode = this.normalizeBootstrapMode(request.bootstrapMode);
      const existingDatabasePath = this.resolveOptionalAbsolutePath(request.existingDatabasePath);
      const existingBackupArchivePath = this.resolveOptionalAbsolutePath(request.existingBackupArchivePath);

      if (bootstrapMode === 'existing_db' && !existingDatabasePath) {
        throw new Error('Wybrano import istniejącej bazy, ale nie podano ścieżki do pliku app.db.');
      }
      if (bootstrapMode === 'backup_archive' && !existingBackupArchivePath) {
        throw new Error('Wybrano import backupu, ale nie podano ścieżki do archiwum .tar.gz.');
      }

      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
        this.logger.log(`Created data directory: ${dataPath}`);
      }

      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        this.logger.log(`Created uploads directory: ${uploadsPath}`);
      }

      process.env.DATABASE_URL = dbUrl;
      this.logger.log(`Database URL set to: ${dbUrl}`);

      // If Prisma already opened sqlite connections (for example due to stale auth probe),
      // replacing the sqlite file can leave runtime on deleted inode and cause P2021.
      // We hard-disconnect before touching database file and reconnect lazily after setup.
      await this.refreshRuntimePrisma('before sqlite reset');

      if (bootstrapMode === 'fresh') {
        // Setup should always start from a clean sqlite file.
        // This avoids partial schema artifacts after interrupted setup attempts.
        if (fs.existsSync(dbPath)) {
          fs.rmSync(dbPath, { force: true });
          this.logger.warn(`Removed existing sqlite file before setup: ${dbPath}`);
        }
      } else if (bootstrapMode === 'existing_db') {
        this.importExistingDatabaseToRuntime({
          sourceDbPath: existingDatabasePath as string,
          targetDbPath: dbPath,
          uploadsPath,
        });
      } else if (bootstrapMode === 'backup_archive') {
        this.importBackupArchiveToRuntime({
          archivePath: existingBackupArchivePath as string,
          targetDbPath: dbPath,
          uploadsPath,
        });
      }

      const migrations = await this.runMigrations(dbUrl);
      this.logger.log(`Migrations applied: ${migrations.applied} (DATABASE_URL=${migrations.databaseUrl})`);

      const prisma = new PrismaClient({
        datasources: { db: { url: migrations.databaseUrl } },
      });

      await prisma.$connect();
      await this.ensureDefaultVatRates(prisma);
      const adminUserId = await this.createAdminUser(prisma, request.adminEmail, request.adminPassword);

      if (request.organizationName) {
        const existingOrg = await prisma.organization.findFirst({
          where: { name: request.organizationName },
          select: { id: true },
        });
        if (!existingOrg) {
          await prisma.organization.create({
            data: { name: request.organizationName },
          });
          this.logger.log(`Organization created: ${request.organizationName}`);
        }
      }

      await this.ensureDefaultSystemSettings(prisma, request.organizationName);

      await prisma.$disconnect();

      const config: AppConfig = {
        databaseMode: 'sqlite',
        databaseUrl: migrations.databaseUrl,
        storageMode: 'local',
        dataPath,
        uploadsPath,
        port: Number(process.env.PORT || 3000),
        jwtSecret: crypto.randomBytes(32).toString('hex'),
        setupMode: false,
        adminEmail: request.adminEmail,
        createdAt: new Date(),
      };

      await this.configLoader.saveConfig(config);
      this.logger.log('Configuration saved');
      await this.refreshRuntimePrisma('after setup init');

      return {
        success: true,
        message: 'System initialized successfully',
        configPath: dataPath,
        migrationsApplied: migrations.applied,
        adminUserId,
        adminEmail: request.adminEmail,
        installationMode: 'server_client',
        bootstrapMode,
        bootstrapSourcePath:
          bootstrapMode === 'existing_db'
            ? existingDatabasePath || undefined
            : bootstrapMode === 'backup_archive'
              ? existingBackupArchivePath || undefined
              : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Initialization failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async initializeClientOnlyMode(request: ClientOnlySetupRequest): Promise<SetupResponse> {
    if (!this.configLoader.isSetupMode()) {
      return {
        success: false,
        message: 'System is already configured. Cannot re-initialize.',
      };
    }

    const remoteApiBaseUrl = this.normalizeRemoteApiBaseUrl(request.remoteApiBaseUrl);
    const dataPath = this.configLoader.getDefaultDataDirectoryPath();
    const uploadsPath = path.join(dataPath, 'uploads');
    const dbPath = path.join(dataPath, 'app.db');
    const dbUrl = this.toSqliteDatabaseUrl(dbPath);

    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    const config: AppConfig = {
      databaseMode: 'sqlite',
      databaseUrl: dbUrl,
      storageMode: 'local',
      dataPath,
      uploadsPath,
      port: Number(process.env.PORT || 3000),
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      setupMode: false,
      installationMode: 'client_only',
      remoteApiBaseUrl,
      createdAt: new Date(),
    };

    await this.configLoader.saveConfig(config);
    this.logger.log(`Client-only mode configured. Remote API base: ${remoteApiBaseUrl}`);
    await this.refreshRuntimePrisma('after client-only setup');

    return {
      success: true,
      message: 'Client-only mode initialized successfully',
      configPath: dataPath,
      installationMode: 'client_only',
      remoteApiBaseUrl,
    };
  }

  private async ensureDefaultVatRates(prisma: PrismaClient): Promise<void> {
    const defaults = [
      { code: '23', percent: 23, isExempt: false, name: 'VAT 23%' },
      { code: '8', percent: 8, isExempt: false, name: 'VAT 8%' },
      { code: '5', percent: 5, isExempt: false, name: 'VAT 5%' },
      { code: '0', percent: 0, isExempt: false, name: 'VAT 0%' },
      { code: 'ZW', percent: 0, isExempt: true, name: 'ZW' },
    ];

    for (const rate of defaults) {
      await prisma.vatRate.upsert({
        where: { code: rate.code },
        update: {
          percent: rate.percent,
          isExempt: rate.isExempt,
          name: rate.name,
        },
        create: rate,
      });
    }
  }

  private async runMigrations(databaseUrl: string): Promise<{ applied: number; databaseUrl: string }> {
    const backendRoot = path.resolve(__dirname, '..', '..');
    const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
    const prismaCli = this.resolvePrismaCli(backendRoot);
    const candidates = this.buildDatabaseUrlCandidates(databaseUrl);
    const attemptsPerCandidate = 2;
    const forceSqliteFallback = process.env.TICKET_SYSTEM_FORCE_SQLITE_FALLBACK === '1';
    let lastError = 'Unknown Prisma error';

    for (const candidate of candidates) {
      if (forceSqliteFallback) {
        try {
          const applied = await this.runSqliteMigrationsViaPrismaClient({
            backendRoot,
            databaseUrl: candidate,
          });
          if (applied > 0) {
            this.logger.warn(
              `Prisma CLI path skipped by TICKET_SYSTEM_FORCE_SQLITE_FALLBACK=1; setup applied via in-process SQL fallback (${applied} file(s)).`,
            );
            return { applied, databaseUrl: candidate };
          }
        } catch (forcedFallbackError: any) {
          lastError = `forced sqlite fallback failed: ${forcedFallbackError?.message || String(forcedFallbackError)}`;
        }
      }

      for (let attempt = 1; attempt <= attemptsPerCandidate; attempt++) {
        const env = {
          ...process.env,
          DATABASE_URL: candidate,
          PRISMA_HIDE_UPDATE_MESSAGE: '1',
          ...(prismaCli.envPatch || {}),
        };

        const result = spawnSync(
          prismaCli.command,
          prismaCli.args.concat(['db', 'push', '--skip-generate', '--schema', schemaPath]),
          {
            env,
            encoding: 'utf-8',
            cwd: backendRoot,
          },
        );

        if (result.status === 0) {
          return { applied: 1, databaseUrl: candidate };
        }

        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        const spawnError = result.error?.message?.trim();
        lastError = spawnError || stderr || stdout || 'Unknown Prisma error';

        this.logger.warn(
          `Prisma db push attempt ${attempt}/${attemptsPerCandidate} failed for ${candidate}: ${lastError}`,
        );
      }

      // Fallback for environments where schema-engine is unstable (for example newer Node runtimes).
      // We apply SQL migrations directly for sqlite setup path.
      try {
        const applied = this.runSqliteMigrationsViaDbExecute({
          backendRoot,
          schemaPath,
          prismaCli,
          databaseUrl: candidate,
        });
        if (applied > 0) {
          this.logger.warn(
            `Prisma db push failed for ${candidate}; setup recovered via sqlite migration SQL fallback (${applied} file(s)).`,
          );
          return { applied, databaseUrl: candidate };
        }
      } catch (fallbackError: any) {
        lastError = `${lastError}; sqlite fallback failed: ${fallbackError?.message || String(fallbackError)}`;
      }

      // Runtime-safe fallback that does not depend on Prisma CLI or system sqlite3 binary.
      // This path is important for packaged/offline desktop builds.
      try {
        const applied = await this.runSqliteMigrationsViaPrismaClient({
          backendRoot,
          databaseUrl: candidate,
        });
        if (applied > 0) {
          this.logger.warn(
            `Prisma db push failed for ${candidate}; setup recovered via in-process SQL fallback (${applied} file(s)).`,
          );
          return { applied, databaseUrl: candidate };
        }
      } catch (prismaFallbackError: any) {
        lastError = `${lastError}; in-process fallback failed: ${prismaFallbackError?.message || String(prismaFallbackError)}`;
      }

      // Last resort fallback for environments where Prisma schema engine is unavailable
      // (for example packaged desktop runtime without matching engine binaries).
      try {
        const applied = this.runSqliteMigrationsViaSqliteCli({
          backendRoot,
          databaseUrl: candidate,
        });
        if (applied > 0) {
          this.logger.warn(
            `Prisma db push failed for ${candidate}; setup recovered via system sqlite3 fallback (${applied} file(s)).`,
          );
          return { applied, databaseUrl: candidate };
        }
      } catch (sqliteFallbackError: any) {
        lastError = `${lastError}; sqlite3 fallback failed: ${sqliteFallbackError?.message || String(sqliteFallbackError)}`;
      }
    }

    throw new Error(`Prisma db push failed: ${lastError}`);
  }

  private async runSqliteMigrationsViaPrismaClient(params: {
    backendRoot: string;
    databaseUrl: string;
  }): Promise<number> {
    const { backendRoot, databaseUrl } = params;
    if (!databaseUrl.startsWith('file:')) {
      throw new Error('in-process sqlite fallback supports only file: DATABASE_URL');
    }

    const migrationFiles = this.getSqliteMigrationFiles(backendRoot);
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    try {
      await prisma.$connect();

      for (const filePath of migrationFiles) {
        const sql = fs.readFileSync(filePath, 'utf-8');
        const statements = this.splitSqlStatements(sql);

        for (const statement of statements) {
          const trimmed = statement.trim();
          if (!trimmed) {
            continue;
          }
          await prisma.$executeRawUnsafe(trimmed);
        }
      }
    } finally {
      await prisma.$disconnect();
    }

    return migrationFiles.length;
  }

  private runSqliteMigrationsViaDbExecute(params: {
    backendRoot: string;
    schemaPath: string;
    prismaCli: { command: string; args: string[]; envPatch?: Record<string, string> };
    databaseUrl: string;
  }): number {
    const { backendRoot, schemaPath, prismaCli, databaseUrl } = params;
    if (!databaseUrl.startsWith('file:')) {
      throw new Error('sqlite fallback supports only file: DATABASE_URL');
    }

    const migrationFiles = this.getSqliteMigrationFiles(backendRoot);

    for (const filePath of migrationFiles) {
      const env = {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
        ...(prismaCli.envPatch || {}),
      };

      const result = spawnSync(
        prismaCli.command,
        prismaCli.args.concat(['db', 'execute', '--file', filePath, '--schema', schemaPath]),
        {
          env,
          encoding: 'utf-8',
          cwd: backendRoot,
        },
      );

      if (result.status !== 0) {
        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        const spawnError = result.error?.message?.trim();
        throw new Error(
          `db execute failed for ${path.basename(path.dirname(filePath))}: ${spawnError || stderr || stdout || 'unknown error'}`,
        );
      }
    }

    return migrationFiles.length;
  }

  private runSqliteMigrationsViaSqliteCli(params: {
    backendRoot: string;
    databaseUrl: string;
  }): number {
    const { backendRoot, databaseUrl } = params;
    const dbPath = this.resolveSqlitePathFromDatabaseUrl(databaseUrl);
    const migrationFiles = this.getSqliteMigrationFiles(backendRoot);

    for (const filePath of migrationFiles) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      const result = spawnSync('sqlite3', ['-bail', dbPath], {
        input: sql,
        encoding: 'utf-8',
      });

      if (result.status !== 0) {
        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        const spawnError = result.error?.message?.trim();
        throw new Error(
          `sqlite3 execution failed for ${path.basename(path.dirname(filePath))}: ${
            spawnError || stderr || stdout || 'unknown error'
          }`,
        );
      }
    }

    return migrationFiles.length;
  }

  private getSqliteMigrationFiles(backendRoot: string): string[] {
    const migrationsDir = path.join(backendRoot, 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory does not exist: ${migrationsDir}`);
    }

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((entry) => entry !== 'migration_lock.toml')
      .map((entry) => path.join(migrationsDir, entry, 'migration.sql'))
      .filter((filePath) => fs.existsSync(filePath))
      .sort();

    if (migrationFiles.length === 0) {
      throw new Error('No sqlite migration.sql files found');
    }

    return migrationFiles;
  }

  private resolveSqlitePathFromDatabaseUrl(databaseUrl: string): string {
    if (!databaseUrl.startsWith('file:')) {
      throw new Error('sqlite fallback supports only file: DATABASE_URL');
    }

    const rawPath = databaseUrl.slice(5);
    try {
      return path.resolve(decodeURI(rawPath));
    } catch {
      return path.resolve(rawPath);
    }
  }

  private buildDatabaseUrlCandidates(databaseUrl: string): string[] {
    const out: string[] = [];
    const add = (value: string) => {
      if (!value || out.includes(value)) {
        return;
      }
      out.push(value);
    };

    add(databaseUrl);

    if (databaseUrl.startsWith('file:')) {
      const rawPath = databaseUrl.slice(5);
      try {
        const decoded = decodeURI(rawPath);
        add(`file:${decoded}`);
      } catch {
        // ignore invalid encoded sequence
      }
    }

    return out;
  }

  private splitSqlStatements(sql: string): string[] {
    const out: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i += 1) {
      const ch = sql[i];
      const next = sql[i + 1];
      const prev = sql[i - 1];

      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
          current += ch;
        }
        continue;
      }

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
        }
        continue;
      }

      if (!inSingle && !inDouble) {
        if (ch === '-' && next === '-') {
          inLineComment = true;
          i += 1;
          continue;
        }

        if (ch === '/' && next === '*') {
          inBlockComment = true;
          i += 1;
          continue;
        }
      }

      if (ch === "'" && !inDouble) {
        if (inSingle && next === "'") {
          current += ch + next;
          i += 1;
          continue;
        }
        if (prev !== '\\') {
          inSingle = !inSingle;
        }
      } else if (ch === '"' && !inSingle) {
        if (inDouble && next === '"') {
          current += ch + next;
          i += 1;
          continue;
        }
        if (prev !== '\\') {
          inDouble = !inDouble;
        }
      }

      if (ch === ';' && !inSingle && !inDouble) {
        const statement = current.trim();
        if (statement.length > 0) {
          out.push(statement);
        }
        current = '';
        continue;
      }

      current += ch;
    }

    const tail = current.trim();
    if (tail.length > 0) {
      out.push(tail);
    }

    return out;
  }

  private resolvePrismaCli(backendRoot: string): {
    command: string;
    args: string[];
    envPatch?: Record<string, string>;
  } {
    const prismaJs = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
    if (fs.existsSync(prismaJs)) {
      return {
        command: process.execPath,
        args: [prismaJs],
        envPatch: process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : undefined,
      };
    }

    const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
    const localBin = path.join(backendRoot, 'node_modules', '.bin', binName);

    if (fs.existsSync(localBin)) {
      return { command: localBin, args: [], envPatch: undefined };
    }

    this.logger.warn(`Local Prisma CLI not found at ${localBin}, falling back to npx prisma`);
    return { command: 'npx', args: ['prisma'], envPatch: undefined };
  }

  private async createAdminUser(prisma: PrismaClient, email: string, password: string): Promise<string> {
    const passwordHash = hashPassword(password);
    try {
      const user = await prisma.user.create({
        data: {
          email,
          name: 'System Administrator',
          role: 'ADMIN',
          passwordHash,
        },
      });
      this.logger.log(`Admin user created with ID: ${user.id}`);
      return user.id;
    } catch (error: any) {
      if (error.code === 'P2002') {
        const user = await prisma.user.update({
          where: { email },
          data: {
            role: 'ADMIN',
            passwordHash,
            disabledAt: null,
          },
        });
        this.logger.warn(`Existing user promoted to admin: ${user.id}`);
        return user.id;
      }
      throw error;
    }
  }

  private async ensureDefaultSystemSettings(
    prisma: PrismaClient,
    organizationName?: string,
  ): Promise<void> {
    const settings = {
      branding: {
        companyName: organizationName || 'OpenTicket',
        logoDataUrl: '',
        theme: 'helpdesk-blue',
      },
      features: {
        technicianSelfSignup: false,
      },
      reminders: {
        enabled: true,
        channels: ['IN_APP'],
      },
      uiDefaults: {
        compactMode: false,
        defaultStatusFilter: '',
        defaultPriorityFilter: '',
        language: 'pl',
      },
      integrations: {
        email: {
          mode: 'disabled',
          provider: 'smtp',
          from: '',
          host: '',
          port: 587,
          secure: false,
          username: '',
        },
        sms: {
          mode: 'disabled',
          provider: 'webhook',
          sender: '',
          webhookUrl: '',
        },
      },
    };

    await prisma.appSetting.upsert({
      where: { key: 'system.settings' },
      update: { value: JSON.stringify(settings) },
      create: { key: 'system.settings', value: JSON.stringify(settings) },
    });
  }

  async isSystemSetup(): Promise<boolean> {
    const config = this.configLoader.getConfigSync();
    return config !== null && !config.setupMode;
  }

  async getSetupStatus(): Promise<{
    isSetup: boolean;
    setupMode: boolean;
    defaultDataPath: string;
    installationMode: 'server_client' | 'client_only';
    remoteApiBaseUrl?: string;
  }> {
    const isSetup = await this.isSystemSetup();
    const config = this.configLoader.getConfigSync();

    return {
      isSetup,
      setupMode: !isSetup,
      defaultDataPath: this.getRecommendedDataPath(),
      installationMode: (config?.installationMode as 'server_client' | 'client_only') || 'server_client',
      remoteApiBaseUrl: config?.remoteApiBaseUrl || undefined,
    };
  }

  getRecommendedDataPath(): string {
    const config = this.configLoader.getConfigSync();
    if (config?.dataPath) {
      return path.resolve(config.dataPath);
    }

    return this.configLoader.getDefaultDataDirectoryPath();
  }

  private normalizeBootstrapMode(
    rawMode?: string,
  ): 'fresh' | 'existing_db' | 'backup_archive' {
    const normalized = (rawMode || 'fresh').trim().toLowerCase();
    if (normalized === 'existing_db' || normalized === 'backup_archive') {
      return normalized;
    }
    return 'fresh';
  }

  private resolveOptionalAbsolutePath(inputPath?: string): string | null {
    if (!inputPath || inputPath.trim().length === 0) {
      return null;
    }
    return this.resolveDataPath(inputPath.trim());
  }

  private importExistingDatabaseToRuntime(params: {
    sourceDbPath: string;
    targetDbPath: string;
    uploadsPath: string;
  }): void {
    const sourceDbPath = path.resolve(params.sourceDbPath);
    const targetDbPath = path.resolve(params.targetDbPath);
    const sameFile = sourceDbPath === targetDbPath;
    if (!fs.existsSync(sourceDbPath)) {
      throw new Error(`Nie znaleziono pliku bazy danych: ${sourceDbPath}`);
    }

    fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
    fs.mkdirSync(params.uploadsPath, { recursive: true });

    if (!sameFile) {
      const dbTargets = [
        targetDbPath,
        `${targetDbPath}-wal`,
        `${targetDbPath}-shm`,
        `${targetDbPath}-journal`,
      ];
      for (const target of dbTargets) {
        fs.rmSync(target, { force: true });
      }
      fs.copyFileSync(sourceDbPath, targetDbPath);
      this.copyFileIfExists(`${sourceDbPath}-wal`, `${targetDbPath}-wal`);
      this.copyFileIfExists(`${sourceDbPath}-shm`, `${targetDbPath}-shm`);
      this.copyFileIfExists(`${sourceDbPath}-journal`, `${targetDbPath}-journal`);
    }

    this.logger.log(`Setup import: existing database copied (${sourceDbPath} -> ${targetDbPath})`);
  }

  private importBackupArchiveToRuntime(params: {
    archivePath: string;
    targetDbPath: string;
    uploadsPath: string;
  }): void {
    const archivePath = path.resolve(params.archivePath);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Nie znaleziono archiwum backupu: ${archivePath}`);
    }

    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openticket-setup-import-'));

    try {
      const extract = spawnSync('tar', ['-xzf', archivePath, '-C', stageDir], { encoding: 'utf-8' });
      if (extract.status !== 0) {
        const reason = (extract.stderr || extract.stdout || 'tar extract failed').trim();
        throw new Error(`Nie udało się rozpakować backupu: ${reason}`);
      }

      const importedDbPath = path.join(stageDir, 'app.db');
      if (!fs.existsSync(importedDbPath)) {
        throw new Error('Backup nie zawiera pliku app.db.');
      }

      fs.mkdirSync(path.dirname(params.targetDbPath), { recursive: true });
      const dbTargets = [
        params.targetDbPath,
        `${params.targetDbPath}-wal`,
        `${params.targetDbPath}-shm`,
        `${params.targetDbPath}-journal`,
      ];
      for (const target of dbTargets) {
        fs.rmSync(target, { force: true });
      }

      fs.copyFileSync(importedDbPath, params.targetDbPath);
      this.copyFileIfExists(path.join(stageDir, 'app.db-wal'), `${params.targetDbPath}-wal`);
      this.copyFileIfExists(path.join(stageDir, 'app.db-shm'), `${params.targetDbPath}-shm`);
      this.copyFileIfExists(path.join(stageDir, 'app.db-journal'), `${params.targetDbPath}-journal`);

      const importedUploads = path.join(stageDir, 'uploads');
      if (fs.existsSync(importedUploads)) {
        fs.rmSync(params.uploadsPath, { recursive: true, force: true });
        fs.cpSync(importedUploads, params.uploadsPath, { recursive: true });
      } else if (!fs.existsSync(params.uploadsPath)) {
        fs.mkdirSync(params.uploadsPath, { recursive: true });
      }

      this.logger.log(`Setup import: backup restored from ${archivePath}`);
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }

  private copyFileIfExists(source: string, target: string): void {
    if (!fs.existsSync(source)) {
      return;
    }
    fs.copyFileSync(source, target);
  }

  validateDataPath(inputPath?: string): DataPathValidationResult {
    const requestedPath = (inputPath || '').trim();
    const resolvedPath = this.resolveDataPath(requestedPath);
    const denyList = ['/System', '/Applications', '/Library'];

    if (denyList.some((prefix) => resolvedPath === prefix || resolvedPath.startsWith(`${prefix}/`))) {
      return {
        ok: false,
        requestedPath,
        resolvedPath,
        createdDirectory: false,
        writable: false,
        error: 'Wybierz lokalizację w katalogu użytkownika (nie /System, /Applications ani /Library).',
      };
    }

    const parentDir = path.dirname(resolvedPath);
    let createdDirectory = false;

    try {
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
        createdDirectory = true;
      }

      fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);

      const probeFile = path.join(
        resolvedPath,
        `.openticket-write-test-${process.pid}-${Date.now()}.tmp`,
      );
      fs.writeFileSync(probeFile, 'ok', { encoding: 'utf-8', mode: 0o600 });
      fs.rmSync(probeFile, { force: true });

      const recommendedPath = this.configLoader.getDefaultDataDirectoryPath();
      const warning =
        process.platform === 'darwin' &&
        !resolvedPath.startsWith(path.join(os.homedir(), 'Library', 'Application Support'))
          ? `Na macOS zalecana jest lokalizacja: ${recommendedPath}`
          : undefined;

      return {
        ok: true,
        requestedPath,
        resolvedPath,
        createdDirectory,
        writable: true,
        warning,
      };
    } catch (error: any) {
      return {
        ok: false,
        requestedPath,
        resolvedPath,
        createdDirectory,
        writable: false,
        error:
          error?.code === 'EACCES'
            ? 'Brak uprawnień zapisu do wybranego katalogu. Wybierz lokalizację w katalogu użytkownika.'
            : error?.message || 'Nie udało się zweryfikować lokalizacji danych.',
      };
    }
  }

  discoverLocalDataSources(): DiscoverLocalDataResponse {
    const searched = new Set<string>();
    const dbCandidates = new Set<string>();
    const backupCandidates = new Set<string>();

    const dataDirs = this.getLocalDataCandidateDirectories();
    for (const dirPath of dataDirs) {
      const resolvedDir = path.resolve(dirPath);
      searched.add(resolvedDir);
      const dbPath = path.join(resolvedDir, 'app.db');
      if (fs.existsSync(dbPath)) {
        dbCandidates.add(dbPath);
      }
      const backupsDir = path.join(resolvedDir, 'backups');
      if (fs.existsSync(backupsDir)) {
        searched.add(backupsDir);
        for (const filePath of this.listBackupArchives(backupsDir)) {
          backupCandidates.add(filePath);
        }
      }
    }

    const homeDir = os.homedir();
    const additionalBackupDirs = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Downloads'),
      path.join(homeDir, 'Desktop', 'backups'),
      path.join(homeDir, 'Downloads', 'backups'),
    ];
    for (const dirPath of additionalBackupDirs) {
      searched.add(path.resolve(dirPath));
      for (const filePath of this.listBackupArchives(dirPath)) {
        backupCandidates.add(filePath);
      }
    }

    const existingDatabases = Array.from(dbCandidates).sort();
    const backupArchives = Array.from(backupCandidates).sort((a, b) => {
      const aTime = this.safeMtimeMs(a);
      const bTime = this.safeMtimeMs(b);
      return bTime - aTime;
    });

    return {
      success: true,
      existingDatabases,
      backupArchives,
      searchedPaths: Array.from(searched).sort(),
    };
  }

  async discoverRemoteServers(request: DiscoverServersRequest = {}): Promise<DiscoverServersResponse> {
    const startedAt = Date.now();
    const deepScan = request.deepScan === true;
    const includeLocalhost = request.includeLocalhost !== false;
    const timeoutMs = this.clampInt(request.timeoutMs ?? (deepScan ? 900 : 700), 300, 3000);
    const maxResults = this.clampInt(request.maxResults ?? 20, 1, 100);

    const targets = this.buildDiscoveryTargets({ deepScan, includeLocalhost });
    const probed = await this.mapWithConcurrency(targets, deepScan ? 28 : 24, async (apiBaseUrl) =>
      this.probeApiBase(apiBaseUrl, timeoutMs),
    );

    const deduped = new Map<string, DiscoveredServerInfo>();
    for (const entry of probed) {
      if (!entry) {
        continue;
      }
      const current = deduped.get(entry.apiBaseUrl);
      if (!current || entry.latencyMs < current.latencyMs) {
        deduped.set(entry.apiBaseUrl, entry);
      }
    }

    const servers = Array.from(deduped.values())
      .sort((a, b) => a.latencyMs - b.latencyMs)
      .slice(0, maxResults);

    return {
      success: true,
      scannedTargets: targets.length,
      durationMs: Date.now() - startedAt,
      servers,
      message:
        servers.length > 0
          ? `Znaleziono ${servers.length} serwer(y).`
          : 'Nie znaleziono serwera automatycznie. Wpisz adres ręcznie (np. zewnętrzny URL).',
    };
  }

  async validateRemoteServer(rawUrl: string): Promise<ValidateRemoteServerResponse> {
    const apiBaseUrl = this.normalizeRemoteApiBaseUrl(rawUrl);
    const probe = await this.probeApiBase(apiBaseUrl, 1800);
    if (!probe) {
      return {
        ok: false,
        apiBaseUrl,
        error: 'Nie można połączyć się z serwerem (sprawdź adres, port i połączenie sieciowe).',
      };
    }

    return {
      ok: true,
      apiBaseUrl: probe.apiBaseUrl,
      latencyMs: probe.latencyMs,
      system: {
        app: probe.app,
        version: probe.version,
        setupMode: probe.setupMode,
        installationMode: probe.installationMode,
      },
    };
  }

  /**
   * DEV helper: remove config + local sqlite data so setup can run again.
   * Enabled only when APP_ENV=DEV_LOCAL or TICKET_SYSTEM_ALLOW_DEV_RESET=1.
   */
  async resetForDev(): Promise<{ success: boolean; message: string }> {
    const allowDevReset =
      process.env.APP_ENV === 'DEV_LOCAL' || process.env.TICKET_SYSTEM_ALLOW_DEV_RESET === '1';

    if (!allowDevReset) {
      return {
        success: false,
        message:
          'DEV reset is disabled in this environment. Set APP_ENV=DEV_LOCAL or TICKET_SYSTEM_ALLOW_DEV_RESET=1.',
      };
    }

    const removed: string[] = [];
    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    let dataPath = process.env.TICKET_SYSTEM_DATA_DIR
      ? path.resolve(process.env.TICKET_SYSTEM_DATA_DIR)
      : this.configLoader.getDefaultDataDirectoryPath();

    if (fs.existsSync(configFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as { dataPath?: string };
        if (parsed?.dataPath) {
          dataPath = path.resolve(parsed.dataPath);
        }
      } catch {
        // ignore invalid config and continue cleanup with default data path
      }
    }

    const dbFile = path.join(dataPath, 'app.db');
    const uploadsDir = path.join(dataPath, 'uploads');

    if (fs.existsSync(dbFile)) {
      fs.rmSync(dbFile, { force: true });
      removed.push(dbFile);
    }

    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      removed.push(uploadsDir);
    }

    if (fs.existsSync(configFile)) {
      fs.rmSync(configFile, { force: true });
      removed.push(configFile);
    }

    this.configLoader.clearCache();

    this.logger.warn(`DEV reset executed. Removed: ${removed.join(', ') || 'nothing to remove'}`);
    return {
      success: true,
      message: 'DEV reset complete. Refresh /setup to run initialization again.',
    };
  }

  private resolveDataPath(inputPath?: string): string {
    if (!inputPath || inputPath.trim().length === 0) {
      return this.configLoader.getDefaultDataDirectoryPath();
    }

    if (inputPath.startsWith('~/')) {
      return path.join(os.homedir(), inputPath.slice(2));
    }

    return path.resolve(inputPath);
  }

  private toSqliteDatabaseUrl(dbPath: string): string {
    const resolved = path.resolve(dbPath);
    if (process.platform === 'win32') {
      const normalized = resolved.replace(/\\/g, '/');
      return normalized.startsWith('/') ? `file:${normalized}` : `file:/${normalized}`;
    }
    return `file:${resolved}`;
  }

  private normalizeRemoteApiBaseUrl(rawUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new Error('Adres serwera jest nieprawidłowy (oczekiwano http:// lub https://).');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Adres serwera musi używać protokołu http:// lub https://.');
    }

    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString().replace(/\/+$/, '');
  }

  private getLocalDataCandidateDirectories(): string[] {
    const candidates = new Set<string>();
    const config = this.configLoader.getConfigSync();
    if (config?.dataPath) {
      candidates.add(path.resolve(config.dataPath));
    }
    if (process.env.TICKET_SYSTEM_DATA_DIR) {
      candidates.add(path.resolve(process.env.TICKET_SYSTEM_DATA_DIR));
    }

    const recommended = this.getRecommendedDataPath();
    if (recommended) {
      candidates.add(path.resolve(recommended));
    }

    const homeDir = os.homedir();
    const platform = process.platform;
    if (platform === 'darwin') {
      const appSupport = path.join(homeDir, 'Library', 'Application Support');
      [
        'OpenTicket',
        'openticket-desktop',
        'ticket-system',
        'TicketSystem',
        'ticket-system-desktop',
      ].forEach((name) => candidates.add(path.join(appSupport, name, 'data')));
    } else if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      ['OpenTicket', 'openticket-desktop', 'ticket-system', 'TicketSystem'].forEach((name) =>
        candidates.add(path.join(appData, name, 'data')),
      );
    } else {
      candidates.add(path.join(homeDir, '.local', 'share', 'openticket', 'data'));
      candidates.add(path.join(homeDir, '.local', 'share', 'ticket-system', 'data'));
    }

    return Array.from(candidates);
  }

  private listBackupArchives(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    let entries: string[];
    try {
      entries = fs.readdirSync(dirPath);
    } catch {
      return [];
    }

    return entries
      .filter((name) => name.endsWith('.tar.gz'))
      .map((name) => path.join(dirPath, name))
      .filter((fullPath) => fs.existsSync(fullPath));
  }

  private safeMtimeMs(filePath: string): number {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return 0;
    }
  }

  private buildDiscoveryTargets(params: {
    deepScan: boolean;
    includeLocalhost: boolean;
  }): string[] {
    const targets = new Set<string>();
    const ports = [3200, 3000];
    const hosts = this.collectLanHosts(params.deepScan);

    for (const host of hosts) {
      for (const port of ports) {
        targets.add(`http://${host}:${port}`);
      }
    }

    if (params.includeLocalhost) {
      targets.add('http://127.0.0.1:3200');
      targets.add('http://localhost:3200');
      targets.add('http://127.0.0.1:3000');
      targets.add('http://localhost:3000');
    }

    const cfg = this.configLoader.getConfigSync();
    if (cfg?.remoteApiBaseUrl) {
      targets.add(cfg.remoteApiBaseUrl.replace(/\/+$/, ''));
    }

    return Array.from(targets);
  }

  private collectLanHosts(deepScan: boolean): string[] {
    const network = os.networkInterfaces();
    const hosts = new Set<string>();

    for (const entries of Object.values(network)) {
      if (!entries) {
        continue;
      }

      for (const entry of entries) {
        if (entry.family !== 'IPv4' || entry.internal) {
          continue;
        }

        const octets = entry.address.split('.').map((part) => Number(part));
        if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
          continue;
        }

        const subnetPrefix = `${octets[0]}.${octets[1]}.${octets[2]}`;
        const hostOctet = octets[3];
        const hostCandidates = new Set<number>();

        if (deepScan) {
          for (let n = 1; n <= 254; n += 1) {
            hostCandidates.add(n);
          }
        } else {
          hostCandidates.add(1);
          hostCandidates.add(hostOctet);
          for (let delta = -16; delta <= 16; delta += 1) {
            const next = hostOctet + delta;
            if (next >= 1 && next <= 254) {
              hostCandidates.add(next);
            }
          }
          [10, 20, 50, 100, 150, 200, 254].forEach((value) => hostCandidates.add(value));
        }

        for (const candidate of hostCandidates) {
          hosts.add(`${subnetPrefix}.${candidate}`);
        }
      }
    }

    const limit = deepScan ? 700 : 220;
    return Array.from(hosts).slice(0, limit);
  }

  private async probeApiBase(apiBaseUrl: string, timeoutMs: number): Promise<DiscoveredServerInfo | null> {
    const normalizedBase = apiBaseUrl.replace(/\/+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(normalizedBase);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const startedAt = Date.now();
    const health = await this.fetchJsonWithTimeout(`${normalizedBase}/api/v1/health`, timeoutMs);
    if (!health || health.status < 200 || health.status >= 300) {
      return null;
    }
    const healthData = (health.payload?.data ?? health.payload) as { status?: string } | null;
    if (!healthData || String(healthData.status || '').toLowerCase() !== 'ok') {
      return null;
    }

    const systemInfo = await this.fetchJsonWithTimeout(`${normalizedBase}/api/v1/system/info`, timeoutMs);
    const systemData = (systemInfo?.payload?.data ?? systemInfo?.payload ?? {}) as Record<string, any>;
    const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));

    return {
      apiBaseUrl: normalizedBase,
      host: parsed.hostname,
      port,
      latencyMs: Math.max(1, Date.now() - startedAt),
      setupMode: typeof systemData.setupMode === 'boolean' ? systemData.setupMode : undefined,
      installationMode:
        systemData.installationMode === 'client_only' || systemData.installationMode === 'server_client'
          ? systemData.installationMode
          : undefined,
      app: typeof systemData.app === 'string' ? systemData.app : undefined,
      version: typeof systemData.version === 'string' ? systemData.version : undefined,
    };
  }

  private async fetchJsonWithTimeout(
    url: string,
    timeoutMs: number,
  ): Promise<{ status: number; payload: any } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      return { status: response.status, payload };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R | null>,
  ): Promise<Array<R | null>> {
    const results: Array<R | null> = new Array(items.length).fill(null);
    let index = 0;

    const runWorker = async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    };

    const poolSize = Math.max(1, Math.min(limit, items.length));
    const pool = Array.from({ length: poolSize }, () => runWorker());
    await Promise.all(pool);
    return results;
  }

  private clampInt(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.floor(value)));
  }

  private async refreshRuntimePrisma(stage: string): Promise<void> {
    try {
      await this.prismaService.refreshDatasource(process.env.DATABASE_URL, true);
      this.logger.log(`Runtime Prisma connections refreshed (${stage}).`);
    } catch (error: any) {
      this.logger.warn(
        `Runtime Prisma disconnect skipped (${stage}): ${error?.message || String(error)}`,
      );
    }
  }
}
