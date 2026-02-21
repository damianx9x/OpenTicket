import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { DemoService } from './demo.service';

type LoadDemoBody = {
  count?: number;
  reset?: boolean;
};

@ApiTags('Demo')
@Controller('demo')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('load')
  @ApiOperation({ summary: 'Wczytaj realistyczną bazę demo (admin only)' })
  async loadDemo(@Body() body: LoadDemoBody) {
    return this.demoService.loadDemoDataset({
      count: body?.count,
      reset: body?.reset,
    });
  }
}

