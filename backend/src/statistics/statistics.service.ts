import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: {
    from?: string;
    to?: string;
    assignedAgentId?: string;
    channel?: string;
    priority?: string;
    status?: string;
  }) {
    const where: Prisma.TicketWhereInput = {};
    const createdAt: Prisma.DateTimeFilter = {};

    if (query.from) {
      createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      createdAt.lte = new Date(query.to);
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId;
    if (query.channel) where.channel = query.channel;
    if (query.priority) where.priority = query.priority;
    if (query.status) where.status = query.status;

    const [total, byStatus, byPriority, byChannel, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['priority'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['channel'], where, _count: { _all: true } }),
      this.prisma.ticket.findMany({
        where,
        select: {
          createdAt: true,
          updatedAt: true,
          closedAt: true,
          status: true,
        },
      }),
    ]);

    const trendCreated: Record<string, number> = {};
    const trendClosed: Record<string, number> = {};
    let resolvedDurationsSumHours = 0;
    let resolvedDurationsCount = 0;

    for (const ticket of tickets) {
      const createdKey = ticket.createdAt.toISOString().slice(0, 10);
      trendCreated[createdKey] = (trendCreated[createdKey] || 0) + 1;

      if (ticket.closedAt) {
        const closedKey = ticket.closedAt.toISOString().slice(0, 10);
        trendClosed[closedKey] = (trendClosed[closedKey] || 0) + 1;
      }

      if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
        const endDate = ticket.closedAt || ticket.updatedAt;
        const hours = Math.max(0, (endDate.getTime() - ticket.createdAt.getTime()) / 3_600_000);
        resolvedDurationsSumHours += hours;
        resolvedDurationsCount += 1;
      }
    }

    const averageResolutionHours =
      resolvedDurationsCount > 0
        ? Number((resolvedDurationsSumHours / resolvedDurationsCount).toFixed(2))
        : null;

    const costAgg = await this.prisma.costItem.aggregate({
      _sum: {
        netTotal: true,
        vatTotal: true,
        grossTotal: true,
      },
      _count: { _all: true },
    });

    return {
      totalTickets: total,
      byStatus: byStatus.map((row) => ({ key: row.status, count: row._count._all })),
      byPriority: byPriority.map((row) => ({ key: row.priority, count: row._count._all })),
      byChannel: byChannel.map((row) => ({ key: row.channel, count: row._count._all })),
      trend: {
        created: trendCreated,
        closed: trendClosed,
      },
      sla: {
        averageResolutionHours,
      },
      costs: {
        itemCount: costAgg._count._all,
        netTotal: costAgg._sum.netTotal ?? 0,
        vatTotal: costAgg._sum.vatTotal ?? 0,
        grossTotal: costAgg._sum.grossTotal ?? 0,
      },
    };
  }
}
