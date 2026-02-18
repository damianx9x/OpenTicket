import { Injectable, Logger } from '@nestjs/common';
import { IStorageStrategy, StorageUploadUrlResponse, StorageDownloadUrlResponse, StorageUploadParams } from './storage.interface';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import { ConfigLoaderService } from '../config/config-loader.service';

@Injectable()
export class S3StorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(S3StorageStrategy.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private configLoader: ConfigLoaderService) {
    const config = configLoader.getConfigSync();
    
    this.endpoint = config?.s3Endpoint || process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const accessKey = config?.s3AccessKey || process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin';
    const secret = config?.s3SecretKey || process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin';
    this.bucket = config?.s3Bucket || process.env.MINIO_BUCKET || 'tickets';

    this.s3 = new S3Client({
      endpoint: this.endpoint.startsWith('http') ? this.endpoint : `http://${this.endpoint}:${process.env.MINIO_PORT || 9000}`,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secret },
      forcePathStyle: true,
    });

    this.logger.log(`S3 Storage initialized: endpoint=${this.endpoint}, bucket=${this.bucket}`);
  }

  async generateUploadUrl(params: {
    objectKey: string;
    mimeType: string;
    byteSize: number;
  }): Promise<StorageUploadUrlResponse> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
        ContentType: params.mimeType,
      });

      const url = await getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 minutes

      return {
        url,
        objectKey: params.objectKey,
        expiresAt: new Date(Date.now() + 900 * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to generate upload URL: ${error}`);
      throw error;
    }
  }

  async generateDownloadUrl(params: { objectKey: string }): Promise<StorageDownloadUrlResponse> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
      });

      const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 }); // 1 hour

      return {
        url,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      };
    } catch (error) {
      this.logger.error(`Failed to generate download URL: ${error}`);
      throw error;
    }
  }

  async uploadFile(params: StorageUploadParams): Promise<{ objectKey: string; url: string }> {
    const ext = params.filename.split('.').pop() || 'bin';
    const objectKey = `${params.ticketId}/${crypto.randomUUID()}.${ext}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: params.fileBuffer,
        ContentType: params.mimeType,
      });

      await this.s3.send(command);
      this.logger.log(`File uploaded to S3: ${objectKey}`);

      // Generate download URL for response
      const dlCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      const url = await getSignedUrl(this.s3, dlCommand, { expiresIn: 3600 });

      return { objectKey, url };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error}`);
      throw error;
    }
  }

  async deleteFile(params: { objectKey: string }): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
      });

      await this.s3.send(command);
      this.logger.log(`File deleted from S3: ${params.objectKey}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file: ${error}`);
      // Don't throw - deletion failures shouldn't block operations
    }
  }

  async fileExists(params: { objectKey: string }): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: params.objectKey,
      });

      await this.s3.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      this.logger.error(`Error checking file existence: ${error}`);
      throw error;
    }
  }

  getProviderName(): string {
    return 's3';
  }
}
