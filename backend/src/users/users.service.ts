import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../common/security/password';
import * as crypto from 'crypto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async listUsers(includeDisabled = false) {
    const users = await this.prisma.user.findMany({
      where: includeDisabled ? {} : { disabledAt: null },
      orderBy: [{ role: 'asc' }, { name: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        uiPreferences: true,
        createdAt: true,
        disabledAt: true,
      },
    });

    return users.map((user) => ({
      ...user,
      uiPreferences: this.tryParseJson(user.uiPreferences, {}),
    }));
  }

  async createUser(input: {
    email: string;
    name?: string;
    role?: string;
    phone?: string;
    password?: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const role = (input.role || 'AGENT').toUpperCase();

    if (!['ADMIN', 'AGENT', 'REPORTER', 'VIEWER'].includes(role)) {
      throw new BadRequestException('Nieobsługiwana rola.');
    }

    if (['ADMIN', 'AGENT'].includes(role) && (!input.password || input.password.trim().length < 8)) {
      throw new BadRequestException('Hasło dla admina/technika musi mieć min. 8 znaków.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name?.trim() || null,
        role,
        phone: input.phone?.trim() || null,
        passwordHash: input.password ? hashPassword(input.password) : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    return user;
  }

  async updateUser(
    userId: string,
    patch: {
      email?: string;
      name?: string | null;
      role?: string;
      phone?: string | null;
      password?: string;
      disabled?: boolean;
    },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('Użytkownik nie istnieje.');
    }

    const data: any = {};
    if (patch.email !== undefined) data.email = patch.email.trim().toLowerCase();
    if (patch.name !== undefined) data.name = patch.name?.trim() || null;
    if (patch.role !== undefined) {
      const role = patch.role.toUpperCase();
      if (!['ADMIN', 'AGENT', 'REPORTER', 'VIEWER'].includes(role)) {
        throw new BadRequestException('Nieobsługiwana rola.');
      }
      data.role = role;
    }
    if (patch.phone !== undefined) data.phone = patch.phone?.trim() || null;
    if (patch.password !== undefined) {
      if (patch.password.trim().length < 8) {
        throw new BadRequestException('Hasło musi mieć minimum 8 znaków.');
      }
      data.passwordHash = hashPassword(patch.password);
    }
    if (patch.disabled === true) data.disabledAt = new Date();
    if (patch.disabled === false) data.disabledAt = null;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        disabledAt: true,
        uiPreferences: true,
      },
    });

    return {
      ...user,
      uiPreferences: this.tryParseJson(user.uiPreferences, {}),
    };
  }

  async updateMyPreferences(userId: string, preferences: Record<string, unknown>) {
    const serialized = JSON.stringify(preferences || {});
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { uiPreferences: serialized },
      select: {
        id: true,
        uiPreferences: true,
      },
    });
    return {
      userId: user.id,
      uiPreferences: this.tryParseJson(user.uiPreferences, {}),
    };
  }

  async getMyPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        uiPreferences: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Użytkownik nie istnieje.');
    }

    return this.tryParseJson(user.uiPreferences, {});
  }

  async listUserNotes(userId: string) {
    return this.prisma.userNote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        authorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async addUserNote(input: {
    userId: string;
    authorUserId?: string;
    body: string;
    isInternal?: boolean;
  }) {
    const target = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) {
      throw new NotFoundException('Użytkownik nie istnieje.');
    }

    return this.prisma.userNote.create({
      data: {
        userId: input.userId,
        authorUserId: input.authorUserId || null,
        body: input.body.trim(),
        isInternal: input.isInternal ?? true,
      },
      include: {
        authorUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
  }

  async registerTechnician(input: {
    signupCode?: string;
    email?: string;
    name?: string;
    phone?: string;
    password?: string;
  }) {
    const settings = await this.settingsService.getSystemSettings();
    if (!settings.features.technicianSelfSignup) {
      throw new BadRequestException('Samodzielna rejestracja techników jest wyłączona.');
    }

    const signupCodeHashRow = await this.prisma.appSetting.findUnique({
      where: { key: 'technician.signup.codeHash' },
      select: { value: true },
    });
    if (!signupCodeHashRow?.value) {
      throw new BadRequestException('Kod rejestracji technika nie jest skonfigurowany.');
    }

    const providedCode = (input.signupCode || '').trim();
    if (!providedCode) {
      throw new BadRequestException('Brak kodu rejestracji.');
    }

    const providedHash = crypto.createHash('sha256').update(providedCode).digest('hex');
    if (providedHash !== signupCodeHashRow.value) {
      throw new BadRequestException('Niepoprawny kod rejestracji.');
    }

    if (!input.email || !input.password) {
      throw new BadRequestException('Email i hasło są wymagane.');
    }

    return this.createUser({
      email: input.email,
      name: input.name,
      phone: input.phone,
      role: 'AGENT',
      password: input.password,
    });
  }

  async setTechnicianSignupCode(code: string) {
    const hashed = crypto.createHash('sha256').update(code.trim()).digest('hex');
    await this.prisma.appSetting.upsert({
      where: { key: 'technician.signup.codeHash' },
      update: { value: hashed },
      create: { key: 'technician.signup.codeHash', value: hashed },
    });
  }

  private tryParseJson(value: string | null, fallback: any): any {
    if (!value) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
}
