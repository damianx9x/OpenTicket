import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Utwórz nowy ticket' })
  @ApiResponse({ status: 201, description: 'Ticket utworzony' })
  @ApiResponse({ status: 400, description: 'Błąd walidacji' })
  async create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Lista ticketów z paginacją i filtrami' })
  @ApiResponse({ status: 200, description: 'Lista ticketów' })
  async list(@Query() query: QueryTicketsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ticketsService.findAll(query, user);
  }

  @Get('status/:token')
  @ApiOperation({ summary: 'Sprawdź status ticketu po public_token (portal bez logowania)' })
  @ApiParam({ name: 'token', description: 'Public token ticketu' })
  @ApiResponse({ status: 200, description: 'Status ticketu' })
  @ApiResponse({ status: 404, description: 'Nie znaleziono ticketu' })
  async getByPublicToken(@Param('token') token: string) {
    return this.ticketsService.findByPublicToken(token);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
  @ApiOperation({ summary: 'Pobierz szczegóły ticketu po ID' })
  @ApiParam({ name: 'id', description: 'UUID ticketu' })
  @ApiResponse({ status: 200, description: 'Szczegóły ticketu' })
  @ApiResponse({ status: 404, description: 'Ticket nie znaleziony' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Aktualizuj ticket (status, priorytet, przypisanie, opis)' })
  @ApiParam({ name: 'id', description: 'UUID ticketu' })
  @ApiHeader({ name: 'Authorization', description: 'Bearer token', required: true })
  @ApiResponse({ status: 200, description: 'Ticket zaktualizowany' })
  @ApiResponse({ status: 404, description: 'Ticket nie znaleziony' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.update(id, dto, user.id);
  }
}
