import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { requestId?: string }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? messageOf(exception) : 'Something went wrong.';
    if (status >= 500) {
      const errorName = exception instanceof Error ? exception.name : 'Error';
      this.logger.error(JSON.stringify({ requestId: request.requestId, status, error: errorName }));
    }
    response.status(status).json({
      statusCode: status,
      message,
      requestId: request.requestId,
    });
  }
}

function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && body && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.filter((item) => typeof item === 'string').join(' ');
    if (typeof message === 'string') return message;
  }
  return exception.message;
}
