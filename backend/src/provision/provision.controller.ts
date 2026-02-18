import { Controller, Post, Body } from '@nestjs/common';

@Controller('provision')
export class ProvisionController {
  @Post('qr-accept')
  async qrAccept(@Body() body: { qr_token: string; deviceId: string }) {
    // Stub: verify QR, create session, return credentials
    return {
      ok: true,
      qr_token: body.qr_token,
      deviceId: body.deviceId,
      session: 'stub-session-token',
      message: 'Provisioning accepted (stub)'
    };
  }
}