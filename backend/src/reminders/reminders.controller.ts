import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RemindersService } from './reminders.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('Reminders')
@Controller('reminders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT', 'REPORTER', 'VIEWER')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista przypomnień (globalnie lub per ticket)' })
  async list(
    @Query('ticketId') ticketId?: string,
    @Query('includeDone') includeDone?: string,
  ) {
    return this.remindersService.list({
      ticketId,
      includeDone: includeDone === '1' || includeDone === 'true',
    });
  }

  @Post()
  @Roles('ADMIN', 'AGENT', 'REPORTER')
  @ApiOperation({ summary: 'Dodaj przypomnienie' })
  async create(
    @Body() body: { ticketId?: string; title?: string; note?: string; dueAt?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.remindersService.create({
      ...body,
      createdBy: user.id,
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'AGENT', 'REPORTER')
  @ApiOperation({ summary: 'Oznacz przypomnienie jako wykonane/niewykonane' })
  async markDone(@Param('id') id: string, @Body() body: { done?: boolean }) {
    return this.remindersService.markDone(id, Boolean(body.done));
  }

  @Delete(':id')
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Usuń przypomnienie' })
  async remove(@Param('id') id: string) {
    return this.remindersService.remove(id);
  }
}
