import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ProductFilesService } from './product-files.service';
import { AdminProductsController, ProductsController, VendorProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [ProductsController, VendorProductsController, AdminProductsController],
  providers: [ProductsService, ProductFilesService],
  exports: [ProductsService],
})
export class ProductsModule {}
