process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { AddressInfo } from 'node:net';
import { AuthController } from '../modules/auth/auth.controller';
import { AuthService } from '../modules/auth/auth.service';
import { WebhooksController } from '../modules/webhooks/webhooks.controller';
import { WebhooksService } from '../modules/webhooks/webhooks.service';
import { WriteThrottlerGuard } from './guards/write-throttler.guard';
import { DEFAULT_RATE_LIMIT, TOO_MANY_REQUESTS_MESSAGE } from './throttle';

/** Boots the real controllers behind the real guard, with the services stubbed, over HTTP. */
describe('Rate limits', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [DEFAULT_RATE_LIMIT],
          errorMessage: TOO_MANY_REQUESTS_MESSAGE,
        }),
      ],
      controllers: [AuthController, WebhooksController],
      providers: [
        { provide: APP_GUARD, useClass: WriteThrottlerGuard },
        {
          provide: AuthService,
          useValue: {
            login: async () => ({}),
            requestPasswordReset: async () => ({ success: true }),
            me: async () => ({ id: 'u1' }),
          },
        },
        { provide: WebhooksService, useValue: { handle: async () => ({ received: true }) } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/`;
  });

  afterAll(() => app.close());

  const post = (path: string, body: unknown = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.status);

  it('allows 10 login attempts per minute and refuses the 11th', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push(await post('auth/login'));
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    const refused = await fetch(base + 'auth/login', { method: 'POST' }).then((r) => r.json());
    expect(refused.message).toBe(TOO_MANY_REQUESTS_MESSAGE);
  });

  it('allows 5 password reset requests per minute and refuses the 6th', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push(await post('auth/forgot-password'));
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('never limits reads (server-side rendering shares a few IPs)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 150; i++) statuses.push((await fetch(base + 'auth/me')).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('never limits payment webhooks', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 150; i++) statuses.push(await post('webhooks/payments'));
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
