import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import * as os from 'os';
import { ConfigLoaderService } from '../config/config-loader.service';

type CheckResult = {
  ok: boolean;
  reason?: string;
  skipped?: boolean;
};

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configLoader: ConfigLoaderService,
  ) {}

  async checkDatabase(): Promise<CheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      this.logger.error('DB check failed', err as any);
      return { ok: false, reason: this.describeError(err) };
    }
  }

  async checkRedis(): Promise<CheckResult> {
    const redisUrl = (process.env.REDIS_URL || '').trim();
    if (!redisUrl) {
      return { ok: true, skipped: true, reason: 'redis-not-configured' };
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 1200,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      // Errors are handled by awaited connect/ping below.
    });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.disconnect(false);
      return { ok: pong === 'PONG' };
    } catch (err) {
      this.logger.error('Redis check failed', err as any);
      try {
        await client.disconnect(false);
      } catch {}
      return { ok: false, reason: this.describeError(err) };
    }
  }

  async checkObjectStorage(): Promise<CheckResult & { buckets?: string[] }> {
    const cfg = this.configLoader.getConfigSync();
    const storageMode = (cfg?.storageMode || 'local').toLowerCase();

    if (storageMode !== 's3') {
      return { ok: true, skipped: true, reason: `storage-mode-${storageMode}` };
    }

    const endpoint = (process.env.MINIO_ENDPOINT || cfg?.s3Endpoint || '').trim();
    const accessKey = (process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || cfg?.s3AccessKey || '').trim();
    const secret = (process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || cfg?.s3SecretKey || '').trim();
    if (!endpoint || !accessKey || !secret) {
      return { ok: false, reason: 's3-config-missing' };
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
      return { ok: false, reason: this.describeError(err) };
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

  async buildSupportReport() {
    const checks = await this.runAllChecks();
    return {
      checks,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        uptimeSec: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
      },
      config: {
        env: process.env.NODE_ENV || 'development',
        port: Number(process.env.PORT || 3000),
        databaseUrlMasked: this.maskDatabaseUrl(process.env.DATABASE_URL || ''),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private maskDatabaseUrl(url: string): string {
    if (!url) return '';
    return url.replace(/:[^:@/]+@/, ':***@');
  }

  private describeError(err: unknown): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return String(err || 'unknown-error');
  }
}
