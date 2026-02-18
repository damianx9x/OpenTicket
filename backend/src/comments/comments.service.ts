import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dodaje komentarz do ticketu.
   */
  async create(dto: CreateCommentDto) {
    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${dto.ticketId} not found`);
    }

    const comment = await this.prisma.comment.create({
      data: {
        ticketId: dto.ticketId,
        authorUserId: dto.authorUserId,
        body: dto.body,
        isInternal: dto.isInternal ?? false,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Comment created: ${comment.id} on ticket ${dto.ticketId}`);
    return comment;
  }

  /**
   * Lista komentarzy do ticketu (z opcjonalnym filtrowaniem internal).
   */
  async findByTicketId(ticketId: string, includeInternal = true) {
    const where: any = { ticketId };
    if (!includeInternal) {
      where.isInternal = false;
    }

    return this.prisma.comment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Usuwa komentarz (soft-delete w przyszłości, teraz hard-delete).
   */
  async remove(commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException(`Comment ${commentId} not found`);
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    this.logger.log(`Comment deleted: ${commentId}`);
    return { deleted: true };
  }
}
