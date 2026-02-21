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

    await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash,
        userAgent: metadata.userAgent || null,
        ip: metadata.ip || null,
        expiresAt,
      },
    });

    const user = await this.getSafeUserById(userId);
    return { token, expiresAt, user };
  }

  async getUserFromToken(token: string): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashAccessToken(token);
    const session = await this.prisma.authSession.findUnique({
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

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() < Date.now() || session.user.disabledAt) {
      await this.prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
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
    await this.prisma.authSession.deleteMany({ where: { tokenHash } });
  }

  async logoutEverywhere(userId: string): Promise<void> {
    await this.prisma.authSession.deleteMany({ where: { userId } });
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
}
