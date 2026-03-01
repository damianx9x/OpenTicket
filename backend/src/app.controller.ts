import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ConfigLoaderService } from './config/config-loader.service';
import { PrismaService } from './prisma/prisma.service';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(
    private readonly configLoader: ConfigLoaderService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('health')
  async health(@Res({ passthrough: true }) response: Response) {
    const cfg = this.configLoader.getConfigSync();
    const setupMode = cfg?.setupMode ?? true;
    let databaseOk = true;
    let databaseError: string | null = null;
    if (!setupMode) {
      try {
        await this.prisma.$queryRawUnsafe('SELECT 1');
      } catch (error) {
        databaseOk = false;
        databaseError = error instanceof Error ? error.message : String(error);
      }
    }

    response.status(databaseOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: databaseOk ? 'ok' : 'degraded',
      setupMode,
      database: {
        ok: databaseOk,
        error: databaseError,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system/info')
  systemInfo() {
    const cfg = this.configLoader.getConfigSync();
    const remoteSetupExpiresAt = cfg?.setupRemoteEnabledUntil ?? null;
    const remoteSetupOpen =
      Boolean(cfg?.setupMode) &&
      Boolean(remoteSetupExpiresAt) &&
      Number.isFinite(Date.parse(remoteSetupExpiresAt as string)) &&
      Date.parse(remoteSetupExpiresAt as string) > Date.now();
    return {
      app: 'openticket',
      version: process.env.npm_package_version || '0.0.0-dev',
      node: process.version,
      environment: process.env.NODE_ENV || 'development',
      setupMode: cfg?.setupMode ?? true,
      installationMode: cfg?.installationMode ?? 'server_client',
      deploymentTarget: cfg?.deploymentTarget ?? 'local_machine',
      hostProfile: cfg?.hostProfile ?? null,
      setupSessionMode: cfg?.setupSessionMode ?? 'loopback',
      remoteSetupOpen,
      remoteSetupExpiresAt,
      remoteApiBaseUrl: cfg?.remoteApiBaseUrl ?? null,
      databaseMode: cfg?.databaseMode ?? 'sqlite',
      storageMode: cfg?.storageMode ?? 'local',
      port: Number(process.env.PORT || cfg?.port || 3000),
    };
  }
}
