import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WithdrawalsService } from '../finance/withdrawals.service';
import { OrdersService } from '../orders/orders.service';
import { NormalizedWebhookEvent, PAYMENT_GATEWAY, PaymentGateway, WebhookHeaders } from '../payments/gateway/payment-gateway.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly withdrawals: WithdrawalsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  verify(rawBody: Buffer, headers: WebhookHeaders) {
    return this.gateway.verifyWebhook(rawBody, headers);
  }

  async handle(payload: unknown) {
    const event = this.gateway.parseWebhook(payload);

    // Exactly-once: the unique (provider, eventId) index rejects replays.
    let record;
    try {
      record = await this.prisma.webhookEvent.create({
        data: {
          provider: this.gateway.name,
          eventId: event.eventId,
          type: event.kind,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw err;
    }

    try {
      await this.dispatch(event);
      await this.prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date() } });
      return { received: true };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Webhook ${event.kind} (${event.eventId}) failed: ${message}`);
      await this.prisma.webhookEvent.update({ where: { id: record.id }, data: { error: message } });
      // Returning 200 with an error flag avoids endless provider retries for logic errors;
      // failed events remain queryable for manual replay.
      return { received: true, error: message };
    }
  }

  private async dispatch(event: NormalizedWebhookEvent) {
    switch (event.kind) {
      case 'order.paid':
        return this.orders.markPaidByGatewayId(event.gatewayOrderId, {
          chargeId: event.chargeId,
          paymentMethod: event.paymentMethod,
        });
      case 'order.failed':
        return this.orders.markFailedByGatewayId(event.gatewayOrderId, event.reason);
      case 'subscription.activated':
      case 'subscription.renewed':
        return this.subscriptions.markActive(event.gatewaySubscriptionId, event.periodStart, event.periodEnd);
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
