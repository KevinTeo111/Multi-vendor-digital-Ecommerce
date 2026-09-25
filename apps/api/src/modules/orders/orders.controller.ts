import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { AdminOrdersQuery, BuyerOrdersQuery, VendorSalesQuery } from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post('checkout')
  checkout(@CurrentUser('id') userId: string) {
    return this.checkoutService.checkout(userId);
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
  get(@CurrentUser('id') userId: string, @Param('id') id: string) {
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

  @Get(':itemId')
  get(@CurrentUser('vendorId') vendorId: string, @Param('itemId') itemId: string) {
    return this.orders.getSaleForVendor(vendorId, itemId);
  }
}

@Controller('admin/orders')
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: AdminOrdersQuery) {
    return this.orders.listForAdmin(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.getForAdmin(id);
  }
}
