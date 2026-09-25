import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { AdminSubscriptionsQuery, SubscribeDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller('vendor/subscription')
@Roles(Role.VENDOR)
export class VendorSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  current(@CurrentUser('vendorId') vendorId: string) {
    return this.subscriptions.getCurrent(vendorId);
  }

  @Post()
  subscribe(@CurrentUser('vendorId') vendorId: string, @Body() dto: SubscribeDto) {
    return this.subscriptions.subscribe(vendorId, dto.planId);
  }

  @Delete()
  cancel(@CurrentUser() user: AuthUser) {
    return this.subscriptions.cancel(user.vendorId!, user.id);
  }
}

@Controller('admin/subscriptions')
@Roles(Role.ADMIN)
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Query() query: AdminSubscriptionsQuery) {
    return this.subscriptions.listForAdmin(query.vendorId);
  }
}
