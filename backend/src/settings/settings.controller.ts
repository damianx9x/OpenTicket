import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Publiczne ustawienia brandingu i UI' })
  async getPublicSettings() {
    const settings = await this.settingsService.getSystemSettings();
    return {
      branding: settings.branding,
      uiDefaults: settings.uiDefaults,
      features: settings.features,
    };
  }

  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Pełne ustawienia systemu (admin)' })
  async getAdminSettings() {
    return this.settingsService.getSystemSettings();
  }

  @Put('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Aktualizacja ustawień systemu (admin)' })
  async updateAdminSettings(@Body() patch: Record<string, unknown>) {
    return this.settingsService.updateSystemSettings(patch as any);
  }
}
