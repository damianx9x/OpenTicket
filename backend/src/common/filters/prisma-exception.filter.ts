import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

type PrismaException =
  | Prisma.PrismaClientInitializationError
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientRustPanicError
  | Prisma.PrismaClientUnknownRequestError;

@Catch(
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: PrismaException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const message = this.resolveUserMessage(exception);
    const status = this.resolveStatus(exception, message);
    const code = (exception as any)?.code || null;

    this.logger.error(`Prisma exception (${code || 'no-code'}): ${exception.message}`);

    response.status(status).json({
      success: false,
      message,
      error: code || exception.constructor.name,
      meta: {
        status,
      },
    });
  }

  private resolveStatus(exception: PrismaException, message: string): number {
    const code = (exception as any)?.code || '';
    if (
      code === 'P1000' ||
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1003' ||
      code === 'P2021' ||
      code === 'P2022' ||
      message.includes('Baza danych jest niedostępna')
    ) {
      return HttpStatus.SERVICE_UNAVAILABLE;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveUserMessage(exception: PrismaException): string {
    const rawMessage = exception.message || '';
    const lower = rawMessage.toLowerCase();
    const code = ((exception as any)?.code || '').toString().toUpperCase();

    if (
      lower.includes('unable to open the database file') ||
      lower.includes('error code 14') ||
      code === 'P1003'
    ) {
      return 'Baza danych jest niedostępna (ścieżka lub uprawnienia). Użyj narzędzi serwisowych: „Szybka naprawa” lub „Reset systemu”.';
    }

    if (code === 'P2021' || code === 'P2022' || lower.includes('table') || lower.includes('column')) {
      return 'Struktura bazy danych jest niekompletna. Uruchom ponownie silnik lub wykonaj reset systemu i setup.';
    }

    return 'Wystąpił błąd silnika bazy danych. Sprawdź logi i uruchom narzędzia serwisowe.';
  }
}
