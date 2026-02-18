/**
 * Storage abstraction interface
 * Allows switching between local filesystem and S3/MinIO
 */

export interface StorageUploadParams {
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  byteSize: number;
  ticketId: string;
}

export interface StorageUrlParams {
  bucketName: string;
  objectKey: string;
  expiresIn?: number; // seconds
}

export interface StorageDownloadUrlResponse {
  url: string;
  expiresAt?: Date;
}

export interface StorageUploadUrlResponse {
  url: string;
  expiresAt?: Date;
  objectKey: string;
}

export interface IStorageStrategy {
  /**
   * Generate presigned PUT URL for direct upload (used by frontend)
   */
  generateUploadUrl(params: {
    objectKey: string;
    mimeType: string;
    byteSize: number;
  }): Promise<StorageUploadUrlResponse>;

  /**
   * Generate presigned GET URL for download
   */
  generateDownloadUrl(params: {
    objectKey: string;
  }): Promise<StorageDownloadUrlResponse>;

  /**
   * Upload a file directly to storage
   */
  uploadFile(params: StorageUploadParams): Promise<{ objectKey: string; url: string }>;

  /**
   * Delete a file from storage
   */
  deleteFile(params: { objectKey: string }): Promise<void>;

  /**
   * Check if file exists
   */
  fileExists(params: { objectKey: string }): Promise<boolean>;

  /**
   * Get storage provider name (e.g., 'local', 's3', 'minio')
   */
  getProviderName(): string;
}
