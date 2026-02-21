import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CostItemsService } from './cost-items.service';
import { CreateCostItemDto } from './dto/create-cost-item.dto';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@ApiTags('Cost Items')
@Controller()
export class CostItemsController {
  constructor(private readonly costItemsService: CostItemsService) {}

  @Post('tickets/:ticketId/cost-items')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dodaj pozycję kosztową do ticketu (z auto-kalkulacją VAT)' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 201, description: 'Pozycja kosztowa dodana' })
  async create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCostItemDto,
  ) {
    dto.ticketId = ticketId;
    return this.costItemsService.create(dto);
  }

  @Get('tickets/:ticketId/cost-items')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Lista pozycji kosztowych ticketu z podsumowaniem' })
  @ApiParam({ name: 'ticketId', description: 'UUID ticketu' })
  @ApiResponse({ status: 200, description: 'Lista pozycji z summary (netTotal, vatTotal, grossTotal)' })
  async list(@Param('ticketId', ParseUUIDPipe) ticketId: string) {
    return this.costItemsService.findByTicketId(ticketId);
  }

  @Delete('cost-items/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Usuń pozycję kosztową' })
  @ApiParam({ name: 'id', description: 'UUID pozycji kosztowej' })
  @ApiResponse({ status: 200, description: 'Pozycja usunięta' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.costItemsService.remove(id);
  }

  @Get('vat-rates')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Pobierz dostępne stawki VAT' })
  @ApiResponse({ status: 200, description: 'Lista stawek VAT' })
  async getVatRates() {
    return this.costItemsService.getVatRates();
  }
}
