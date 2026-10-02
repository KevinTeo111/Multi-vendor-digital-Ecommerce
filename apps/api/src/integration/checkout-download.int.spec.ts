/**
 * Integration test against a real, disposable Postgres (TEST_DATABASE_URL), promised in the brief:
 * checkout → signed webhook → PAID with ledger credit, idempotent replay, and download
 * authorisation. The real Mercado Pago adapter runs with only its HTTP calls faked, so signature
 * validation and the payment lookup are exercised exactly as in production.
 *
 * Skipped when TEST_DATABASE_URL is not set. The database is wiped, so Neon hosts are refused.
 */
const TEST_DB = process.env.TEST_DATABASE_URL;
const describeIfDb = TEST_DB ? describe : describe.skip;

if (TEST_DB) {
  if (/neon\.tech|render\.com/i.test(TEST_DB))
    throw new Error('TEST_DATABASE_URL points at a hosted database; refusing to wipe it');
  Object.assign(process.env, {
    DATABASE_URL: TEST_DB,
    NODE_ENV: 'test',
    JOBS_ENABLED: 'false',
    PAYMENT_GATEWAY: 'mock',
    JWT_ACCESS_SECRET: 'it-access-secret-0123456789abcdef0123456789',
    JWT_REFRESH_SECRET: 'it-refresh-secret-0123456789abcdef0123456789',
    S3_ENDPOINT: 'https://storage.invalid',
    S3_ACCESS_KEY_ID: 'it-key',
    S3_SECRET_ACCESS_KEY: 'it-secret',
    S3_BUCKET: 'it-bucket',
  });
}

import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Client } from 'pg';

const WEBHOOK_SECRET = 'it-webhook-secret';
const PAYMENT_ID = '777001';

async function resetDatabase(url: string) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const dir = join(__dirname, '..', '..', 'prisma', 'migrations');
    for (const name of readdirSync(dir)
      .filter((d) => !d.endsWith('.toml'))
      .sort())
      await client.query(readFileSync(join(dir, name, 'migration.sql'), 'utf8'));
  } finally {
    await client.end();
  }
}

