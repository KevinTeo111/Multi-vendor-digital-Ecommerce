/**
 * Gateway abstraction. Everything that talks to Pagar.me (or any other provider)
 * lives behind this interface so the rest of the system never depends on a vendor SDK.
 * Amounts are integer cents.
 */

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

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
}

export interface CheckoutResult {
  gatewayOrderId: string;
  /** Hosted checkout page, when the provider offers one. */
  checkoutUrl?: string;
  status: 'pending' | 'paid' | 'failed';
}

export interface CreateSubscriptionInput {
  vendorId: string;
  planId: string;
  gatewayPlanId?: string | null;
  planName: string;
  priceCents: number;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  customer: GatewayCustomer;
}

export interface SubscriptionResult {
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
  | { kind: 'order.paid'; eventId: string; gatewayOrderId: string; chargeId?: string; paymentMethod?: string }
  | { kind: 'order.failed'; eventId: string; gatewayOrderId: string; reason?: string }
  | { kind: 'subscription.activated'; eventId: string; gatewaySubscriptionId: string; periodStart?: Date; periodEnd?: Date }
  | { kind: 'subscription.renewed'; eventId: string; gatewaySubscriptionId: string; periodStart?: Date; periodEnd?: Date }
  | { kind: 'subscription.past_due'; eventId: string; gatewaySubscriptionId: string }
  | { kind: 'subscription.canceled'; eventId: string; gatewaySubscriptionId: string }
  | { kind: 'transfer.paid'; eventId: string; gatewayTransferId: string }
  | { kind: 'transfer.failed'; eventId: string; gatewayTransferId: string; reason?: string }
  | { kind: 'ignored'; eventId: string; type: string };

export interface PaymentGateway {
  readonly name: 'mock' | 'pagarme';

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;

  createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult>;
  cancelSubscription(gatewaySubscriptionId: string): Promise<void>;

  createRecipient(input: CreateRecipientInput): Promise<{ recipientId: string }>;
  createTransfer(input: TransferInput): Promise<TransferResult>;

  /** Returns false when the signature does not match; the caller must reject the request. */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  parseWebhook(payload: unknown): NormalizedWebhookEvent;
}
