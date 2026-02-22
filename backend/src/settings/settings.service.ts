import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { CostCatalogItem, DEFAULT_SYSTEM_SETTINGS, SystemSettings } from './settings.types';

@Injectable()
export class SettingsService {
  private readonly costCatalogKey = 'catalog.costItems.v1';

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

  async getCostCatalog(): Promise<CostCatalogItem[]> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: this.costCatalogKey },
      select: { value: true },
    });
    if (!row?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(row.value);
      return this.normalizeCostCatalog(parsed);
    } catch {
      return [];
    }
  }

  async updateCostCatalog(items: unknown): Promise<CostCatalogItem[]> {
    const normalized = this.normalizeCostCatalog(items);

    await this.prisma.appSetting.upsert({
      where: { key: this.costCatalogKey },
      update: { value: JSON.stringify(normalized) },
      create: { key: this.costCatalogKey, value: JSON.stringify(normalized) },
    });

    return normalized;
  }

  private normalizeCostCatalog(items: unknown): CostCatalogItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    const normalized: CostCatalogItem[] = [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const candidate = raw as Record<string, unknown>;
      const name = String(candidate.name || '').trim();
      if (!name) {
        continue;
      }
      const unitNet = Number(candidate.unitNet);
      const defaultQty = Number(candidate.defaultQty);
      const vatCode = String(candidate.vatCode || '23').trim() || '23';
      const category = String(candidate.category || '').trim();
      const unit = String(candidate.unit || '').trim();
      const active =
        typeof candidate.active === 'boolean'
          ? candidate.active
          : String(candidate.active || '').trim().toLowerCase() !== 'false';

      normalized.push({
        id: String(candidate.id || '').trim() || randomUUID(),
        name,
        unitNet: Number.isFinite(unitNet) && unitNet >= 0 ? Number(unitNet.toFixed(2)) : 0,
        defaultQty: Number.isFinite(defaultQty) && defaultQty > 0 ? Number(defaultQty.toFixed(2)) : 1,
        vatCode,
        category: category || undefined,
        unit: unit || undefined,
        active,
      });
    }

    return normalized.slice(0, 600);
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
