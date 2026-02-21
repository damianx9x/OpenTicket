import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

type ReminderStatus = 'PENDING' | 'DONE';

export interface ReminderItem {
  id: string;
  ticketId: string | null;
  title: string;
  note: string;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  createdBy: string | null;
  completedAt: string | null;
}

@Injectable()
export class RemindersService {
  private readonly settingsKey = 'system.reminders.items';

  constructor(private readonly prisma: PrismaService) {}

  async list(query: { ticketId?: string; includeDone?: boolean }) {
    const reminders = await this.readAll();
    const includeDone = query.includeDone ?? false;
    const ticketId = query.ticketId?.trim();

    const filtered = reminders
      .filter((item) => (ticketId ? item.ticketId === ticketId : true))
      .filter((item) => (includeDone ? true : item.status !== 'DONE'))
      .sort((a, b) => {
        const byDue = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (byDue !== 0) {
          return byDue;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return filtered;
  }

  async create(input: {
    ticketId?: string;
    title?: string;
    note?: string;
    dueAt?: string;
    createdBy?: string;
  }) {
    const title = (input.title || '').trim();
    if (title.length < 2) {
      throw new BadRequestException('Tytuł przypomnienia musi mieć minimum 2 znaki.');
    }

    const dueAtRaw = (input.dueAt || '').trim();
    if (!dueAtRaw) {
      throw new BadRequestException('Data przypomnienia jest wymagana.');
    }
    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Niepoprawna data przypomnienia.');
    }

    const ticketId = input.ticketId?.trim() || null;
    if (ticketId) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
      if (!ticket) {
        throw new NotFoundException('Ticket dla przypomnienia nie istnieje.');
      }
    }

    const item: ReminderItem = {
      id: crypto.randomUUID(),
      ticketId,
      title,
      note: (input.note || '').trim(),
      dueAt: dueAt.toISOString(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy || null,
      completedAt: null,
    };

    const all = await this.readAll();
    all.push(item);
    await this.writeAll(all);
    return item;
  }

  async markDone(id: string, done: boolean) {
    const all = await this.readAll();
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) {
      throw new NotFoundException('Przypomnienie nie istnieje.');
    }

    all[idx] = {
      ...all[idx],
      status: done ? 'DONE' : 'PENDING',
      completedAt: done ? new Date().toISOString() : null,
    };

    await this.writeAll(all);
    return all[idx];
  }

  async remove(id: string) {
    const all = await this.readAll();
    const next = all.filter((item) => item.id !== id);
    if (next.length === all.length) {
      throw new NotFoundException('Przypomnienie nie istnieje.');
    }

    await this.writeAll(next);
    return { deleted: true };
  }

  private async readAll(): Promise<ReminderItem[]> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: this.settingsKey },
      select: { value: true },
    });

    if (!row?.value) {
      return [];
    }

    try {
      const parsed = JSON.parse(row.value);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(Boolean);
    } catch {
      return [];
    }
  }

  private async writeAll(items: ReminderItem[]): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: this.settingsKey },
      update: { value: JSON.stringify(items) },
      create: { key: this.settingsKey, value: JSON.stringify(items) },
    });
  }
}
