import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import * as net from 'net';
import { promises as dns } from 'dns';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async sendEmail(to: string, subject: string, body: string) {
    const settings = await this.settingsService.getSystemSettings();
    const emailCfg = settings.integrations.email;

    if (emailCfg.mode === 'disabled') {
      return { ok: false, skipped: true, reason: 'Email integration disabled' };
    }

    if (emailCfg.mode === 'webhook' && emailCfg.webhookUrl) {
      const webhookUrl = await this.validateWebhookUrl(emailCfg.webhookUrl, 'email');
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'EMAIL',
          to,
          subject,
          body,
          from: emailCfg.from || null,
          provider: emailCfg.provider,
        }),
      });

      if (!response.ok) {
        throw new Error(`Email webhook failed with status ${response.status}`);
      }

      return { ok: true, provider: 'webhook' };
    }

    // For local offline deployments we strongly recommend webhook bridge
    // (SMTP runtime differs between providers and requires additional dependencies).
    this.logger.warn('SMTP mode is configured but not available in this build. Use webhook bridge.');
    return { ok: false, skipped: true, reason: 'SMTP mode not available; use webhook mode' };
  }

  async sendSms(to: string, message: string) {
    const settings = await this.settingsService.getSystemSettings();
    const smsCfg = settings.integrations.sms;

    if (smsCfg.mode === 'disabled') {
      return { ok: false, skipped: true, reason: 'SMS integration disabled' };
    }

    if (smsCfg.mode === 'webhook' && smsCfg.webhookUrl) {
      const webhookUrl = await this.validateWebhookUrl(smsCfg.webhookUrl, 'sms');
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SMS',
          to,
          message,
          from: smsCfg.sender || null,
          provider: smsCfg.provider,
        }),
      });

      if (!response.ok) {
        throw new Error(`SMS webhook failed with status ${response.status}`);
      }

      return { ok: true, provider: 'webhook' };
    }

    if (smsCfg.mode === 'twilio' && smsCfg.accountSid && smsCfg.authToken && smsCfg.sender) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        smsCfg.accountSid,
      )}/Messages.json`;
      const auth = Buffer.from(`${smsCfg.accountSid}:${smsCfg.authToken}`).toString('base64');
      const bodyData = new URLSearchParams({
        To: to,
        From: smsCfg.sender,
        Body: message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyData.toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Twilio SMS failed (${response.status}): ${text}`);
      }

      return { ok: true, provider: 'twilio' };
    }

    throw new Error('SMS integration is misconfigured');
  }

  async sendPush(userId: string, payload: any) {
    // Stub: integrate with push provider (APNs/FCM)
    this.logger.log(`sendPush user=${userId} payload=${JSON.stringify(payload)}`);
    return { ok: true };
  }

  private async validateWebhookUrl(rawUrl: string, channel: 'email' | 'sms'): Promise<string> {
    const allowInsecureHttp =
      process.env.TICKET_SYSTEM_ALLOW_INSECURE_WEBHOOKS === '1' || process.env.APP_ENV === 'DEV_LOCAL';
    const allowLoopback =
      process.env.TICKET_SYSTEM_ALLOW_LOOPBACK_WEBHOOKS === '1' || process.env.APP_ENV === 'DEV_LOCAL';
    const allowPrivateLan =
      process.env.TICKET_SYSTEM_ALLOW_PRIVATE_WEBHOOKS === '1' || process.env.APP_ENV === 'DEV_LOCAL';

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      throw new BadRequestException(`Niepoprawny adres webhook (${channel}).`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(`Webhook (${channel}) musi używać http:// albo https://.`);
    }
    if (parsed.protocol === 'http:' && !allowInsecureHttp) {
      throw new BadRequestException(`Webhook (${channel}) przez HTTP jest zablokowany. Użyj HTTPS.`);
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException(`Webhook (${channel}) nie może zawierać danych logowania w URL.`);
    }

    await this.assertHostAllowed(parsed.hostname, {
      allowLoopback,
      allowPrivateLan,
      channel,
    });

    return parsed.toString();
  }

  private async assertHostAllowed(
    host: string,
    opts: { allowLoopback: boolean; allowPrivateLan: boolean; channel: 'email' | 'sms' },
  ): Promise<void> {
    const normalized = host.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException(`Webhook (${opts.channel}) ma pusty host.`);
    }

    if (normalized === 'localhost') {
      if (opts.allowLoopback) {
        return;
      }
      throw new BadRequestException(`Webhook (${opts.channel}) do localhost jest zablokowany.`);
    }

    const directIpType = net.isIP(normalized);
    if (directIpType) {
      this.assertIpAllowed(normalized, opts);
      return;
    }

    let records: Array<{ address: string }> = [];
    try {
      records = await dns.lookup(normalized, { all: true, verbatim: true });
    } catch (error) {
      // DNS can be unavailable in offline installations. We log warning and allow hostname.
      this.logger.warn(
        `Webhook host DNS lookup skipped (${normalized}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    for (const record of records) {
      this.assertIpAllowed(record.address, opts);
    }
  }

  private assertIpAllowed(
    ip: string,
    opts: { allowLoopback: boolean; allowPrivateLan: boolean; channel: 'email' | 'sms' },
  ): void {
    if (this.isLoopbackOrLinkLocalIp(ip) && !opts.allowLoopback) {
      throw new BadRequestException(`Webhook (${opts.channel}) do loopback/link-local jest zablokowany.`);
    }
    if (this.isPrivateLanIp(ip) && !opts.allowPrivateLan) {
      throw new BadRequestException(`Webhook (${opts.channel}) do sieci prywatnej jest zablokowany.`);
    }
  }

  private isLoopbackOrLinkLocalIp(ip: string): boolean {
    if (net.isIP(ip) === 4) {
      return ip.startsWith('127.') || ip.startsWith('169.254.');
    }
    const normalized = ip.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fe80:');
  }

  private isPrivateLanIp(ip: string): boolean {
    if (net.isIP(ip) === 4) {
      if (ip.startsWith('10.')) {
        return true;
      }
      if (ip.startsWith('192.168.')) {
        return true;
      }
      const parts = ip.split('.').map((part) => Number(part));
      return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
    }
    const normalized = ip.toLowerCase();
    return normalized.startsWith('fc') || normalized.startsWith('fd');
  }
}
