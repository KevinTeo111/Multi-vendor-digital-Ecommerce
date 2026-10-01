import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [OrdersModule, SubscriptionsModule],
  providers: [JobsService],
})
export class JobsModule {}
