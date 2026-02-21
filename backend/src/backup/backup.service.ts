import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { AppConfig } from '../config/config.types';

type ResolvedRuntimePaths = {
  configDir: string;
  configFile: string;
  dataPath: string;
  dbFile: string;
  uploadsDir: string;
  backupsDir: string;
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  async exportBackup(actorUserId: string) {
    const runtime = this.resolveRuntimePaths();

    if (!fs.existsSync(runtime.dbFile)) {
      throw new BadRequestException(
        `Brak pliku bazy danych app.db do eksportu (sprawdzono: ${runtime.dbFile}).`,
      );
    }

    fs.mkdirSync(runtime.backupsDir, { recursive: true });
    const timestamp = this.nowStamp();
    const archiveName = `ticket-backup-${timestamp}.tar.gz`;
    const archivePath = path.join(runtime.backupsDir, archiveName);
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-export-'));

    try {
      fs.copyFileSync(runtime.dbFile, path.join(stageDir, 'app.db'));
      if (fs.existsSync(runtime.uploadsDir)) {
        fs.cpSync(runtime.uploadsDir, path.join(stageDir, 'uploads'), { recursive: true });
      }
      if (fs.existsSync(runtime.configFile)) {
        fs.copyFileSync(runtime.configFile, path.join(stageDir, 'config.json'));
      }

      const manifest = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        actorUserId,
        sourceDataPath: runtime.dataPath,
        sourceDatabaseFile: runtime.dbFile,
        sourceUploadsPath: runtime.uploadsDir,
        includes: ['app.db', 'uploads/', 'config.json'],
      };
      fs.writeFileSync(path.join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      const tarResult = spawnSync('tar', ['-czf', archivePath, '-C', stageDir, '.'], {
        encoding: 'utf-8',
      });
      if (tarResult.status !== 0) {
        throw new Error((tarResult.stderr || tarResult.stdout || 'tar failed').trim());
      }

      const stat = fs.statSync(archivePath);
      return {
        archivePath,
        archiveName,
        bytes: stat.size,
      };
    } finally {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
  }

  async importBackupByPath(archivePath: string) {
    if (!archivePath || archivePath.trim().length === 0) {
      throw new BadRequestException('Brak ścieżki do pliku backupu.');
    }

    const resolved = path.resolve(archivePath);
    if (!fs.existsSync(resolved)) {
      throw new BadRequestException(`Plik backupu nie istnieje: ${resolved}`);
    }

    await this.importFromArchiveFile(resolved);
    return { success: true, archivePath: resolved };
  }

  async importFromArchiveFile(archivePath: string) {
    const runtime = this.resolveRuntimePaths();
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-import-'));

    try {
      const tarResult = spawnSync('tar', ['-xzf', archivePath, '-C', stageDir], {
        encoding: 'utf-8',
      });
      if (tarResult.status !== 0) {
        throw new Error((tarResult.stderr || tarResult.stdout || 'tar extract failed').trim());
      }

      const importedDb = path.join(stageDir, 'app.db');
      if (!fs.existsSync(importedDb)) {
        throw new BadRequestException('Backup nie zawiera pliku app.db.');
      }

      await this.prisma.$disconnect().catch(() => undefined);
      fs.mkdirSync(runtime.dataPath, { recursive: true });
      fs.copyFileSync(importedDb, runtime.dbFile);

      const importedUploads = path.join(stageDir, 'uploads');
      if (fs.existsSync(importedUploads)) {
        fs.rmSync(runtime.uploadsDir, { recursive: true, force: true });
        fs.cpSync(importedUploads, runtime.uploadsDir, { recursive: true });
      }

      const importedConfig = path.join(stageDir, 'config.json');
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

    const runtime = this.resolveRuntimePaths();
    const fullPath = path.join(runtime.backupsDir, fileName);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Plik backupu nie istnieje.');
    }

    return fullPath;
  }

  private resolveRuntimePaths(): ResolvedRuntimePaths {
    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    const cached = this.configLoader.getConfigSync();
    const fileConfig = this.readConfigFile(configFile);

    const candidateDataPaths = [
      process.env.TICKET_SYSTEM_DATA_DIR,
      cached?.dataPath,
      fileConfig?.dataPath,
      this.configLoader.getDefaultDataDirectoryPath(),
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => path.resolve(value));

    const candidateDbFiles = [
      this.resolveSqlitePath(process.env.DATABASE_URL),
      this.resolveSqlitePath(cached?.databaseUrl),
      this.resolveSqlitePath(fileConfig?.databaseUrl),
      ...candidateDataPaths.map((dataPath) => path.join(dataPath, 'app.db')),
    ].filter((value): value is string => !!value);

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
    };
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

    fs.mkdirSync(runtime.configDir, { recursive: true });
    const serializable = {
      ...merged,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(runtime.configFile, JSON.stringify(serializable, null, 2), 'utf-8');
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
    return `file:${encodeURI(path.resolve(dbPath))}`;
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
