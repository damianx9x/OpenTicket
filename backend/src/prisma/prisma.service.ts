import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type NullableString = string | null;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: PrismaClient;
  private currentDatabaseUrl: NullableString = null;

  constructor() {
    this.client = this.createClient(process.env.DATABASE_URL);
  }

  get user(): PrismaClient['user'] {
    return this.client.user;
  }

  get organization(): PrismaClient['organization'] {
    return this.client.organization;
  }

  get ticket(): PrismaClient['ticket'] {
    return this.client.ticket;
  }

  get ticketStatusHistory(): PrismaClient['ticketStatusHistory'] {
    return this.client.ticketStatusHistory;
  }

  get comment(): PrismaClient['comment'] {
    return this.client.comment;
  }

  get attachment(): PrismaClient['attachment'] {
    return this.client.attachment;
  }

  get vatRate(): PrismaClient['vatRate'] {
    return this.client.vatRate;
  }

  get costItem(): PrismaClient['costItem'] {
    return this.client.costItem;
  }

  get automationRule(): PrismaClient['automationRule'] {
    return this.client.automationRule;
  }

  get notification(): PrismaClient['notification'] {
    return this.client.notification;
  }

  get auditLog(): PrismaClient['auditLog'] {
    return this.client.auditLog;
  }

  get authSession(): PrismaClient['authSession'] {
    return this.client.authSession;
  }

  get userNote(): PrismaClient['userNote'] {
    return this.client.userNote;
  }

  get appSetting(): PrismaClient['appSetting'] {
    return this.client.appSetting;
  }

  $transaction(...args: any[]): any {
    return (this.client.$transaction as any)(...args);
  }

  $queryRaw<T = unknown>(...args: any[]): Prisma.PrismaPromise<T> {
    return (this.client.$queryRaw as any)(...args);
  }

  $queryRawUnsafe<T = unknown>(...args: any[]): Prisma.PrismaPromise<T> {
    return (this.client.$queryRawUnsafe as any)(...args);
  }

  $executeRaw<T = number>(...args: any[]): Prisma.PrismaPromise<T> {
    return (this.client.$executeRaw as any)(...args);
  }

  $executeRawUnsafe<T = number>(...args: any[]): Prisma.PrismaPromise<T> {
    return (this.client.$executeRawUnsafe as any)(...args);
  }

  $on(...args: any[]): any {
    return (this.client.$on as any)(...args);
  }

  $use(...args: any[]): any {
    return (this.client.$use as any)(...args);
  }

  async $connect(): Promise<void> {
    await this.client.$connect();
  }

  async $disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  getDatabaseUrl(): NullableString {
    return this.currentDatabaseUrl;
  }

  async refreshDatasource(nextUrl?: string, forceReconnect = false): Promise<void> {
    const normalized = this.normalizeUrl(nextUrl ?? process.env.DATABASE_URL);
    if (!forceReconnect && normalized === this.currentDatabaseUrl) {
      await this.client.$disconnect().catch(() => undefined);
      this.logger.log('Prisma datasource reconnect skipped (same DATABASE_URL).');
      return;
    }

    await this.client.$disconnect().catch(() => undefined);
    this.client = this.createClient(normalized);
    this.logger.log(
      `Prisma datasource reloaded (${this.currentDatabaseUrl ? 'custom' : 'default env'}).`,
    );
  }

  async onModuleInit(): Promise<void> {
    // Keep Prisma lazy-connected.
    this.logger.log('Prisma client initialized (lazy connection mode)');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    await this.client.$disconnect();
    this.logger.log('Database disconnected');
  }

  private createClient(databaseUrl?: string | null): PrismaClient {
    const normalized = this.normalizeUrl(databaseUrl);
    this.currentDatabaseUrl = normalized;
    return new PrismaClient({
      datasources: normalized ? { db: { url: normalized } } : undefined,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  private normalizeUrl(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
