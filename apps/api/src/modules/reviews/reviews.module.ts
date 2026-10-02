import { Module } from '@nestjs/common';
import {
  AdminReviewsController,
  ReviewsController,
  VendorReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController, VendorReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
