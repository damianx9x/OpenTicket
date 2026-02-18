import { Injectable, Logger } from '@nestjs/common';
import { IStorageStrategy } from './storage.interface';
import { LocalStorageStrategy } from './local-storage.strategy';
import { S3StorageStrategy } from './s3-storage.strategy';
import { ConfigLoaderService } from '../config/config-loader.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private strategy: IStorageStrategy | null = null;

  constructor(
    private configLoader: ConfigLoaderService,
    private localStorage: LocalStorageStrategy,
    private s3Storage: S3StorageStrategy,
  ) {}

  /**
   * Initialize and get the appropriate storage strategy based on configuration
   */
  getStrategy(): IStorageStrategy {
    if (this.strategy) {
      return this.strategy;
    }

    const config = this.configLoader.getConfigSync();
    
    if (!config) {
      this.logger.warn('No configuration found, defaulting to local storage');
      this.strategy = this.localStorage;
    } else if (config.storageMode === 'local') {
      this.logger.log('Using local storage strategy');
      this.strategy = this.localStorage;
    } else if (config.storageMode === 's3') {
      this.logger.log('Using S3 storage strategy');
      this.strategy = this.s3Storage;
    } else {
      this.logger.warn(`Unknown storage mode: ${config.storageMode}, defaulting to local storage`);
      this.strategy = this.localStorage;
    }

    return this.strategy;
  }

  /**
   * Proxy methods to the underlying strategy
   */
  async generateUploadUrl(params: {
    objectKey: string;
    mimeType: string;
    byteSize: number;
  }) {
    return this.getStrategy().generateUploadUrl(params);
  }

  async generateDownloadUrl(params: { objectKey: string }) {
    return this.getStrategy().generateDownloadUrl(params);
  }

  async uploadFile(params: any) {
    return this.getStrategy().uploadFile(params);
  }

  async deleteFile(params: { objectKey: string }) {
    return this.getStrategy().deleteFile(params);
  }

  async fileExists(params: { objectKey: string }) {
    return this.getStrategy().fileExists(params);
  }

  getProviderName(): string {
    return this.getStrategy().getProviderName();
  }

  /**
   * Get local storage strategy (if available)
   */
  getLocalStrategy(): LocalStorageStrategy | null {
    return this.strategy instanceof LocalStorageStrategy ? this.strategy : this.localStorage;
  }
}
