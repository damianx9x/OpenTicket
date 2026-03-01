import { requestData } from '@/lib/api-base';

export interface BackupExportResult {
  archivePath: string;
  archiveName: string;
  bytes: number;
  encrypted?: boolean;
}

export async function exportBackup(): Promise<BackupExportResult> {
  return requestData<BackupExportResult>('/api/v1/system/backup/export', {
    method: 'POST',
  });
}

export async function importBackupByPath(
  archivePath: string,
  encryptionKey?: string,
): Promise<{ success: boolean }> {
  return requestData('/api/v1/system/backup/import-path', {
    method: 'POST',
    body: JSON.stringify({ archivePath, encryptionKey }),
  });
}

export async function importBackupFromFile(
  file: File,
  encryptionKey?: string,
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('backup', file);
  if (encryptionKey && encryptionKey.trim().length > 0) {
    formData.append('encryptionKey', encryptionKey.trim());
  }

  return requestData('/api/v1/system/backup/import', {
    method: 'POST',
    body: formData,
  });
}

export function buildBackupDownloadUrl(fileName: string): string {
  return `/api/v1/system/backup/download/${encodeURIComponent(fileName)}`;
}

export interface AutoBackupStatus {
  enabled: boolean;
  intervalHours: number;
  targetPath: string;
  keepPrevious: boolean;
  running: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastArchivePath?: string | null;
  previousArchivePath?: string | null;
  lastError?: string | null;
  lastTrigger?: string | null;
  dueNow?: boolean;
}

export interface BackupVerificationResult {
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
}

export async function getAutoBackupStatus(): Promise<AutoBackupStatus> {
  return requestData<AutoBackupStatus>('/api/v1/system/backup/auto-status');
}

export async function runAutoBackupNow(): Promise<{
  success: boolean;
  message: string;
  currentPath?: string;
  previousPath?: string | null;
}> {
  return requestData('/api/v1/system/backup/auto-run', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function verifyBackupByPath(
  archivePath: string,
  encryptionKey?: string,
): Promise<BackupVerificationResult> {
  return requestData<BackupVerificationResult>('/api/v1/system/backup/verify-path', {
    method: 'POST',
    body: JSON.stringify({ archivePath, encryptionKey }),
  });
}

export async function verifyBackupFromFile(
  file: File,
  encryptionKey?: string,
): Promise<BackupVerificationResult> {
  const formData = new FormData();
  formData.append('backup', file);
  if (encryptionKey && encryptionKey.trim().length > 0) {
    formData.append('encryptionKey', encryptionKey.trim());
  }

  return requestData<BackupVerificationResult>('/api/v1/system/backup/verify', {
    method: 'POST',
    body: formData,
  });
}
