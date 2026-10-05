import { Global, Module } from '@nestjs/common';
import { env } from '../../config/env';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway.interface';
import { MockPaymentGateway } from './gateway/mock.gateway';
import { MercadoPagoPaymentGateway } from './gateway/mercadopago.gateway';
import type { PaymentGateway } from './gateway/payment-gateway.interface';

function createGateway(): PaymentGateway {
  switch (env.PAYMENT_GATEWAY) {
    case 'mercadopago':
      return new MercadoPagoPaymentGateway();
    default:
      return new MockPaymentGateway();
  }
}

/**
 * Exposes a single PAYMENT_GATEWAY provider chosen from configuration.
 * The rest of the application only ever depends on the PaymentGateway interface.
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: createGateway,
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
