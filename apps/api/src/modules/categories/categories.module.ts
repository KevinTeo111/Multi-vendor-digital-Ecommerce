import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController, CategoriesController } from './categories.controller';

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
