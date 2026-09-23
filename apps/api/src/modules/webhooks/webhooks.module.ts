import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [OrdersModule, SubscriptionsModule, FinanceModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
