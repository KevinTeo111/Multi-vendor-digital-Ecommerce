import { Module } from '@nestjs/common';
import { AdminCouponsController, VendorCouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [AdminCouponsController, VendorCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
