import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { hashAccessToken, generateAccessToken } from '../common/security/token';
import { verifyPassword } from '../common/security/password';
import { AuthSessionResult, AuthenticatedUser } from './auth.types';

const DEFAULT_SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async login(params: {
    email: string;
    password: string;
    userAgent?: string;
    ip?: string;
  }): Promise<AuthSessionResult> {
    const email = params.email.trim().toLowerCase();
    let user:
      | {
          id: string;
          email: string;
          name: string;
          role: string;
          phone: string | null;
          passwordHash: string | null;
          disabledAt: Date | null;
        }
      | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          passwordHash: true,
          disabledAt: true,
        },
      });
    } catch (error) {
      if (this.isDatabaseUnavailableError(error)) {
        this.logger.error(`Login blocked, database unavailable: ${error instanceof Error ? error.message : String(error)}`);
        throw new ServiceUnavailableException(
          'Baza danych jest niedostępna. Użyj narzędzi serwisowych: „Szybka naprawa” albo „Reset systemu”.',
        );
      }
      throw error;
    }

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('Niepoprawny e-mail lub hasło.');
    }

    if (!user.passwordHash || !verifyPassword(params.password, user.passwordHash)) {
      throw new UnauthorizedException('Niepoprawny e-mail lub hasło.');
    }

    return this.createSession(user.id, {
      userAgent: params.userAgent,
      ip: params.ip,
    });
  }

  async createSession(
    userId: string,
    metadata: { userAgent?: string; ip?: string } = {},
  ): Promise<AuthSessionResult> {
    const token = generateAccessToken(32);
    const tokenHash = hashAccessToken(token);
    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_DAYS * 24 * 60 * 60 * 1000);

    try {
      await this.prisma.authSession.create({
        data: {
          userId,
          tokenHash,
          userAgent: metadata.userAgent || null,
          ip: metadata.ip || null,
          expiresAt,
        },
      });
    } catch (error) {
      const repaired = await this.tryRepairAuthSessionStorage(error);
      if (repaired) {
        try {
          await this.prisma.authSession.create({
            data: {
              userId,
              tokenHash,
              userAgent: metadata.userAgent || null,
              ip: metadata.ip || null,
              expiresAt,
            },
          });
        } catch (retryError) {
          this.logger.error(
            `Cannot create auth session after repair: ${
              retryError instanceof Error ? retryError.message : String(retryError)
            }`,
          );
          throw new ServiceUnavailableException(
            'Silnik sesji logowania nie jest gotowy. Użyj „Szybka naprawa” albo „Reset systemu”, a następnie zaloguj ponownie.',
          );
        }
      } else if (this.isSchemaMismatchError(error) || this.isDatabaseUnavailableError(error)) {
        this.logger.error(
          `Cannot create auth session: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new ServiceUnavailableException(
          'Silnik sesji logowania nie jest gotowy. Użyj „Szybka naprawa” albo „Reset systemu”, a następnie zaloguj ponownie.',
        );
      } else {
        throw error;
      }
    }

    const user = await this.getSafeUserById(userId);
    return { token, expiresAt, user };
  }

  async getUserFromToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashAccessToken(token);
    let session:
      | {
          id: string;
          expiresAt: Date;
          user: {
            id: string;
            email: string;
            name: string;
            role: string;
            phone: string | null;
            disabledAt: Date | null;
          };
        }
      | null = null;

    try {
      session = await this.prisma.authSession.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              phone: true,
              disabledAt: true,
            },
          },
        },
      });
    } catch (error) {
      const repaired = await this.tryRepairAuthSessionStorage(error);
      if (repaired) {
        try {
          session = await this.prisma.authSession.findUnique({
            where: { tokenHash },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  phone: true,
                  disabledAt: true,
                },
              },
            },
          });
        } catch (retryError) {
          this.logger.warn(
            `Session lookup skipped after repair attempt: ${
              retryError instanceof Error ? retryError.message : String(retryError)
            }`,
          );
          return null;
        }
      } else if (this.isSchemaMismatchError(error) || this.isDatabaseUnavailableError(error)) {
        this.logger.warn(
          `Session lookup skipped (database not ready): ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } else {
        throw error;
      }
    }

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() < Date.now() || session.user.disabledAt) {
      await this.prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    await this.prisma.authSession
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((error) => {
        if (!this.isSchemaMismatchError(error)) {
          this.logger.warn(
            `Failed to update auth session lastUsedAt: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      phone: session.user.phone ?? null,
    };
  }

  async logout(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const tokenHash = hashAccessToken(token);
    await this.prisma.authSession.deleteMany({ where: { tokenHash } }).catch(async (error) => {
      if (!this.isSchemaMismatchError(error)) {
        throw error;
      }
      await this.tryRepairAuthSessionStorage(error);
    });
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } }).catch(async (error) => {
      if (!this.isSchemaMismatchError(error)) {
        throw error;
      }
      await this.tryRepairAuthSessionStorage(error);
    });
  }

  async getSafeUserById(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, phone: true },
    });

    if (!user) {
      throw new UnauthorizedException('Użytkownik nie istnieje.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone ?? null,
    };
  }

  private isDatabaseUnavailableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return true;
    }

    const message = (error as any)?.message?.toString?.().toLowerCase?.() || '';
    const code = ((error as any)?.code || '').toString().toUpperCase();

    return (
      code === 'P1000' ||
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1003' ||
      message.includes('unable to open the database file') ||
      message.includes('error code 14')
    );
  }

  private isSchemaMismatchError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = ((error as any)?.code || '').toString().toUpperCase();
    if (code === 'P2021' || code === 'P2022') {
      return true;
    }

    const message = (error as any)?.message?.toString?.().toLowerCase?.() || '';
    return message.includes('table') && message.includes('does not exist');
  }

  /**
   * Auto-heal for old/partially migrated SQLite databases (common after import/reset on older builds).
   * We repair only auth_sessions storage; other schema issues are still surfaced to diagnostics.
   */
  private async tryRepairAuthSessionStorage(error: unknown): Promise<boolean> {
    if (!(this.isSchemaMismatchError(error) || this.isDatabaseUnavailableError(error))) {
      return false;
    }

    const databaseUrl = this.prisma.getDatabaseUrl() || process.env.DATABASE_URL || '';
    if (!databaseUrl.startsWith('file:')) {
      return false;
    }

    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "auth_sessions" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "user_id" TEXT NOT NULL,
          "token_hash" TEXT NOT NULL,
          "user_agent" TEXT,
          "ip" TEXT,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "expires_at" DATETIME NOT NULL,
          "last_used_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "auth_sessions_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users" ("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await this.prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash")`,
      );
      await this.prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at")`,
      );

      const tableInfo = await this.prisma.$queryRawUnsafe<Array<{ name?: string }>>(
        `PRAGMA table_info('auth_sessions')`,
      );
      const columns = new Set((tableInfo || []).map((item) => (item?.name || '').toLowerCase()));
      if (!columns.has('last_used_at')) {
        await this.prisma.$executeRawUnsafe(
          `ALTER TABLE "auth_sessions" ADD COLUMN "last_used_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
        );
      }

      this.logger.warn('Auth session storage schema auto-repaired for SQLite runtime.');
      return true;
    } catch (repairError) {
      this.logger.error(
        `Auth session storage auto-repair failed: ${
          repairError instanceof Error ? repairError.message : String(repairError)
        }`,
      );
      return false;
    }
  }
}
