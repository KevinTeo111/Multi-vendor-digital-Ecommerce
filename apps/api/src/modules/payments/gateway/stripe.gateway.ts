import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { env } from '../../../config/env';
import {
  CheckoutResult,
  CreateCheckoutInput,
  CreateSubscriptionInput,
  NormalizedWebhookEvent,
  PaymentGateway,
  PlanLike,
  SubscriptionResult,
  WebhookHeaders,
  WebhookRejectedError,
} from './payment-gateway.interface';

/**
 * Stripe adapter.
 *
 * - Product purchases: Stripe Checkout in `payment` mode. Payment methods (card, Pix, boleto) are
 *   whatever is enabled in the Stripe dashboard. The order stores the Checkout Session id.
 * - Seller plans: Stripe Checkout in `subscription` mode against a Price that this adapter creates
 *   for each plan (`syncPlan`). The subscription row first stores the session id, then the webhook
 *   swaps in the real subscription id.
 * - Payouts: not implemented (Phase 2 would use Stripe Connect). Manual payout mode is used instead.
 * - Webhooks: signature verified with STRIPE_WEBHOOK_SECRET against the raw request body.
 */
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  readonly name = 'stripe' as const;
  readonly supportsPayouts = false;
  private readonly logger = new Logger(StripePaymentGateway.name);
  private readonly stripe: Stripe;

  constructor(secretKey = env.STRIPE_SECRET_KEY, private readonly webhookSecret = env.STRIPE_WEBHOOK_SECRET) {
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY is required when PAYMENT_GATEWAY=stripe');
    this.stripe = new Stripe(secretKey, { appInfo: { name: 'DigiMarket' } });
  }

  // ---- Checkout ----------------------------------------------------------

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: input.orderId,
      customer_email: input.customer.email,
      line_items: input.items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: i.amountCents,
          product_data: { name: i.description.slice(0, 250) },
        },
      })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
      payment_intent_data: { metadata: { orderId: input.orderId, orderNumber: input.orderNumber } },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Pix/boleto need time; sessions last 24 h
    });
    return { gatewayOrderId: session.id, checkoutUrl: session.url ?? undefined, status: 'pending' };
  }

  // ---- Plans & subscriptions ---------------------------------------------

  /** Creates a Product + recurring Price for the plan. Prices are immutable in Stripe, so a changed price gets a new Price. */
  async syncPlan(plan: PlanLike): Promise<{ gatewayPlanId: string }> {
    if (plan.gatewayPlanId) {
      try {
        const existing = await this.stripe.prices.retrieve(plan.gatewayPlanId);
        const sameAmount = existing.unit_amount === plan.priceCents && existing.currency === plan.currency.toLowerCase();
        const sameInterval = existing.recurring?.interval === (plan.interval === 'YEAR' ? 'year' : 'month');
        if (existing.active && sameAmount && sameInterval) return { gatewayPlanId: existing.id };
        await this.stripe.prices.update(existing.id, { active: false });
      } catch (err) {
        this.logger.warn(`Stripe price ${plan.gatewayPlanId} not reusable: ${(err as Error).message}`);
      }
    }
    const price = await this.stripe.prices.create({
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.priceCents,
      recurring: { interval: plan.interval === 'YEAR' ? 'year' : 'month' },
      product_data: { name: `Seller plan: ${plan.name}`, metadata: { planId: plan.id } },
      metadata: { planId: plan.id },
    });
    return { gatewayPlanId: price.id };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    if (!input.plan.gatewayPlanId) throw new Error('Plan has no Stripe price; call syncPlan first');
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: input.vendorId,
      customer_email: input.customer.email,
      line_items: [{ price: input.plan.gatewayPlanId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { vendorId: input.vendorId, planId: input.plan.id },
      subscription_data: { metadata: { vendorId: input.vendorId, planId: input.plan.id } },
    });
    return { gatewaySubscriptionId: session.id, status: 'pending', checkoutUrl: session.url ?? undefined };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    if (gatewaySubscriptionId.startsWith('cs_')) {
      // Checkout never completed; just expire the session.
      await this.stripe.checkout.sessions.expire(gatewaySubscriptionId).catch(() => undefined);
      return;
    }
    // Keep access until the paid period ends, matching the local entitlement rule.
    await this.stripe.subscriptions.update(gatewaySubscriptionId, { cancel_at_period_end: true });
  }

  // ---- Payouts (Phase 2: Stripe Connect) ----------------------------------

  async createRecipient(): Promise<{ recipientId: string }> {
    throw new Error('Automated payouts are not enabled for Stripe; use manual payout mode');
  }

  async createTransfer(): Promise<never> {
    throw new Error('Automated payouts are not enabled for Stripe; use manual payout mode');
  }

  // ---- Webhooks ----------------------------------------------------------

  async parseWebhook(rawBody: Buffer, headers: WebhookHeaders): Promise<NormalizedWebhookEvent> {
    if (!this.webhookSecret) throw new WebhookRejectedError('STRIPE_WEBHOOK_SECRET is not configured');
    const sigHeader = headers['stripe-signature'];
    const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    if (!signature) throw new WebhookRejectedError('Missing stripe-signature header');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      throw new WebhookRejectedError(`Invalid Stripe signature: ${(err as Error).message}`);
    }
    return this.normalize(event);
  }

  private async normalize(event: Stripe.Event): Promise<NormalizedWebhookEvent> {
    const eventId = event.id;
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription') {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          const period = subId ? await this.subscriptionPeriod(subId) : {};
          return { kind: 'subscription.activated', eventId, gatewaySubscriptionId: session.id, newGatewaySubscriptionId: subId, ...period };
        }
        if (session.payment_status === 'paid') return this.paid(eventId, session);
        return { kind: 'ignored', eventId, type: `${event.type}:${session.payment_status}` }; // Pix/boleto still pending
      }
      case 'checkout.session.async_payment_succeeded':
        return this.paid(eventId, event.data.object);
      case 'checkout.session.async_payment_failed':
        return { kind: 'order.failed', eventId, gatewayOrderId: event.data.object.id, reason: 'Payment not completed' };
      case 'checkout.session.expired':
        return { kind: 'order.failed', eventId, gatewayOrderId: event.data.object.id, reason: 'Checkout expired' };

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subId = this.invoiceSubscriptionId(invoice);
        if (!subId) return { kind: 'ignored', eventId, type: event.type };
        const line = invoice.lines?.data?.[0];
        return {
          kind: 'subscription.renewed',
          eventId,
          gatewaySubscriptionId: subId,
          periodStart: line?.period?.start ? new Date(line.period.start * 1000) : undefined,
          periodEnd: line?.period?.end ? new Date(line.period.end * 1000) : undefined,
        };
      }
      case 'invoice.payment_failed': {
        const subId = this.invoiceSubscriptionId(event.data.object);
        return subId ? { kind: 'subscription.past_due', eventId, gatewaySubscriptionId: subId } : { kind: 'ignored', eventId, type: event.type };
      }
      case 'customer.subscription.deleted':
        return { kind: 'subscription.canceled', eventId, gatewaySubscriptionId: event.data.object.id };

      default:
        return { kind: 'ignored', eventId, type: event.type };
    }
  }

  private paid(eventId: string, session: Stripe.Checkout.Session): NormalizedWebhookEvent {
    const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    const method = (session as unknown as { payment_method_types?: string[] }).payment_method_types?.[0];
    return { kind: 'order.paid', eventId, gatewayOrderId: session.id, chargeId: pi, paymentMethod: method };
  }

  private invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
    const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
    if (typeof legacy === 'string') return legacy;
    if (legacy && typeof legacy === 'object') return legacy.id;
    const parent = (invoice as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } }).parent;
    const sub = parent?.subscription_details?.subscription;
    return typeof sub === 'string' ? sub : sub?.id;
  }

  /** Current period from the subscription; newer API versions moved the fields onto the first item. */
  private async subscriptionPeriod(subscriptionId: string): Promise<{ periodStart?: Date; periodEnd?: Date }> {
    try {
      const sub = (await this.stripe.subscriptions.retrieve(subscriptionId)) as unknown as {
        current_period_start?: number;
        current_period_end?: number;
        items?: { data?: Array<{ current_period_start?: number; current_period_end?: number }> };
      };
      const item = sub.items?.data?.[0];
      const start = item?.current_period_start ?? sub.current_period_start;
      const end = item?.current_period_end ?? sub.current_period_end;
      return { periodStart: start ? new Date(start * 1000) : undefined, periodEnd: end ? new Date(end * 1000) : undefined };
    } catch (err) {
      this.logger.warn(`Could not read subscription period for ${subscriptionId}: ${(err as Error).message}`);
      return {};
    }
  }
}
