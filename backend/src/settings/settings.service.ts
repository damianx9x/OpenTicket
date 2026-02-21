import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_SYSTEM_SETTINGS, SystemSettings } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemSettings(): Promise<SystemSettings> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: 'system.settings' },
      select: { value: true },
    });

    if (!row) {
      return DEFAULT_SYSTEM_SETTINGS;
    }

    try {
      const parsed = JSON.parse(row.value) as Partial<SystemSettings>;
      return this.mergeSettings(parsed);
    } catch {
      return DEFAULT_SYSTEM_SETTINGS;
    }
  }

  async updateSystemSettings(patch: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSystemSettings();
    const merged = this.mergeSettings({
      ...current,
      ...patch,
      branding: { ...current.branding, ...(patch.branding || {}) },
      features: { ...current.features, ...(patch.features || {}) },
      reminders: { ...current.reminders, ...(patch.reminders || {}) },
      uiDefaults: { ...current.uiDefaults, ...(patch.uiDefaults || {}) },
      integrations: {
        email: { ...current.integrations.email, ...(patch.integrations?.email || {}) },
        sms: { ...current.integrations.sms, ...(patch.integrations?.sms || {}) },
      },
    });

    await this.prisma.appSetting.upsert({
      where: { key: 'system.settings' },
      update: { value: JSON.stringify(merged) },
      create: {
        key: 'system.settings',
        value: JSON.stringify(merged),
      },
    });

    return merged;
  }

  private mergeSettings(candidate: Partial<SystemSettings>): SystemSettings {
    return {
      branding: {
        ...DEFAULT_SYSTEM_SETTINGS.branding,
        ...(candidate.branding || {}),
      },
      features: {
        ...DEFAULT_SYSTEM_SETTINGS.features,
        ...(candidate.features || {}),
      },
      reminders: {
        ...DEFAULT_SYSTEM_SETTINGS.reminders,
        ...(candidate.reminders || {}),
      },
      uiDefaults: {
        ...DEFAULT_SYSTEM_SETTINGS.uiDefaults,
        ...(candidate.uiDefaults || {}),
      },
      integrations: {
        email: {
          ...DEFAULT_SYSTEM_SETTINGS.integrations.email,
          ...(candidate.integrations?.email || {}),
        },
        sms: {
          ...DEFAULT_SYSTEM_SETTINGS.integrations.sms,
          ...(candidate.integrations?.sms || {}),
        },
      },
    };
  }
}
