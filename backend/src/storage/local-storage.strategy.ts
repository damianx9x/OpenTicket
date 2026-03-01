import { Injectable, Logger } from '@nestjs/common';
import { IStorageStrategy, StorageUploadUrlResponse, StorageDownloadUrlResponse, StorageUploadParams } from './storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigLoaderService } from '../config/config-loader.service';

@Injectable()
export class LocalStorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(LocalStorageStrategy.name);
  private uploadsPath = path.join(process.cwd(), 'uploads');

  constructor(private configLoader: ConfigLoaderService) {
    this.ensureReady();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadsPath}`);
    }
  }

  private ensureReady(): void {
    const config = this.configLoader.getConfigSync();
    const targetPath = config?.uploadsPath || path.join(process.cwd(), 'uploads');
    if (targetPath !== this.uploadsPath) {
      this.uploadsPath = targetPath;
    }
    this.ensureDirectoryExists();
  }

  async generateUploadUrl(params: {
    objectKey: string;
    mimeType: string;
    byteSize: number;
  }): Promise<StorageUploadUrlResponse> {
    this.ensureReady();
    // For local storage, we don't generate presigned URLs
    // Instead, we return a direct upload endpoint
    // Frontend will POST to /api/v1/attachments/upload with the file
    return {
      url: `/api/v1/attachments/upload?key=${encodeURIComponent(params.objectKey)}`,
      objectKey: params.objectKey,
    };
  }

  async generateDownloadUrl(params: { objectKey: string }): Promise<StorageDownloadUrlResponse> {
    this.ensureReady();
    // For local storage, return a direct download URL
    return {
      url: `/api/v1/attachments/download/${encodeURIComponent(params.objectKey)}`,
    };
  }

  async uploadFile(params: StorageUploadParams): Promise<{ objectKey: string; url: string }> {
    this.ensureReady();
    const safeFilename = this.sanitizeFilename(params.filename);
    const objectKey = `${params.ticketId}/${Date.now()}-${safeFilename}`;
    const filePath = this.resolveSafePath(objectKey);

    // Create subdirectory if needed
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, params.fileBuffer);
    this.logger.log(`File uploaded: ${objectKey}`);

    return {
      objectKey,
      url: `/api/v1/attachments/download/${encodeURIComponent(objectKey)}`,
    };
  }

  async deleteFile(params: { objectKey: string }): Promise<void> {
    this.ensureReady();
    const filePath = this.resolveSafePath(params.objectKey);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.log(`File deleted: ${params.objectKey}`);
    }
  }

  async fileExists(params: { objectKey: string }): Promise<boolean> {
    this.ensureReady();
    const filePath = this.resolveSafePath(params.objectKey);
    return fs.existsSync(filePath);
  }

  getProviderName(): string {
    return 'local';
  }

  /**
   * Read file from disk (used by download endpoint)
   */
  async readFile(objectKey: string): Promise<Buffer> {
    this.ensureReady();
    const filePath = this.resolveSafePath(objectKey);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${objectKey}`);
    }

    return fs.promises.readFile(filePath);
  }

  /**
   * Get full file path (for local serving)
   */
  getFilePath(objectKey: string): string {
    this.ensureReady();
    return this.resolveSafePath(objectKey);
  }

  private sanitizeFilename(name: string): string {
    const base = path
      .basename((name || '').trim())
      .replace(/[^A-Za-z0-9._()\-\s]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();

    if (!base || base === '.' || base === '..') {
      return `attachment-${Date.now()}.bin`;
    }

    if (base.length <= 180) {
      return base;
    }

    const ext = path.extname(base);
    const stem = base.slice(0, Math.max(1, 180 - ext.length));
    return `${stem}${ext}`;
  }

  private resolveSafePath(objectKey: string): string {
    const normalizedKey = (objectKey || '').replace(/\\/g, '/');
    const root = path.resolve(this.uploadsPath);
    const target = path.resolve(root, normalizedKey);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid storage object key path.');
    }
    return target;
  }
}
