import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { AdminVendorsController, VendorsController } from './vendors.controller';

@Module({
  controllers: [VendorsController, AdminVendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
