import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../common/security/password';
import * as crypto from 'crypto';

type LoadDemoOptions = {
  count?: number;
  reset?: boolean;
};

type DemoPerson = {
  email: string;
  name: string;
};

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoDomain = 'demo.openticket.local';

  constructor(private readonly prisma: PrismaService) {}

  async loadDemoDataset(options: LoadDemoOptions) {
    const requestedCount = Number(options?.count ?? 200);
    const count = Number.isFinite(requestedCount) ? Math.max(1, Math.min(1000, Math.floor(requestedCount))) : 200;
    const reset = options?.reset === true;

    if (reset) {
      await this.resetTicketData();
    }

    await this.ensureVatRates();
    const technicians = await this.ensureDemoTechnicians();
    const customers = await this.ensureDemoCustomers();
    const vatCodes = await this.resolveVatCodes();

    let nextNumber = await this.getNextTicketNumber();
    let createdTickets = 0;
    let createdComments = 0;
    let createdCosts = 0;
    let createdStatusHistory = 0;

    for (let index = 0; index < count; index += 1) {
      const status = this.pickWeighted([
        { value: 'NEW', weight: 0.24 },
        { value: 'IN_PROGRESS', weight: 0.29 },
        { value: 'WAITING_FOR_CUSTOMER', weight: 0.16 },
        { value: 'RESOLVED', weight: 0.13 },
        { value: 'CLOSED', weight: 0.18 },
      ]);
      const priority = this.pickWeighted([
        { value: 'LOW', weight: 0.18 },
        { value: 'NORMAL', weight: 0.45 },
        { value: 'HIGH', weight: 0.27 },
        { value: 'URGENT', weight: 0.1 },
      ]);
      const channel = this.pickWeighted([
        { value: 'WEB_FORM', weight: 0.52 },
        { value: 'APP', weight: 0.28 },
        { value: 'DROP_OFF', weight: 0.12 },
        { value: 'EMAIL', weight: 0.08 },
      ]);

      const owner = this.pickRandom(customers);
      const assignee =
        status === 'NEW' && Math.random() < 0.45 ? null : this.pickRandom(technicians);

      const createdAt = this.randomPastDate(180);
      const updatedAt = this.randomDateBetween(createdAt, new Date());
      const closedAt =
        status === 'CLOSED' || status === 'RESOLVED'
          ? this.randomDateBetween(updatedAt, new Date())
          : null;

      const ticketTitle = this.buildTicketTitle(index);
      const ticketDescription = this.buildTicketDescription(ticketTitle);

      const ticket = await this.prisma.ticket.create({
        data: {
          number: nextNumber,
          title: ticketTitle,
          description: ticketDescription,
          status,
          priority,
          channel,
          ownerUserId: owner.id,
          assignedAgentId: assignee?.id ?? null,
          publicToken: crypto.randomBytes(16).toString('hex'),
          createdAt,
          updatedAt,
          closedAt,
        },
        select: {
          id: true,
          number: true,
          createdAt: true,
        },
      });
      createdTickets += 1;
      nextNumber += 1;

      const commentCount = this.randomInt(0, 3);
      if (commentCount > 0) {
        const commentRows = Array.from({ length: commentCount }).map((_, commentIndex) => {
          const author = assignee ?? this.pickRandom(technicians);
          return {
            ticketId: ticket.id,
            authorUserId: author.id,
            body: this.buildCommentBody(commentIndex, status),
            isInternal: Math.random() < 0.35,
            createdAt: this.randomDateBetween(ticket.createdAt, new Date()),
          };
        });

        await this.prisma.comment.createMany({
          data: commentRows,
        });
        createdComments += commentRows.length;
      }

      const shouldAddCosts = ['IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status) && Math.random() < 0.66;
      if (shouldAddCosts) {
        const costRows = Array.from({ length: this.randomInt(1, 2) }).map(() => {
          const qty = Number((Math.random() * 2 + 1).toFixed(2));
          const unitNet = Number((Math.random() * 450 + 40).toFixed(2));
          const netTotal = Number((qty * unitNet).toFixed(2));
          const vatCode = this.pickRandom(vatCodes);
          const vatRatePercent = this.resolveVatPercent(vatCode);
          const vatTotal = Number((netTotal * (vatRatePercent / 100)).toFixed(2));
          const grossTotal = Number((netTotal + vatTotal).toFixed(2));

          return {
            ticketId: ticket.id,
            name: this.pickRandom([
              'Diagnostyka',
              'Naprawa płyty głównej',
              'Wymiana baterii',
              'Czyszczenie po zalaniu',
              'Wymiana gniazda USB-C',
              'Wymiana ekranu',
              'Testy końcowe',
            ]),
            qty,
            unitNet,
            vatCode,
            netTotal,
            vatTotal,
            grossTotal,
            createdAt: this.randomDateBetween(ticket.createdAt, new Date()),
          };
        });

        await this.prisma.costItem.createMany({
          data: costRows,
        });
        createdCosts += costRows.length;
      }

      if (status !== 'NEW' && assignee) {
        await this.prisma.ticketStatusHistory.create({
          data: {
            ticketId: ticket.id,
            fromStatus: 'NEW',
            toStatus: status,
            changedBy: assignee.id,
            changedAt: this.randomDateBetween(ticket.createdAt, new Date()),
          },
        });
        createdStatusHistory += 1;
      }
    }

    const totalTickets = await this.prisma.ticket.count();
    const payload = {
      success: true,
      resetApplied: reset,
      requestedCount: count,
      createdTickets,
      createdComments,
      createdCosts,
      createdStatusHistory,
      createdUsers: technicians.length + customers.length,
      totalTickets,
    };

    this.logger.log(`Demo dataset loaded: ${JSON.stringify(payload)}`);
    return payload;
  }

  private async resetTicketData() {
    await this.prisma.$transaction([
      this.prisma.ticketStatusHistory.deleteMany({}),
      this.prisma.comment.deleteMany({}),
      this.prisma.attachment.deleteMany({}),
      this.prisma.costItem.deleteMany({}),
      this.prisma.notification.deleteMany({}),
      this.prisma.ticket.deleteMany({}),
    ]);
  }

  private async ensureDemoTechnicians() {
    const people: DemoPerson[] = [
      { email: `anna.nowak@${this.demoDomain}`, name: 'Anna Nowak' },
      { email: `marek.kaminski@${this.demoDomain}`, name: 'Marek Kamiński' },
      { email: `tomasz.wisniewski@${this.demoDomain}`, name: 'Tomasz Wiśniewski' },
      { email: `ewa.dabrowska@${this.demoDomain}`, name: 'Ewa Dąbrowska' },
      { email: `jan.kowalski@${this.demoDomain}`, name: 'Jan Kowalski' },
    ];

    const passwordHash = hashPassword('DemoAgent123!');
    const users = [];
    for (const person of people) {
      const user = await this.prisma.user.upsert({
        where: { email: person.email },
        update: {
          name: person.name,
          role: 'AGENT',
          disabledAt: null,
          passwordHash,
        },
        create: {
          email: person.email,
          name: person.name,
          role: 'AGENT',
          passwordHash,
        },
        select: { id: true, email: true, name: true },
      });
      users.push(user);
    }
    return users;
  }

  private async ensureDemoCustomers() {
    const names = [
      'Adam Wójcik',
      'Karolina Mazur',
      'Piotr Krawczyk',
      'Marta Lewandowska',
      'Kacper Zieliński',
      'Alicja Jankowska',
      'Jakub Szymański',
      'Natalia Król',
      'Bartosz Kubiak',
      'Zuzanna Wojciechowska',
      'Paweł Nowicki',
      'Monika Sikora',
      'Łukasz Pawlak',
      'Aleksandra Kamińska',
      'Patryk Michalak',
      'Joanna Dudek',
      'Rafał Maj',
      'Julia Piotrowska',
      'Mateusz Górski',
      'Paulina Lis',
      'Dominik Kaczmarek',
      'Wiktoria Sobczak',
      'Sebastian Czerwiński',
      'Agata Urban',
      'Michał Bąk',
      'Iga Chmielewska',
      'Artur Olszewski',
      'Emilia Sadowska',
      'Robert Jabłoński',
      'Weronika Pietrzak',
    ];

    const users = [];
    for (const name of names) {
      const emailLocal = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/(^\.|\.$)/g, '');
      const email = `${emailLocal}@${this.demoDomain}`;
      const user = await this.prisma.user.upsert({
        where: { email },
        update: {
          name,
          role: 'REPORTER',
          disabledAt: null,
        },
        create: {
          email,
          name,
          role: 'REPORTER',
        },
        select: { id: true, email: true, name: true },
      });
      users.push(user);
    }
    return users;
  }

  private async ensureVatRates() {
    const defaults = [
      { code: '23', percent: 23, isExempt: false, name: 'VAT 23%' },
      { code: '8', percent: 8, isExempt: false, name: 'VAT 8%' },
      { code: '5', percent: 5, isExempt: false, name: 'VAT 5%' },
      { code: '0', percent: 0, isExempt: false, name: 'VAT 0%' },
      { code: 'ZW', percent: 0, isExempt: true, name: 'ZW' },
    ];

    for (const rate of defaults) {
      await this.prisma.vatRate.upsert({
        where: { code: rate.code },
        update: {
          percent: rate.percent,
          isExempt: rate.isExempt,
          name: rate.name,
        },
        create: rate,
      });
    }
  }

  private async resolveVatCodes(): Promise<string[]> {
    const rows = await this.prisma.vatRate.findMany({
      select: { code: true },
      orderBy: { code: 'asc' },
    });
    const codes = rows.map((row) => row.code).filter(Boolean);
    return codes.length > 0 ? codes : ['23', '8', '5', '0', 'ZW'];
  }

  private async getNextTicketNumber() {
    const latest = await this.prisma.ticket.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return (latest?.number ?? 0) + 1;
  }

  private pickRandom<T>(values: T[]): T {
    return values[Math.floor(Math.random() * values.length)];
  }

  private pickWeighted<T>(values: Array<{ value: T; weight: number }>): T {
    const totalWeight = values.reduce((acc, item) => acc + item.weight, 0);
    const random = Math.random() * totalWeight;
    let cursor = 0;
    for (const item of values) {
      cursor += item.weight;
      if (random <= cursor) {
        return item.value;
      }
    }
    return values[values.length - 1].value;
  }

  private randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomPastDate(maxDaysBack: number): Date {
    const now = Date.now();
    const maxOffsetMs = maxDaysBack * 24 * 60 * 60 * 1000;
    const offset = Math.floor(Math.random() * maxOffsetMs);
    return new Date(now - offset);
  }

  private randomDateBetween(start: Date, end: Date): Date {
    const from = start.getTime();
    const to = end.getTime();
    if (to <= from) {
      return new Date(from);
    }
    const timestamp = from + Math.floor(Math.random() * (to - from));
    return new Date(timestamp);
  }

  private buildTicketTitle(index: number): string {
    const templates = [
      'Wymiana baterii w iPhone',
      'Zalany MacBook - diagnostyka',
      'Nie ładuje się iPad',
      'Uszkodzone gniazdo USB-C',
      'Wymiana ekranu po upadku',
      'Brak dźwięku po naprawie',
      'Laptop przegrzewa się pod obciążeniem',
      'Telefon restartuje się samoczynnie',
      'Nie działa Face ID / Touch ID',
      'Aktualizacja systemu zatrzymuje się',
      'Uszkodzona kamera tylna',
      'Wymiana klawiatury',
    ];
    return `${this.pickRandom(templates)} #${index + 1}`;
  }

  private buildTicketDescription(title: string): string {
    const details = [
      'Klient zgłasza problem od kilku dni, urządzenie trafiło do serwisu z kompletem akcesoriów.',
      'Objawy występują nieregularnie, zalecono pełną diagnostykę i testy obciążeniowe.',
      'Urządzenie po wcześniejszej naprawie w innym punkcie, potrzebna weryfikacja podzespołów.',
      'Wymagane potwierdzenie kosztorysu przed finalnym zamknięciem zgłoszenia.',
      'Klient prosi o kontakt SMS po zakończonej naprawie i gotowości odbioru.',
      'Wstępna analiza wskazuje na uszkodzenie modułu zasilania lub baterii.',
    ];
    return `${title}. ${this.pickRandom(details)}`;
  }

  private buildCommentBody(index: number, status: string): string {
    const base = [
      'Przyjęto urządzenie i wykonano diagnostykę wstępną.',
      'Wysłano kosztorys do akceptacji klienta.',
      'Zamówiono część zamienną od dostawcy.',
      'Wykonano naprawę i testy funkcjonalne.',
      'Skontaktowano się z klientem w sprawie odbioru.',
      'Uzupełniono dokumentację serwisową.',
    ];
    const prefix = status === 'WAITING_FOR_CUSTOMER' ? 'Oczekiwanie na klienta.' : 'Aktualizacja serwisowa.';
    return `${prefix} ${base[index % base.length]}`;
  }

  private resolveVatPercent(code: string): number {
    switch (code) {
      case '23':
        return 23;
      case '8':
        return 8;
      case '5':
        return 5;
      default:
        return 0;
    }
  }
}

