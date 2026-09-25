import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WithdrawalsService } from '../finance/withdrawals.service';
import { CheckoutService } from '../orders/checkout.service';
import {
  NormalizedWebhookEvent,
  PAYMENT_GATEWAY,
  PaymentGateway,
  WebhookHeaders,
  WebhookRejectedError,
} from '../payments/gateway/payment-gateway.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly subscriptions: SubscriptionsService,
    private readonly withdrawals: WithdrawalsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async handle(rawBody: Buffer, headers: WebhookHeaders) {
    let event: NormalizedWebhookEvent;
    try {
      event = await this.gateway.parseWebhook(rawBody, headers);
    } catch (err) {
      if (err instanceof WebhookRejectedError) {
        this.logger.warn(`Webhook rejected: ${err.message}`);
        throw new UnauthorizedException('Webhook authentication failed');
      }
      throw err;
    }

    let payload: Prisma.InputJsonValue;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      payload = { raw: rawBody.toString('utf8').slice(0, 10_000) };
    }

    // Exactly-once: the unique (provider, eventId) index rejects replays.
    let record;
    try {
      record = await this.prisma.webhookEvent.create({
        data: { provider: this.gateway.name, eventId: event.eventId, type: event.kind, payload },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw err;
    }

    try {
      await this.dispatch(event);
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date() },
      });
      return { received: true, kind: event.kind };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Webhook ${event.kind} (${event.eventId}) failed: ${message}`);
      await this.prisma.webhookEvent.update({ where: { id: record.id }, data: { error: message } });
      // 200 with an error flag avoids endless provider retries for logic errors; failed events stay queryable.
      return { received: true, error: message };
    }
  }

  private async dispatch(event: NormalizedWebhookEvent) {
    switch (event.kind) {
      case 'order.paid':
        return this.checkout.markPaidByGatewayId(event.gatewayOrderId, {
          chargeId: event.chargeId,
          paymentMethod: event.paymentMethod,
        });
      case 'order.failed':
        return this.checkout.markFailedByGatewayId(event.gatewayOrderId, event.reason);
      case 'subscription.activated':
        return this.subscriptions.markActive(
          event.gatewaySubscriptionId,
          event.periodStart,
          event.periodEnd,
          event.newGatewaySubscriptionId,
        );
      case 'subscription.renewed':
        return this.subscriptions.markActive(
          event.gatewaySubscriptionId,
          event.periodStart,
          event.periodEnd,
        );
      case 'subscription.past_due':
        return this.subscriptions.markPastDue(event.gatewaySubscriptionId);
      case 'subscription.canceled':
        return this.subscriptions.markCanceled(event.gatewaySubscriptionId);
      case 'transfer.paid':
        return this.withdrawals.markTransferPaid(event.gatewayTransferId);
      case 'transfer.failed':
        return this.withdrawals.markTransferFailed(event.gatewayTransferId, event.reason);
      case 'ignored':
        this.logger.debug(`Ignoring webhook type ${event.type}`);
        return;
    }
  }
}
