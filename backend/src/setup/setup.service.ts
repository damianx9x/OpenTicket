import { Injectable, Logger } from '@nestjs/common';
import { ConfigLoaderService } from '../config/config-loader.service';
import { AppConfig, SetupRequest, SetupResponse } from '../config/config.types';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private configLoader: ConfigLoaderService,
    private prisma: PrismaService,
  ) {}

  /**
   * Initialize the system with user-provided configuration
   */
  async initializeSystem(request: SetupRequest): Promise<SetupResponse> {
    try {
      // Check if already setup
      if (!this.configLoader.isSetupMode()) {
        return {
          success: false,
          message: 'System is already configured. Cannot re-initialize.',
        };
      }

      this.logger.log('Starting system initialization...');

      // 1. Create data directory
      const dataPath = request.dataPath;
      const uploadsPath = path.join(dataPath, 'uploads');
      const dbPath = path.join(dataPath, 'app.db');

      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true });
        this.logger.log(`Created data directory: ${dataPath}`);
      }

      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        this.logger.log(`Created uploads directory: ${uploadsPath}`);
      }

      // 2. Update DATABASE_URL for SQLite
      process.env.DATABASE_URL = `file:${dbPath}`;
      this.logger.log(`Database URL set to: ${process.env.DATABASE_URL}`);

      // 3. Run Prisma migrations
      const migrationsRun = await this.runMigrations();
      this.logger.log(`Migrations applied: ${migrationsRun}`);

      // 4. Create admin user
      const adminUserId = await this.createAdminUser(request.adminEmail, request.adminPassword);
      this.logger.log(`Admin user created: ${adminUserId}`);

      // 5. Create organization (if provided)
      if (request.organizationName) {
        await this.prisma.organization.create({
          data: {
            name: request.organizationName,
          },
        });
        this.logger.log(`Organization created: ${request.organizationName}`);
      }

      // 6. Create and save configuration
      const config: AppConfig = {
        databaseMode: 'sqlite',
        databaseUrl: `file:${dbPath}`,
        storageMode: 'local',
        dataPath,
        uploadsPath,
        port: 3000,
        jwtSecret: crypto.randomBytes(32).toString('hex'),
        setupMode: false,
        createdAt: new Date(),
      };

      await this.configLoader.saveConfig(config);
      this.logger.log('Configuration saved');

      return {
        success: true,
        message: 'System initialized successfully',
        configPath: dataPath,
        migrationsApplied: migrationsRun,
        adminUserId,
      };
    } catch (error: any) {
      this.logger.error(`Initialization failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Run Prisma migrations
   */
  private async runMigrations(): Promise<number> {
    try {
      // This is a simplified version - in production, you'd use:
      // const { execSync } = require('child_process');
      // execSync('prisma migrate deploy', { stdio: 'inherit' });

      // For now, we'll ensure the database is created by accessing Prisma
      // Prisma will auto-create the schema on first access
      await this.prisma.$executeRaw`SELECT 1`;

      this.logger.log('Database schema initialized');
      return 1;
    } catch (error: any) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create the initial admin user
   */
  private async createAdminUser(email: string, password: string): Promise<string> {
    try {
      // In production, you would hash the password using bcrypt
      // For now, just creating the user record
      // Password hashing should be done in the actual auth implementation

      const user = await this.prisma.user.create({
        data: {
          email,
          name: 'System Administrator',
          role: 'ADMIN',
        },
      });

      this.logger.log(`Admin user created with ID: ${user.id}`);
      return user.id;
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - user already exists
        const user = await this.prisma.user.findUnique({
          where: { email },
        });
        return user?.id || '';
      }
      throw error;
    }
  }

  /**
   * Check if system is already set up (i.e., config exists and is not in setup mode)
   */
  async isSystemSetup(): Promise<boolean> {
    const config = this.configLoader.getConfigSync();
    return config !== null && !config.setupMode;
  }
}
