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
      if (/^\/v1\/payments\/\d+\/refunds$/.test(path) && init?.method === 'POST') {
        refundKeys.push(new Headers(init.headers).get('X-Idempotency-Key'));
        return new Response(JSON.stringify({ id: 4242, status: 'approved' }), { status: 201 });
      }
      // Any payment id resolves to the most recent order (one payment per test order).
      const paymentId = path.match(/^\/v1\/payments\/(\d+)$/)?.[1];
      if (paymentId) {
        return new Response(
          JSON.stringify({
            id: Number(paymentId),
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
    expect(entries.map((e) => [e.type, e.status, e.amountCents])).toEqual([
      ['SALE_CREDIT', 'PENDING', 2000],
      ['REFUND_DEBIT', 'PENDING', -2000],
    ]);
    // The credit was still on hold, so it is reversed on hold: nothing becomes negative.
    expect(entries[1].availableAt?.getTime()).toBe(entries[0].availableAt?.getTime());
    const { LedgerService } = await import('../modules/finance/ledger.service');
    expect(await app.get(LedgerService).getBalance(vendor.id)).toEqual({
      pendingCents: 0,
      availableCents: 0,
    });
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

  it('sells an Extended licence with a coupon, verifies its code, and handles its review', async () => {
    const { listPriceCents, splitSale } = await import('@marketplace/shared');
    const bcrypt = await import('bcryptjs');
    const login = async (email: string, password: string) =>
      (await call('POST', '/auth/login', { body: { email, password } })).data.accessToken as string;
    const admin = await login('admin@it.test', 'admin-password-1');

    // The seller from the first test, now able to log in.
    await prisma.user.update({
      where: { email: 'seller@it.test' },
      data: { passwordHash: await bcrypt.hash('seller-password-1', 4) },
    });
    const seller = await login('seller@it.test', 'seller-password-1');
    const vendor = await prisma.vendor.findUniqueOrThrow({ where: { slug: 'it-store' } });
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'books' } });

    // A product with Regular 40,00 and Extended 100,00 (seller prices; 5% fee built in).
    const regular = listPriceCents(4000, 500);
    const extended = listPriceCents(10_000, 500);
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
        title: 'IT Template',
        slug: 'it-template',
        shortDescription: 'Short',
        description: 'Long',
        basePriceCents: 4000,
        priceCents: regular,
        extendedBasePriceCents: 10_000,
        extendedPriceCents: extended,
        status: 'APPROVED',
        publishedAt: new Date(),
        files: {
          create: {
            storageKey: 'products/it/template.zip',
            fileName: 'template.zip',
            sizeBytes: 99,
            mimeType: 'application/zip',
          },
        },
      },
    });

    // Platform coupon: 10% off, once per buyer.
    const coupon = await call('POST', '/admin/coupons', {
      token: admin,
      body: { code: 'save10', type: 'PERCENT', value: 1000, perBuyerLimit: 1 },
    });
    expect(coupon.status).toBe(201);
    expect(coupon.data.code).toBe('SAVE10');

    const buyer = await register('licence@it.test');
    const cart = await call('POST', '/cart/items', {
      token: buyer,
      body: { productId: product.id, licenseType: 'EXTENDED' },
    });
    expect(cart.data.items[0]).toMatchObject({ licenseType: 'EXTENDED', unitPriceCents: extended });

    // Preview and checkout agree: 10% of the Extended price, taken from the platform commission.
    const discount = Math.floor((extended * 1000 + 5000) / 10_000);
    const preview = await call('POST', '/checkout/preview', {
      token: buyer,
      body: { couponCode: 'save10' },
    });
    expect(preview.data).toMatchObject({
      subtotalCents: extended,
      discountCents: discount,
      totalCents: extended - discount,
      couponCode: 'SAVE10',
    });
    const checkout = await call('POST', '/checkout', {
      token: buyer,
      body: { couponCode: 'SAVE10' },
    });
    expect(checkout.status).toBe(201);
    const order = checkout.data.order;
    expect(order).toMatchObject({
      subtotalCents: extended,
      discountCents: discount,
      totalCents: extended - discount,
      couponCode: 'SAVE10',
    });
    const line = order.items[0];
    const { commissionCents, vendorNetCents } = splitSale(10_000, 2000);
    expect(line).toMatchObject({
      licenseType: 'EXTENDED',
      priceCents: extended,
      discountCents: discount,
      gatewayFeeCents: extended - 10_000,
      commissionCents: commissionCents - discount,
      vendorNetCents, // a platform coupon never touches the seller's money
    });
    expect(line.purchaseCode).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(preferenceBodies.at(-1)).toMatchObject({
      items: [expect.objectContaining({ unit_price: (extended - discount) / 100 })],
    });

    // The coupon is held by the pending order: a second use by the same buyer is refused.
    const again = await call('POST', '/checkout/preview', {
      token: buyer,
      body: { couponCode: 'SAVE10' },
    });
    expect(again.status).toBe(400);
    expect(again.data.message).toMatch(/already used/);

    // Paid by webhook (a new payment id).
    paymentStatus = 'approved';
    expect(await deliver('888001')).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');

    // The seller verifies the code, typed loosely.
    const typed = line.purchaseCode.replace(/-/g, '').toLowerCase();
    const verified = await call('GET', `/vendor/sales/verify?code=${typed}`, { token: seller });
    expect(verified.data).toMatchObject({
      valid: true,
      licenseType: 'EXTENDED',
      orderNumber: order.orderNumber,
    });
    expect(
      (await call('GET', '/vendor/sales/verify?code=0000-0000-0000-0000', { token: seller }))
        .status,
    ).toBe(404);

    // Reviews: only the buyer, rating kept in step on the product, moderation by the admin.
    const stranger = await register('nosy@it.test');
    expect(
      (
        await call('POST', '/reviews', {
          token: stranger,
          body: { orderItemId: line.id, rating: 1 },
        })
      ).status,
    ).toBe(404);
    const rated = async () =>
      prisma.product.findUniqueOrThrow({
        where: { id: product.id },
        select: { ratingSum: true, ratingCount: true },
      });
    await call('POST', '/reviews', {
      token: buyer,
      body: { orderItemId: line.id, rating: 4, comment: 'Great' },
    });
    expect(await rated()).toEqual({ ratingSum: 4, ratingCount: 1 });
    const review = await call('POST', '/reviews', {
      token: buyer,
      body: { orderItemId: line.id, rating: 5, comment: 'Even better' },
    });
    expect(await rated()).toEqual({ ratingSum: 5, ratingCount: 1 });
    const publicList = await call('GET', '/products/it-template/reviews');
    expect(publicList.data.items).toEqual([
      expect.objectContaining({ rating: 5, comment: 'Even better', buyer: { name: 'licence' } }),
    ]);
    await call('PATCH', `/admin/reviews/${review.data.id}`, {
      token: admin,
      body: { hidden: true },
    });
    expect(await rated()).toEqual({ ratingSum: 0, ratingCount: 0 });
    expect((await call('GET', '/products/it-template/reviews')).data.items).toEqual([]);
    await call('PATCH', `/admin/reviews/${review.data.id}`, {
      token: admin,
      body: { hidden: false },
    });
    expect(await rated()).toEqual({ ratingSum: 5, ratingCount: 1 });
    const reply = await call('POST', `/vendor/reviews/${review.data.id}/reply`, {
      token: seller,
      body: { reply: 'Thank you!' },
    });
    expect(reply.data.sellerReply).toBe('Thank you!');

    // Coupon usage is counted once paid.
    const coupons = await call('GET', '/admin/coupons', { token: admin });
    expect(coupons.data.find((c: { code: string }) => c.code === 'SAVE10')._count.redemptions).toBe(
      1,
    );

    // A refund removes the review and invalidates the purchase code.
    expect(
      (
        await call('POST', `/admin/orders/${order.id}/refund`, {
          token: admin,
          body: { reason: 'Licence test refund' },
        })
      ).status,
    ).toBe(201);
    expect(await rated()).toEqual({ ratingSum: 0, ratingCount: 0 });
    expect(await prisma.review.count({ where: { orderItemId: line.id } })).toBe(0);
    expect(
      (await call('GET', `/vendor/sales/verify?code=${line.purchaseCode}`, { token: seller })).data,
    ).toMatchObject({ valid: false });
  });
});
