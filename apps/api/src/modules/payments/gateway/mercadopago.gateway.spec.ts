process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import {
  MercadoPagoPaymentGateway,
  normalizePaymentMethod,
  signManifest,
  signatureManifest,
  toDecimal,
} from './mercadopago.gateway';
import { WebhookRejectedError } from './payment-gateway.interface';

const SECRET = 'mp_test_secret';
const NOW = 1_800_000_000_000; // fixed clock (ms)

/** In-memory stand-in for the Mercado Pago REST API. */
function fakeApi(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    const path = input.replace('https://api.mercadopago.com', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response('{"message":"not found"}', { status: 404 });
    const route = routes[key];
    const payload = typeof route === 'function' ? (route as (b: unknown) => unknown)(body) : route;
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  return { fetchImpl, calls };
}

function gateway(routes: Record<string, unknown> = {}) {
  const api = fakeApi(routes);
  const gw = new MercadoPagoPaymentGateway('TEST-token', SECRET, {
    fetch: api.fetchImpl,
    now: () => NOW,
  });
  return { gw, calls: api.calls };
}

/** Builds a signed notification the way Mercado Pago sends it (pointer body + query + headers). */
function signed(type: string, dataId: string, opts: { ts?: number; secret?: string } = {}) {
  const ts = String(opts.ts ?? Math.floor(NOW / 1000));
  const requestId = 'req-1';
  const manifest = signatureManifest({ dataId, requestId, ts });
  const v1 = signManifest(manifest, opts.secret ?? SECRET);
  return {
    raw: Buffer.from(JSON.stringify({ type, action: `${type}.updated`, data: { id: dataId } })),
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    query: { type, 'data.id': dataId },
  };
}

describe('MercadoPagoPaymentGateway helpers', () => {
  it('converts cents to decimals and maps provider method ids', () => {
    expect(toDecimal(1999)).toBe(19.99);
    expect(toDecimal(100)).toBe(1);
    expect(normalizePaymentMethod({ id: 1, status: 'approved', payment_method_id: 'pix' })).toBe(
      'pix',
    );
    expect(normalizePaymentMethod({ id: 1, status: 'approved', payment_type_id: 'ticket' })).toBe(
      'boleto',
    );
    expect(
      normalizePaymentMethod({ id: 1, status: 'approved', payment_type_id: 'debit_card' }),
    ).toBe('card');
  });

  it('builds the manifest in the documented order, skipping absent parts', () => {
    expect(signatureManifest({ dataId: '123', requestId: 'r', ts: '9' })).toBe(
      'id:123;request-id:r;ts:9;',
    );
    expect(signatureManifest({ ts: '9' })).toBe('ts:9;');
  });
});

describe('MercadoPagoPaymentGateway checkout', () => {
  it('creates a preference in BRL decimals keyed by the order number', async () => {
    const { gw, calls } = gateway({
      'POST /checkout/preferences': { id: 'pref_1', init_point: 'https://mp.test/checkout/1' },
    });
    const result = await gw.createCheckout({
      orderId: 'order-uuid',
      orderNumber: 'ORD-20260929-ABC123',
      amountCents: 4990,
      currency: 'BRL',
      customer: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
      items: [{ description: 'Theme', amountCents: 4990, quantity: 1 }],
      successUrl: 'https://site/orders/order-uuid?status=success',
      pendingUrl: 'https://site/orders/order-uuid?status=pending',
      cancelUrl: 'https://site/cart?status=canceled',
    });
    expect(result).toEqual({
      gatewayOrderId: 'ORD-20260929-ABC123',
      checkoutUrl: 'https://mp.test/checkout/1',
      status: 'pending',
    });
    const body = calls[0].body as Record<string, unknown>;
    expect(body.external_reference).toBe('ORD-20260929-ABC123');
    expect(body.items).toEqual([
      expect.objectContaining({ unit_price: 49.9, currency_id: 'BRL', quantity: 1 }),
    ]);
    expect(body.back_urls).toEqual({
      success: 'https://site/orders/order-uuid?status=success',
      pending: 'https://site/orders/order-uuid?status=pending',
      failure: 'https://site/cart?status=canceled',
    });
    expect(body.auto_return).toBe('approved');
    expect(String(body.expiration_date_to)).toMatch(/\+00:00$/);
  });

  it('creates a pending preapproval with its own auto_recurring (no plan, hosted card form)', async () => {
    const { gw, calls } = gateway({
      'POST /preapproval': { id: 'pre_1', status: 'pending', init_point: 'https://mp.test/sub/1' },
    });
    const plan = {
      id: 'p1',
      name: 'Pro',
      priceCents: 2900,
      currency: 'BRL',
      interval: 'YEAR' as const,
      gatewayPlanId: null,
    };
    // No API call: Mercado Pago plans need a card token we never see.
    await expect(gw.syncPlan(plan)).resolves.toEqual({ gatewayPlanId: 'inline:YEAR:2900' });
    expect(calls).toHaveLength(0);

    const sub = await gw.createSubscription({
      vendorId: 'v1',
      plan: { ...plan, gatewayPlanId: 'inline:YEAR:2900' },
      customer: { id: 'u1', name: 'Loja', email: 'loja@example.com' },
      successUrl: 'https://site/vendor/subscription?status=success',
      cancelUrl: 'https://site/vendor/subscription?status=canceled',
    });
    expect(sub).toEqual({
      gatewaySubscriptionId: 'pre_1',
      status: 'pending',
      checkoutUrl: 'https://mp.test/sub/1',
    });
    expect(calls[0].body).toEqual({
      reason: 'Seller plan: Pro',
      external_reference: 'v1',
      payer_email: 'loja@example.com',
      auto_recurring: {
        frequency: 12,
        frequency_type: 'months',
        transaction_amount: 29,
        currency_id: 'BRL',
      },
      back_url: 'https://site/vendor/subscription?status=success',
      status: 'pending',
    });
    expect(calls[0].body).not.toHaveProperty('preapproval_plan_id');
  });

  it('fails clearly when Mercado Pago returns no payment link', async () => {
    const { gw } = gateway({ 'POST /preapproval': { id: 'pre_2', status: 'pending' } });
    await expect(
      gw.createSubscription({
        vendorId: 'v1',
        plan: {
          id: 'p1',
          name: 'Pro',
          priceCents: 4990,
          currency: 'BRL',
          interval: 'MONTH',
          gatewayPlanId: 'x',
        },
        customer: { id: 'u1', name: 'Loja', email: 'loja@example.com' },
        successUrl: 'https://s',
        cancelUrl: 'https://c',
      }),
    ).rejects.toThrow(/without a payment link/);
  });
});

describe('MercadoPagoPaymentGateway reconciliation', () => {
  it('finds an approved payment by order number', async () => {
    const { gw, calls } = gateway({
      'GET /v1/payments/search?external_reference=ORD-9&sort=date_created&criteria=desc': {
        results: [
          { id: 2, status: 'approved', external_reference: 'ORD-9', payment_method_id: 'pix' },
          { id: 1, status: 'rejected', external_reference: 'ORD-9' },
        ],
      },
    });
    await expect(gw.lookupOrder('ORD-9')).resolves.toEqual({
      kind: 'order.paid',
      eventId: 'payment:2:approved',
      gatewayOrderId: 'ORD-9',
      chargeId: '2',
      paymentMethod: 'pix',
    });
    expect(calls[0].path).toContain('external_reference=ORD-9');
  });

  it('reports failure only when every attempt is final, otherwise nothing', async () => {
    const { gw } = gateway({
      'GET /v1/payments/search?external_reference=ORD-F&sort=date_created&criteria=desc': {
        results: [{ id: 5, status: 'rejected', status_detail: 'cc_rejected_bad_filled_cvv' }],
      },
      'GET /v1/payments/search?external_reference=ORD-P&sort=date_created&criteria=desc': {
        results: [
          { id: 6, status: 'in_process' },
          { id: 7, status: 'rejected' },
        ],
      },
      'GET /v1/payments/search?external_reference=ORD-N&sort=date_created&criteria=desc': {
        results: [],
      },
    });
    await expect(gw.lookupOrder('ORD-F')).resolves.toMatchObject({
      kind: 'order.failed',
      reason: 'cc_rejected_bad_filled_cvv',
    });
    await expect(gw.lookupOrder('ORD-P')).resolves.toBeNull();
    await expect(gw.lookupOrder('ORD-N')).resolves.toBeNull();
  });

  it('looks up a subscription and maps it like a webhook', async () => {
    const { gw } = gateway({
      'GET /preapproval/pre_9': { id: 'pre_9', status: 'authorized' },
      'GET /preapproval/pre_0': { id: 'pre_0', status: 'pending' },
    });
    await expect(gw.lookupSubscription('pre_9')).resolves.toMatchObject({
      kind: 'subscription.activated',
      gatewaySubscriptionId: 'pre_9',
    });
    await expect(gw.lookupSubscription('pre_0')).resolves.toBeNull();
  });

  it('refuses non-BRL amounts with a clear message', async () => {
    const { gw } = gateway();
    await expect(
      gw.createCheckout({
        orderId: 'o',
        orderNumber: 'ORD-USD',
        amountCents: 100,
        currency: 'USD',
        customer: { id: 'u', name: 'n', email: 'e@x.com' },
        items: [{ description: 'x', amountCents: 100, quantity: 1 }],
        successUrl: 'https://s',
        cancelUrl: 'https://c',
      }),
    ).rejects.toThrow(/charge in BRL/);
  });
});

describe('MercadoPagoPaymentGateway webhooks', () => {
  it('accepts the legacy format whether or not the id was signed', async () => {
    const { gw } = gateway({
      'GET /v1/payments/43': { id: 43, status: 'approved', external_reference: 'ORD-L2' },
    });
    const ts = String(Math.floor(NOW / 1000));
    const withoutId = signManifest(signatureManifest({ requestId: 'r-2', ts }), SECRET);
    const raw = Buffer.from(JSON.stringify({ resource: '/v1/payments/43', topic: 'payment' }));
    await expect(
      gw.parseWebhook(
        raw,
        { 'x-signature': `ts=${ts},v1=${withoutId}`, 'x-request-id': 'r-2' },
        {
          topic: 'payment',
          id: '43',
        },
      ),
    ).resolves.toMatchObject({ kind: 'order.paid', gatewayOrderId: 'ORD-L2' });
  });

  it('drops unhandled topics as unverified so they are never persisted', async () => {
    const { gw } = gateway();
    const raw = Buffer.from(
      JSON.stringify({ topic: 'merchant_order', resource: '/merchant_orders/1' }),
    );
    await expect(
      gw.parseWebhook(raw, {}, { topic: 'merchant_order', id: '1' }),
    ).resolves.toMatchObject({
      kind: 'ignored',
      unverified: true,
    });
  });

  it('accepts the legacy topic/id format when the signature covers the id', async () => {
    const { gw } = gateway({
      'GET /v1/payments/42': { id: 42, status: 'approved', external_reference: 'ORD-L' },
    });
    const ts = String(Math.floor(NOW / 1000));
    const v1 = signManifest(signatureManifest({ dataId: '42', requestId: 'r-1', ts }), SECRET);
    const raw = Buffer.from(JSON.stringify({ resource: '/v1/payments/42', topic: 'payment' }));
    await expect(
      gw.parseWebhook(
        raw,
        { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'r-1' },
        {
          topic: 'payment',
          id: '42',
        },
      ),
    ).resolves.toMatchObject({ kind: 'order.paid', gatewayOrderId: 'ORD-L', chargeId: '42' });
  });

  it('accepts any of several comma-separated secrets (rotation, multiple notifying apps)', async () => {
    const api = fakeApi({
      'GET /v1/payments/7': { id: 7, status: 'approved', external_reference: 'ORD-7' },
    });
    const gw = new MercadoPagoPaymentGateway('TEST-token', `other_secret, ${SECRET}`, {
      fetch: api.fetchImpl,
      now: () => NOW,
    });
    const ok = signed('payment', '7');
    await expect(gw.parseWebhook(ok.raw, ok.headers, ok.query)).resolves.toMatchObject({
      kind: 'order.paid',
      gatewayOrderId: 'ORD-7',
    });
  });

  it('rejects missing, forged and stale signatures', async () => {
    const { gw } = gateway();
    const ok = signed('payment', '1');
    await expect(gw.parseWebhook(ok.raw, {}, ok.query)).rejects.toBeInstanceOf(
      WebhookRejectedError,
    );

    const forged = signed('payment', '1', { secret: 'wrong' });
    await expect(gw.parseWebhook(forged.raw, forged.headers, forged.query)).rejects.toBeInstanceOf(
      WebhookRejectedError,
    );

    const stale = signed('payment', '1', { ts: Math.floor(NOW / 1000) - 2 * 60 * 60 });
    await expect(gw.parseWebhook(stale.raw, stale.headers, stale.query)).rejects.toBeInstanceOf(
      WebhookRejectedError,
    );
  });

  it('fetches the payment and maps approved / rejected / pending, with status in the event id', async () => {
    const { gw } = gateway({
      'GET /v1/payments/10': {
        id: 10,
        status: 'approved',
        external_reference: 'ORD-1',
        payment_type_id: 'bank_transfer',
        payment_method_id: 'pix',
      },
      'GET /v1/payments/11': {
        id: 11,
        status: 'rejected',
        status_detail: 'cc_rejected_insufficient_amount',
        external_reference: 'ORD-2',
        payment_type_id: 'credit_card',
      },
      'GET /v1/payments/12': { id: 12, status: 'pending', external_reference: 'ORD-3' },
    });

    const paid = signed('payment', '10');
    await expect(gw.parseWebhook(paid.raw, paid.headers, paid.query)).resolves.toEqual({
      kind: 'order.paid',
      eventId: 'payment:10:approved',
      gatewayOrderId: 'ORD-1',
      chargeId: '10',
      paymentMethod: 'pix',
    });

    const failed = signed('payment', '11');
    await expect(gw.parseWebhook(failed.raw, failed.headers, failed.query)).resolves.toEqual({
      kind: 'order.failed',
      eventId: 'payment:11:rejected',
      gatewayOrderId: 'ORD-2',
      reason: 'cc_rejected_insufficient_amount',
    });

    const pending = signed('payment', '12');
    await expect(gw.parseWebhook(pending.raw, pending.headers, pending.query)).resolves.toEqual({
      kind: 'ignored',
      eventId: 'payment:12:pending',
      type: 'payment:pending',
    });
  });

  it('ignores subscription charges that arrive as plain payments', async () => {
    const { gw } = gateway({
      'GET /v1/payments/88': {
        id: 88,
        status: 'approved',
        external_reference: 'cmuovpqlm001ejv1xaqoz86be',
      },
    });
    const n = signed('payment', '88');
    await expect(gw.parseWebhook(n.raw, n.headers, n.query)).resolves.toEqual({
      kind: 'ignored',
      eventId: 'payment:88:approved',
      type: 'payment:not_an_order',
    });
  });

  it('ignores ids the API does not know (panel simulator) and unknown topics', async () => {
    const { gw } = gateway();
    const missing = signed('payment', '999');
    await expect(gw.parseWebhook(missing.raw, missing.headers, missing.query)).resolves.toEqual({
      kind: 'ignored',
      eventId: 'payment:999:missing',
      type: 'payment',
    });
    const other = signed('merchant_order', '5');
    await expect(gw.parseWebhook(other.raw, other.headers, other.query)).resolves.toMatchObject({
      kind: 'ignored',
      type: 'merchant_order',
    });
    // Unhandled topics are dropped even when unsigned (legacy topic/id format has no data.id).
    const legacy = Buffer.from(
      JSON.stringify({ resource: '/merchant_orders/5', topic: 'merchant_order' }),
    );
    await expect(
      gw.parseWebhook(legacy, {}, { topic: 'merchant_order', id: '5' }),
    ).resolves.toMatchObject({
      kind: 'ignored',
      type: 'merchant_order',
    });
  });

  it('maps subscription lifecycle: authorized, renewed, paused, cancelled', async () => {
    const { gw } = gateway({
      'GET /preapproval/pre_1': {
        id: 'pre_1',
        status: 'authorized',
        next_payment_date: '2026-10-29T12:00:00.000-03:00',
      },
      'GET /preapproval/pre_2': { id: 'pre_2', status: 'paused' },
      'GET /preapproval/pre_3': { id: 'pre_3', status: 'cancelled' },
      'GET /authorized_payments/77': {
        id: 77,
        preapproval_id: 'pre_1',
        status: 'processed',
        debit_date: '2026-09-29T12:00:00.000-03:00',
        payment: { id: 500, status: 'approved' },
      },
      'GET /authorized_payments/78': {
        id: 78,
        preapproval_id: 'pre_1',
        status: 'recycling',
        payment: { id: 501, status: 'rejected' },
      },
    });

    const activated = signed('subscription_preapproval', 'pre_1');
    const ev = await gw.parseWebhook(activated.raw, activated.headers, activated.query);
    expect(ev).toMatchObject({
      kind: 'subscription.activated',
      eventId: 'preapproval:pre_1:authorized',
      gatewaySubscriptionId: 'pre_1',
    });
    expect((ev as { periodEnd?: Date }).periodEnd?.toISOString()).toBe('2026-10-29T15:00:00.000Z');

    const renewed = signed('subscription_authorized_payment', '77');
    await expect(
      gw.parseWebhook(renewed.raw, renewed.headers, renewed.query),
    ).resolves.toMatchObject({
      kind: 'subscription.renewed',
      eventId: 'authorized_payment:77:approved',
      gatewaySubscriptionId: 'pre_1',
    });

    const failedRenewal = signed('subscription_authorized_payment', '78');
    await expect(
      gw.parseWebhook(failedRenewal.raw, failedRenewal.headers, failedRenewal.query),
    ).resolves.toMatchObject({ kind: 'subscription.past_due', gatewaySubscriptionId: 'pre_1' });

    const paused = signed('subscription_preapproval', 'pre_2');
    await expect(gw.parseWebhook(paused.raw, paused.headers, paused.query)).resolves.toMatchObject({
      kind: 'subscription.past_due',
      gatewaySubscriptionId: 'pre_2',
    });

    const cancelled = signed('subscription_preapproval', 'pre_3');
    await expect(
      gw.parseWebhook(cancelled.raw, cancelled.headers, cancelled.query),
    ).resolves.toMatchObject({ kind: 'subscription.canceled', gatewaySubscriptionId: 'pre_3' });
  });
});
