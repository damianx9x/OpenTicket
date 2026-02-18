import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly prisma: PrismaService) {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'minioadmin';
    const secret = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'minioadmin';
    this.bucket = process.env.MINIO_BUCKET || 'tickets';

    this.s3 = new S3Client({
      endpoint: endpoint.startsWith('http') ? endpoint : `http://${endpoint}:${process.env.MINIO_PORT || 9000}`,
      region: 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secret },
      forcePathStyle: true,
    });
  }

  /**
   * Rejestruje załącznik w DB i generuje presigned PUT URL do uploadu bezpośrednio do MinIO.
   */
  async createWithUploadUrl(dto: CreateAttachmentDto) {
    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${dto.ticketId} not found`);
    }

    // Generate unique objectKey
    const ext = dto.filename.split('.').pop() || 'bin';
    const objectKey = `${dto.ticketId}/${crypto.randomUUID()}.${ext}`;

    // Create DB record
    const attachment = await this.prisma.attachment.create({
      data: {
        ticketId: dto.ticketId,
        uploadedBy: dto.uploadedBy ?? null,
        filename: dto.filename,
        mimeType: dto.mimeType,
        byteSize: BigInt(dto.byteSize),
        storageProvider: 'minio',
        bucket: this.bucket,
        objectKey,
      },
    });

    // Generate presigned PUT URL (valid 15 minutes)
    let uploadUrl: string | null = null;
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: dto.mimeType,
      });
      uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 });
    } catch (err) {
      this.logger.warn(`Could not generate presigned URL: ${err}`);
    }

    this.logger.log(`Attachment registered: ${attachment.id} (${dto.filename})`);
    return {
      attachment,
      uploadUrl,
    };
  }

  /**
   * Generuje presigned GET URL do pobrania pliku.
   */
  async getDownloadUrl(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    try {
      const command = new GetObjectCommand({
        Bucket: attachment.bucket,
        Key: attachment.objectKey,
      });
      const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
      return { attachment, downloadUrl };
    } catch (err) {
      this.logger.error(`Could not generate download URL: ${err}`);
      return { attachment, downloadUrl: null, error: 'Could not generate download URL' };
    }
  }

  /**
   * Lista załączników ticketu.
   */
  async findByTicketId(ticketId: string) {
    return this.prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
        uploader: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Usuwa załącznik z DB i próbuje usunąć z MinIO.
   */
  async remove(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    // Try to delete from storage
    try {
      const command = new DeleteObjectCommand({
        Bucket: attachment.bucket,
        Key: attachment.objectKey,
      });
      await this.s3.send(command);
    } catch (err) {
      this.logger.warn(`Could not delete object from storage: ${err}`);
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    this.logger.log(`Attachment deleted: ${attachmentId}`);
    return { deleted: true };
  }
}
