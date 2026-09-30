import {
  CHECKOUT_TTL_MS,
  NormalizedWebhookEvent,
} from '../payments/gateway/payment-gateway.interface';

/**
 * What to do with a PENDING order after asking the provider about it.
 * Pure so the rules can be unit-tested without a database.
 */
export type ReconcileAction =
  | { kind: 'paid'; chargeId?: string; paymentMethod?: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'none' };

export function decideReconciliation(
  event: NormalizedWebhookEvent | null,
  createdAt: Date,
  now = Date.now(),
): ReconcileAction {
  if (event?.kind === 'order.paid')
    return { kind: 'paid', chargeId: event.chargeId, paymentMethod: event.paymentMethod };
  if (event?.kind === 'order.failed')
    return { kind: 'failed', reason: event.reason ?? 'Payment failed' };
  // Nothing at the provider and the checkout window is over: the buyer abandoned it.
  if (!event && now - createdAt.getTime() > CHECKOUT_TTL_MS)
    return { kind: 'failed', reason: 'Checkout expired' };
  return { kind: 'none' };
}
