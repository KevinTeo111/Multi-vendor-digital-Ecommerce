import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { env } from './config/env';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for webhook signature verification
  });

  app.setGlobalPrefix('api');
  // Behind Render/Vercel/Cloudflare proxies the client IP arrives in X-Forwarded-For.
  app.set('trust proxy', 1);
  // WEB_URL may be a comma-separated list (production domain + Vercel preview URL).
  const origins = env.WEB_URL.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length === 1 ? origins[0] : origins, credentials: true });
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
