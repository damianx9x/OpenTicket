import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/auth/auth.guard';
import { RolesGuard } from '../common/auth/roles.guard';
import { Roles } from '../common/auth/roles.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Lista użytkowników (admin/technik)' })
  async list(@Query('includeDisabled') includeDisabled?: string) {
    return this.usersService.listUsers(includeDisabled === '1' || includeDisabled === 'true');
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Dodaj użytkownika (admin)' })
  async create(@Body() body: Record<string, any>) {
    return this.usersService.createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      phone: body.phone,
      password: body.password,
    });
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edytuj użytkownika (admin)' })
  async update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.usersService.updateUser(id, {
      email: body.email,
      name: body.name,
      role: body.role,
      phone: body.phone,
      password: body.password,
      disabled: body.disabled,
    });
  }

  @Get(':id/notes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Lista notatek wewnętrznych użytkownika' })
  async notes(@Param('id') id: string) {
    return this.usersService.listUserNotes(id);
  }

  @Post(':id/notes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @ApiOperation({ summary: 'Dodaj notatkę do użytkownika' })
  async addNote(
    @Param('id') id: string,
    @Body() body: { body?: string; isInternal?: boolean },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.addUserNote({
      userId: id,
      authorUserId: user.id,
      body: body.body || '',
      isInternal: body.isInternal ?? true,
    });
  }

  @Get('me/preferences')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Pobierz preferencje UI zalogowanego użytkownika' })
  async getMyPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMyPreferences(user.id);
  }

  @Patch('me/preferences')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Zapisz preferencje UI zalogowanego użytkownika' })
  async saveMyPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { preferences?: Record<string, unknown> },
  ) {
    return this.usersService.updateMyPreferences(user.id, body.preferences || {});
  }

  @Post('register-technician')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rejestracja technika (tylko admin)' })
  async registerTechnician(@Body() body: Record<string, any>) {
    return this.usersService.registerTechnician({
      signupCode: body.signupCode,
      email: body.email,
      name: body.name,
      phone: body.phone,
      password: body.password,
    });
  }

  @Post('technician-signup-code')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ustaw/zmień kod samodzielnej rejestracji technika' })
  async setTechnicianSignupCode(@Body() body: { code?: string; enabled?: boolean }) {
    if (!body.code || body.code.trim().length < 4) {
      throw new BadRequestException('Kod musi mieć minimum 4 znaki.');
    }

    await this.usersService.setTechnicianSignupCode(body.code);

    if (typeof body.enabled === 'boolean') {
      await this.settingsService.updateSystemSettings({
        features: { technicianSelfSignup: body.enabled },
      });
    }

    return { success: true };
  }
}
