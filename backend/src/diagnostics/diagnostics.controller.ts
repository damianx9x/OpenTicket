import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { Response } from 'express';
import { register } from 'prom-client';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('diagnostics')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class DiagnosticsController {
  constructor(private readonly diag: DiagnosticsService) {}

  @Get()
  async runChecks() {
    return await this.diag.runAllChecks();
  }

  @Get('report')
  async report() {
    return await this.diag.buildSupportReport();
  }

  @Get('metrics')
  async metrics(@Res() res: Response) {
    try {
      const data = await register.metrics();
      res.set('Content-Type', register.contentType);
      res.send(data);
    } catch (err) {
      res.status(500).send('metrics error');
    }
  }
}
