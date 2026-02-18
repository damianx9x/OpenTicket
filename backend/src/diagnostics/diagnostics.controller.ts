import { Controller, Get, Res } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { Response } from 'express';
import { register } from 'prom-client';

@Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diag: DiagnosticsService) {}

  @Get()
  async runChecks() {
    return await this.diag.runAllChecks();
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
