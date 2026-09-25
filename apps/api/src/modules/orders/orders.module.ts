import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CheckoutService } from './checkout.service';
import {
  AdminOrdersController,
  OrdersController,
  VendorSalesController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [CartModule, SubscriptionsModule],
  controllers: [OrdersController, VendorSalesController, AdminOrdersController],
  providers: [OrdersService, CheckoutService],
  exports: [OrdersService, CheckoutService],
})
export class OrdersModule {}
