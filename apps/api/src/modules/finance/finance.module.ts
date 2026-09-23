import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminFinanceController, VendorFinanceController } from './finance.controller';
import { LedgerService } from './ledger.service';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [VendorFinanceController, AdminFinanceController],
  providers: [LedgerService, WithdrawalsService],
  exports: [LedgerService, WithdrawalsService],
})
export class FinanceModule {}
