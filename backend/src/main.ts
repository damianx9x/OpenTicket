import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigLoaderService } from './config/config-loader.service';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import helmet from 'helmet';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

type RateRule = {
  pattern: RegExp;
  windowMs: number;
  limit: number;
  message: string;
};

function isLoopbackOrigin(origin: string): boolean {
  return /^https?:\/\/(([\w-]+\.)*localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function isPrivateLanOrigin(origin: string): boolean {
  return /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(
    origin,
  );
}

function isNullOrigin(origin: string): boolean {
  return origin.trim().toLowerCase() === 'null';
}

function resolveCorsAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => set.add(item));
  return set;
}

function isPrivateLanCorsAllowed(): boolean {
  if (process.env.CORS_ALLOW_PRIVATE_LAN === '1') {
    return true;
  }
  return process.env.APP_ENV === 'DEV_LOCAL';
}

function isSwaggerEnabled(): boolean {
  if (process.env.SWAGGER_ENABLED === '1') {
    return true;
  }
  if (process.env.SWAGGER_ENABLED === '0') {
    return false;
  }
  return process.env.APP_ENV === 'DEV_LOCAL';
}

function isNullOriginCorsAllowed(setupMode: boolean): boolean {
  if (process.env.CORS_ALLOW_NULL_ORIGIN === '1') {
    return true;
  }
  if (process.env.CORS_ALLOW_NULL_ORIGIN === '0') {
    return false;
  }
  return setupMode;
}

function resolvePrismaCommand(backendRoot: string): {
  command: string;
  argsPrefix: string[];
  envPatch?: Record<string, string>;
} {
  const prismaJs = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
  if (fs.existsSync(prismaJs)) {
    return {
      command: process.execPath,
      argsPrefix: [prismaJs],
      envPatch: process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : undefined,
    };
  }

  const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
  const localBin = path.join(backendRoot, 'node_modules', '.bin', binName);
  if (fs.existsSync(localBin)) {
    return { command: localBin, argsPrefix: [], envPatch: undefined };
  }
  return { command: 'npx', argsPrefix: ['prisma'], envPatch: undefined };
}

