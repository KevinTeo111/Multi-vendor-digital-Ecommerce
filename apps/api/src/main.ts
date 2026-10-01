import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env, webOrigins } from './config/env';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for webhook signature verification
  });

  app.setGlobalPrefix('api');
  // Behind Render/Vercel/Cloudflare proxies the client IP arrives in X-Forwarded-For.
  app.set('trust proxy', 1);
  app.enableCors({ origin: webOrigins, credentials: true });
  // Standard security headers. The API is called cross-origin by the web app, so resources must
  // stay readable from other origins (CORS still decides which ones).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(env.API_PORT);
  Logger.log(`API listening on http://localhost:${env.API_PORT}/api`, 'Bootstrap');
}

void bootstrap();
