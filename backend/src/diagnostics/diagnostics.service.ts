import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<any> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      this.logger.error('DB check failed', err as any);
      return { ok: false, reason: String(err) };
    }
  }

  async checkRedis(): Promise<any> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(redisUrl);
    try {
      const pong = await client.ping();
      await client.quit();
      return { ok: pong === 'PONG' };
    } catch (err) {
      this.logger.error('Redis check failed', err as any);
      try {
        await client.quit();
      } catch {}
      return { ok: false, reason: String(err) };
    }
  }

  async checkObjectStorage(): Promise<any> {
    const endpoint = process.env.MINIO_ENDPOINT;
    const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER;
    const secret = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;
    if (!endpoint || !accessKey || !secret) {
      return { ok: false, reason: 'minio-env-missing' };
    }
    try {
      const s3 = new S3Client({
        endpoint: endpoint.startsWith('http') ? endpoint : `http://${endpoint}:${process.env.MINIO_PORT || 9000}`,
        region: 'us-east-1',
        credentials: { accessKeyId: accessKey, secretAccessKey: secret },
        forcePathStyle: true,
      } as any);
      const res = await s3.send(new ListBucketsCommand({}));
      return { ok: true, buckets: (res.Buckets || []).map((b) => b.Name) };
    } catch (err) {
      this.logger.error('Object storage check failed', err as any);
      return { ok: false, reason: String(err) };
    }
  }

  async getStats(): Promise<any> {
    try {
      const [ticketCount, openTickets, userCount] = await this.prisma.$transaction([
        this.prisma.ticket.count(),
        this.prisma.ticket.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] } } }),
        this.prisma.user.count(),
      ]);
      return { ticketCount, openTickets, userCount };
    } catch (err) {
      return { error: String(err) };
    }
  }

  async runAllChecks() {
    const [database, redis, objectStorage, stats] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkObjectStorage(),
      this.getStats(),
    ]);

    return {
      database,
      redis,
      objectStorage,
      stats,
      timestamp: new Date().toISOString(),
    };
  }
}
