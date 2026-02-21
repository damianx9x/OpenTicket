import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../../auth/auth.service';
import { AuthenticatedUser } from '../../auth/auth.types';

type RequestWithUser = {
  headers?: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const rawHeader = request.headers?.authorization;
    const authorization = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Brak tokenu autoryzacji.');
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Niepoprawny token autoryzacji.');
    }

    const user = await this.authService.getUserFromToken(token);
    if (!user) {
      throw new UnauthorizedException('Sesja wygasła lub token jest niepoprawny.');
    }

    request.user = user;
    return true;
  }
}
