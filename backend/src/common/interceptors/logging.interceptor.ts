import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, started),
        error: () => this.write(request, response.statusCode || 500, started),
      }),
    );
  }

  private write(request: Request & { requestId?: string }, status: number, started: number): void {
    const route = request.route && typeof request.route.path === 'string' ? request.route.path : request.path;
    this.logger.log(
      JSON.stringify({
        requestId: request.requestId,
        method: request.method,
        route,
        status,
        durationMs: Date.now() - started,
      }),
    );
  }
}
