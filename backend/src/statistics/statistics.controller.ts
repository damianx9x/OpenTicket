import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@ApiTags('Statistics')
@Controller('statistics')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Rozbudowane statystyki zgłoszeń i kosztów' })
  async overview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('assignedAgentId') assignedAgentId?: string,
    @Query('channel') channel?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
  ) {
    return this.statisticsService.overview({
      from,
      to,
      assignedAgentId,
      channel,
      priority,
      status,
    });
  }
}
