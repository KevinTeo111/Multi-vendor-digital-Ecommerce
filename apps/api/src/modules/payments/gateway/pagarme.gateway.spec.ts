process.env.PAGARME_SECRET_KEY = 'sk_test_dummy';
process.env.PAGARME_WEBHOOK_SECRET = 'hookuser:hookpass';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import { PagarmePaymentGateway } from './pagarme.gateway';

describe('PagarmePaymentGateway', () => {
  const gw = new PagarmePaymentGateway();

  describe('verifyWebhook', () => {
    const basic = (pair: string) => ({ authorization: `Basic ${Buffer.from(pair).toString('base64')}` });

    it('accepts the configured basic-auth pair', () => {
      expect(gw.verifyWebhook(Buffer.from('{}'), basic('hookuser:hookpass'))).toBe(true);
    });

    it('rejects wrong credentials, missing header and non-basic schemes', () => {
      expect(gw.verifyWebhook(Buffer.from('{}'), basic('hookuser:wrong'))).toBe(false);
      expect(gw.verifyWebhook(Buffer.from('{}'), {})).toBe(false);
      expect(gw.verifyWebhook(Buffer.from('{}'), { authorization: 'Bearer abc' })).toBe(false);
    });
  });

  describe('parseWebhook', () => {
    it('maps order.paid with charge details', () => {
      const ev = gw.parseWebhook({
        id: 'hook_1',
        type: 'order.paid',
        data: { id: 'or_123', charges: [{ id: 'ch_9', payment_method: 'pix' }] },
      });
      expect(ev).toEqual({ kind: 'order.paid', eventId: 'hook_1', gatewayOrderId: 'or_123', chargeId: 'ch_9', paymentMethod: 'pix' });
    });

    it('maps invoice.paid to a subscription renewal with the cycle dates', () => {
      const ev = gw.parseWebhook({
        id: 'hook_2',
        type: 'invoice.paid',
        data: { id: 'in_1', subscription: { id: 'sub_1' }, cycle: { start_at: '2026-09-01T00:00:00Z', end_at: '2026-10-01T00:00:00Z' } },
      });
      expect(ev).toMatchObject({ kind: 'subscription.renewed', gatewaySubscriptionId: 'sub_1' });
      expect((ev as { periodEnd?: Date }).periodEnd?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('maps failures and transfers', () => {
      expect(gw.parseWebhook({ id: 'h', type: 'order.payment_failed', data: { id: 'or_1' } })).toMatchObject({ kind: 'order.failed', gatewayOrderId: 'or_1' });
      expect(gw.parseWebhook({ id: 'h', type: 'invoice.payment_failed', data: { subscription: { id: 'sub_2' } } })).toMatchObject({ kind: 'subscription.past_due' });
      expect(gw.parseWebhook({ id: 'h', type: 'subscription.canceled', data: { id: 'sub_3' } })).toMatchObject({ kind: 'subscription.canceled', gatewaySubscriptionId: 'sub_3' });
      expect(gw.parseWebhook({ id: 'h', type: 'transfer.paid', data: { id: 'tr_1' } })).toMatchObject({ kind: 'transfer.paid', gatewayTransferId: 'tr_1' });
      expect(gw.parseWebhook({ id: 'h', type: 'transfer.failed', data: { id: 'tr_2' } })).toMatchObject({ kind: 'transfer.failed' });
    });

    it('ignores unknown events instead of throwing', () => {
      expect(gw.parseWebhook({ id: 'h', type: 'customer.created', data: {} })).toEqual({ kind: 'ignored', eventId: 'h', type: 'customer.created' });
    });
  });
});