describeIfDb('Checkout, webhook and download (integration)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let base: string;
  let prisma: import('../prisma/prisma.service').PrismaService;
  let signedWebhook: (
    paymentId: string,
    secret?: string,
  ) => { headers: Record<string, string>; body: string; query: string };
  const preferenceBodies: Array<{ external_reference: string }> = [];
  const refundKeys: Array<string | null> = [];
  let paymentStatus = 'approved';

  beforeAll(async () => {
    await resetDatabase(TEST_DB!);

    const { AppModule } = await import('../app.module');
    const { PrismaService } = await import('../prisma/prisma.service');
    const { PAYMENT_GATEWAY } =
      await import('../modules/payments/gateway/payment-gateway.interface');
    const { MercadoPagoPaymentGateway, signManifest, signatureManifest } =
      await import('../modules/payments/gateway/mercadopago.gateway');

    // Fake Mercado Pago REST API: records preferences and refunds, answers the payment lookup with
    // whatever state the test has moved the payment to.
    const fakeFetch = async (input: string, init?: RequestInit) => {
      const path = input.replace('https://api.mercadopago.com', '');
      if (path === '/checkout/preferences' && init?.method === 'POST') {
        preferenceBodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp.test/pay' }));
      }
      if (path === `/v1/payments/${PAYMENT_ID}/refunds` && init?.method === 'POST') {
        refundKeys.push(new Headers(init.headers).get('X-Idempotency-Key'));
        return new Response(JSON.stringify({ id: 4242, status: 'approved' }), { status: 201 });
      }
      if (path === `/v1/payments/${PAYMENT_ID}`) {
        return new Response(
          JSON.stringify({
            id: Number(PAYMENT_ID),
            status: paymentStatus,
            external_reference: preferenceBodies.at(-1)?.external_reference,
            payment_type_id: 'bank_transfer',
            payment_method_id: 'pix',
          }),
        );
      }
      return new Response('{"message":"not found"}', { status: 404 });
    };
    const gateway = new MercadoPagoPaymentGateway('TEST-it-token', WEBHOOK_SECRET, {
      fetch: fakeFetch,
    });
    signedWebhook = (paymentId, secret = WEBHOOK_SECRET) => {
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = `req-${Math.random().toString(36).slice(2)}`;
      const v1 = signManifest(signatureManifest({ dataId: paymentId, requestId, ts }), secret);
      return {
        headers: {
          'Content-Type': 'application/json',
          'x-signature': `ts=${ts},v1=${v1}`,
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          type: 'payment',
          action: 'payment.updated',
          data: { id: paymentId },
        }),
        query: `?type=payment&data.id=${paymentId}`,
      };
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  const call = async (
    method: string,
    path: string,
    { token, body }: { token?: string; body?: unknown } = {},
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };

  const register = async (email: string) => {
    const res = await call('POST', '/auth/register', {
      body: { email, password: 'buyer-password-1', name: email.split('@')[0] },
    });
    expect(res.status).toBe(201);
    return res.data.accessToken as string;
  };

  const deliver = async (paymentId: string, secret?: string) => {
    const hook = signedWebhook(paymentId, secret);
    const res = await fetch(`${base}/webhooks/payments${hook.query}`, {
      method: 'POST',
      headers: hook.headers,
      body: hook.body,
    });
    return res.status;
  };

  it('prices with the fee, pays through a signed webhook, authorises downloads, and refunds once', async () => {
    const { listPriceCents } = await import('@marketplace/shared');
    const bcrypt = await import('bcryptjs');
    await prisma.user.create({
      data: {
        email: 'admin@it.test',
        name: 'Admin',
        role: 'ADMIN',
        passwordHash: await bcrypt.hash('admin-password-1', 4),
      },
    });
    const adminLogin = await call('POST', '/auth/login', {
      body: { email: 'admin@it.test', password: 'admin-password-1' },
    });
    const admin = adminLogin.data.accessToken as string;

    // Seller with an approved product and a file, seeded directly.
    const sellerUser = await prisma.user.create({
      data: { email: 'seller@it.test', name: 'Seller', passwordHash: 'x', role: 'VENDOR' },
    });
    const vendor = await prisma.vendor.create({
      data: { userId: sellerUser.id, storeName: 'IT Store', slug: 'it-store', status: 'ACTIVE' },
    });
    const category = await prisma.category.create({ data: { name: 'Books', slug: 'books' } });
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
        title: 'IT E-book',
        slug: 'it-e-book',
        shortDescription: 'Short',
        description: 'Long',
        priceCents: 2500,
        status: 'APPROVED',
        publishedAt: new Date(),
        files: {
          create: {
            storageKey: 'products/it/e-book.zip',
            fileName: 'e-book.zip',
            sizeBytes: 1234,
            mimeType: 'application/zip',
          },
        },
      },
    });

    // Setting the provider fee reprices the catalogue: the seller keeps 25,00, buyers see 26,32.
    expect(
      (
        await call('PUT', '/admin/settings', {
          token: admin,
          body: { 'finance.gateway_fee_bps': 500 },
        })
      ).status,
    ).toBe(200);
    const listed = listPriceCents(2500, 500);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      basePriceCents: 2500,
      priceCents: listed,
    });

    const buyer = await register('buyer@it.test');
    const stranger = await register('stranger@it.test');

    // Cart and checkout: the order starts PENDING with a hosted checkout link.
    expect(
      (await call('POST', '/cart/items', { token: buyer, body: { productId: product.id } })).status,
    ).toBe(201);
    const checkout = await call('POST', '/checkout', { token: buyer });
    expect(checkout.status).toBe(201);
    expect(checkout.data.checkoutUrl).toBe('https://mp.test/pay');
    const order = checkout.data.order;
    expect(order.status).toBe('PENDING');
    expect(preferenceBodies.at(-1)?.external_reference).toBe(order.orderNumber);
    // The buyer is charged exactly the listed price, in one payment.
    expect(order.totalCents).toBe(listed);
    expect(preferenceBodies.at(-1)).toMatchObject({
      items: [expect.objectContaining({ unit_price: listed / 100 })],
      payment_methods: { installments: 1, default_installments: 1 },
    });
    const itemId = order.items[0].id as string;

    // No download before payment.
    expect((await call('GET', `/orders/items/${itemId}/download`, { token: buyer })).status).toBe(
      403,
    );

    // A webhook signed with the wrong secret changes nothing.
    const forged = signedWebhook(PAYMENT_ID, 'not-the-secret');
    const forgedRes = await fetch(`${base}/webhooks/payments${forged.query}`, {
      method: 'POST',
      headers: forged.headers,
      body: forged.body,
    });
    expect(forgedRes.status).toBe(401);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );

    // The genuine webhook pays the order; a replay is recognised as a duplicate.
    for (let i = 0; i < 2; i++) {
      const hook = signedWebhook(PAYMENT_ID);
      const res = await fetch(`${base}/webhooks/payments${hook.query}`, {
        method: 'POST',
        headers: hook.headers,
        body: hook.body,
      });
      expect(res.status).toBe(200);
    }
    const paid = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(paid.status).toBe('PAID');
    expect(paid.paymentMethod).toBe('PIX');
    expect(paid.gatewayChargeId).toBe(PAYMENT_ID);

    const credits = await prisma.ledgerEntry.findMany({ where: { vendorId: vendor.id } });
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      type: 'SALE_CREDIT',
      amountCents: paid.items[0].vendorNetCents,
    });
    // Fee reserve 1,32 + commission 20% of the seller's 25,00 + seller 20,00 = 26,32 paid.
    expect(paid.items[0]).toMatchObject({
      priceCents: listed,
      gatewayFeeCents: listed - 2500,
      commissionCents: 500,
      vendorNetCents: 2000,
    });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).salesCount).toBe(
      1,
    );

    // Download: the buyer gets a signed, expiring link and the download is logged.
    const download = await call('GET', `/orders/items/${itemId}/download`, { token: buyer });
    expect(download.status).toBe(200);
    expect(download.data.url).toContain('X-Amz-Signature=');
    expect(download.data.fileName).toBe('e-book.zip');
    expect(await prisma.download.count({ where: { orderItemId: itemId } })).toBe(1);

    // Another account cannot download someone else's purchase, nor learn that it exists.
    expect(
      (await call('GET', `/orders/items/${itemId}/download`, { token: stranger })).status,
    ).toBe(404);
    expect((await call('GET', `/orders/items/${itemId}/download`)).status).toBe(401);

    // Admin refund: Mercado Pago is asked first (once, with a charge-derived key), then the order
    // is reversed: credit debited, sales counter back, downloads closed.
    const refund = await call('POST', `/admin/orders/${order.id}/refund`, {
      token: admin,
      body: { reason: 'Customer request' },
    });
    expect(refund.status).toBe(201);
    expect(refund.data.status).toBe('REFUNDED');
    expect(refundKeys).toEqual([`refund-${PAYMENT_ID}`]);

    const reversed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reversed).toMatchObject({ status: 'REFUNDED', refundReason: 'Customer request' });
    expect(reversed.refundedAt).toBeInstanceOf(Date);
    const entries = await prisma.ledgerEntry.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((e) => [e.type, e.amountCents])).toEqual([
      ['SALE_CREDIT', 2000],
      ['REFUND_DEBIT', -2000],
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).salesCount).toBe(
      0,
    );
    expect((await call('GET', `/orders/items/${itemId}/download`, { token: buyer })).status).toBe(
      403,
    );

    // Mercado Pago's own "refunded" notification arrives later: verified, and changes nothing.
    paymentStatus = 'refunded';
    expect(await deliver(PAYMENT_ID)).toBe(200);
    expect(await prisma.ledgerEntry.count({ where: { vendorId: vendor.id } })).toBe(2);

    // A second refund attempt is refused without calling the provider again.
    expect(
      (
        await call('POST', `/admin/orders/${order.id}/refund`, {
          token: admin,
          body: { reason: 'Again' },
        })
      ).status,
    ).toBe(400);
    expect(refundKeys).toHaveLength(1);
  });

  it('applies exactly one admin action to a withdrawal, even when two arrive at once', async () => {
    const adminLogin = await call('POST', '/auth/login', {
      body: { email: 'admin@it.test', password: 'admin-password-1' },
    });
    const admin = adminLogin.data.accessToken as string;
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { slug: 'it-store' } });

    // A requested withdrawal with its hold, as WithdrawalsService.request() leaves it, funded by
    // an available credit of the same amount so the seller's balance never goes negative.
    const requested = async (amountCents: number) => {
      await prisma.ledgerEntry.create({
        data: {
          vendorId: vendor.id,
          type: 'ADJUSTMENT',
          status: 'AVAILABLE',
          amountCents,
          description: 'Test funds',
        },
      });
      const w = await prisma.withdrawal.create({
        data: { vendorId: vendor.id, amountCents, status: 'REQUESTED' },
      });
      await prisma.ledgerEntry.create({
        data: {
          vendorId: vendor.id,
          type: 'WITHDRAWAL_HOLD',
          status: 'AVAILABLE',
          amountCents: -amountCents,
          withdrawalId: w.id,
          description: 'Withdrawal requested',
        },
      });
      return w.id;
    };
    const releases = (withdrawalId: string) =>
      prisma.ledgerEntry.count({ where: { withdrawalId, type: 'WITHDRAWAL_RELEASE' } });

    // Reject and "mark as paid" at the same moment: one wins, and money is never both
    // paid out and returned to the seller's balance.
    for (let round = 0; round < 5; round++) {
      const id = await requested(10_000);
      const [rejected, paid] = await Promise.all([
        call('POST', `/admin/finance/withdrawals/${id}/reject`, {
          token: admin,
          body: { reason: 'Race test' },
        }),
        call('POST', `/admin/finance/withdrawals/${id}/mark-paid`, {
          token: admin,
          body: { reference: `E2E-RACE-${round}` },
        }),
      ]);
      const statuses = [rejected.status, paid.status].sort();
      expect(statuses).toEqual([201, 400]);
      const final = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
      if (final.status === 'REJECTED') {
        expect(rejected.status).toBe(201);
        expect(await releases(id)).toBe(1);
        expect(final.paidAt).toBeNull();
      } else {
        expect(final.status).toBe('PAID');
        expect(paid.status).toBe(201);
        expect(await releases(id)).toBe(0);
        expect(final.gatewayTransferId).toBe(`manual:E2E-RACE-${round}`);
      }
      const loser = rejected.status === 400 ? rejected : paid;
      // Refused either by the status check or, when both requests truly overlap, by the
      // conditional update; either way with a message the admin understands.
      expect(loser.data.message).toMatch(/already processed|cannot be|Only requested/);
    }

    // Two "mark as paid" clicks at once: recorded once, with the trimmed reference.
    const id = await requested(10_000);
    const both = await Promise.all(
      [1, 2].map(() =>
        call('POST', `/admin/finance/withdrawals/${id}/mark-paid`, {
          token: admin,
          body: { reference: '  E2E-DOUBLE  ' },
        }),
      ),
    );
    expect(both.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await prisma.withdrawal.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'PAID',
      gatewayTransferId: 'manual:E2E-DOUBLE',
    });
    expect(
      await prisma.auditLog.count({ where: { entityId: id, action: 'withdrawal.mark_paid' } }),
    ).toBe(1);
  });
});
