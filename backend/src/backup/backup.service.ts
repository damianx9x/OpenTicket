import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { AppConfig } from '../config/config.types';
import {
  generateBackupEncryptionKey,
  decryptBackupFileToArchive,
  encryptArchiveToBackupFile,
  isEncryptedBackupFile,
  normalizeBackupEncryptionKey,
} from './backup-encryption';

type ResolvedRuntimePaths = {
  configDir: string;
  configFile: string;
  dataPath: string;
  dbFile: string;
  uploadsDir: string;
  backupsDir: string;
  installationMode: AppConfig['installationMode'];
  remoteApiBaseUrl?: string;
  checkedDbCandidates: string[];
};

type AutoBackupState = {
  lastRunAt?: string;
  nextRunAt?: string;
  lastArchivePath?: string;
  previousArchivePath?: string | null;
  lastError?: string | null;
  lastTrigger?: string | null;
};

type BackupVerificationResult = {
  success: boolean;
  archivePath: string;
  archiveBytes: number;
  encrypted: boolean;
  contains: {
    database: boolean;
    uploads: boolean;
    config: boolean;
  };
  extractedEntries: number;
  manifest: {
    schemaVersion?: number;
    createdAt?: string;
    sourceDataPath?: string;
    includes?: string[];
  } | null;
  warnings: string[];
};

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private readonly maxArchiveBytes = 2 * 1024 * 1024 * 1024;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private autoBackupRunning = false;

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.startAutoBackupLoop();
  }

  onModuleDestroy(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  async exportBackup(actorUserId: string) {
    const runtime = await this.resolveRuntimePaths();

    if (!fs.existsSync(runtime.dbFile)) {
      const checked = runtime.checkedDbCandidates.join(', ');
      if (runtime.installationMode === 'client_only') {
        const target = runtime.remoteApiBaseUrl || 'zdalny serwer (brak skonfigurowanego adresu)';
        throw new BadRequestException(
          `Ta instalacja działa w trybie klienta i nie ma lokalnej bazy danych do eksportu. Wykonaj backup na serwerze: ${target}. Sprawdzone ścieżki: ${checked}.`,
        );
      }

      throw new BadRequestException(
        `Brak pliku bazy danych app.db do eksportu. Sprawdzone ścieżki: ${checked}.`,
      );
    }

    fs.mkdirSync(runtime.backupsDir, { recursive: true });
    const timestamp = this.nowStamp();
    const archiveName = `ticket-backup-${timestamp}.otbackup`;
    const archivePath = path.join(runtime.backupsDir, archiveName);
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-export-'));
    const rawArchivePath = path.join(stageDir, 'backup-plain.tar.gz');
    const includes: string[] = [];

    try {
      // Best-effort checkpoint so SQLite WAL is merged before copy.
      try {
        await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // ignore checkpoint issues; sidecar files are still exported below
      }

      fs.copyFileSync(runtime.dbFile, path.join(stageDir, 'app.db'));
      includes.push('app.db');

      const dbSidecars: Array<{ source: string; target: string }> = [
        { source: `${runtime.dbFile}-wal`, target: 'app.db-wal' },
        { source: `${runtime.dbFile}-shm`, target: 'app.db-shm' },
        { source: `${runtime.dbFile}-journal`, target: 'app.db-journal' },
      ];
      for (const sidecar of dbSidecars) {
        if (!fs.existsSync(sidecar.source)) {
          continue;
        }
        fs.copyFileSync(sidecar.source, path.join(stageDir, sidecar.target));
        includes.push(sidecar.target);
      }

      if (fs.existsSync(runtime.uploadsDir)) {
        fs.cpSync(runtime.uploadsDir, path.join(stageDir, 'uploads'), { recursive: true });
        includes.push('uploads/');
      }
      if (fs.existsSync(runtime.configFile)) {
        fs.copyFileSync(runtime.configFile, path.join(stageDir, 'config.json'));
        includes.push('config.json');
      }

      const manifest = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        actorUserId,
        sourceDataPath: runtime.dataPath,
        sourceDatabaseFile: runtime.dbFile,
        sourceUploadsPath: runtime.uploadsDir,
        includes,
      };
      fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      const tarResult = spawnSync('tar', ['-czf', rawArchivePath, '-C', stageDir, '.'], {
        encoding: 'utf-8',
      });
      if (tarResult.status !== 0) {
        throw new Error((tarResult.stderr || tarResult.stdout || 'tar failed').trim());
      }

      const encryptionKey = await this.resolveConfiguredBackupEncryptionKey();
      await encryptArchiveToBackupFile({
        inputArchivePath: rawArchivePath,
        outputBackupPath: archivePath,
        encryptionKey,
      });

      const stat = fs.statSync(archivePath);
      return {
        archivePath,
        archiveName,
        bytes: stat.size,
        encrypted: true,
      };
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }

  async runAutoBackupNow(trigger = 'manual'): Promise<{
    success: boolean;
    currentPath?: string;
    previousPath?: string | null;
    message: string;
  }> {
    if (this.autoBackupRunning) {
      return { success: false, message: 'Auto-backup jest już w trakcie wykonywania.' };
    }

    this.autoBackupRunning = true;
    try {
      const decision = await this.shouldRunAutoBackup(true);
      if (!decision.enabled) {
        await this.writeAutoBackupState({
          ...decision.state,
          lastError: 'auto-backup-disabled',
          lastTrigger: trigger,
        });
        return { success: false, message: 'Auto-backup jest wyłączony w konfiguracji.' };
      }

      const result = await this.executeAutoBackupRotation({
        targetDir: decision.targetDir,
        keepPrevious: decision.keepPrevious,
      });
      await this.writeAutoBackupState({
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + decision.intervalHours * 60 * 60 * 1000).toISOString(),
        lastArchivePath: result.currentPath,
        previousArchivePath: result.previousPath || null,
        lastError: null,
        lastTrigger: trigger,
      });

      return {
        success: true,
        currentPath: result.currentPath,
        previousPath: result.previousPath,
        message: 'Auto-backup wykonany poprawnie.',
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const now = new Date();
      await this.writeAutoBackupState({
        lastRunAt: now.toISOString(),
        nextRunAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        lastError: reason,
        lastTrigger: trigger,
      });
      throw error;
    } finally {
      this.autoBackupRunning = false;
    }
  }

  async getAutoBackupStatus(): Promise<Record<string, unknown>> {
    const decision = await this.shouldRunAutoBackup(false);
    const now = new Date();
    const nextRunAt = decision.state.nextRunAt ? new Date(decision.state.nextRunAt) : null;
    return {
      enabled: decision.enabled,
      intervalHours: decision.intervalHours,
      targetPath: decision.targetDir,
      keepPrevious: decision.keepPrevious,
      running: this.autoBackupRunning,
      lastRunAt: decision.state.lastRunAt || null,
      nextRunAt: decision.state.nextRunAt || null,
      lastArchivePath: decision.state.lastArchivePath || null,
      previousArchivePath: decision.state.previousArchivePath || null,
      lastError: decision.state.lastError || null,
      lastTrigger: decision.state.lastTrigger || null,
      dueNow: Boolean(nextRunAt && nextRunAt.getTime() <= now.getTime()),
      skippedReason: decision.enabled ? null : 'disabled',
    };
  }

  async importBackupByPath(archivePath: string, encryptionKey?: string) {
    if (!archivePath || archivePath.trim().length === 0) {
      throw new BadRequestException('Brak ścieżki do pliku backupu.');
    }

    const resolved = path.resolve(archivePath);
    if (!fs.existsSync(resolved)) {
      throw new BadRequestException(`Plik backupu nie istnieje: ${resolved}`);
    }
    this.assertArchiveFileIsSafe(resolved);

    await this.importFromArchiveFile(resolved, { encryptionKey });
    return { success: true, archivePath: resolved };
  }

  async verifyBackupByPath(archivePath: string, encryptionKey?: string): Promise<BackupVerificationResult> {
    if (!archivePath || archivePath.trim().length === 0) {
      throw new BadRequestException('Brak ścieżki do pliku backupu.');
    }

    const resolved = path.resolve(archivePath);
    if (!fs.existsSync(resolved)) {
      throw new BadRequestException(`Plik backupu nie istnieje: ${resolved}`);
    }

    return this.inspectBackupArchive(resolved, { encryptionKey });
  }

  async importFromArchiveFile(archivePath: string, options?: { encryptionKey?: string }) {
    const runtime = await this.resolveRuntimePaths();
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-import-'));
    const extractedDir = path.join(stageDir, 'extracted');
    fs.mkdirSync(extractedDir, { recursive: true });

    try {
      this.assertArchiveFileIsSafe(archivePath);
      let archiveToExtract = archivePath;
      if (isEncryptedBackupFile(archivePath)) {
        const decryptionKey = await this.resolveImportBackupEncryptionKey(options?.encryptionKey);
        archiveToExtract = path.join(stageDir, 'decrypted.tar.gz');
        try {
          await decryptBackupFileToArchive({
            inputBackupPath: archivePath,
            outputArchivePath: archiveToExtract,
            encryptionKey: decryptionKey,
          });
        } catch (error: any) {
          throw new BadRequestException(
            `Nie udało się odszyfrować backupu: ${error?.message || 'nieprawidłowy klucz lub uszkodzony plik'}`,
          );
        }
      }
      this.assertArchiveFileIsSafe(archiveToExtract);
      this.assertArchiveEntriesSafe(archiveToExtract);

      const tarResult = spawnSync(
        'tar',
        ['-xzf', archiveToExtract, '-C', extractedDir, '--no-same-owner', '--no-same-permissions'],
        {
          encoding: 'utf-8',
        },
      );
      if (tarResult.status !== 0) {
        throw new Error((tarResult.stderr || tarResult.stdout || 'tar extract failed').trim());
      }
      this.assertNoSymlinks(extractedDir);

      const importedDb = path.join(extractedDir, 'app.db');
      if (!fs.existsSync(importedDb)) {
        throw new BadRequestException('Backup nie zawiera pliku app.db.');
      }

      await this.prisma.$disconnect().catch(() => undefined);
      fs.mkdirSync(runtime.dataPath, { recursive: true });

      // Remove stale SQLite files before restore.
      const dbRestoreTargets = [
        runtime.dbFile,
        `${runtime.dbFile}-wal`,
        `${runtime.dbFile}-shm`,
        `${runtime.dbFile}-journal`,
      ];
      for (const filePath of dbRestoreTargets) {
        fs.rmSync(filePath, { force: true });
      }

      fs.copyFileSync(importedDb, runtime.dbFile);
      const importedSidecars: Array<{ source: string; target: string }> = [
        { source: path.join(extractedDir, 'app.db-wal'), target: `${runtime.dbFile}-wal` },
        { source: path.join(extractedDir, 'app.db-shm'), target: `${runtime.dbFile}-shm` },
        { source: path.join(extractedDir, 'app.db-journal'), target: `${runtime.dbFile}-journal` },
      ];
      for (const sidecar of importedSidecars) {
        if (!fs.existsSync(sidecar.source)) {
          continue;
        }
        fs.copyFileSync(sidecar.source, sidecar.target);
      }

      const importedUploads = path.join(extractedDir, 'uploads');
      if (fs.existsSync(importedUploads)) {
        fs.rmSync(runtime.uploadsDir, { recursive: true, force: true });
        fs.cpSync(importedUploads, runtime.uploadsDir, { recursive: true });
      }

      const importedConfig = path.join(extractedDir, 'config.json');
      if (fs.existsSync(importedConfig)) {
        this.persistImportedConfigSafely(importedConfig, runtime);
      }

      this.configLoader.clearCache();
      this.logger.warn(`Backup imported from ${archivePath}. Recommended action: restart app.`);
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }

  getBackupDownloadPath(fileName: string): string {
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
      throw new BadRequestException('Niepoprawna nazwa pliku backupu.');
    }

    const runtime = this.resolveRuntimePathsSync();
    const fullPath = path.join(runtime.backupsDir, fileName);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Plik backupu nie istnieje.');
    }

    return fullPath;
  }

  private assertArchiveFileIsSafe(archivePath: string): void {
    const resolved = path.resolve(archivePath);
    if (!fs.existsSync(resolved)) {
      throw new BadRequestException(`Plik backupu nie istnieje: ${resolved}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      throw new BadRequestException('Plik backupu jest nieprawidłowy (oczekiwano pliku).');
    }
    if (stat.size <= 0) {
      throw new BadRequestException('Plik backupu jest pusty.');
    }
    if (stat.size > this.maxArchiveBytes) {
      throw new BadRequestException(
        `Plik backupu jest za duży (${Math.round(stat.size / 1024 / 1024)}MB). Maksymalny rozmiar: ${Math.round(
          this.maxArchiveBytes / 1024 / 1024,
        )}MB.`,
      );
    }
  }

  private assertArchiveEntriesSafe(archivePath: string): void {
    const listResult = spawnSync('tar', ['-tzf', archivePath], {
      encoding: 'utf-8',
    });
    if (listResult.status !== 0) {
      throw new BadRequestException(
        `Backup jest niepoprawnym archiwum tar.gz: ${(listResult.stderr || listResult.stdout || 'tar list failed').trim()}`,
      );
    }

    const entries = (listResult.stdout || '')
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const entry of entries) {
      const normalized = entry.replace(/\\/g, '/');
      if (normalized.startsWith('/')) {
        throw new BadRequestException(`Backup zawiera niedozwoloną ścieżkę absolutną: ${entry}`);
      }

      const segments = normalized.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '..')) {
        throw new BadRequestException(`Backup zawiera niedozwolony segment '..': ${entry}`);
      }
    }
  }

  private assertNoSymlinks(rootDir: string): void {
    const stack = [rootDir];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          throw new BadRequestException(`Backup zawiera niedozwolony link symboliczny: ${entry.name}`);
        }
        if (stat.isDirectory()) {
          stack.push(fullPath);
        }
      }
    }
  }

  private async inspectBackupArchive(
    archivePath: string,
    options?: { encryptionKey?: string },
  ): Promise<BackupVerificationResult> {
    const resolvedArchivePath = path.resolve(archivePath);
    this.assertArchiveFileIsSafe(resolvedArchivePath);

    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-verify-'));
    const extractedDir = path.join(stageDir, 'extracted');
    fs.mkdirSync(extractedDir, { recursive: true });

    const warnings: string[] = [];
    const archiveBytes = fs.statSync(resolvedArchivePath).size;
    const encrypted = isEncryptedBackupFile(resolvedArchivePath);

    try {
      let archiveToExtract = resolvedArchivePath;
      if (encrypted) {
        const decryptionKey = await this.resolveImportBackupEncryptionKey(options?.encryptionKey);
        archiveToExtract = path.join(stageDir, 'decrypted.tar.gz');
        try {
          await decryptBackupFileToArchive({
            inputBackupPath: resolvedArchivePath,
            outputArchivePath: archiveToExtract,
            encryptionKey: decryptionKey,
          });
        } catch (error: any) {
          throw new BadRequestException(
            `Nie udało się odszyfrować backupu: ${error?.message || 'nieprawidłowy klucz lub uszkodzony plik'}`,
          );
        }
      }

      this.assertArchiveFileIsSafe(archiveToExtract);
      this.assertArchiveEntriesSafe(archiveToExtract);

      const tarResult = spawnSync(
        'tar',
        ['-xzf', archiveToExtract, '-C', extractedDir, '--no-same-owner', '--no-same-permissions'],
        {
          encoding: 'utf-8',
        },
      );
      if (tarResult.status !== 0) {
        throw new BadRequestException(
          `Nie udało się rozpakować backupu: ${(tarResult.stderr || tarResult.stdout || 'tar extract failed').trim()}`,
        );
      }

      this.assertNoSymlinks(extractedDir);

      const dbExists = fs.existsSync(path.join(extractedDir, 'app.db'));
      if (!dbExists) {
        throw new BadRequestException('Backup nie zawiera pliku app.db.');
      }

      const uploadsExists = fs.existsSync(path.join(extractedDir, 'uploads'));
      const configExists = fs.existsSync(path.join(extractedDir, 'config.json'));

      let manifest: BackupVerificationResult['manifest'] = null;
      const manifestPath = path.join(extractedDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
          manifest = {
            schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : undefined,
            createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
            sourceDataPath: typeof parsed.sourceDataPath === 'string' ? parsed.sourceDataPath : undefined,
            includes: Array.isArray(parsed.includes)
              ? parsed.includes.filter((item): item is string => typeof item === 'string')
              : undefined,
          };
        } catch {
          warnings.push('Nie udało się odczytać manifest.json (plik uszkodzony lub niepoprawny JSON).');
        }
      } else {
        warnings.push('Backup nie zawiera manifest.json (legacy lub archiwum niestandardowe).');
      }

      return {
        success: true,
        archivePath: resolvedArchivePath,
        archiveBytes,
        encrypted,
        contains: {
          database: dbExists,
          uploads: uploadsExists,
          config: configExists,
        },
        extractedEntries: this.countExtractedEntries(extractedDir),
        manifest,
        warnings,
      };
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }

  private countExtractedEntries(rootDir: string): number {
    let count = 0;
    const stack = [rootDir];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        count += 1;
        if (entry.isDirectory()) {
          stack.push(path.join(current, entry.name));
        }
      }
    }
    return count;
  }

  private async resolveConfiguredBackupEncryptionKey(): Promise<string> {
    const runtimeConfig = this.configLoader.getConfigSync();
    const fromEnv = process.env.TICKET_SYSTEM_BACKUP_KEY;
    const candidate = (fromEnv || runtimeConfig?.backupEncryptionKey || '').trim();
    if (candidate) {
      return normalizeBackupEncryptionKey(candidate);
    }

    const generated = generateBackupEncryptionKey();
    const config = runtimeConfig || (await this.configLoader.loadConfig());
    await this.configLoader.saveConfig({
      ...config,
      backupEncryptionKey: generated,
      createdAt: config.createdAt || new Date(),
    });
    this.logger.warn('Brak klucza backupu w konfiguracji. Wygenerowano nowy klucz szyfrowania.');
    return normalizeBackupEncryptionKey(generated);
  }

  private async resolveImportBackupEncryptionKey(candidate?: string): Promise<string> {
    if (candidate && candidate.trim().length > 0) {
      return normalizeBackupEncryptionKey(candidate);
    }
    return this.resolveConfiguredBackupEncryptionKey();
  }

  private startAutoBackupLoop(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }

    const tick = () => {
      void this.runAutoBackupTick().catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Auto-backup tick failed: ${reason}`);
      });
    };

    this.autoBackupTimer = setInterval(tick, 60_000);
    this.autoBackupTimer.unref?.();
    setTimeout(tick, 12_000).unref?.();
  }

  private async runAutoBackupTick(): Promise<void> {
    if (this.autoBackupRunning) {
      return;
    }

    const config = this.configLoader.getConfigSync();
    if (!config || config.setupMode || config.installationMode === 'client_only') {
      return;
    }

    const decision = await this.shouldRunAutoBackup(false);
    if (!decision.enabled || !decision.due) {
      return;
    }

    this.autoBackupRunning = true;
    try {
      const result = await this.executeAutoBackupRotation({
        targetDir: decision.targetDir,
        keepPrevious: decision.keepPrevious,
      });
      await this.writeAutoBackupState({
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + decision.intervalHours * 60 * 60 * 1000).toISOString(),
        lastArchivePath: result.currentPath,
        previousArchivePath: result.previousPath || null,
        lastError: null,
        lastTrigger: 'interval',
      });
      this.logger.log(`Auto-backup completed: ${result.currentPath}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const now = new Date();
      await this.writeAutoBackupState({
        lastRunAt: now.toISOString(),
        nextRunAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        lastError: reason,
        lastTrigger: 'interval',
      });
      this.logger.warn(`Auto-backup failed: ${reason}`);
    } finally {
      this.autoBackupRunning = false;
    }
  }

  private async shouldRunAutoBackup(forceNow: boolean): Promise<{
    enabled: boolean;
    due: boolean;
    intervalHours: number;
    targetDir: string;
    keepPrevious: boolean;
    state: AutoBackupState;
  }> {
    const runtime = await this.resolveRuntimePaths();
    const settings = await this.readBackupSettings(runtime);
    const state = await this.readAutoBackupState();
    if (!forceNow && settings.enabled && !state.nextRunAt) {
      const firstNext = new Date(Date.now() + settings.intervalHours * 60 * 60 * 1000).toISOString();
      const initialized = {
        ...state,
        nextRunAt: firstNext,
        lastTrigger: state.lastTrigger || 'bootstrap',
      };
      await this.writeAutoBackupState(initialized);
      return {
        enabled: settings.enabled,
        due: false,
        intervalHours: settings.intervalHours,
        targetDir: settings.targetPath,
        keepPrevious: settings.keepPrevious,
        state: initialized,
      };
    }
    const now = Date.now();
    const nextRunAt = state.nextRunAt ? new Date(state.nextRunAt).getTime() : 0;
    const due = forceNow || !nextRunAt || nextRunAt <= now;
    return {
      enabled: settings.enabled,
      due,
      intervalHours: settings.intervalHours,
      targetDir: settings.targetPath,
      keepPrevious: settings.keepPrevious,
      state,
    };
  }

  private async readBackupSettings(runtime: ResolvedRuntimePaths): Promise<{
    enabled: boolean;
    intervalHours: number;
    targetPath: string;
    keepPrevious: boolean;
  }> {
    const fallback = {
      enabled: true,
      intervalHours: 24,
      targetPath: path.join(runtime.dataPath, 'backups', 'auto'),
      keepPrevious: true,
    };

    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: 'system.settings' },
        select: { value: true },
      });
      if (!row?.value) {
        return fallback;
      }

      const parsed = JSON.parse(row.value) as Record<string, any>;
      const candidate = (parsed?.backup || {}) as Record<string, any>;
      const enabled = typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled;
      const intervalHoursRaw = Number(candidate.intervalHours ?? fallback.intervalHours);
      const intervalHours = Number.isFinite(intervalHoursRaw)
        ? Math.min(168, Math.max(1, Math.floor(intervalHoursRaw)))
        : fallback.intervalHours;
      const targetPathRaw = String(candidate.targetPath || '').trim();
      const targetPath = targetPathRaw ? path.resolve(targetPathRaw) : fallback.targetPath;
      const keepPrevious = typeof candidate.keepPrevious === 'boolean' ? candidate.keepPrevious : true;
      return { enabled, intervalHours, targetPath, keepPrevious };
    } catch {
      return fallback;
    }
  }

  private async executeAutoBackupRotation(params: {
    targetDir: string;
    keepPrevious: boolean;
  }): Promise<{ currentPath: string; previousPath: string | null }> {
    const exportResult = await this.exportBackup('system:auto');
    const targetDir = path.resolve(params.targetDir);
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    const currentPath = path.join(targetDir, 'openticket-auto-backup.current.otbackup');
    const previousPath = path.join(targetDir, 'openticket-auto-backup.previous.otbackup');
    const tempPath = path.join(targetDir, `openticket-auto-backup.tmp.${Date.now()}.otbackup`);

    fs.copyFileSync(exportResult.archivePath, tempPath);

    if (params.keepPrevious) {
      fs.rmSync(previousPath, { force: true });
      if (fs.existsSync(currentPath)) {
        fs.renameSync(currentPath, previousPath);
      }
    } else {
      fs.rmSync(currentPath, { force: true });
      fs.rmSync(previousPath, { force: true });
    }

    fs.renameSync(tempPath, currentPath);

    if (path.resolve(exportResult.archivePath) !== path.resolve(currentPath)) {
      fs.rmSync(exportResult.archivePath, { force: true });
    }

    return {
      currentPath,
      previousPath: params.keepPrevious && fs.existsSync(previousPath) ? previousPath : null,
    };
  }

  private async readAutoBackupState(): Promise<AutoBackupState> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: 'backup.auto.state.v1' },
        select: { value: true },
      });
      if (!row?.value) {
        return {};
      }
      const parsed = JSON.parse(row.value) as AutoBackupState;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async writeAutoBackupState(state: AutoBackupState): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: 'backup.auto.state.v1' },
      update: { value: JSON.stringify(state) },
      create: { key: 'backup.auto.state.v1', value: JSON.stringify(state) },
    });
  }

  private async resolveRuntimePaths(): Promise<ResolvedRuntimePaths> {
    const runtime = this.resolveRuntimePathsSync();
    const liveDbFile = await this.detectLiveSqliteDatabasePath();
    if (liveDbFile && fs.existsSync(liveDbFile)) {
      const liveDataPath = path.dirname(liveDbFile);
      runtime.dbFile = liveDbFile;
      runtime.dataPath = liveDataPath;
      runtime.uploadsDir = fs.existsSync(path.join(liveDataPath, 'uploads'))
        ? path.join(liveDataPath, 'uploads')
        : runtime.uploadsDir;
      runtime.backupsDir = path.join(liveDataPath, 'backups');
      runtime.checkedDbCandidates = this.uniqueNormalizedPaths([liveDbFile, ...runtime.checkedDbCandidates]);
    }
    return runtime;
  }

  private resolveRuntimePathsSync(): ResolvedRuntimePaths {
    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    const cached = this.configLoader.getConfigSync();
    const fileConfig = this.readConfigFile(configFile);

    const candidateDataPaths = this.uniqueNormalizedPaths([
      process.env.TICKET_SYSTEM_DATA_DIR,
      cached?.dataPath,
      fileConfig?.dataPath,
      this.configLoader.getDefaultDataDirectoryPath(),
      ...this.resolveLegacyDataPathCandidates(),
    ]);

    const candidateDbFiles = this.uniqueNormalizedPaths([
      this.resolveSqlitePath(process.env.DATABASE_URL),
      this.resolveSqlitePath(cached?.databaseUrl),
      this.resolveSqlitePath(fileConfig?.databaseUrl),
      ...candidateDataPaths.map((dataPath) => path.join(dataPath, 'app.db')),
      ...this.findAppDbFiles(candidateDataPaths),
    ]);

    const existingDbFile = candidateDbFiles.find((dbPath) => fs.existsSync(dbPath));
    const dbFile = existingDbFile || candidateDbFiles[0] || path.join(this.configLoader.getDefaultDataDirectoryPath(), 'app.db');
    const dataPath = path.dirname(dbFile);

    const candidateUploads = [
      cached?.uploadsPath,
      fileConfig?.uploadsPath,
      ...candidateDataPaths.map((candidate) => path.join(candidate, 'uploads')),
      path.join(dataPath, 'uploads'),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => path.resolve(value));

    const uploadsDir = candidateUploads.find((uploadsPath) => fs.existsSync(uploadsPath)) || path.join(dataPath, 'uploads');
    const backupsDir = path.join(dataPath, 'backups');

    return {
      configDir,
      configFile,
      dataPath,
      dbFile,
      uploadsDir,
      backupsDir,
      installationMode: cached?.installationMode || fileConfig?.installationMode || 'server_client',
      remoteApiBaseUrl: cached?.remoteApiBaseUrl || fileConfig?.remoteApiBaseUrl || undefined,
      checkedDbCandidates: candidateDbFiles,
    };
  }

  private async detectLiveSqliteDatabasePath(): Promise<string | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ name: string; file: string }>>(
        'PRAGMA database_list;',
      );
      const mainEntry = (rows || []).find((entry) => entry?.name === 'main' && entry?.file);
      if (!mainEntry?.file) {
        return null;
      }
      return path.resolve(mainEntry.file);
    } catch {
      return null;
    }
  }

  private findAppDbFiles(dataPaths: string[]): string[] {
    const matches = new Set<string>();
    for (const dataPath of dataPaths) {
      const candidate = path.join(dataPath, 'app.db');
      if (fs.existsSync(candidate)) {
        matches.add(path.resolve(candidate));
      }
    }
    return [...matches];
  }

  private uniqueNormalizedPaths(values: Array<string | null | undefined>): string[] {
    const unique = new Set<string>();
    for (const raw of values) {
      if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
        continue;
      }
      unique.add(path.resolve(raw));
    }
    return [...unique];
  }

  private resolveLegacyDataPathCandidates(): string[] {
    const platform = os.platform();
    const homeDir = os.homedir();
    if (platform === 'darwin') {
      return [
        path.join(homeDir, 'Library', 'Application Support', 'ticket-system', 'data'),
        path.join(homeDir, 'Library', 'Application Support', 'TicketSystem', 'data'),
        path.join(homeDir, 'Library', 'Application Support', 'openticket-desktop', 'data'),
      ];
    }
    if (platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      return [path.join(appData, 'ticket-system', 'data'), path.join(appData, 'OpenTicketDesktop', 'data')];
    }
    return [path.join(homeDir, '.local', 'share', 'ticket-system', 'data')];
  }

  private persistImportedConfigSafely(importedConfigPath: string, runtime: ResolvedRuntimePaths): void {
    const imported = this.readConfigFile(importedConfigPath) || {};
    const existing = this.readConfigFile(runtime.configFile) || this.configLoader.getConfigSync() || {};

    const merged: Partial<AppConfig> = {
      ...existing,
      ...imported,
      setupMode: false,
      installationMode: existing.installationMode || imported.installationMode || 'server_client',
      dataPath: runtime.dataPath,
      uploadsPath: runtime.uploadsDir,
      databaseUrl: this.toSqliteDatabaseUrl(runtime.dbFile),
      createdAt: new Date(),
    };

    fs.mkdirSync(runtime.configDir, { recursive: true, mode: 0o700 });
    const serializable = {
      ...merged,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(runtime.configFile, JSON.stringify(serializable, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    try {
      fs.chmodSync(runtime.configFile, 0o600);
    } catch {
      // ignore chmod errors on unsupported filesystems
    }
  }

  private readConfigFile(configPath: string): Partial<AppConfig> | null {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<AppConfig>;
    } catch {
      return null;
    }
  }

  private resolveSqlitePath(databaseUrl?: string): string | null {
    if (!databaseUrl || typeof databaseUrl !== 'string' || !databaseUrl.startsWith('file:')) {
      return null;
    }
    const rawPath = databaseUrl.slice(5);
    try {
      return path.resolve(decodeURI(rawPath));
    } catch {
      return path.resolve(rawPath);
    }
  }

  private toSqliteDatabaseUrl(dbPath: string): string {
    const resolved = path.resolve(dbPath);
    if (process.platform === 'win32') {
      const normalized = resolved.replace(/\\/g, '/');
      return normalized.startsWith('/') ? `file:${normalized}` : `file:/${normalized}`;
    }
    return `file:${resolved}`;
  }

  private nowStamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, '0');
    const dd = `${now.getDate()}`.padStart(2, '0');
    const hh = `${now.getHours()}`.padStart(2, '0');
    const mi = `${now.getMinutes()}`.padStart(2, '0');
    const ss = `${now.getSeconds()}`.padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }
}
