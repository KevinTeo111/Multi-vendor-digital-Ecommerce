import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CheckoutResult,
  CreateCheckoutInput,
  CreateRecipientInput,
  CreateSubscriptionInput,
  NormalizedWebhookEvent,
  PaymentGateway,
  PlanLike,
  SubscriptionResult,
  TransferInput,
  TransferResult,
} from './payment-gateway.interface';

/**
 * Development gateway: every operation succeeds immediately, nothing leaves the process.
 * Webhooks can be simulated by POSTing { id, type: 'order.paid' | ..., data: { ... } }.
 */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock' as const;
  readonly supportsPayouts = true;
  private readonly logger = new Logger(MockPaymentGateway.name);

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    this.logger.debug(`Mock checkout for order ${input.orderNumber} (${input.amountCents} cents)`);
    return { gatewayOrderId: `mock_or_${randomUUID()}`, status: 'paid' };
  }

  async syncPlan(plan: PlanLike) {
    return { gatewayPlanId: plan.gatewayPlanId ?? `mock_price_${plan.id}` };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    const start = new Date();
    const end = new Date(start);
    if (input.plan.interval === 'YEAR') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return { gatewaySubscriptionId: `mock_sub_${randomUUID()}`, status: 'active', currentPeriodStart: start, currentPeriodEnd: end };
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

  async parseWebhook(rawBody: Buffer): Promise<NormalizedWebhookEvent> {
    let payload: { id?: string; type?: string; data?: Record<string, unknown> } = {};
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      payload = {};
    }
    const eventId = payload.id ?? randomUUID();
    const data = payload.data ?? {};
    const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);

    switch (payload.type) {
      case 'order.paid':
        return { kind: 'order.paid', eventId, gatewayOrderId: str('gatewayOrderId') ?? '', chargeId: str('chargeId') };
      case 'order.failed':
        return { kind: 'order.failed', eventId, gatewayOrderId: str('gatewayOrderId') ?? '', reason: str('reason') };
      case 'subscription.activated':
        return { kind: 'subscription.activated', eventId, gatewaySubscriptionId: str('gatewaySubscriptionId') ?? '' };
      case 'subscription.renewed':
        return { kind: 'subscription.renewed', eventId, gatewaySubscriptionId: str('gatewaySubscriptionId') ?? '' };
      case 'subscription.past_due':
      case 'subscription.canceled':
        return { kind: payload.type, eventId, gatewaySubscriptionId: str('gatewaySubscriptionId') ?? '' };
      case 'transfer.paid':
        return { kind: 'transfer.paid', eventId, gatewayTransferId: str('gatewayTransferId') ?? '' };
      case 'transfer.failed':
        return { kind: 'transfer.failed', eventId, gatewayTransferId: str('gatewayTransferId') ?? '', reason: str('reason') };
      default:
        return { kind: 'ignored', eventId, type: payload.type ?? 'unknown' };
    }
  }
}
