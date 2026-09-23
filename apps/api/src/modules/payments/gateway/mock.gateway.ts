import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CheckoutResult,
  CreateCheckoutInput,
  CreateRecipientInput,
  CreateSubscriptionInput,
  NormalizedWebhookEvent,
  PaymentGateway,
  SubscriptionResult,
  TransferInput,
  TransferResult,
} from './payment-gateway.interface';

/**
 * Development gateway: every operation succeeds immediately.
 * Webhooks can be simulated by POSTing a payload of the shape
 * { id, type: 'order.paid' | ..., data: { ... } } to the webhook endpoint.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock' as const;
  private readonly logger = new Logger(MockPaymentGateway.name);

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    this.logger.debug(`Mock checkout for order ${input.orderNumber} (${input.amountCents} cents)`);
    return { gatewayOrderId: `mock_or_${randomUUID()}`, status: 'paid' };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    const start = new Date();
    const end = new Date(start);
    if (input.interval === 'YEAR') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return {
      gatewaySubscriptionId: `mock_sub_${randomUUID()}`,
      status: 'active',
      currentPeriodStart: start,
      currentPeriodEnd: end,
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    this.logger.debug(`Mock cancel subscription ${gatewaySubscriptionId}`);
  }

  async createRecipient(input: CreateRecipientInput) {
    return { recipientId: `mock_rp_${input.vendorId}` };
  }

  async createTransfer(input: TransferInput): Promise<TransferResult> {
    this.logger.debug(`Mock transfer ${input.amountCents} cents to ${input.recipientId}`);
    return { gatewayTransferId: `mock_tr_${randomUUID()}`, status: 'paid' };
  }

  verifyWebhookSignature(): boolean {
    return true;
  }

  parseWebhook(payload: unknown): NormalizedWebhookEvent {
    const p = (payload ?? {}) as { id?: string; type?: string; data?: Record<string, unknown> };
    const eventId = p.id ?? randomUUID();
    const data = p.data ?? {};
    const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);

    switch (p.type) {
      case 'order.paid':
        return { kind: 'order.paid', eventId, gatewayOrderId: str('gatewayOrderId') ?? '', chargeId: str('chargeId') };
      case 'order.failed':
        return { kind: 'order.failed', eventId, gatewayOrderId: str('gatewayOrderId') ?? '', reason: str('reason') };
      case 'subscription.activated':
      case 'subscription.renewed':
        return { kind: p.type, eventId, gatewaySubscriptionId: str('gatewaySubscriptionId') ?? '' };
      case 'subscription.past_due':
      case 'subscription.canceled':
        return { kind: p.type, eventId, gatewaySubscriptionId: str('gatewaySubscriptionId') ?? '' };
      case 'transfer.paid':
        return { kind: 'transfer.paid', eventId, gatewayTransferId: str('gatewayTransferId') ?? '' };
      case 'transfer.failed':
        return { kind: 'transfer.failed', eventId, gatewayTransferId: str('gatewayTransferId') ?? '', reason: str('reason') };
      default:
        return { kind: 'ignored', eventId, type: p.type ?? 'unknown' };
    }
  }
}
