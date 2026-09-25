import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { MockPaymentGateway } from './gateway/mock.gateway';
import { StripePaymentGateway } from './gateway/stripe.gateway';

/**
 * Exposes a single PAYMENT_GATEWAY provider chosen from configuration.
 * The rest of the application only ever depends on the PaymentGateway interface.
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () => (env.PAYMENT_GATEWAY === 'stripe' ? new StripePaymentGateway() : new MockPaymentGateway()),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
