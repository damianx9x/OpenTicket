import { Controller, Post, Param, Body } from '@nestjs/common';
import { QrService } from './qr.service';

@Controller('tickets')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Post(':id/generate-qr')
  generate(@Param('id') id: string) {
    // In real implementation check permissions and ticket existence
    return this.qr.generateToken(id);
  }

  @Post(':id/qr')
  generateV2(@Param('id') id: string) {
    return this.qr.generateToken(id);
  }

  @Post('/qr-scan')
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
