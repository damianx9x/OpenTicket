import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('tickets')
@UseGuards(AuthGuard, RolesGuard)
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Post(':id/generate-qr')
  @Roles('ADMIN', 'AGENT')
  generate(@Param('id') id: string) {
    return this.qr.generateToken(id);
  }

  @Post(':id/qr')
  @Roles('ADMIN', 'AGENT')
  generateV2(@Param('id') id: string) {
    return this.qr.generateToken(id);
  }

  @Post('/qr-scan')
  @Roles('ADMIN', 'AGENT')
  async scan(@Body() body: { qr_token: string; action: string; technicianId?: string }) {
    const { qr_token, action, technicianId } = body as any;
    const res = this.qr.verifyToken(qr_token);
    if (!res.ok) return { ok: false, reason: res.reason };
    // Here we would apply action to ticket (update status, create timeline entry)
    // For now return a stub
    return {
      ok: true,
      ticketId: res.data.ticketId,
      action,
      performedBy: technicianId || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
