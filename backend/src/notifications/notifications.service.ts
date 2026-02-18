import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmail(to: string, subject: string, body: string) {
    // Stub: integrate with SMTP provider or transactional email service
    this.logger.log(`sendEmail to=${to} subject=${subject}`);
    return { ok: true };
  }

  async sendSms(to: string, message: string) {
    // Stub: integrate with SMS provider
    this.logger.log(`sendSms to=${to} msg=${message}`);
    return { ok: true };
  }

  async sendPush(userId: string, payload: any) {
    // Stub: integrate with push provider (APNs/FCM)
    this.logger.log(`sendPush user=${userId} payload=${JSON.stringify(payload)}`);
    return { ok: true };
  }
}
