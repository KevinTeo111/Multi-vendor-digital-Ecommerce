import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminReviewsQuery,
  HideReviewDto,
  ReplyReviewDto,
  UpsertReviewDto,
} from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:slug/reviews')
  listForProduct(@Param('slug') slug: string, @Query() query: PaginationDto) {
    return this.reviews.listForProduct(slug, query);
  }

  /** Create or edit the review of one purchased item. */
  @Post('reviews')
  upsert(@CurrentUser('id') buyerId: string, @Body() dto: UpsertReviewDto) {
    return this.reviews.upsert(buyerId, dto.orderItemId, dto.rating, dto.comment);
  }
}

@Controller('vendor/reviews')
@Roles(Role.VENDOR)
export class VendorReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@CurrentUser('vendorId') vendorId: string, @Query() query: PaginationDto) {
    return this.reviews.listForVendor(vendorId, query);
  }

  @Post(':id/reply')
  reply(
    @CurrentUser('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviews.reply(vendorId, id, dto.reply);
  }
}

@Controller('admin/reviews')
@Roles(Role.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query() query: AdminReviewsQuery) {
    return this.reviews.listForAdmin(query, query.hidden);
  }

  @Patch(':id')
  setHidden(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: HideReviewDto,
  ) {
    return this.reviews.setHidden(adminId, id, dto.hidden);
  }
}
