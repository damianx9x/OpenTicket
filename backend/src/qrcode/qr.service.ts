import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly defaultTokenTtlMs = 30 * 24 * 60 * 60 * 1000;

  generateToken(ticketId: string) {
    const issuedAt = new Date().toISOString();
    const exp = Date.now() + this.defaultTokenTtlMs;
    const nonce = crypto.randomBytes(6).toString('hex');
    const payload = JSON.stringify({ v: 1, ticketId, issuedAt, exp, nonce });
    const secret = this.resolveSecret();
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = Buffer.from(payload).toString('base64url') + '.' + hmac;

    // Simple SVG label to act as QR placeholder (can be replaced with real QR generator)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='#fff'/><text x='10' y='20' font-size='14'>Ticket: ${ticketId}</text><text x='10' y='40' font-size='12'>Issued: ${issuedAt}</text></svg>`;
    const svgBase64 = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

    return { token, svg: svgBase64 };
  }

  verifyToken(qrToken: string) {
    try {
      const [b64, hmac] = qrToken.split('.');
      if (!b64 || !hmac) return { ok: false, reason: 'invalid-format' };
      const payload = Buffer.from(b64, 'base64url').toString('utf8');
      const secret = this.resolveSecret();
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (!this.safeEqualHex(expected, hmac)) return { ok: false, reason: 'bad-signature' };
      const data = JSON.parse(payload) as { ticketId?: string; exp?: number; [key: string]: unknown };
      if (typeof data.exp === 'number' && Number.isFinite(data.exp) && Date.now() > data.exp) {
        return { ok: false, reason: 'expired' };
      }
      return { ok: true, data };
    } catch (err) {
      this.logger.warn('QR verify failed', err as any);
      return { ok: false, reason: 'exception' };
    }
  }

  private resolveSecret(): string {
    const secret = (process.env.QR_SECRET || process.env.JWT_SECRET || '').trim();
    if (secret.length < 16) {
      throw new Error('QR secret is not configured or too short.');
    }
    return secret;
  }

  private safeEqualHex(expectedHex: string, providedHex: string): boolean {
    try {
      const left = Buffer.from(expectedHex, 'hex');
      const right = Buffer.from((providedHex || '').trim(), 'hex');
      if (left.length === 0 || right.length === 0 || left.length !== right.length) {
        return false;
      }
      return crypto.timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }
}
