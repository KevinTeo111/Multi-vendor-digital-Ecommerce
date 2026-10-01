import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { WriteThrottlerGuard } from './common/guards/write-throttler.guard';
import { DEFAULT_RATE_LIMIT, TOO_MANY_REQUESTS_MESSAGE } from './common/throttle';
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
import { JobsModule } from './modules/jobs/jobs.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { MailModule } from './modules/mail/mail.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // infrastructure (global)
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_RATE_LIMIT],
      errorMessage: TOO_MANY_REQUESTS_MESSAGE,
    }),
    PrismaModule,
    AuditModule,
    SettingsModule,
    StorageModule,
    PaymentsModule,
    RealtimeModule,
    MailModule,
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
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiting (writes only) runs first so floods are cut before any token or DB work.
    { provide: APP_GUARD, useClass: WriteThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
