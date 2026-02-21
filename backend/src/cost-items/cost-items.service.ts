import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CostItemsService {
  private readonly logger = new Logger(CostItemsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dodaje pozycję kosztową do ticketu z automatyczną kalkulacją VAT.
   */
  async create(dto: CreateCostItemDto) {
    if (!dto.ticketId) {
      throw new BadRequestException('ticketId is required');
    }

    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
    if (!ticket) {
      throw new NotFoundException(`Ticket ${dto.ticketId} not found`);
    }

    const normalized = {
      name: dto.name ?? dto.description,
      qty: dto.qty ?? dto.quantity,
      unitNet: dto.unitNet ?? dto.unitPrice,
      vatCode: dto.vatCode ?? (dto.vat !== undefined ? String(dto.vat) : undefined),
    };

    if (!normalized.name || normalized.qty === undefined || normalized.unitNet === undefined || !normalized.vatCode) {
      throw new BadRequestException('Missing required fields for cost item: name/qty/unitNet/vatCode');
    }

    // Verify VAT rate exists (self-heal default rates for legacy installs)
    const vatRate = await this.resolveVatRate(normalized.vatCode);
    if (!vatRate) {
      throw new BadRequestException(`VAT rate code '${normalized.vatCode}' not found. Use one of: 23, 8, 5, 0, ZW`);
    }

    // Calculate totals
    const netTotal = this.round2(normalized.qty * normalized.unitNet);
    let vatTotal: number;

    if (vatRate.isExempt) {
      vatTotal = 0;
    } else {
      vatTotal = this.round2(netTotal * Number(vatRate.percent) / 100);
    }
    const grossTotal = this.round2(netTotal + vatTotal);

    const costItem = await this.prisma.costItem.create({
      data: {
        ticketId: dto.ticketId,
        name: normalized.name,
        qty: new Decimal(normalized.qty),
        unitNet: new Decimal(normalized.unitNet),
        vatCode: normalized.vatCode,
        netTotal: new Decimal(netTotal),
        vatTotal: new Decimal(vatTotal),
        grossTotal: new Decimal(grossTotal),
      },
      include: {
        vatRate: true,
      },
    });

    this.logger.log(`CostItem created: ${costItem.id} on ticket ${dto.ticketId} (gross: ${grossTotal} PLN)`);
    return costItem;
  }

  /**
   * Lista pozycji kosztowych do ticketu.
   */
  async findByTicketId(ticketId: string) {
    const items = await this.prisma.costItem.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      include: { vatRate: true },
    });

    // Calculate summary
    const summary = items.reduce(
      (acc, item) => ({
        netTotal: acc.netTotal + Number(item.netTotal),
        vatTotal: acc.vatTotal + Number(item.vatTotal),
        grossTotal: acc.grossTotal + Number(item.grossTotal),
      }),
      { netTotal: 0, vatTotal: 0, grossTotal: 0 },
    );

    return {
      items,
      summary: {
        netTotal: this.round2(summary.netTotal),
        vatTotal: this.round2(summary.vatTotal),
        grossTotal: this.round2(summary.grossTotal),
        itemCount: items.length,
      },
    };
  }

  /**
   * Usuwa pozycję kosztową.
   */
  async remove(costItemId: string) {
    const item = await this.prisma.costItem.findUnique({ where: { id: costItemId } });
    if (!item) {
      throw new NotFoundException(`CostItem ${costItemId} not found`);
    }

    await this.prisma.costItem.delete({ where: { id: costItemId } });
    this.logger.log(`CostItem deleted: ${costItemId}`);
    return { deleted: true };
  }

  /**
   * Pobiera dostępne stawki VAT.
   */
  async getVatRates() {
    await this.ensureDefaultVatRates();
    return this.prisma.vatRate.findMany({ orderBy: { percent: 'desc' } });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async resolveVatRate(code: string) {
    const direct = await this.prisma.vatRate.findUnique({ where: { code } });
    if (direct) {
      return direct;
    }

    await this.ensureDefaultVatRates();
    return this.prisma.vatRate.findUnique({ where: { code } });
  }

  private async ensureDefaultVatRates(): Promise<void> {
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
}
