import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlansModule } from './modules/plans/plans.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { AuditModule } from './modules/audit/audit.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StorageModule } from './modules/storage/storage.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // infrastructure (global)
    PrismaModule,
    AuditModule,
    SettingsModule,
    StorageModule,
    PaymentsModule,
    RealtimeModule,
    // domain
    AuthModule,
    UsersModule,
    PlansModule,
    VendorsModule,
    CategoriesModule,
    SubscriptionsModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    FinanceModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
