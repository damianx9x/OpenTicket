import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('tickets')
  list() {
    return { data: [], meta: { total: 0 } };
  }

  @Post('tickets')
  create(@Body() body: any) {
    return { id: 'stub-ticket-id', received: body };
  }
}
