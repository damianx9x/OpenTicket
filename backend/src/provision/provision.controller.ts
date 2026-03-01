import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@Controller('provision')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProvisionController {
  @Post('qr-accept')
  async qrAccept(@Body() body: { qr_token: string; deviceId: string }) {
    // Controlled stub (admin-only): production pairing flow should use dedicated signed workflow.
    return {
      ok: true,
      qr_token: body.qr_token,
      deviceId: body.deviceId,
      message: 'Provisioning accepted (stub)'
    };
  }
}

@Controller('pairings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
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
