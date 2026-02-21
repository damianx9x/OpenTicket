import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { StorageService } from '../storage/storage.service';
import * as crypto from 'crypto';
import * as fs from 'fs';

type UploadedFileLike = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  private readonly allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);
  private readonly maxUploadSizeBytes = 25 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createWithUploadUrl(dto: CreateAttachmentDto) {
    if (!dto.ticketId) {
      throw new BadRequestException('Brak ticketId w ścieżce żądania.');
    }

    await this.ensureTicketExists(dto.ticketId);
    this.validateAttachmentInput({
      filename: dto.filename,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });

    const ext = dto.filename.split('.').pop() || 'bin';
    const objectKey = `${dto.ticketId}/${crypto.randomUUID()}.${ext}`;
    const upload = await this.storageService.generateUploadUrl({
      objectKey,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        ticketId: dto.ticketId,
        uploadedBy: dto.uploadedBy ?? null,
        filename: dto.filename,
        mimeType: dto.mimeType,
        byteSize: BigInt(dto.byteSize),
        storageProvider: this.storageService.getProviderName(),
        bucket: this.resolveBucketName(),
        objectKey: upload.objectKey || objectKey,
      },
      select: {
        id: true,
        ticketId: true,
        filename: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
      },
    });

    this.logger.log(`Attachment registered: ${attachment.id} (${dto.filename})`);
    return {
      attachment: this.normalizeAttachment(attachment),
      uploadUrl: upload.url,
      provider: this.storageService.getProviderName(),
    };
  }

  async uploadAndCreate(ticketId: string, file: UploadedFileLike, uploadedBy?: string) {
    await this.ensureTicketExists(ticketId);
    this.validateAttachmentInput({
      filename: file.originalname,
      mimeType: file.mimetype,
      byteSize: file.size,
    });

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Plik jest pusty lub nie został poprawnie odczytany.');
    }

    const upload = await this.storageService.uploadFile({
      fileBuffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      byteSize: file.size,
      ticketId,
    });

    const attachment = await this.prisma.attachment.create({
      data: {
        ticketId,
        uploadedBy: uploadedBy ?? null,
        filename: file.originalname,
        mimeType: file.mimetype,
        byteSize: BigInt(file.size),
        storageProvider: this.storageService.getProviderName(),
        bucket: this.resolveBucketName(),
        objectKey: upload.objectKey,
      },
      select: {
        id: true,
        ticketId: true,
        filename: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
      },
    });

    this.logger.log(`Attachment uploaded: ${attachment.id} (${file.originalname})`);
    return {
      attachment: this.normalizeAttachment(attachment),
      downloadUrl: `/api/v1/attachments/${attachment.id}/file`,
      provider: this.storageService.getProviderName(),
    };
  }

  async getDownloadUrl(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    const provider = attachment.storageProvider || this.storageService.getProviderName();

    if (provider === 'local') {
      return {
        attachment: this.normalizeAttachment(attachment),
        downloadUrl: `/api/v1/attachments/${attachment.id}/file`,
      };
    }

    const download = await this.storageService.generateDownloadUrl({
      objectKey: attachment.objectKey,
    });
    return {
      attachment: this.normalizeAttachment(attachment),
      downloadUrl: download.url,
    };
  }

  async resolveFileAccess(attachmentId: string): Promise<
    | { mode: 'file'; filePath: string; mimeType: string; filename: string }
    | { mode: 'redirect'; url: string }
  > {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    const provider = attachment.storageProvider || this.storageService.getProviderName();
    if (provider === 'local') {
      const local = this.storageService.getLocalStrategy();
      const filePath = local?.getFilePath(attachment.objectKey);
      if (!filePath || !fs.existsSync(filePath)) {
        throw new NotFoundException('Plik załącznika nie istnieje w pamięci lokalnej.');
      }

      return {
        mode: 'file',
        filePath,
        mimeType: attachment.mimeType,
        filename: attachment.filename,
      };
    }

    const download = await this.storageService.generateDownloadUrl({
      objectKey: attachment.objectKey,
    });
    return {
      mode: 'redirect',
      url: download.url,
    };
  }

  async findByTicketId(ticketId: string) {
    const items = await this.prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
        storageProvider: true,
        uploader: { select: { id: true, name: true } },
      },
    });

    return items.map((item) => this.normalizeAttachment(item));
  }

  async remove(attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    try {
      await this.storageService.deleteFile({ objectKey: attachment.objectKey });
    } catch (err) {
      this.logger.warn(`Could not delete object from storage: ${err}`);
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    this.logger.log(`Attachment deleted: ${attachmentId}`);
    return { deleted: true };
  }

  private resolveBucketName(): string {
    const provider = this.storageService.getProviderName();
    if (provider === 'local') {
      return 'local';
    }
    return process.env.MINIO_BUCKET || 'tickets';
  }

  private async ensureTicketExists(ticketId: string): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }
  }

  private validateAttachmentInput(input: { filename: string; mimeType: string; byteSize: number }): void {
    if (!this.allowedMimeTypes.has(input.mimeType)) {
      throw new BadRequestException(
        `Niedozwolony typ pliku (${input.mimeType}). Dozwolone: ${Array.from(this.allowedMimeTypes).join(', ')}`,
      );
    }

    if (!Number.isFinite(input.byteSize) || input.byteSize <= 0 || input.byteSize > this.maxUploadSizeBytes) {
      throw new BadRequestException(
        `Nieprawidłowy rozmiar pliku. Maksymalny rozmiar: ${this.maxUploadSizeBytes / (1024 * 1024)}MB.`,
      );
    }

    const ext = input.filename.split('.').pop()?.toLowerCase() || '';
    if (!this.allowedExtensions.has(ext)) {
      throw new BadRequestException(
        `Niedozwolone rozszerzenie pliku (.${ext || 'brak'}). Dozwolone: ${Array.from(this.allowedExtensions).join(
          ', ',
        )}`,
      );
    }
  }

  private normalizeAttachment<T extends { byteSize: bigint | number | string }>(attachment: T) {
    return {
      ...attachment,
      byteSize:
        typeof attachment.byteSize === 'bigint'
          ? Number(attachment.byteSize)
          : typeof attachment.byteSize === 'string'
            ? Number(attachment.byteSize)
            : attachment.byteSize,
    };
  }
}
