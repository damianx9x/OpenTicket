import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined) {
          return { data: null };
        }

        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          if ('data' in payload || 'error' in payload || 'success' in payload || 'meta' in payload) {
            return payload;
          }
        }

        return { data: payload };
      }),
    );
  }
}
