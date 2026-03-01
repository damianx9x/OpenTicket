import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('qr')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'AGENT')
export class QrScanController {
  constructor(private readonly qr: QrService) {}

  @Post('scan')
  async scan(@Body() body: { qr_token: string; action: string; technicianId?: string }) {
    const { qr_token, action, technicianId } = body as any;
    const res = this.qr.verifyToken(qr_token);
    if (!res.ok) return { ok: false, reason: res.reason };

    return {
      ok: true,
      ticketId: res.data.ticketId,
      action,
      performedBy: technicianId || 'unknown',
      timestamp: new Date().toISOString(),
    };
  }
}
