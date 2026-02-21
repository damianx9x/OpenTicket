import { Controller, Post, Body } from '@nestjs/common';
import * as crypto from 'crypto';

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

@Controller('pairings')
export class PairingsController {
  @Post('create')
  async create(@Body() body: { deviceName?: string }) {
    return {
      pairingId: crypto.randomUUID(),
      token: crypto.randomBytes(16).toString('hex'),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      deviceName: body?.deviceName || 'unknown',
    };
  }

  @Post('claim')
  async claim(@Body() body: { pairingId: string; token: string; deviceId: string }) {
    return {
      ok: true,
      pairingId: body.pairingId,
      deviceId: body.deviceId,
      sessionToken: crypto.randomBytes(24).toString('hex'),
      claimedAt: new Date().toISOString(),
    };
  }
}
