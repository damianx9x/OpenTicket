import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as os from 'os';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Backup')
@Controller('system/backup')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class BackupController {
  private static readonly MAX_UPLOAD_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;

  constructor(private readonly backupService: BackupService) {}

  @Post('export')
  @ApiOperation({ summary: 'Eksport całego systemu do jednego, szyfrowanego pliku (.otbackup)' })
  async export(@CurrentUser() user: AuthenticatedUser) {
    return this.backupService.exportBackup(user.id);
  }

  @Get('download/:fileName')
  @ApiOperation({ summary: 'Pobierz wygenerowany plik backupu' })
  async download(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = this.backupService.getBackupDownloadPath(fileName);
    return res.download(filePath);
  }

  @Get('auto-status')
  @ApiOperation({ summary: 'Status automatycznych backupów' })
  async autoStatus() {
    return this.backupService.getAutoBackupStatus();
  }

  @Post('auto-run')
  @ApiOperation({ summary: 'Wymuś natychmiastowy automatyczny backup' })
  async autoRun(@CurrentUser() user: AuthenticatedUser) {
    return this.backupService.runAutoBackupNow(`manual:${user.id}`);
  }

  @Post('import-path')
  @ApiOperation({ summary: 'Import backupu ze ścieżki lokalnej serwera' })
  async importByPath(@Body() body: { archivePath?: string; encryptionKey?: string }) {
    return this.backupService.importBackupByPath(body.archivePath || '', body.encryptionKey || '');
  }

  @Post('verify-path')
  @ApiOperation({ summary: 'Sprawdź integralność backupu ze ścieżki lokalnej (bez importu)' })
  async verifyByPath(@Body() body: { archivePath?: string; encryptionKey?: string }) {
    return this.backupService.verifyBackupByPath(body.archivePath || '', body.encryptionKey || '');
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('backup', {
      dest: os.tmpdir(),
      limits: { fileSize: BackupController.MAX_UPLOAD_BACKUP_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Import backupu z uploadowanego pliku .otbackup / .tar.gz' })
  async importUploaded(
    @UploadedFile() file?: { path?: string; originalname?: string },
    @Body() body?: { encryptionKey?: string },
  ) {
    if (!file?.path || !fs.existsSync(file.path)) {
      throw new BadRequestException('Brak pliku backupu do importu.');
    }

    const originalName = (file.originalname || '').trim().toLowerCase();
    if (originalName && !/\.(otbackup|tar\.gz|tgz|gz)$/.test(originalName)) {
      throw new BadRequestException('Do importu backupu użyj pliku .otbackup lub .tar.gz.');
    }

    try {
      await this.backupService.importFromArchiveFile(file.path, {
        encryptionKey: body?.encryptionKey || '',
      });
      return { success: true };
    } finally {
      fs.rmSync(file.path, { force: true });
    }
  }

  @Post('verify')
  @UseInterceptors(
    FileInterceptor('backup', {
      dest: os.tmpdir(),
      limits: { fileSize: BackupController.MAX_UPLOAD_BACKUP_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Sprawdź integralność uploadowanego backupu (.otbackup / .tar.gz) bez importu' })
  async verifyUploaded(
    @UploadedFile() file?: { path?: string; originalname?: string },
    @Body() body?: { encryptionKey?: string },
  ) {
    if (!file?.path || !fs.existsSync(file.path)) {
      throw new BadRequestException('Brak pliku backupu do weryfikacji.');
    }

    const originalName = (file.originalname || '').trim().toLowerCase();
    if (originalName && !/\.(otbackup|tar\.gz|tgz|gz)$/.test(originalName)) {
      throw new BadRequestException('Do weryfikacji backupu użyj pliku .otbackup lub .tar.gz.');
    }

    try {
      return this.backupService.verifyBackupByPath(file.path, body?.encryptionKey || '');
    } finally {
      fs.rmSync(file.path, { force: true });
    }
  }
}
