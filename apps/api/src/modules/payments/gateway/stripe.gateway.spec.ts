process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import Stripe from 'stripe';
import { StripePaymentGateway } from './stripe.gateway';
import { WebhookRejectedError } from './payment-gateway.interface';

const SECRET = 'whsec_test_secret';

function signed(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { raw: Buffer.from(payload), headers: { 'stripe-signature': header } };
}

describe('StripePaymentGateway webhooks', () => {
  const gw = new StripePaymentGateway('sk_test_dummy', SECRET);

  it('rejects requests without a valid signature', async () => {
    const raw = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }));
    await expect(gw.parseWebhook(raw, {})).rejects.toBeInstanceOf(WebhookRejectedError);
    await expect(gw.parseWebhook(raw, { 'stripe-signature': 't=1,v1=bad' })).rejects.toBeInstanceOf(
      WebhookRejectedError,
    );
  });

  it('maps a paid checkout session to order.paid', async () => {
    const { raw, headers } = signed({
      id: 'evt_paid',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          payment_intent: 'pi_9',
          payment_method_types: ['pix'],
        },
      },
    });
    await expect(gw.parseWebhook(raw, headers)).resolves.toEqual({
      kind: 'order.paid',
      eventId: 'evt_paid',
      gatewayOrderId: 'cs_123',
      chargeId: 'pi_9',
      paymentMethod: 'pix',
    });
  });

  it('ignores a completed session that is still unpaid (Pix / boleto pending) and maps the async result', async () => {
    const pending = signed({
      id: 'evt_p',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'unpaid',
        },
      },
    });
    await expect(gw.parseWebhook(pending.raw, pending.headers)).resolves.toMatchObject({
      kind: 'ignored',
    });

    const ok = signed({
      id: 'evt_ok',
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: { id: 'cs_1', object: 'checkout.session', mode: 'payment', payment_status: 'paid' },
      },
    });
    await expect(gw.parseWebhook(ok.raw, ok.headers)).resolves.toMatchObject({
      kind: 'order.paid',
      gatewayOrderId: 'cs_1',
    });

    const failed = signed({
      id: 'evt_f',
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_1', object: 'checkout.session', mode: 'payment' } },
    });
    await expect(gw.parseWebhook(failed.raw, failed.headers)).resolves.toMatchObject({
      kind: 'order.failed',
      gatewayOrderId: 'cs_1',
    });
  });

  it('activates a subscription from its checkout session and swaps in the real subscription id', async () => {
    const retrieve = jest
      .spyOn((gw as unknown as { stripe: Stripe }).stripe.subscriptions, 'retrieve')
      .mockResolvedValue({
        id: 'sub_1',
        items: {
          data: [{ current_period_start: 1_700_000_000, current_period_end: 1_702_592_000 }],
        },
      } as never);
    const { raw, headers } = signed({
      id: 'evt_s',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub',
          object: 'checkout.session',
          mode: 'subscription',
          subscription: 'sub_1',
        },
      },
    });
    const ev = await gw.parseWebhook(raw, headers);
    expect(ev).toMatchObject({
      kind: 'subscription.activated',
      gatewaySubscriptionId: 'cs_sub',
      newGatewaySubscriptionId: 'sub_1',
    });
    expect((ev as { periodEnd?: Date }).periodEnd?.toISOString()).toBe(
      new Date(1_702_592_000 * 1000).toISOString(),
    );
    retrieve.mockRestore();
  });

  it('maps invoice and subscription lifecycle events (old and new invoice shapes)', async () => {
    const paidLegacy = signed({
      id: 'e1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          object: 'invoice',
          subscription: 'sub_1',
          lines: { data: [{ period: { start: 1_700_000_000, end: 1_702_592_000 } }] },
        },
      },
    });
    await expect(gw.parseWebhook(paidLegacy.raw, paidLegacy.headers)).resolves.toMatchObject({
      kind: 'subscription.renewed',
      gatewaySubscriptionId: 'sub_1',
    });

    const paidNew = signed({
      id: 'e2',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_2',
          object: 'invoice',
          parent: { subscription_details: { subscription: 'sub_2' } },
          lines: { data: [] },
        },
      },
    });
    await expect(gw.parseWebhook(paidNew.raw, paidNew.headers)).resolves.toMatchObject({
      kind: 'subscription.renewed',
      gatewaySubscriptionId: 'sub_2',
    });

    const failed = signed({
      id: 'e3',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_3', object: 'invoice', subscription: 'sub_3' } },
    });
    await expect(gw.parseWebhook(failed.raw, failed.headers)).resolves.toMatchObject({
      kind: 'subscription.past_due',
      gatewaySubscriptionId: 'sub_3',
    });

    const deleted = signed({
      id: 'e4',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_4', object: 'subscription' } },
    });
    await expect(gw.parseWebhook(deleted.raw, deleted.headers)).resolves.toMatchObject({
      kind: 'subscription.canceled',
      gatewaySubscriptionId: 'sub_4',
    });

    const other = signed({
      id: 'e5',
      type: 'customer.created',
      data: { object: { id: 'cus_1', object: 'customer' } },
    });
    await expect(gw.parseWebhook(other.raw, other.headers)).resolves.toEqual({
      kind: 'ignored',
      eventId: 'e5',
      type: 'customer.created',
    });
  });
});
