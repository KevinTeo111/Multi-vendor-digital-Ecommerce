import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsService } from './subscriptions.service';
import { AdminSubscriptionsController, VendorSubscriptionController } from './subscriptions.controller';

@Module({
  imports: [PlansModule],
  controllers: [VendorSubscriptionController, AdminSubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
