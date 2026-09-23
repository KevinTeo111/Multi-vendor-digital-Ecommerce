import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { MockPaymentGateway } from './gateway/mock.gateway';

/**
 * Exposes a single PAYMENT_GATEWAY provider chosen from configuration.
 * The Pagar.me implementation is registered here once it exists; the rest of
 * the application only ever depends on the PaymentGateway interface.
 */
@Global()
@Module({
  providers: [
    MockPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      inject: [MockPaymentGateway],
      useFactory: (mock: MockPaymentGateway) => {
        if (env.PAYMENT_GATEWAY === 'pagarme') {
          throw new Error('PAYMENT_GATEWAY=pagarme is not implemented yet; use mock');
        }
        return mock;
      },
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
