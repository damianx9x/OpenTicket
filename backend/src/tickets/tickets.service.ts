import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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
  async create(dto: CreateTicketDto) {
    const publicToken = crypto.randomBytes(16).toString('hex');
    const ownerUserId = await this.resolveOwnerUserId(dto);
    const ticket = await this.createWithNumberRetry({
      dto,
      ownerUserId,
      publicToken,
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

    if (dto.assignedAgentId !== undefined) {
      data.assignedAgent = dto.assignedAgentId
        ? { connect: { id: dto.assignedAgentId } }
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
            ...(params.dto.assignedAgentId
              ? { assignedAgent: { connect: { id: params.dto.assignedAgentId } } }
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

    const email = (dto.customerEmail || 'reporter.local@openticket.local').trim().toLowerCase();
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      return existingByEmail.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        name: dto.customerName || 'System Reporter',
        role: 'REPORTER',
      },
    });
    return created.id;
  }
}
