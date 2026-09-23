import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { SubscriptionsService } from './subscriptions.service';

class SubscribeDto {
  @IsString()
  planId: string;

  /** Card token from the payment provider's client-side tokenization; required for paid plans on Pagar.me. */
  @IsOptional()
  @IsString()
  cardToken?: string;
}

class AdminListQuery {
  @IsOptional() @IsString() vendorId?: string;
}

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
    return this.subscriptions.subscribe(vendorId, dto.planId, dto.cardToken);
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
  list(@Query() query: AdminListQuery) {
    return this.subscriptions.listForAdmin(query.vendorId);
  }
}
