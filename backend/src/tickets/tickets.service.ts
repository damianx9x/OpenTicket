import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tworzy nowy ticket i automatycznie generuje publicToken do śledzenia statusu.
   */
  async create(dto: CreateTicketDto, currentUser?: AuthenticatedUser) {
    const publicToken = crypto.randomBytes(16).toString('hex');
    const ownerUserId = await this.resolveOwnerUserId(dto);
    const assignedAgentId = await this.resolveAssignedAgentId(dto, currentUser);
    const ticket = await this.createWithNumberRetry({
      dto,
      ownerUserId,
      publicToken,
      assignedAgentId,
    });

    this.logger.log(`Ticket created: ${ticket.id} (#${ticket.number})`);
    return ticket;
  }

  /**
   * Lista ticketów z paginacją, filtrowaniem i sortowaniem.
   */
  async findAll(query: QueryTicketsDto, currentUser?: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const andFilters: Prisma.TicketWhereInput[] = [];

    if (query.status) {
      andFilters.push({ status: query.status as any });
    }
    if (query.priority) {
      andFilters.push({ priority: query.priority as any });
    }
    if (query.assignedAgentId) {
      andFilters.push({ assignedAgentId: query.assignedAgentId });
    }
    if (query.onlyMine && currentUser?.id) {
      andFilters.push({
        OR: [{ assignedAgentId: currentUser.id }, { ownerUserId: currentUser.id }],
      });
    }
    if (query.minAgeDays && query.minAgeDays > 0) {
      const threshold = new Date(Date.now() - query.minAgeDays * 24 * 60 * 60 * 1000);
      andFilters.push({ createdAt: { lte: threshold } });
    }
    if (query.search) {
      const normalized = query.search.trim();
      if (normalized.length > 0) {
        const searchOr: Prisma.TicketWhereInput[] = [
          { title: { contains: normalized } },
          { description: { contains: normalized } },
          { owner: { name: { contains: normalized } } },
          { owner: { email: { contains: normalized } } },
          { assignedAgent: { name: { contains: normalized } } },
          { assignedAgent: { email: { contains: normalized } } },
          { comments: { some: { body: { contains: normalized } } } },
        ];

        const numericCandidate = Number(normalized.replace(/^#/, ''));
        if (Number.isInteger(numericCandidate) && numericCandidate > 0) {
          searchOr.push({ number: numericCandidate });
        }

        andFilters.push({ OR: searchOr });
      }
    }

    const where: Prisma.TicketWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

    const orderBy = this.parseSort(query.sort ?? 'createdAt_desc');

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true, costItems: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Pobiera ticket po ID z pełnymi relacjami.
   */
  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true } } },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            filename: true,
            mimeType: true,
            byteSize: true,
            createdAt: true,
          },
        },
        costItems: {
          orderBy: { createdAt: 'desc' },
          include: { vatRate: true },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async getCustomerHistory(ticketId: string, limit = 10) {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.floor(limit), 50)) : 10;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ownerUserId: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    const items = await this.prisma.ticket.findMany({
      where: {
        ownerUserId: ticket.ownerUserId,
        id: { not: ticketId },
      },
      orderBy: { createdAt: 'desc' },
      take: normalizedLimit,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        assignedAgentId: true,
        assignedAgent: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      owner: ticket.owner,
      ownerUserId: ticket.ownerUserId,
      ticketCount: items.length,
      items,
    };
  }

  /**
   * Pobiera ticket po public_token (portal statusu — bez logowania).
   */
  async findByPublicToken(token: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          select: { fromStatus: true, toStatus: true, changedAt: true },
        },
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          select: { body: true, createdAt: true, author: { select: { name: true } } },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found for given token');
    }

    return ticket;
  }

  /**
   * Aktualizuje ticket. Jeśli zmieniono status, tworzy wpis w historii.
   */
  async update(id: string, dto: UpdateTicketDto, changedByUserId?: string) {
    const existing = await this.prisma.ticket.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    const data: Prisma.TicketUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priority !== undefined) data.priority = dto.priority as any;

    const resolvedAssignedAgentId =
      dto.assignedAgentId !== undefined
        ? await this.resolveAssignedAgentReference(dto.assignedAgentId, true)
        : dto.assignedTo !== undefined
          ? await this.resolveAssignedAgentReference(dto.assignedTo, true)
          : undefined;

    if (resolvedAssignedAgentId !== undefined) {
      data.assignedAgent = resolvedAssignedAgentId
        ? { connect: { id: resolvedAssignedAgentId } }
        : { disconnect: true };
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status as any;

      if (dto.status === 'CLOSED' || dto.status === 'RESOLVED') {
        data.closedAt = new Date();
      }

      if (changedByUserId) {
        await this.prisma.ticketStatusHistory.create({
          data: {
            ticketId: id,
            fromStatus: existing.status,
            toStatus: dto.status,
            changedBy: changedByUserId,
          },
        });
      }
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Ticket updated: ${id}`);
    return updated;
  }

  private parseSort(sort: string): Prisma.TicketOrderByWithRelationInput {
    const sortMap: Record<string, Prisma.TicketOrderByWithRelationInput> = {
      createdAt_asc: { createdAt: 'asc' },
      createdAt_desc: { createdAt: 'desc' },
      updatedAt_asc: { updatedAt: 'asc' },
      updatedAt_desc: { updatedAt: 'desc' },
      priority_asc: { priority: 'asc' },
      priority_desc: { priority: 'desc' },
    };
    return sortMap[sort] ?? { createdAt: 'desc' };
  }

  private async nextTicketNumber(): Promise<number> {
    const latest = await this.prisma.ticket.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return (latest?.number ?? 0) + 1;
  }

  private async createWithNumberRetry(params: {
    dto: CreateTicketDto;
    ownerUserId: string;
    publicToken: string;
    assignedAgentId: string | null;
  }) {
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const number = await this.nextTicketNumber();

      try {
        return await this.prisma.ticket.create({
          data: {
            number,
            title: params.dto.title,
            description: params.dto.description,
            priority: params.dto.priority ?? 'NORMAL',
            channel: params.dto.channel ?? 'WEB_FORM',
            publicToken: params.publicToken,
            owner: { connect: { id: params.ownerUserId } },
            ...(params.dto.organizationId ? { organization: { connect: { id: params.dto.organizationId } } } : {}),
            ...(params.assignedAgentId
              ? { assignedAgent: { connect: { id: params.assignedAgentId } } }
              : {}),
          },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            assignedAgent: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
          },
        });
      } catch (error: any) {
        const target = Array.isArray(error?.meta?.target)
          ? error.meta.target.join(',')
          : String(error?.meta?.target || '');
        const duplicateNumber = error?.code === 'P2002' && target.includes('number');

        if (duplicateNumber && attempt < maxAttempts) {
          this.logger.warn(
            `Ticket number collision for #${number}. Retry ${attempt}/${maxAttempts - 1}`,
          );
          continue;
        }

        throw error;
      }
    }

    throw new Error('Nie udało się wygenerować unikalnego numeru ticketu.');
  }

  private async resolveOwnerUserId(dto: CreateTicketDto): Promise<string> {
    if (dto.ownerUserId) {
      const existingOwner = await this.prisma.user.findUnique({ where: { id: dto.ownerUserId } });
      if (existingOwner) {
        return existingOwner.id;
      }
    }

    const normalizedEmail = this.normalizeEmail(dto.customerEmail);
    const normalizedPhone = this.normalizePhone(dto.customerPhone);
    const normalizedName = this.normalizeName(dto.customerName);

    if (normalizedEmail) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingByEmail) {
        await this.enrichReporter(existingByEmail.id, normalizedName, normalizedPhone);
        return existingByEmail.id;
      }
    }

    if (normalizedPhone) {
      const existingByPhone = await this.prisma.user.findFirst({
        where: {
          role: 'REPORTER',
          phone: normalizedPhone,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existingByPhone) {
        await this.enrichReporter(existingByPhone.id, normalizedName, normalizedPhone);
        return existingByPhone.id;
      }
    }

    if (normalizedName) {
      const existingByName = await this.prisma.user.findFirst({
        where: {
          role: 'REPORTER',
          name: normalizedName,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existingByName) {
        await this.enrichReporter(existingByName.id, normalizedName, normalizedPhone);
        return existingByName.id;
      }
    }

    const fallbackEmail = normalizedEmail ?? this.buildReporterAliasEmail(normalizedName, normalizedPhone);
    const created = await this.prisma.user.create({
      data: {
        email: fallbackEmail,
        name: normalizedName || 'Klient',
        phone: normalizedPhone || null,
        role: 'REPORTER',
      },
    });
    return created.id;
  }

  private async resolveAssignedAgentId(
    dto: CreateTicketDto,
    currentUser?: AuthenticatedUser,
  ): Promise<string | null> {
    const explicit =
      dto.assignedAgentId !== undefined
        ? await this.resolveAssignedAgentReference(dto.assignedAgentId, false)
        : dto.assignedTo !== undefined
          ? await this.resolveAssignedAgentReference(dto.assignedTo, false)
          : undefined;

    if (explicit !== undefined) {
      return explicit;
    }

    const role = (currentUser?.role || '').toUpperCase();
    if (currentUser?.id && (role === 'ADMIN' || role === 'AGENT')) {
      return currentUser.id;
    }

    return null;
  }

  private async resolveAssignedAgentReference(
    reference: string | null | undefined,
    allowEmpty: boolean,
  ): Promise<string | null | undefined> {
    if (reference === undefined) {
      return undefined;
    }

    const trimmed = (reference || '').trim();
    if (trimmed.length === 0) {
      return allowEmpty ? null : undefined;
    }

    const byId = await this.prisma.user.findUnique({
      where: { id: trimmed },
      select: { id: true, role: true, disabledAt: true },
    });
    if (byId) {
      const role = byId.role.toUpperCase();
      if (!['ADMIN', 'AGENT'].includes(role)) {
        throw new BadRequestException('Wybrany użytkownik nie jest technikiem.');
      }
      if (byId.disabledAt) {
        throw new BadRequestException('Wybrany technik jest zablokowany.');
      }
      return byId.id;
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: trimmed.toLowerCase() },
      select: { id: true, role: true, disabledAt: true },
    });
    if (byEmail) {
      const role = byEmail.role.toUpperCase();
      if (!['ADMIN', 'AGENT'].includes(role)) {
        throw new BadRequestException('Wybrany użytkownik nie jest technikiem.');
      }
      if (byEmail.disabledAt) {
        throw new BadRequestException('Wybrany technik jest zablokowany.');
      }
      return byEmail.id;
    }

    throw new BadRequestException(`Nie znaleziono technika dla: ${trimmed}`);
  }

  private normalizeEmail(value?: string): string | null {
    const normalized = (value || '').trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizePhone(value?: string): string | null {
    const normalized = (value || '').trim().replace(/\s+/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeName(value?: string): string | null {
    const normalized = (value || '').trim().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : null;
  }

  private buildReporterAliasEmail(name: string | null, phone: string | null): string {
    if (phone) {
      const digits = phone.replace(/[^0-9+]/g, '');
      if (digits.length >= 6) {
        return `phone-${digits.replace(/^\+/, '00')}@customer.openticket.local`;
      }
    }

    if (name) {
      const slug = name
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .slice(0, 42);
      if (slug.length > 0) {
        return `name-${slug}@customer.openticket.local`;
      }
    }

    return `anonymous-${crypto.randomBytes(4).toString('hex')}@customer.openticket.local`;
  }

  private async enrichReporter(userId: string, name: string | null, phone: string | null): Promise<void> {
    if (!name && !phone) {
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      },
    });
  }
}
