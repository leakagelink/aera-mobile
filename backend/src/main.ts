import 'reflect-metadata';

import { join } from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, { json, urlencoded, type Request, type Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { APP_CONFIG } from './config/config.module';
import type { AppConfig } from './config/load-config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  if (config.trustProxy) app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet());
  const server = app.getHttpAdapter().getInstance();
  const legalDir = join(process.cwd(), 'legal');
  server.use('/legal', express.static(legalDir));
  const sendLegal = (file: string, contentSecurityPolicy?: string) => (_request: Request, response: Response) => {
    if (contentSecurityPolicy) response.setHeader('Content-Security-Policy', contentSecurityPolicy);
    response.sendFile(join(legalDir, file));
  };
  const deletionPolicy = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    "connect-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://accounts.google.com",
  ].join('; ');
  server.get('/', sendLegal('home.html'));
  server.get(['/privacy', '/privacy/'], sendLegal('privacy.html'));
  server.get(['/terms', '/terms/'], sendLegal('terms.html'));
  server.get(['/account-deletion', '/account-deletion/'], sendLegal('account-deletion.html', deletionPolicy));
  app.use('/admin', express.static(join(process.cwd(), 'admin')));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: false, limit: '1mb' }));
  app.enableCors({ origin: config.corsOrigins, methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
