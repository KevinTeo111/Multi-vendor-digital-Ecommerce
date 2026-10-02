import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { CouponCodeDto } from '../coupons/dto/coupon.dto';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import {
  AdminOrdersQuery,
  BuyerOrdersQuery,
  RefundOrderDto,
  VendorSalesQuery,
  VerifyPurchaseQuery,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post('checkout')
  checkout(@CurrentUser('id') userId: string, @Body() dto: CouponCodeDto) {
    return this.checkoutService.checkout(userId, dto.couponCode);
  }

  /** What the buyer would pay now (with an optional coupon); nothing is created. */
  @Post('checkout/preview')
  @HttpCode(200)
  preview(@CurrentUser('id') userId: string, @Body() dto: CouponCodeDto) {
    return this.checkoutService.preview(userId, dto.couponCode);
  }

  @Get('orders')
  list(@CurrentUser('id') userId: string, @Query() query: BuyerOrdersQuery) {
    return this.orders.listForBuyer(userId, query);
  }

  @Get('orders/library')
  library(@CurrentUser('id') userId: string) {
    return this.orders.libraryForBuyer(userId);
  }

  @Get('orders/:id')
  async get(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.checkoutService.reconcile(id, userId);
    return this.orders.getForBuyer(userId, id);
  }

  @Get('orders/items/:itemId/download')
  download(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.orders.downloadUrl(userId, itemId, undefined, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('orders/items/:itemId/files/:fileId/download')
  downloadFile(
    @CurrentUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
  ) {
    return this.orders.downloadUrl(userId, itemId, fileId, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

@Controller('vendor/sales')
@Roles(Role.VENDOR)
export class VendorSalesController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser('vendorId') vendorId: string, @Query() query: VendorSalesQuery) {
    return this.orders.listSalesForVendor(vendorId, query);
  }

  /** Checks a buyer's purchase code against this seller's sales. Declared before ':itemId'. */
  @Get('verify')
  verify(@CurrentUser('vendorId') vendorId: string, @Query() query: VerifyPurchaseQuery) {
    return this.orders.verifyPurchaseCode(vendorId, query.code);
  }

  @Get(':itemId')
  get(@CurrentUser('vendorId') vendorId: string, @Param('itemId') itemId: string) {
    return this.orders.getSaleForVendor(vendorId, itemId);
  }
}

@Controller('admin/orders')
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkout: CheckoutService,
  ) {}

  @Post(':id/refund')
  refund(@Param('id') id: string, @Body() dto: RefundOrderDto, @CurrentUser('id') adminId: string) {
    return this.checkout.refund(id, adminId, dto.reason.trim());
  }

  @Get()
  list(@Query() query: AdminOrdersQuery) {
    return this.orders.listForAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.getForAdmin(id);
  }
}
