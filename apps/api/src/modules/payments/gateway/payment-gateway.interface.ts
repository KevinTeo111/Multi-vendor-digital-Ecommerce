/**
 * Gateway abstraction. Everything that talks to the payment provider lives behind this
 * interface so the rest of the system never depends on a vendor SDK. Amounts are integer cents.
 */

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** How long a hosted checkout stays payable (Pix and boleto need time). Orders untouched past this expire. */
export const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

export interface GatewayCustomer {
  id: string;
  name: string;
  email: string;
  document?: string;
}

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  customer: GatewayCustomer;
  items: Array<{ description: string; amountCents: number; quantity: number }>;
  successUrl: string;
  cancelUrl: string;
  /** Where to send the buyer when the provider accepted the order but the money is still on its way (Pix / boleto). */
  pendingUrl?: string;
}

export interface CheckoutResult {
  /** Provider reference stored on the order; webhooks are matched against it. */
  gatewayOrderId: string;
  /** Hosted checkout page the buyer is redirected to, when the provider offers one. */
  checkoutUrl?: string;
  status: 'pending' | 'paid' | 'failed';
}

export interface PlanLike {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  gatewayPlanId: string | null;
}

export interface CreateSubscriptionInput {
  vendorId: string;
  plan: PlanLike;
  customer: GatewayCustomer;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionResult {
  /** Provider reference; may be replaced by the final subscription id when a webhook confirms it. */
  gatewaySubscriptionId: string;
  status: 'pending' | 'active' | 'failed';
  checkoutUrl?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export interface CreateRecipientInput {
  vendorId: string;
  name: string;
  email: string;
  document?: string;
  payoutDetails: Record<string, unknown>;
}

export interface TransferInput {
  withdrawalId: string;
  recipientId: string;
  amountCents: number;
}

export interface TransferResult {
  gatewayTransferId: string;
  status: 'pending' | 'paid' | 'failed';
}

export type NormalizedWebhookEvent =
  | {
      kind: 'order.paid';
      eventId: string;
      gatewayOrderId: string;
      chargeId?: string;
      paymentMethod?: string;
    }
  | { kind: 'order.failed'; eventId: string; gatewayOrderId: string; reason?: string }
  | {
      /** The provider returned the money (refund) or the card issuer reversed it (chargeback). */
      kind: 'order.refunded';
      eventId: string;
      gatewayOrderId: string;
      reason: string;
      chargeback: boolean;
    }
  | {
      kind: 'subscription.activated';
      eventId: string;
      gatewaySubscriptionId: string;
      /** When the provider assigns a final id different from the one returned at creation. */
      newGatewaySubscriptionId?: string;
      periodStart?: Date;
      periodEnd?: Date;
    }
  | {
      kind: 'subscription.renewed';
      eventId: string;
      gatewaySubscriptionId: string;
      periodStart?: Date;
      periodEnd?: Date;
    }
  | { kind: 'subscription.past_due'; eventId: string; gatewaySubscriptionId: string }
  | { kind: 'subscription.canceled'; eventId: string; gatewaySubscriptionId: string }
  | { kind: 'transfer.paid'; eventId: string; gatewayTransferId: string }
  | { kind: 'transfer.failed'; eventId: string; gatewayTransferId: string; reason?: string }
  | {
      kind: 'ignored';
      eventId: string;
      type: string;
      /** True when the adapter dropped the request before authenticating it (unhandled topic). */
      unverified?: boolean;
    };

export type WebhookHeaders = Record<string, string | string[] | undefined>;
export type WebhookQuery = Record<string, unknown>;

export class WebhookRejectedError extends Error {}

export interface PaymentGateway {
  readonly name: 'mock' | 'mercadopago';
  /** Whether createRecipient/createTransfer are implemented. Manual payout mode works regardless. */
  readonly supportsPayouts: boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;

  /** Makes sure the provider has a billable price for the plan; returns the provider's id for it. */
  syncPlan(plan: PlanLike): Promise<{ gatewayPlanId: string }>;
  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult>;
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;

  createRecipient(input: CreateRecipientInput): Promise<{ recipientId: string }>;
  createTransfer(input: TransferInput): Promise<TransferResult>;

  /**
   * Authenticates the request (signature / credentials) and normalizes the event.
   * Throws WebhookRejectedError when the request cannot be attributed to the provider.
   */
  parseWebhook(
    rawBody: Buffer,
    headers: WebhookHeaders,
    query?: WebhookQuery,
  ): Promise<NormalizedWebhookEvent>;

  /**
   * Optional: asks the provider for the current state of an order / subscription, used when a
   * webhook may have been lost. Returns the same normalized events a webhook would, or null when
   * the provider has nothing conclusive yet.
   */
  lookupOrder?(gatewayOrderId: string): Promise<NormalizedWebhookEvent | null>;

  /** Full refund of a paid charge. Safe to repeat for the same charge. */
  refundPayment?(chargeId: string): Promise<{ refundId: string }>;
  lookupSubscription?(gatewaySubscriptionId: string): Promise<NormalizedWebhookEvent | null>;
}
