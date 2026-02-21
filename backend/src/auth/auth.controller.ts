import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/auth/auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUser } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logowanie lokalne (admin/technik)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'admin@firma.pl' },
        password: { type: 'string', example: 'Haslo123!' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Zalogowano poprawnie' })
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: { headers?: Record<string, string | undefined>; ip?: string },
  ) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Brak e-maila lub hasła.');
    }

    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      userAgent: req.headers?.['user-agent'],
      ip: req.ip,
    });

    return {
      data: result,
      meta: { tokenType: 'Bearer' },
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wylogowanie bieżącej sesji' })
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim() || '';
    await this.authService.logout(token);
    return { success: true };
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wylogowanie wszystkich sesji aktualnego użytkownika' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutEverywhere(user.id);
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Profil zalogowanego użytkownika' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