function runPrismaAutoMigration(logger: Logger): void {
  if (process.env.TICKET_SYSTEM_AUTO_MIGRATE === '0') {
    return;
  }

  const backendRoot = path.resolve(__dirname, '..');
  const schemaPath = path.join(backendRoot, 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    logger.warn(`Auto-migrate skipped. Prisma schema missing: ${schemaPath}`);
    return;
  }

  const prisma = resolvePrismaCommand(backendRoot);
  const commands: string[][] = [
    ['migrate', 'deploy', '--schema', schemaPath],
    ['db', 'push', '--skip-generate', '--schema', schemaPath],
  ];
  const env = {
    ...process.env,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
    ...(prisma.envPatch || {}),
  };

  for (const cmd of commands) {
    const args = prisma.argsPrefix.concat(cmd);
    const result = spawnSync(prisma.command, args, {
      cwd: backendRoot,
      env,
      encoding: 'utf-8',
    });

    if (result.status === 0) {
      logger.log(`Prisma auto-migrate: ${cmd.join(' ')} -> OK`);
      return;
    }

    const output = [
      result.error?.message || '',
      (result.stderr || '').trim(),
      (result.stdout || '').trim(),
    ]
      .filter(Boolean)
      .join(' | ');
    logger.warn(`Prisma auto-migrate failed: ${cmd.join(' ')} -> ${output || 'unknown error'}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Prisma resolves DATABASE_URL during provider initialization, so config must be loaded first.
  const bootstrapConfigLoader = new ConfigLoaderService();
  const preloadConfig = await bootstrapConfigLoader.loadConfig();
  if (!preloadConfig.setupMode) {
    runPrismaAutoMigration(logger);
  }

  const app = await NestFactory.create(AppModule);
  const configLoader = app.get(ConfigLoaderService);
  const config = await configLoader.loadConfig();

  // Global Validation Pipe - wymusza walidację DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // usuwa pola, których nie ma w DTO
      transform: true, // automatycznie konwertuje typy (np. string -> number w params)
      forbidNonWhitelisted: true, // rzuca błąd, gdy przyjdą nadmiarowe pola
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new PrismaExceptionFilter());

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Enable CORS
  const corsAllowlist = resolveCorsAllowedOrigins();
  const allowPrivateLanCors = isPrivateLanCorsAllowed();
  const allowNullOriginCors = isNullOriginCorsAllowed(config.setupMode);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowNullOriginCors && isNullOrigin(origin)) {
        callback(null, true);
        return;
      }

      if (corsAllowlist.has(origin) || isLoopbackOrigin(origin)) {
        callback(null, true);
        return;
      }

      if (allowPrivateLanCors && isPrivateLanOrigin(origin)) {
        callback(null, true);
        return;
      }

      logger.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    },
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const parsedMaxUrlLength = Number(process.env.TICKET_SYSTEM_MAX_URL_LENGTH || 2048);
  const maxUrlLength = Number.isFinite(parsedMaxUrlLength) && parsedMaxUrlLength > 256 ? parsedMaxUrlLength : 2048;
  app.use((req, res, next) => {
    const requestUrl = req.originalUrl || req.url || '';
    if (requestUrl.length > maxUrlLength) {
      res.status(414).json({
        success: false,
        message: 'Request URL is too long.',
      });
      return;
    }
    next();
  });

  const rateRules: RateRule[] = [
    {
      pattern: /^\/api\/v1\/auth\/login$/,
      windowMs: 10 * 60 * 1000,
      limit: 20,
      message: 'Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.',
    },
    {
      pattern: /^\/api\/v1\/setup\/(init|client-only|dev-reset)$/,
      windowMs: 10 * 60 * 1000,
      limit: 80,
      message: 'Zbyt wiele żądań krytycznych setup. Odczekaj chwilę i spróbuj ponownie.',
    },
    {
      pattern: /^\/api\/v1\/setup\/token\/(create|claim|revoke)$/,
      windowMs: 10 * 60 * 1000,
      limit: 30,
      message: 'Zbyt wiele żądań tokenu setup. Odczekaj chwilę i spróbuj ponownie.',
    },
    {
      pattern: /^\/api\/v1\/setup\/(validate-path|discover-local-data|discover-servers|validate-remote)$/,
      windowMs: 10 * 60 * 1000,
      limit: 300,
      message: 'Zbyt wiele żądań narzędzi setup. Odczekaj chwilę i spróbuj ponownie.',
    },
    {
      pattern: /^\/api\/v1\/tickets\/status\/.+/,
      windowMs: 60 * 1000,
      limit: 120,
      message: 'Limit żądań statusu został przekroczony.',
    },
  ];
  const buckets = new Map<string, { count: number; resetAt: number }>();

  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const matchedRule = rateRules.find((rule) => rule.pattern.test(req.path));
    if (!matchedRule) {
      next();
      return;
    }

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${matchedRule.pattern.source}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + matchedRule.windowMs,
      });
      next();
      return;
    }

    current.count += 1;
    if (current.count > matchedRule.limit) {
      res.status(429).json({
        success: false,
        message: matchedRule.message,
        meta: {
          retryAfterMs: Math.max(0, current.resetAt - now),
        },
      });
      return;
    }

    if (buckets.size > 2000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  if (isSwaggerEnabled()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OpenTicket API')
      .setDescription('API documentation for OpenTicket')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger enabled at /api/docs');
  } else {
    logger.log('Swagger disabled (set SWAGGER_ENABLED=1 to enable).');
  }

  const port = config.port || preloadConfig.port || 3000;
  const bindHost = process.env.BIND_HOST || '127.0.0.1';
  await app.listen(port, bindHost);
  
  const baseUrl = `http://${bindHost}:${port}`;
  if (config.setupMode) {
    logger.warn('⚠️  SYSTEM IN SETUP MODE - Configure via POST /setup/init');
  } else {
    logger.log('✅ Configuration loaded from file');
  }
  logger.log(`✅ Application is running on: ${baseUrl}`);
  if (isSwaggerEnabled()) {
    logger.log(`📚 Swagger docs available at: ${baseUrl}/api/docs`);
  }
  logger.log(`🎯 API is available at: ${baseUrl}/api/v1`);
  
  if (config.setupMode) {
    logger.log(`⚙️  Setup endpoint: POST ${baseUrl}/api/v1/setup/init`);
  }
}

bootstrap();

// Fix BigInt serialization for Prisma
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
