import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('test/email')
  @ApiOperation({ summary: 'Wyślij testową wiadomość e-mail (admin)' })
  async testEmail(@Body() body: { to?: string; subject?: string; message?: string }) {
    if (!body.to) {
      throw new BadRequestException('Brak adresu docelowego.');
    }

    return this.notificationsService.sendEmail(
      body.to,
      body.subject || 'OpenTicket test email',
      body.message || 'To jest test konfiguracji wiadomości e-mail.',
    );
  }

  @Post('test/sms')
  @ApiOperation({ summary: 'Wyślij testową wiadomość SMS (admin)' })
  async testSms(@Body() body: { to?: string; message?: string }) {
    if (!body.to) {
      throw new BadRequestException('Brak numeru docelowego.');
    }

    return this.notificationsService.sendSms(
      body.to,
      body.message || 'OpenTicket: test konfiguracji SMS.',
    );
  }
}
