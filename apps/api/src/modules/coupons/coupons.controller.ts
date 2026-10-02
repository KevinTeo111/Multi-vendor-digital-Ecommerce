import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

/** Platform coupons: the platform absorbs the discount. */
@Controller('admin/coupons')
@Roles(Role.ADMIN)
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list(null);
  }

  @Post()
  create(@Body() dto: CreateCouponDto, @CurrentUser('id') actorId: string) {
    return this.coupons.create(null, actorId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.coupons.update(null, actorId, id, dto);
  }
}

/** Seller coupons: only for the seller's own products, and the seller absorbs the discount. */
@Controller('vendor/coupons')
@Roles(Role.VENDOR)
export class VendorCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@CurrentUser('vendorId') vendorId: string) {
    return this.coupons.list(vendorId);
  }

  @Post()
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: AuthUser) {
    return this.coupons.create(user.vendorId!, user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto, @CurrentUser() user: AuthUser) {
    return this.coupons.update(user.vendorId!, user.id, id, dto);
  }
}
