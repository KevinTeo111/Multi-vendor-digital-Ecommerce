import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { AdminPlansController, PlansController } from './plans.controller';

@Module({
  controllers: [PlansController, AdminPlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
