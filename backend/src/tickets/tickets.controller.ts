import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Utwórz nowy ticket' })
  @ApiResponse({ status: 201, description: 'Ticket utworzony' })
  @ApiResponse({ status: 400, description: 'Błąd walidacji' })
  async create(@Body() dto: CreateTicketDto) {
    return this.ticketsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista ticketów z paginacją i filtrami' })
  @ApiResponse({ status: 200, description: 'Lista ticketów' })
  async list(@Query() query: QueryTicketsDto) {
    return this.ticketsService.findAll(query);
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
  @ApiOperation({ summary: 'Pobierz szczegóły ticketu po ID' })
  @ApiParam({ name: 'id', description: 'UUID ticketu' })
  @ApiResponse({ status: 200, description: 'Szczegóły ticketu' })
  @ApiResponse({ status: 404, description: 'Ticket nie znaleziony' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aktualizuj ticket (status, priorytet, przypisanie, opis)' })
  @ApiParam({ name: 'id', description: 'UUID ticketu' })
  @ApiHeader({ name: 'x-user-id', description: 'UUID aktualnego użytkownika (do historii zmian)', required: false })
  @ApiResponse({ status: 200, description: 'Ticket zaktualizowany' })
  @ApiResponse({ status: 404, description: 'Ticket nie znaleziony' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.ticketsService.update(id, dto, userId);
  }
}
