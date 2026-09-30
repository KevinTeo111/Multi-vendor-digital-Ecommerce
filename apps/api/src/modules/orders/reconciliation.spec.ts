import { decideReconciliation } from './reconciliation';

const HOUR = 60 * 60 * 1000;

describe('decideReconciliation', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');

  it('marks paid when the provider reports an approved payment', () => {
    expect(
      decideReconciliation(
        {
          kind: 'order.paid',
          eventId: 'payment:1:approved',
          gatewayOrderId: 'ORD-1',
          chargeId: '1',
          paymentMethod: 'pix',
        },
        new Date(now - HOUR),
        now,
      ),
    ).toEqual({ kind: 'paid', chargeId: '1', paymentMethod: 'pix' });
  });

  it('marks failed when the provider reports a rejection', () => {
    expect(
      decideReconciliation(
        {
          kind: 'order.failed',
          eventId: 'payment:2:rejected',
          gatewayOrderId: 'ORD-2',
          reason: 'cc_rejected',
        },
        new Date(now - HOUR),
        now,
      ),
    ).toEqual({ kind: 'failed', reason: 'cc_rejected' });
  });

  it('keeps waiting while the checkout window is open and nothing was paid', () => {
    expect(decideReconciliation(null, new Date(now - 2 * HOUR), now)).toEqual({ kind: 'none' });
  });

  it('expires an untouched order once the checkout window has passed', () => {
    expect(decideReconciliation(null, new Date(now - 25 * HOUR), now)).toEqual({
      kind: 'failed',
      reason: 'Checkout expired',
    });
  });

  it('does not expire an order the provider still reports as in progress', () => {
    expect(
      decideReconciliation(
        { kind: 'ignored', eventId: 'payment:3:in_process', type: 'payment:in_process' },
        new Date(now - 48 * HOUR),
        now,
      ),
    ).toEqual({ kind: 'none' });
  });
});
