import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminOrdersController, OrdersController, VendorSalesController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, SubscriptionsModule],
  controllers: [OrdersController, VendorSalesController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
