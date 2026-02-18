import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { Prisma, TicketStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tworzy nowy ticket i automatycznie generuje publicToken do śledzenia statusu.
   */
  async create(dto: CreateTicketDto) {
    const publicToken = crypto.randomBytes(16).toString('hex');

    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'NORMAL',
        channel: dto.channel ?? 'WEB_FORM',
        ownerUserId: dto.ownerUserId,
        organizationId: dto.organizationId ?? null,
        assignedAgentId: dto.assignedAgentId ?? null,
        publicToken,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Ticket created: ${ticket.id} (${ticket.number})`);
    return ticket;
  }

  /**
   * Lista ticketów z paginacją, filtrowaniem i sortowaniem.
   */
  async findAll(query: QueryTicketsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.TicketWhereInput = {};

    if (query.status) {
      where.status = query.status as TicketStatus;
    }
    if (query.priority) {
      where.priority = query.priority as any;
    }
    if (query.assignedAgentId) {
      where.assignedAgentId = query.assignedAgentId;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
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
      data.assignedAgent = { connect: { id: dto.assignedAgentId } };
    }

    // Status change with history tracking
    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status as any;

      if (dto.status === 'CLOSED' || dto.status === 'RESOLVED') {
        data.closedAt = new Date();
      }

      // Create status history entry
      if (changedByUserId) {
        await this.prisma.ticketStatusHistory.create({
          data: {
            ticketId: id,
            fromStatus: existing.status,
            toStatus: dto.status as TicketStatus,
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

  /**
   * Helper: parsuje string sortowania na Prisma orderBy.
   */
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
}
