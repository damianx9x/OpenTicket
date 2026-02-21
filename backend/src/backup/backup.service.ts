import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  async exportBackup(actorUserId: string) {
    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    const dataPath = this.resolveDataPathFromConfig(configFile);
    const dbFile = path.join(dataPath, 'app.db');
    const uploadsDir = path.join(dataPath, 'uploads');
    const backupsDir = path.join(dataPath, 'backups');

    if (!fs.existsSync(dbFile)) {
      throw new BadRequestException('Brak pliku bazy danych app.db do eksportu.');
    }

    fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = this.nowStamp();
    const archiveName = `ticket-backup-${timestamp}.tar.gz`;
    const archivePath = path.join(backupsDir, archiveName);
    const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticket-backup-export-'));

    try {
      fs.copyFileSync(dbFile, path.join(stageDir, 'app.db'));
      if (fs.existsSync(uploadsDir)) {
        fs.cpSync(uploadsDir, path.join(stageDir, 'uploads'), { recursive: true });
      }
      if (fs.existsSync(configFile)) {
        fs.copyFileSync(configFile, path.join(stageDir, 'config.json'));
      }

      const manifest = {
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        actorUserId,
        sourceDataPath: dataPath,
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
    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    const dataPath = this.resolveDataPathFromConfig(configFile);
    const dbFile = path.join(dataPath, 'app.db');
    const uploadsDir = path.join(dataPath, 'uploads');
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
      fs.mkdirSync(dataPath, { recursive: true });
      fs.copyFileSync(importedDb, dbFile);

      const importedUploads = path.join(stageDir, 'uploads');
      if (fs.existsSync(importedUploads)) {
        fs.rmSync(uploadsDir, { recursive: true, force: true });
        fs.cpSync(importedUploads, uploadsDir, { recursive: true });
      }

      const importedConfig = path.join(stageDir, 'config.json');
      if (fs.existsSync(importedConfig)) {
        fs.mkdirSync(configDir, { recursive: true });
        fs.copyFileSync(importedConfig, configFile);
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

    const configDir = this.configLoader.getConfigDirectoryPath();
    const configFile = path.join(configDir, 'config.json');
    const dataPath = this.resolveDataPathFromConfig(configFile);
    const fullPath = path.join(dataPath, 'backups', fileName);

    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('Plik backupu nie istnieje.');
    }

    return fullPath;
  }

  private resolveDataPathFromConfig(configFile: string): string {
    if (fs.existsSync(configFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(configFile, 'utf-8')) as { dataPath?: string };
        if (parsed?.dataPath) {
          return path.resolve(parsed.dataPath);
        }
      } catch {
        // fallback below
      }
    }

    return this.configLoader.getDefaultDataDirectoryPath();
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
