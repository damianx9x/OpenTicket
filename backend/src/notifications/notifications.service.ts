import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

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
      const response = await fetch(emailCfg.webhookUrl, {
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
      const response = await fetch(smsCfg.webhookUrl, {
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
}
