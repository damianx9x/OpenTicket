import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  generateToken(ticketId: string) {
    const issuedAt = new Date().toISOString();
    const nonce = crypto.randomBytes(6).toString('hex');
    const payload = JSON.stringify({ ticketId, issuedAt, nonce });
    const secret = process.env.QR_SECRET || 'dev_qr_secret';
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const token = Buffer.from(payload).toString('base64') + '.' + hmac;

    // Simple SVG label to act as QR placeholder (can be replaced with real QR generator)
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='#fff'/><text x='10' y='20' font-size='14'>Ticket: ${ticketId}</text><text x='10' y='40' font-size='12'>Issued: ${issuedAt}</text></svg>`;
    const svgBase64 = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

    return { token, svg: svgBase64 };
  }

  verifyToken(qrToken: string) {
    try {
      const [b64, hmac] = qrToken.split('.');
      if (!b64 || !hmac) return { ok: false, reason: 'invalid-format' };
      const payload = Buffer.from(b64, 'base64').toString('utf8');
      const secret = process.env.QR_SECRET || 'dev_qr_secret';
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      if (expected !== hmac) return { ok: false, reason: 'bad-signature' };
      const data = JSON.parse(payload);
      return { ok: true, data };
    } catch (err) {
      this.logger.warn('QR verify failed', err as any);
      return { ok: false, reason: 'exception' };
    }
  }
}
